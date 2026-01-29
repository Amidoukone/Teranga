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
} = require('../../models');
const { getUserGeoScope, isGlobalAdmin } = require('../utils/geoScope');

/* ======================================================
   🧩 Helpers
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

async function findCountryUsage(countryId) {
  const checks = [
    { model: Region, label: 'régions', field: 'countryId' },
    { model: User, label: 'utilisateurs', field: 'countryId' },
    { model: Franchise, label: 'franchises', field: 'countryId' },
    { model: Property, label: 'biens', field: 'countryId' },
    { model: Service, label: 'services', field: 'countryId' },
    { model: Transaction, label: 'transactions', field: 'countryId' },
    { model: Product, label: 'produits', field: 'countryId' },
    { model: Task, label: 'tâches', field: 'countryId' },
    { model: Project, label: 'projets', field: 'countryId' },
    { model: Evidence, label: 'preuves', field: 'countryId' },
    { model: Order, label: 'commandes', field: 'countryId' },
  ];

  const results = await Promise.all(
    checks.map(async ({ model, label, field }) => {
      if (!model?.count) return { label, count: 0 };
      const count = await model.count({ where: { [field]: countryId } });
      return { label, count };
    })
  );

  return results.find((result) => result.count > 0) || null;
}

/* ======================================================
   📋 LIST
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
    console.error('❌ list countries:', e);
    return res
      .status(500)
      .json({ error: 'Erreur lors de la récupération des pays' });
  }
};

/* ======================================================
   ➕ CREATE (admin)
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

    // ✅ Pré-check anti doublon (meilleur message utilisateur)
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
    // ✅ Erreur unique constraint (sécurité supplémentaire)
    if (e?.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        error: "Ce code ISO existe déjà (contrainte d'unicité)",
      });
    }

    console.error('❌ create country:', e);
    return res.status(500).json({ error: 'Erreur lors de la création du pays' });
  }
};

/* ======================================================
   ✏️ UPDATE (admin)
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

      // ✅ Empêcher collision si isoCode changé
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

    console.error('❌ update country:', e);
    return res
      .status(500)
      .json({ error: 'Erreur lors de la mise à jour du pays' });
  }
};

/* ======================================================
   🗑️ DELETE (admin)
====================================================== */
exports.remove = async (req, res) => {
  try {
    if (!requireGlobalAdmin(req, res)) return;

    const id = toSafeInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalide' });

    const country = await Country.findByPk(id);
    if (!country) return res.status(404).json({ error: 'Pays introuvable' });

    const usage = await findCountryUsage(id);
    if (usage) {
      return res.status(409).json({
        error: `Suppression impossible : ce pays possède encore des ${usage.label}.`,
      });
    }

    await country.destroy();

    return res.json({ success: true });
  } catch (e) {
    console.error('❌ delete country:', e);
    return res
      .status(500)
      .json({ error: 'Erreur lors de la suppression du pays' });
  }
};
