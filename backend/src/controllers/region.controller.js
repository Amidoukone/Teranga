'use strict';

const { Region, Country } = require('../../models');
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
    console.error('❌ list regions:', e);
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
    console.error('❌ create region:', e);
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
    console.error('❌ update region:', e);
    return res
      .status(500)
      .json({ error: 'Erreur lors de la mise à jour de la région' });
  }
};
