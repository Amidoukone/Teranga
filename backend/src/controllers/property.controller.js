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
const fs = require('fs');
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

const toStringArray = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  }

  if (value === undefined || value === null) return [];

  const raw = String(value).trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry) => String(entry || '').trim())
        .filter(Boolean);
    }
  } catch {
    // ignore invalid JSON and fallback to raw string format
  }

  return raw
    .split(',')
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
};

const toSafeInt = (v, fallback = null) => {
  if (v === null || v === undefined || v === '') return fallback;
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? fallback : n;
};

const PROPERTY_MAX_FILES = Math.max(
  1,
  toSafeInt(process.env.PROPERTY_MAX_FILES, 10) || 10
);

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

function sanitizeBasename(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildLocalPropertyFileName(originalName = 'file') {
  const base = path.basename(originalName || 'file');
  const ext = path.extname(base || '').toLowerCase();
  const stem = base.slice(0, base.length - ext.length);
  const safeStem = sanitizeBasename(stem) || 'file';
  const safeExt = ext && ext.length <= 10 ? ext : '';
  const salt = Math.random().toString(36).slice(2, 8);
  const timestamp = Date.now();
  return `property_${timestamp}_${salt}_${safeStem}${safeExt}`;
}

async function savePropertyFileLocally(file) {
  if (!file?.buffer) {
    throw new Error('Fichier invalide: buffer absent');
  }

  const uploadsRoot = path.join(__dirname, '..', '..', 'uploads');
  const propertiesDir = path.join(uploadsRoot, 'properties');
  await fs.promises.mkdir(propertiesDir, { recursive: true });

  const localName = buildLocalPropertyFileName(file.originalname);
  const absolutePath = path.join(propertiesDir, localName);
  await fs.promises.writeFile(absolutePath, file.buffer);

  return {
    url: `/uploads/properties/${localName}`,
    fileId: null,
  };
}

function isLocalUploadPath(filePath) {
  return typeof filePath === 'string' && /^\/?uploads\//.test(filePath);
}

async function removeLocalUpload(filePath) {
  if (!isLocalUploadPath(filePath)) return;

  const relPath = filePath.replace(/^\/+/, '');
  const backendRoot = path.join(__dirname, '..', '..');
  const uploadsRoot = path.resolve(path.join(backendRoot, 'uploads'));
  const absolutePath = path.resolve(path.join(backendRoot, relPath));

  if (
    absolutePath !== uploadsRoot &&
    !absolutePath.startsWith(`${uploadsRoot}${path.sep}`)
  ) {
    logger.warn({ filePath }, 'property.local_file.delete.blocked_path');
    return;
  }

  try {
    await fs.promises.unlink(absolutePath);
  } catch (err) {
    logger.warn(
      { filePath, message: err?.message },
      'property.local_file.delete.failed'
    );
  }
}

function normalizeStoredPhotoItem(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    return { url: value, fileId: null };
  }
  if (typeof value === 'object' && value.url) {
    return { url: String(value.url), fileId: value.fileId || null };
  }
  return null;
}

function normalizeStoredPhotos(value) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeStoredPhotoItem).filter(Boolean);
}

/* ============================================================
   Labels + normalisation photos pour le frontend
============================================================ */
function addLabels(p) {
  if (!p) return null;

  const obj = p.toJSON ? p.toJSON() : p;
  const photos = normalizeStoredPhotos(obj.photos).map((ph) => ph.url);

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
  if (!files || !files.length) return [];

  const imageKitEnabled = isImageKitEnabled();
  if (!imageKitEnabled) {
    logger.warn('property.imagekit.disabled.fallback_local');
  }

  const uploads = await Promise.all(
    files.map(async (f) => {
      const ext = path.extname(f.originalname || '').replace('.', '') || 'jpg';

      if (imageKitEnabled) {
        try {
          const uploaded = await imageKit.upload({
            // Buffer provided by multer.memoryStorage()
            file: f.buffer,
            fileName: `prop_${Date.now()}_${Math.round(Math.random() * 1e9)}.${ext}`,
            folder: '/teranga/properties',
          });

          const uploadedUrl =
            uploaded?.url || uploaded?.fileUrl || uploaded?.path || '';

          if (uploadedUrl) {
            return {
              url: uploadedUrl,
              fileId: uploaded?.fileId || null,
            };
          }

          logger.warn(
            { fileName: f?.originalname },
            'property.imagekit.upload_missing_url.fallback_local'
          );
        } catch (e) {
          logger.warn(
            { err: e, fileName: f?.originalname },
            'property.imagekit.upload.failed.fallback_local'
          );
        }
      }

      try {
        const localSaved = await savePropertyFileLocally(f);
        return {
          url: localSaved.url,
          fileId: localSaved.fileId,
        };
      } catch (e) {
        logger.error(
          { err: e, fileName: f?.originalname },
          'property.local_upload.failed'
        );
        return null;
      }
    })
  );

  return uploads.filter(Boolean);
}

/* ============================================================
   DELETE ImageKit
============================================================ */
async function deleteImageKitFiles(photoObjects = []) {
  const normalized = normalizeStoredPhotos(photoObjects);
  if (!normalized.length) return;

  const imageKitEnabled = isImageKitEnabled();
  if (!imageKitEnabled && normalized.some((p) => p.fileId)) {
    logger.warn(
      'property.imagekit.disabled.remote_delete_skipped'
    );
  }

  for (const p of normalized) {
    if (p.fileId && imageKitEnabled) {
      try {
        await imageKit.deleteFile(p.fileId);
      } catch (e) {
        logger.warn(
          `Warning: unable to delete ImageKit fileId=${p.fileId}`,
          e?.message || e
        );
      }
    }

    if (isLocalUploadPath(p.url)) {
      await removeLocalUpload(p.url);
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

    // ACL + GeoScope
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

    // Strict scope (admin scoped/agent/client)
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
    logger.error('property.list.failed:', e);
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
    logger.error('property.list_by_client.failed:', e);
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

      // Multi-country (new, non-blocking)
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

    /* Owner resolution */
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

    if ((req.files?.length || 0) > PROPERTY_MAX_FILES) {
      return res.status(400).json({
        error: `Maximum ${PROPERTY_MAX_FILES} fichiers autorisés par bien`,
      });
    }

    /* 🔥 Upload fichiers (ImageKit + fallback local, non bloquant) */
    const photos = req.files?.length ? await uploadPhotosToImageKit(req.files) : [];

    // Multi-country:
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

      // Multi-country
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
    logger.error('property.create.failed:', e);
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

    // Base ACL
    const isOwner = String(p.ownerId) === String(req.user.id);
    const isAdminOrMaster = req.user.role === 'admin';

    if (!isAdminOrMaster && !isOwner) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    // GeoScope ACL (strict)
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
       Multi-country UPDATE
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
    const replace = String(body.replacePhotos || '').toLowerCase() === 'true';
    const existingPhotos = normalizeStoredPhotos(p.photos || []);
    const requestedRemovedUrls = new Set(
      toStringArray(
        body.removePhotos ??
          body.removedPhotos ??
          body.photosToRemove ??
          body.removePhotoUrls
      )
    );
    const photosToRemove = existingPhotos.filter((ph) =>
      requestedRemovedUrls.has(ph.url)
    );
    const keptExistingPhotos = existingPhotos.filter(
      (ph) => !requestedRemovedUrls.has(ph.url)
    );
    const incomingFilesCount = req.files?.length || 0;

    const maxNewFiles = replace
      ? PROPERTY_MAX_FILES
      : Math.max(0, PROPERTY_MAX_FILES - keptExistingPhotos.length);
    if (incomingFilesCount > maxNewFiles) {
      return res.status(400).json({
        error: replace
          ? `Maximum ${PROPERTY_MAX_FILES} fichiers autorisés par bien`
          : `Limite atteinte: ce bien contient déjà ${keptExistingPhotos.length}/${PROPERTY_MAX_FILES} fichiers`,
      });
    }

    let newPhotos = [];
    if (incomingFilesCount > 0) {
      newPhotos = await uploadPhotosToImageKit(req.files);
    }

    const photosChanged = replace
      ? incomingFilesCount > 0 || photosToRemove.length > 0
      : photosToRemove.length > 0 || newPhotos.length > 0;

    if (photosChanged) {
      if (replace) {
        await deleteImageKitFiles(existingPhotos);
      } else {
        await deleteImageKitFiles(photosToRemove);
      }

      updates.photos = replace
        ? newPhotos
        : [...keptExistingPhotos, ...newPhotos];
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
    logger.error('property.update.failed:', e);
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

    // Strict GeoScope
    if (!isGlobalAdmin(req.user)) {
      if (!canAccessByGeoScope(req.user, p)) {
        return res.status(403).json({ error: 'Bien hors scope géographique' });
      }
    }

    // ImageKit deletion (safe)
    await deleteImageKitFiles(normalizeStoredPhotos(p.photos || []));

    await p.destroy();

    return res.json({ message: 'Bien supprimé' });
  } catch (e) {
    logger.error('property.delete.failed:', e);
    return res
      .status(500)
      .json({ error: 'Erreur lors de la suppression' });
  }
};


