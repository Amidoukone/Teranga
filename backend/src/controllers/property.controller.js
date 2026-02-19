'use strict';

const { Property, User, Country, Sequelize } = require('../../models');
const { Op } = require('sequelize');

const {
  PROPERTY_TYPES,
  PROPERTY_STATUSES,
  getLabel,
} = require('../utils/labels');

// 🔹 Instance ImageKit (backend/src/helpers/teranga-imagekit.js)
const imageKit = require('../helpers/teranga-imagekit');
const path = require('path');

// ✅ GeoScope (strict + admin global)
const {
  applyGeoScopeForModel,
  canAccessGeoResource,
  getUserGeoScope,
  isGlobalAdmin,
} = require('../utils/geoScope');
const { getPagination } = require('../utils/pagination');
const logger = require('../utils/logger');

/* ============================================================
   Helpers utilitaires
============================================================ */
const toNullableNumber = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const normalized = String(v).trim().replace(',', '.');
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
};

const toTrimOrNull = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
};

const toSafeInt = (v, fallback = null) => {
  if (v === null || v === undefined || v === '') return fallback;
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? fallback : n;
};

async function resolveCountryIdFromLegacy(countryValue) {
  const trimmed = toTrimOrNull(countryValue);
  if (!trimmed) return null;

  const isoCandidate = trimmed.length === 2 ? trimmed.toUpperCase() : null;
  const normalizedName = trimmed.toLowerCase();

  const record = await Country.findOne({
    where: {
      isActive: true,
      [Op.or]: [
        isoCandidate ? { isoCode: isoCandidate } : null,
        Sequelize.where(Sequelize.fn('lower', Sequelize.col('name')), normalizedName),
      ].filter(Boolean),
    },
    attributes: ['id'],
  });

  return record ? record.id : null;
}

/** Indique si ImageKit est configuré (évite les blocages inutiles) */
function isImageKitEnabled() {
  return Boolean(
    process.env.IMAGEKIT_PUBLIC_KEY &&
      process.env.IMAGEKIT_PRIVATE_KEY &&
      process.env.IMAGEKIT_URL_ENDPOINT
  );
}

/* ============================================================
   Helpers GeoScope
============================================================ */
function toScopeFromObj(obj) {
  if (!obj) return { countryId: null, regionId: null };
  return {
    countryId: toSafeInt(obj.countryId ?? obj.country_id, null),
    regionId: toSafeInt(obj.regionId ?? obj.region_id, null),
  };
}

function canAccessByGeoScope(user, resource) {
  return canAccessGeoResource(resource, user);
}

/* ============================================================
   Labels + normalisation photos pour le frontend
============================================================ */
function addLabels(p) {
  if (!p) return null;

  const obj = p.toJSON ? p.toJSON() : p;

  // 🖼 Normalisation des photos pour le frontend :
  // - en base : [{ url, fileId }, ...] OU ["https://...", ...]
  // - en réponse API : ["https://...", ...] (compat avec PropertiesPage)
  let photos = [];

  if (Array.isArray(obj.photos)) {
    photos = obj.photos
      .map((ph) => {
        if (!ph) return null;
        if (typeof ph === 'string') return ph;
        if (typeof ph === 'object' && ph.url) return ph.url;
        return null;
      })
      .filter(Boolean);
  }

  return {
    ...obj,
    photos,
    typeLabel: getLabel(obj.type, PROPERTY_TYPES),
    statusLabel: getLabel(obj.status, PROPERTY_STATUSES),
  };
}

/* ============================================================
   ImageKit Upload
============================================================ */
async function uploadPhotosToImageKit(files = []) {
  const results = [];

  if (!files || !files.length) return results;

  // Si ImageKit n'est pas configuré, on log et on ignore l'upload
  if (!isImageKitEnabled()) {
    logger.warn(
      "⚠️ ImageKit désactivé ou mal configuré. Les fichiers ne seront pas uploadés."
    );
    return results;
  }

  for (const f of files) {
    const ext = path.extname(f.originalname || '').replace('.', '') || 'jpg';

    try {
      const uploaded = await imageKit.upload({
        // Buffer mémoire fourni par multer.memoryStorage()
        file: f.buffer,
        fileName: `prop_${Date.now()}_${Math.round(Math.random() * 1e9)}.${ext}`,
        folder: '/teranga/properties',
      });

      results.push({
        url: uploaded.url,
        fileId: uploaded.fileId,
      });
    } catch (e) {
      logger.error(
        '❌ Échec upload ImageKit pour le fichier',
        f.originalname,
        e?.message || e
      );
      // On continue avec les autres fichiers, mais on ne bloque pas la création du bien
    }
  }

  return results;
}

/* ============================================================
   DELETE ImageKit
============================================================ */
async function deleteImageKitFiles(photoObjects = []) {
  if (!Array.isArray(photoObjects) || !photoObjects.length) return;

  // Si ImageKit n'est pas configuré, inutile d'essayer de supprimer
  if (!isImageKitEnabled()) {
    logger.warn(
      "⚠️ ImageKit désactivé ou mal configuré. Suppression distante ignorée."
    );
    return;
  }

  for (const p of photoObjects) {
    const fileId = p && typeof p === 'object' ? p.fileId : null;
    if (fileId) {
      try {
        await imageKit.deleteFile(fileId);
      } catch (e) {
        logger.warn(
          `⚠️ Impossible de supprimer ImageKit fileId=${fileId}`,
          e?.message || e
        );
      }
    }
  }
}

/* ============================================================
   LIST all (client/admin/agent) + scope
============================================================ */
exports.list = async (req, res) => {
  try {
    const { limit, offset, page } = getPagination(req);
    const { clientId, q } = req.query || {};
    const countryId = toSafeInt(req.query?.countryId ?? req.query?.country_id, null);
    const regionId = toSafeInt(req.query?.regionId ?? req.query?.region_id, null);

    const where = {};
    const whereAnd = [];

    // 🔎 Recherche texte
    if (q) {
      const like = { [Op.like]: `%${q}%` };
      whereAnd.push({
        [Op.or]: [
          { title: like },
          { description: like },
          { city: like },
          { address: like },
          { postalCode: like },
          { '$owner.firstName$': like },
          { '$owner.lastName$': like },
          { '$owner.email$': like },
        ],
      });
    }

    // 🔐 ACL + GeoScope
    // - admin global: tout (optionnel filtre clientId)
    // - admin scoped: tout dans scope (optionnel filtre clientId)
    // - agent: lecture dans scope uniquement (pas de filtre clientId sauf si voulu)
    // - client: uniquement ses biens
    if (isGlobalAdmin(req.user)) {
      if (clientId) where.ownerId = toSafeInt(clientId);
    } else if (req.user.role === 'admin') {
      if (clientId) where.ownerId = toSafeInt(clientId);
      // scope appliqué plus bas
    } else if (req.user.role === 'agent') {
      // lecture seulement + scope (pas de filtre ownerId)
    } else if (req.user.role === 'client') {
      where.ownerId = req.user.id;
    }

    if (countryId) where.countryId = countryId;
    if (regionId) where.regionId = regionId;

    let finalWhere = whereAnd.length
      ? { ...where, [Op.and]: whereAnd }
      : where;

    // 🌍 Scope strict (admin scoped/agent/client)
    finalWhere = applyGeoScopeForModel
      ? applyGeoScopeForModel(finalWhere, req.user, Property, { includeClients: true })
      : finalWhere;

    const { rows, count } = await Property.findAndCountAll({
      where: finalWhere,
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'firstName', 'lastName', 'email', 'country'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return res.json({
      properties: rows.map(addLabels),
      pagination: { page, limit, offset, total: count },
    });
  } catch (e) {
    logger.error('❌ list properties:', e);
    return res
      .status(500)
      .json({ error: 'Erreur lors de la récupération des biens' });
  }
};

/* ============================================================
   LIST by client (ADMIN/MASTER) + scope
============================================================ */
exports.listByClient = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const { limit, offset, page } = getPagination(req);
    const cid = toSafeInt(req.params.id);
    if (!cid) return res.status(400).json({ error: 'clientId requis' });
    const countryId = toSafeInt(req.query?.countryId ?? req.query?.country_id, null);
    const regionId = toSafeInt(req.query?.regionId ?? req.query?.region_id, null);

    let where = { ownerId: cid };
    if (countryId) where.countryId = countryId;
    if (regionId) where.regionId = regionId;

    // Scope strict (admin scoped/client)
    where = applyGeoScopeForModel
      ? applyGeoScopeForModel(where, req.user, Property, { includeClients: true })
      : where;

    const { rows, count } = await Property.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'firstName', 'lastName', 'email', 'country'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return res.json({
      properties: rows.map(addLabels),
      pagination: { page, limit, offset, total: count },
    });
  } catch (e) {
    logger.error('❌ listByClient:', e);
    return res.status(500).json({
      error: 'Erreur lors de la récupération des biens du client',
    });
  }
};

/* ============================================================
   CREATE Property
============================================================ */
exports.create = async (req, res) => {
  try {
    const {
      ownerId,
      clientId,
      ownerEmail,

      title,
      type,
      address,
      city,
      postalCode,
      latitude,
      longitude,
      surfaceArea,
      roomCount,
      description,
      status,

      // 🌍 Multi-pays (nouveau, non bloquant)
      countryId,
      regionId,
      country_id,
      region_id,
    } = req.body || {};

    if (!title || !type || !address || !city) {
      return res
        .status(400)
        .json({ error: 'title, type, address, city sont requis' });
    }

    /* 🔐 Résolution propriétaire */
    let targetOwnerId = req.user.id;
    let targetOwner = req.user;

    // admin/master peuvent créer pour un client
    if (req.user.role === 'admin') {
      const candidateId = toSafeInt(ownerId) || toSafeInt(clientId) || null;

      if (candidateId) {
        const user = await User.findByPk(candidateId);
        if (!user) {
          return res.status(400).json({ error: 'ownerId/clientId invalide' });
        }
        if (user.role !== 'client') {
          return res.status(400).json({ error: 'Le propriétaire doit être un client' });
        }
        targetOwnerId = user.id;
        targetOwner = user;
      } else if (ownerEmail) {
        const user = await User.findOne({ where: { email: ownerEmail } });
        if (!user || user.role !== 'client') {
          return res.status(400).json({ error: 'ownerEmail invalide ou non client' });
        }
        targetOwnerId = user.id;
        targetOwner = user;
      }
    }

    /* 🔥 Upload ImageKit (non bloquant en cas d’erreur) */
    const photos = req.files?.length ? await uploadPhotosToImageKit(req.files) : [];

    // 🌍 Multi-pays :
    // - admin global : peut définir librement
    // - admin scoped : doit rester dans scope, et on force si nécessaire
    // - client/agent : non bloquant => null
    const desiredCountryId = toSafeInt(countryId ?? country_id, null);
    const desiredRegionId = toSafeInt(regionId ?? region_id, null);
    const ownerScope = toScopeFromObj(targetOwner);
    let fallbackCountryId =
      desiredCountryId !== null ? desiredCountryId : ownerScope.countryId;
    const fallbackRegionId =
      desiredRegionId !== null ? desiredRegionId : ownerScope.regionId;

    if (fallbackCountryId === null && targetOwner?.country) {
      fallbackCountryId = await resolveCountryIdFromLegacy(targetOwner.country);
    }

    let finalCountryId = null;
    let finalRegionId = null;

    if (isGlobalAdmin(req.user)) {
      finalCountryId = fallbackCountryId;
      finalRegionId = fallbackRegionId;
    } else if (req.user.role === 'admin') {
      const scope = getUserGeoScope ? getUserGeoScope(req.user) : { countryId: null, regionId: null };

      // si scope region => on force region (et country optionnel)
      if (scope.regionId) {
        finalRegionId = scope.regionId;
        finalCountryId = scope.countryId ?? fallbackCountryId ?? null;

        if (fallbackRegionId && String(fallbackRegionId) !== String(scope.regionId)) {
          return res.status(403).json({ error: 'regionId hors scope' });
        }
        if (scope.countryId && fallbackCountryId && String(fallbackCountryId) !== String(scope.countryId)) {
          return res.status(403).json({ error: 'countryId hors scope' });
        }
      } else if (scope.countryId) {
        finalCountryId = scope.countryId;
        finalRegionId = fallbackRegionId ?? null;

        if (fallbackCountryId && String(fallbackCountryId) !== String(scope.countryId)) {
          return res.status(403).json({ error: 'countryId hors scope' });
        }
      } else {
        // admin scoped sans scope réel => fallback permissif
        finalCountryId = fallbackCountryId;
        finalRegionId = fallbackRegionId;
      }
    } else {
      finalCountryId = fallbackCountryId;
      finalRegionId = fallbackRegionId;
    }

    if (!isGlobalAdmin(req.user)) {
      const targetScope = { countryId: finalCountryId, regionId: finalRegionId };
      if (!canAccessByGeoScope(req.user, targetScope)) {
        return res.status(403).json({ error: 'countryId/regionId hors scope' });
      }
    }

    const created = await Property.create({
      ownerId: targetOwnerId,
      title,
      type,
      address,
      city,
      postalCode: toTrimOrNull(postalCode),
      latitude: toNullableNumber(latitude),
      longitude: toNullableNumber(longitude),
      surfaceArea: toNullableNumber(surfaceArea),
      roomCount: toNullableNumber(roomCount),
      description: toTrimOrNull(description),
      status: status ? String(status).trim() : 'active',

      // 🌍 Multi-pays
      countryId: finalCountryId,
      regionId: finalRegionId,

      photos, // en base : [{ url, fileId }, ...]
    });

    const property = await Property.findByPk(created.id, {
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        },
      ],
    });

    // ✅ sécurité : vérifier qu'on renvoie bien une property dans scope
    if (!isGlobalAdmin(req.user)) {
      if (!canAccessByGeoScope(req.user, property)) {
        return res.status(403).json({ error: 'Bien créé hors scope (bloqué)' });
      }
    }

    return res.status(201).json({
      message: 'Bien créé',
      property: addLabels(property),
    });
  } catch (e) {
    logger.error('❌ create property:', e);
    return res.status(500).json({ error: 'Erreur lors de la création du bien' });
  }
};

/* ============================================================
   UPDATE Property
============================================================ */
exports.update = async (req, res) => {
  try {
    const id = toSafeInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalide' });

    const p = await Property.findByPk(id);
    if (!p) return res.status(404).json({ error: 'Bien introuvable' });

    // 🔐 ACL de base
    const isOwner = String(p.ownerId) === String(req.user.id);
    const isAdminOrMaster = req.user.role === 'admin';

    if (!isAdminOrMaster && !isOwner) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    // 🌍 ACL GeoScope (strict)
    if (!isGlobalAdmin(req.user)) {
      if (!canAccessByGeoScope(req.user, p)) {
        return res.status(403).json({ error: 'Bien hors scope géographique' });
      }
    }

    const body = req.body || {};
    const updates = {};

    const fields = [
      'title',
      'type',
      'address',
      'city',
      'description',
      'status',
    ];

    for (const key of fields) {
      if (body[key] !== undefined) {
        updates[key] = toTrimOrNull(body[key]);
      }
    }

    if (body.postalCode !== undefined)
      updates.postalCode = toTrimOrNull(body.postalCode);
    if (body.latitude !== undefined)
      updates.latitude = toNullableNumber(body.latitude);
    if (body.longitude !== undefined)
      updates.longitude = toNullableNumber(body.longitude);
    if (body.surfaceArea !== undefined)
      updates.surfaceArea = toNullableNumber(body.surfaceArea);
    if (body.roomCount !== undefined)
      updates.roomCount = toNullableNumber(body.roomCount);

    /* ========================================================
       🌍 Multi-pays UPDATE
       - admin global : libre
       - admin scoped : uniquement dans son scope
       - client : interdit
    ======================================================== */
    if (isAdminOrMaster) {
      const desiredCountryId = toSafeInt(
        body.countryId ?? body.country_id,
        null
      );
      const desiredRegionId = toSafeInt(
        body.regionId ?? body.region_id,
        null
      );

      if (isGlobalAdmin(req.user)) {
        if (body.countryId !== undefined || body.country_id !== undefined)
          updates.countryId = desiredCountryId;
        if (body.regionId !== undefined || body.region_id !== undefined)
          updates.regionId = desiredRegionId;
      } else {
        const scope = getUserGeoScope
          ? getUserGeoScope(req.user)
          : { countryId: null, regionId: null };

        // scope région prioritaire
        if (scope.regionId) {
          if (
            desiredRegionId &&
            String(desiredRegionId) !== String(scope.regionId)
          ) {
            return res.status(403).json({ error: 'regionId hors scope' });
          }
          updates.regionId = scope.regionId;
          updates.countryId =
            scope.countryId ?? desiredCountryId ?? p.countryId ?? null;
        } else if (scope.countryId) {
          if (
            desiredCountryId &&
            String(desiredCountryId) !== String(scope.countryId)
          ) {
            return res.status(403).json({ error: 'countryId hors scope' });
          }
          updates.countryId = scope.countryId;
          if (body.regionId !== undefined || body.region_id !== undefined) {
            updates.regionId = desiredRegionId;
          }
        }
      }
    }

    if (!isGlobalAdmin(req.user)) {
      const nextScope = {
        countryId: updates.countryId ?? p.countryId,
        regionId: updates.regionId ?? p.regionId,
      };
      if (!canAccessByGeoScope(req.user, nextScope)) {
        return res.status(403).json({ error: 'Mise à jour hors scope géographique' });
      }
    }

    /* ========================================================
       🔥 Gestion photos (ImageKit)
    ======================================================== */
    let newPhotos = [];
    if (req.files?.length) {
      newPhotos = await uploadPhotosToImageKit(req.files);
    }

    if (newPhotos.length) {
      const replace = String(body.replacePhotos || '').toLowerCase() === 'true';

      if (replace) {
        await deleteImageKitFiles(p.photos || []);
        updates.photos = newPhotos;
      } else {
        updates.photos = [...(p.photos || []), ...newPhotos];
      }
    }

    await p.update(updates);

    const property = await Property.findByPk(p.id, {
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        },
      ],
    });

    return res.json({
      message: 'Bien mis à jour',
      property: addLabels(property),
    });
  } catch (e) {
    logger.error('❌ update property:', e);
    return res
      .status(500)
      .json({ error: 'Erreur lors de la mise à jour' });
  }
};

/* ============================================================
   DELETE Property
============================================================ */
exports.remove = async (req, res) => {
  try {
    const id = toSafeInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalide' });

    const p = await Property.findByPk(id);
    if (!p) return res.status(404).json({ error: 'Bien introuvable' });

    const isOwner = String(p.ownerId) === String(req.user.id);
    const isAdminOrMaster = req.user.role === 'admin';

    if (!isAdminOrMaster && !isOwner) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    // 🌍 GeoScope strict
    if (!isGlobalAdmin(req.user)) {
      if (!canAccessByGeoScope(req.user, p)) {
        return res.status(403).json({ error: 'Bien hors scope géographique' });
      }
    }

    // 🗑️ Suppression ImageKit (safe)
    await deleteImageKitFiles(p.photos || []);

    await p.destroy();

    return res.json({ message: 'Bien supprimé' });
  } catch (e) {
    logger.error('❌ delete property:', e);
    return res
      .status(500)
      .json({ error: 'Erreur lors de la suppression' });
  }
};
