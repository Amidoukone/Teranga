'use strict';

const {
  Region,
  Country,
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
const logger = require('../utils/logger');

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

async function findRegionUsage(regionId) {
  const checks = [
    { model: User, label: 'utilisateurs', field: 'regionId' },
    { model: Franchise, label: 'franchises', field: 'regionId' },
    { model: Property, label: 'biens', field: 'regionId' },
    { model: Service, label: 'services', field: 'regionId' },
    { model: Transaction, label: 'transactions', field: 'regionId' },
    { model: Product, label: 'produits', field: 'regionId' },
    { model: Task, label: 'tâches', field: 'regionId' },
    { model: Project, label: 'projets', field: 'regionId' },
    { model: Evidence, label: 'preuves', field: 'regionId' },
    { model: Order, label: 'commandes', field: 'regionId' },
  ];

  const results = await Promise.all(
    checks.map(async ({ model, label, field }) => {
      if (!model?.count) return { label, count: 0 };
      const count = await model.count({ where: { [field]: regionId } });
      return { label, count };
    })
  );

  return results.find((result) => result.count > 0) || null;
}

/* ======================================================
   📋 LIST
   - Public : OK
   - Admin : ?includeInactive=true inclut régions inactives
   - Filtre : ?countryId=...
   - Optionnel : ?includeCountry=true => include Country
====================================================== */
exports.list = async (req, res) => {
  try {
    const countryId = toSafeInt(req.query?.countryId ?? req.query?.country_id);

    const includeInactive =
      isGlobalAdmin(req.user) && String(req.query?.includeInactive) === 'true';

    const includeCountry = String(req.query?.includeCountry) === 'true';

    const where = {};
    if (!includeInactive) where.isActive = true;
    if (countryId) where.countryId = countryId;

    if (req.user?.role === 'admin' && !isGlobalAdmin(req.user)) {
      const { countryId: scopedCountryId, regionId: scopedRegionId } =
        getUserGeoScope(req.user);

      if (scopedRegionId) {
        where.id = scopedRegionId;
      } else if (scopedCountryId) {
        where.countryId = scopedCountryId;
      } else {
        where.id = 0;
      }
    }

    const rows = await Region.findAll({
      where,
      order: [['name', 'ASC']],
      include: includeCountry
        ? [{ model: Country, as: 'country', attributes: ['id', 'name', 'isoCode'] }]
        : undefined,
    });

    return res.json({ regions: rows });
  } catch (e) {
    logger.error('❌ list regions:', e);
    return res
      .status(500)
      .json({ error: 'Erreur lors de la récupération des régions' });
  }
};

/* ======================================================
   ➕ CREATE (admin)
====================================================== */
exports.create = async (req, res) => {
  try {
    if (!requireGlobalAdmin(req, res)) return;

    const { countryId, country_id, name, code, isActive } = req.body || {};

    const cid = toSafeInt(countryId ?? country_id);
    if (!cid) return res.status(400).json({ error: 'countryId requis' });

    const country = await Country.findByPk(cid);
    if (!country) return res.status(400).json({ error: 'Pays introuvable' });

    const trimmedName = toTrimOrNull(name);
    if (!trimmedName) return res.status(400).json({ error: 'name requis' });

    const trimmedCodeRaw = toTrimOrNull(code);
    const normalizedCode = trimmedCodeRaw ? trimmedCodeRaw.toUpperCase() : null;

    const created = await Region.create({
      countryId: cid,
      name: trimmedName,
      code: normalizedCode,
      isActive: isActive === undefined ? true : Boolean(isActive),
    });

    // (optionnel) renvoi enrichi avec Country si utile pour admin panel
    const withCountry = await Region.findByPk(created.id, {
      include: [{ model: Country, as: 'country', attributes: ['id', 'name', 'isoCode'] }],
    });

    return res.status(201).json({ region: withCountry || created });
  } catch (e) {
    logger.error('❌ create region:', e);
    return res
      .status(500)
      .json({ error: 'Erreur lors de la création de la région' });
  }
};

/* ======================================================
   ✏️ UPDATE (admin)
   - countryId non modifiable (anti incohérence)
====================================================== */
exports.update = async (req, res) => {
  try {
    if (!requireGlobalAdmin(req, res)) return;

    const id = toSafeInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalide' });

    const region = await Region.findByPk(id);
    if (!region) return res.status(404).json({ error: 'Région introuvable' });

    // ✅ Sécurité : empêcher mutation countryId
    if (req.body?.countryId !== undefined || req.body?.country_id !== undefined) {
      return res.status(400).json({
        error: 'countryId ne peut pas être modifié (crée une région dans le bon pays)',
      });
    }

    const { name, code, isActive } = req.body || {};

    if (name !== undefined) {
      region.name = toTrimOrNull(name) || region.name;
    }

    if (code !== undefined) {
      const trimmedCodeRaw = toTrimOrNull(code);
      region.code = trimmedCodeRaw ? trimmedCodeRaw.toUpperCase() : null;
    }

    if (isActive !== undefined) {
      region.isActive = Boolean(isActive);
    }

    await region.save();

    const withCountry = await Region.findByPk(region.id, {
      include: [{ model: Country, as: 'country', attributes: ['id', 'name', 'isoCode'] }],
    });

    return res.json({ region: withCountry || region });
  } catch (e) {
    logger.error('❌ update region:', e);
    return res
      .status(500)
      .json({ error: 'Erreur lors de la mise à jour de la région' });
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

    const region = await Region.findByPk(id);
    if (!region) return res.status(404).json({ error: 'Région introuvable' });

    const usage = await findRegionUsage(id);
    if (usage) {
      return res.status(409).json({
        error: `Suppression impossible : cette région possède encore des ${usage.label}.`,
      });
    }

    await region.destroy();

    return res.json({ success: true });
  } catch (e) {
    logger.error('❌ delete region:', e);
    return res
      .status(500)
      .json({ error: 'Erreur lors de la suppression de la région' });
  }
};
