'use strict';

const {
  Country,
  Region,
  User,
  Franchise,
  Property,
  Service,
  Transaction,
  Product,
  Task,
  Project,
  Evidence,
  Order,
  Activity,
  Notification,
  OrderItem,
  ProjectPhase,
  ProjectDocument,
  sequelize,
} = require('../../models');
const { Op } = require('sequelize');
const { getUserGeoScope, isGlobalAdmin } = require('../utils/geoScope');
const logger = require('../utils/logger');

/* ======================================================
   Helpers
====================================================== */
function toSafeInt(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}

function toTrimOrNull(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function requireGlobalAdmin(req, res) {
  if (!req.user?.role) {
    res.status(401).json({ error: 'Non authentifié' });
    return false;
  }
  if (req.user.role !== 'admin' || !isGlobalAdmin(req.user)) {
    res.status(403).json({ error: 'Accès réservé à un administrateur global' });
    return false;
  }
  return true;
}

function toIntIds(rows) {
  return (rows || [])
    .map((row) => toSafeInt(row?.id))
    .filter((id) => Number.isInteger(id) && id > 0);
}

function buildCountryCascadeWhere(countryId, regionIds) {
  const clauses = [{ countryId }];
  if (regionIds.length) {
    clauses.push({ regionId: { [Op.in]: regionIds } });
  }

  if (clauses.length === 1) return clauses[0];
  return { [Op.or]: clauses };
}

async function cascadeDeleteCountry(country, transaction) {
  const regions = await Region.findAll({
    where: { countryId: country.id },
    attributes: ['id'],
    transaction,
  });
  const regionIds = toIntIds(regions);
  const where = buildCountryCascadeWhere(country.id, regionIds);

  const [orders, projects] = await Promise.all([
    Order.findAll({
      where,
      attributes: ['id'],
      transaction,
    }),
    Project.findAll({
      where,
      attributes: ['id'],
      transaction,
    }),
  ]);

  const orderIds = toIntIds(orders);
  const projectIds = toIntIds(projects);

  if (orderIds.length) {
    await OrderItem.destroy({
      where: { orderId: { [Op.in]: orderIds } },
      transaction,
    });
  }

  if (projectIds.length) {
    await ProjectDocument.destroy({
      where: { projectId: { [Op.in]: projectIds } },
      transaction,
    });
    await ProjectPhase.destroy({
      where: { projectId: { [Op.in]: projectIds } },
      transaction,
    });
  }

  await Evidence.destroy({ where, transaction });
  await Transaction.destroy({ where, transaction });
  await Activity.destroy({ where, transaction });
  await Notification.destroy({ where, transaction });
  await Task.destroy({ where, transaction });
  await Service.destroy({ where, transaction });
  await Product.destroy({ where, transaction });
  await Property.destroy({ where, transaction });
  await Project.destroy({ where, transaction });
  await Order.destroy({ where, transaction });
  await Franchise.destroy({ where, transaction });

  await User.update(
    { countryId: null, regionId: null, country: null },
    { where, transaction }
  );

  await Region.destroy({
    where: { countryId: country.id },
    transaction,
  });

  await country.destroy({ transaction });
}

/* ======================================================
   LIST
   - Public (ou tous rôles)
   - Par défaut : pays actifs uniquement
   - Admin : ?includeInactive=true -> inclut inactifs
====================================================== */
exports.list = async (req, res) => {
  try {
    const includeInactive =
      isGlobalAdmin(req.user) && String(req.query?.includeInactive) === 'true';

    const where = includeInactive ? {} : { isActive: true };

    if (req.user?.role === 'admin' && !isGlobalAdmin(req.user)) {
      const { countryId, regionId } = getUserGeoScope(req.user);
      let scopedCountryId = countryId;

      if (!scopedCountryId && regionId) {
        const region = await Region.findByPk(regionId, {
          attributes: ['id', 'countryId'],
        });
        scopedCountryId = region?.countryId ?? null;
      }

      if (scopedCountryId) {
        where.id = scopedCountryId;
      } else {
        where.id = 0;
      }
    }

    const rows = await Country.findAll({
      where,
      order: [['name', 'ASC']],
    });

    return res.json({ countries: rows });
  } catch (e) {
    logger.error('list countries:', e);
    return res
      .status(500)
      .json({ error: 'Erreur lors de la récupération des pays' });
  }
};

/* ======================================================
   CREATE (admin)
====================================================== */
exports.create = async (req, res) => {
  try {
    if (!requireGlobalAdmin(req, res)) return;

    const { name, isoCode, currency, defaultLanguage, isActive } = req.body || {};

    const trimmedName = toTrimOrNull(name);
    const trimmedIso = toTrimOrNull(isoCode);

    if (!trimmedName || !trimmedIso || trimmedIso.length !== 2) {
      return res
        .status(400)
        .json({ error: 'name et isoCode (2 lettres) requis' });
    }

    const iso = trimmedIso.toUpperCase();

    // Pré-check anti doublon (meilleur message utilisateur)
    const existing = await Country.findOne({ where: { isoCode: iso } });
    if (existing) {
      return res.status(409).json({
        error: `Un pays avec isoCode "${iso}" existe déjà`,
      });
    }

    const created = await Country.create({
      name: trimmedName,
      isoCode: iso,
      currency: toTrimOrNull(currency) || 'XOF',
      defaultLanguage: toTrimOrNull(defaultLanguage) || 'fr',
      isActive: isActive === undefined ? true : Boolean(isActive),
    });

    return res.status(201).json({ country: created });
  } catch (e) {
    // Erreur unique constraint (sécurité supplémentaire)
    if (e?.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        error: "Ce code ISO existe déjà (contrainte d'unicité)",
      });
    }

    logger.error('create country:', e);
    return res.status(500).json({ error: 'Erreur lors de la création du pays' });
  }
};

/* ======================================================
   UPDATE (admin)
====================================================== */
exports.update = async (req, res) => {
  try {
    if (!requireGlobalAdmin(req, res)) return;

    const id = toSafeInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalide' });

    const country = await Country.findByPk(id);
    if (!country) return res.status(404).json({ error: 'Pays introuvable' });

    const { name, isoCode, currency, defaultLanguage, isActive } = req.body || {};

    if (name !== undefined) {
      country.name = toTrimOrNull(name) || country.name;
    }

    if (isoCode !== undefined) {
      const trimmedIso = toTrimOrNull(isoCode);
      if (!trimmedIso || trimmedIso.length !== 2) {
        return res.status(400).json({ error: 'isoCode invalide' });
      }

      const iso = trimmedIso.toUpperCase();

      // Empêcher collision si isoCode changé
      if (iso !== country.isoCode) {
        const existing = await Country.findOne({ where: { isoCode: iso } });
        if (existing) {
          return res.status(409).json({
            error: `Un pays avec isoCode "${iso}" existe déjà`,
          });
        }
      }

      country.isoCode = iso;
    }

    if (currency !== undefined) {
      country.currency = toTrimOrNull(currency) || country.currency;
    }

    if (defaultLanguage !== undefined) {
      country.defaultLanguage =
        toTrimOrNull(defaultLanguage) || country.defaultLanguage;
    }

    if (isActive !== undefined) {
      country.isActive = Boolean(isActive);
    }

    await country.save();

    return res.json({ country });
  } catch (e) {
    if (e?.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        error: "Ce code ISO existe déjà (contrainte d'unicité)",
      });
    }

    logger.error('update country:', e);
    return res
      .status(500)
      .json({ error: 'Erreur lors de la mise à jour du pays' });
  }
};

/* ======================================================
   DELETE (admin)
====================================================== */
exports.remove = async (req, res) => {
  try {
    if (!requireGlobalAdmin(req, res)) return;

    const id = toSafeInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalide' });

    const country = await Country.findByPk(id);
    if (!country) return res.status(404).json({ error: 'Pays introuvable' });

    await sequelize.transaction(async (transaction) => {
      await cascadeDeleteCountry(country, transaction);
    });

    return res.json({ success: true });
  } catch (e) {
    logger.error('delete country:', e);
    return res
      .status(500)
      .json({ error: 'Erreur lors de la suppression du pays' });
  }
};
