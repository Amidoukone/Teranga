'use strict';

const { Op } = require('sequelize');
const { Franchise, Country, Region, User } = require('../../models');
const { getUserGeoScope, isGlobalAdmin, canAccessGeoResource } = require('../utils/geoScope');
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

function requireAdmin(req, res) {
  if (!req.user?.role) {
    res.status(401).json({ error: 'Non authentifié' });
    return false;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Accès réservé à un administrateur' });
    return false;
  }
  return true;
}

const ALLOWED_TYPES = new Set(['MASTER', 'REGIONAL']);
const ALLOWED_STATUS = new Set(['active', 'inactive', 'pending']);

/* ======================================================
   📋 LIST
   - Lecture : OK (admin/agent/client)
   - Filtres : countryId / regionId
====================================================== */
exports.list = async (req, res) => {
  try {
    const countryId = toSafeInt(req.query?.countryId ?? req.query?.country_id);
    const regionId = toSafeInt(req.query?.regionId ?? req.query?.region_id);

    const where = {};
    if (countryId) where.countryId = countryId;
    if (regionId) where.regionId = regionId;

    if (req.user?.role === 'admin' && !isGlobalAdmin(req.user)) {
      const { countryId: scopedCountryId, regionId: scopedRegionId } =
        getUserGeoScope(req.user);

      if (scopedRegionId) {
        where.regionId = scopedRegionId;
      } else if (scopedCountryId) {
        where.countryId = scopedCountryId;
      } else {
        where.id = 0;
      }
    }

    const rows = await Franchise.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [
        { model: Country, as: 'country', attributes: ['id', 'name', 'isoCode'] },
        { model: Region, as: 'region', attributes: ['id', 'name', 'code', 'countryId'] },
      ],
    });

    return res.json({ franchises: rows });
  } catch (e) {
    logger.error('❌ list franchises:', e);
    return res
      .status(500)
      .json({ error: 'Erreur lors de la récupération des franchises' });
  }
};

exports.listMasterCountries = async (req, res) => {
  try {
    const franchiseMasters = await Franchise.findAll({
      where: {
        type: 'MASTER',
        status: 'active',
      },
      attributes: ['countryId'],
    });

    const scopedAdmins = await User.findAll({
      where: {
        role: 'admin',
        [Op.or]: [{ countryId: { [Op.not]: null } }, { regionId: { [Op.not]: null } }],
      },
      attributes: ['countryId', 'regionId'],
    });

    const countryIdSet = new Set();
    const orphanRegionIds = [];

    for (const item of franchiseMasters) {
      const cid = toSafeInt(item?.countryId);
      if (cid) countryIdSet.add(cid);
    }

    for (const admin of scopedAdmins) {
      const cid = toSafeInt(admin?.countryId);
      if (cid) {
        countryIdSet.add(cid);
        continue;
      }
      const rid = toSafeInt(admin?.regionId);
      if (rid) orphanRegionIds.push(rid);
    }

    if (orphanRegionIds.length) {
      const regions = await Region.findAll({
        where: { id: { [Op.in]: orphanRegionIds } },
        attributes: ['countryId'],
      });
      for (const region of regions) {
        const cid = toSafeInt(region?.countryId);
        if (cid) countryIdSet.add(cid);
      }
    }

    if (!countryIdSet.size) {
      return res.json({ countries: [] });
    }

    const countries = await Country.findAll({
      where: {
        id: { [Op.in]: Array.from(countryIdSet) },
        isActive: true,
      },
      attributes: ['id', 'name', 'isoCode'],
      order: [['name', 'ASC']],
    });

    const uniqueByIso = new Map();
    for (const country of countries) {
      const iso = String(country?.isoCode || '').toUpperCase();
      if (!iso || uniqueByIso.has(iso)) continue;
      uniqueByIso.set(iso, {
        id: country.id,
        name: country.name,
        isoCode: iso,
      });
    }

    return res.json({ countries: Array.from(uniqueByIso.values()) });
  } catch (e) {
    logger.error('❌ list master countries:', e);
    return res
      .status(500)
      .json({ error: 'Erreur lors de la récupération des pays disponibles' });
  }
};

/* ======================================================
   ➕ CREATE (admin)
====================================================== */
exports.create = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const {
      type,
      countryId,
      country_id,
      regionId,
      region_id,
      legalName,
      status,
    } = req.body || {};

    const trimmedType = toTrimOrNull(type);
    if (!trimmedType || !ALLOWED_TYPES.has(trimmedType)) {
      return res.status(400).json({ error: 'type invalide (MASTER/REGIONAL)' });
    }

    const cid = toSafeInt(countryId ?? country_id);
    if (!cid) return res.status(400).json({ error: 'countryId requis' });

    if (req.user?.role === 'admin' && !isGlobalAdmin(req.user)) {
      const { countryId: scopedCountryId, regionId: scopedRegionId } =
        getUserGeoScope(req.user);

      if (scopedRegionId) {
        const rid = toSafeInt(regionId ?? region_id);
        if (!rid || String(rid) !== String(scopedRegionId)) {
          return res.status(403).json({
            error: 'Accès interdit hors de votre région.',
          });
        }
        if (scopedCountryId && String(cid) !== String(scopedCountryId)) {
          return res.status(403).json({
            error: 'Accès interdit hors de votre pays.',
          });
        }
      } else if (scopedCountryId && String(cid) !== String(scopedCountryId)) {
        return res.status(403).json({
          error: 'Accès interdit hors de votre pays.',
        });
      }
    }

    const country = await Country.findByPk(cid);
    if (!country) return res.status(400).json({ error: 'Pays introuvable' });

    const rid = toSafeInt(regionId ?? region_id);

    // ✅ Règles type
    if (trimmedType === 'REGIONAL' && !rid) {
      return res
        .status(400)
        .json({ error: 'regionId requis pour un franchisé régional' });
    }
    if (trimmedType === 'MASTER' && rid) {
      return res
        .status(400)
        .json({ error: 'regionId doit être null pour un franchisé MASTER' });
    }

    // ✅ Vérif region si fournie + cohérence country
    if (rid) {
      const region = await Region.findByPk(rid);
      if (!region) return res.status(400).json({ error: 'Région introuvable' });

      // IMPORTANT : Région doit appartenir au pays
      const regionCountryId = region.countryId ?? region.country_id;
      if (String(regionCountryId) !== String(cid)) {
        return res.status(400).json({
          error: "La région ne correspond pas au pays (countryId incohérent)",
        });
      }
    }

    const trimmedLegalName = toTrimOrNull(legalName);
    if (!trimmedLegalName) {
      return res.status(400).json({ error: 'legalName requis' });
    }

    const trimmedStatus = toTrimOrNull(status);
    const finalStatus =
      trimmedStatus && ALLOWED_STATUS.has(trimmedStatus)
        ? trimmedStatus
        : 'active';

    const created = await Franchise.create({
      type: trimmedType,
      countryId: cid,
      regionId: rid || null,
      legalName: trimmedLegalName,
      status: finalStatus,
    });

    // (optionnel) renvoyer avec include pour frontend/admin panel
    const withIncludes = await Franchise.findByPk(created.id, {
      include: [
        { model: Country, as: 'country', attributes: ['id', 'name', 'isoCode'] },
        { model: Region, as: 'region', attributes: ['id', 'name', 'code'] },
      ],
    });

    return res.status(201).json({ franchise: withIncludes || created });
  } catch (e) {
    logger.error('❌ create franchise:', e);
    return res
      .status(500)
      .json({ error: 'Erreur lors de la création de la franchise' });
  }
};

/* ======================================================
   ✏️ UPDATE (admin)
====================================================== */
exports.update = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const id = toSafeInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalide' });

    const franchise = await Franchise.findByPk(id);
    if (!franchise) return res.status(404).json({ error: 'Franchise introuvable' });

    if (req.user?.role === 'admin' && !isGlobalAdmin(req.user)) {
      if (!canAccessGeoResource(franchise, req.user)) {
        return res.status(403).json({
          error: 'Accès interdit hors de votre périmètre.',
        });
      }
    }

    const { type, regionId, region_id, legalName, status } = req.body || {};

    // Type
    if (type !== undefined) {
      const trimmedType = toTrimOrNull(type);
      if (!trimmedType || !ALLOWED_TYPES.has(trimmedType)) {
        return res.status(400).json({ error: 'type invalide (MASTER/REGIONAL)' });
      }
      franchise.type = trimmedType;
    }

    // Region change
    if (regionId !== undefined || region_id !== undefined) {
      const rid = toSafeInt(regionId ?? region_id);

      if (req.user?.role === 'admin' && !isGlobalAdmin(req.user)) {
        const { regionId: scopedRegionId } = getUserGeoScope(req.user);
        if (scopedRegionId && String(rid) !== String(scopedRegionId)) {
          return res.status(403).json({
            error: 'Accès interdit hors de votre région.',
          });
        }
      }

      if (franchise.type === 'REGIONAL' && !rid) {
        return res
          .status(400)
          .json({ error: 'regionId requis pour un franchisé régional' });
      }

      if (franchise.type === 'MASTER' && rid) {
        return res
          .status(400)
          .json({ error: 'regionId doit être null pour un franchisé MASTER' });
      }

      if (rid) {
        const region = await Region.findByPk(rid);
        if (!region) return res.status(400).json({ error: 'Région introuvable' });

        // ✅ Cohérence pays (la franchise a déjà countryId)
        const regionCountryId = region.countryId ?? region.country_id;
        if (String(regionCountryId) !== String(franchise.countryId)) {
          return res.status(400).json({
            error: "La région ne correspond pas au pays de la franchise",
          });
        }
      }

      franchise.regionId = rid || null;
    }

    // Legal name
    if (legalName !== undefined) {
      franchise.legalName = toTrimOrNull(legalName) || franchise.legalName;
    }

    // Status
    if (status !== undefined) {
      const trimmedStatus = toTrimOrNull(status);
      if (trimmedStatus && !ALLOWED_STATUS.has(trimmedStatus)) {
        return res.status(400).json({ error: 'status invalide' });
      }
      franchise.status = trimmedStatus || franchise.status;
    }

    await franchise.save();

    const withIncludes = await Franchise.findByPk(franchise.id, {
      include: [
        { model: Country, as: 'country', attributes: ['id', 'name', 'isoCode'] },
        { model: Region, as: 'region', attributes: ['id', 'name', 'code'] },
      ],
    });

    return res.json({ franchise: withIncludes || franchise });
  } catch (e) {
    logger.error('❌ update franchise:', e);
    return res
      .status(500)
      .json({ error: 'Erreur lors de la mise à jour de la franchise' });
  }
};
