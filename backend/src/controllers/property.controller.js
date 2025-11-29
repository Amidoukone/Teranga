'use strict';

const { Property, User, sequelize } = require('../../models');
const { Op } = require('sequelize');

const {
  PROPERTY_TYPES,
  PROPERTY_STATUSES,
  getLabel,
} = require('../utils/labels');

const imageKit = require('../helpers/teranga-imagekit'); // 🔥 ImageKit helper
const path = require('path');

/* ============================================================
   Helpers utilitaires
============================================================ */
function toNullableNumber(v) {
  if (v === '' || v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toTrimOrNull(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function toSafeInt(v, fallback = null) {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

function getPagination(req, defaultLimit = 50, maxLimit = 200) {
  const limit = Math.min(Math.max(toSafeInt(req.query.limit, defaultLimit), 1), maxLimit);
  const offset = Math.max(toSafeInt(req.query.offset, 0), 0);
  return { limit, offset };
}

/* ============================================================
   🔥 Ajout des labels + conversion
============================================================ */
function addLabels(p) {
  if (!p) return null;

  const obj = p.toJSON ? p.toJSON() : p;

  return {
    ...obj,
    typeLabel: getLabel(obj.type, PROPERTY_TYPES),
    statusLabel: getLabel(obj.status, PROPERTY_STATUSES),
  };
}

/* ============================================================
   🔥 UPLOAD ImageKit (memory buffer → CDN)
============================================================ */
async function uploadPhotosToImageKit(files = []) {
  const results = [];

  for (const f of files) {
    const ext = path.extname(f.originalname).replace('.', '') || 'jpg';

    const uploaded = await imageKit.upload({
      file: f.buffer,       // memory upload
      fileName: `prop_${Date.now()}_${Math.round(Math.random() * 1e9)}.${ext}`,
      folder: '/teranga/properties',
    });

    results.push({
      url: uploaded.url,
      fileId: uploaded.fileId,
    });
  }

  return results;
}

/* ============================================================
   🔥 DELETE ImageKit
============================================================ */
async function deleteImageKitFiles(photoObjects = []) {
  for (const p of photoObjects) {
    if (p?.fileId) {
      try {
        await imageKit.deleteFile(p.fileId);
      } catch (e) {
        console.warn('⚠️ Impossible de supprimer fileId ImageKit:', p.fileId, e.message);
      }
    }
  }
}

/* ============================================================
   🔵 LIST des propriétés
============================================================ */
exports.list = async (req, res) => {
  try {
    const { limit, offset } = getPagination(req);
    const { clientId, all, q } = req.query || {};

    const where = {};
    const whereAnd = [];

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

    if (req.user.role === 'admin') {
      if (clientId) {
        where.ownerId = toSafeInt(clientId);
      }
      // sinon admin voit tout
    } else {
      where.ownerId = req.user.id;
    }

    const finalWhere = whereAnd.length ? { ...where, [Op.and]: whereAnd } : where;

    const { rows, count } = await Property.findAndCountAll({
      where: finalWhere,
      include: [
        { model: User, as: 'owner', attributes: ['id', 'firstName', 'lastName', 'email'] },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    res.json({
      properties: rows.map(addLabels),
      pagination: { limit, offset, total: count },
    });
  } catch (e) {
    console.error('❌ list properties:', e);
    res.status(500).json({ error: 'Erreur lors de la récupération des biens' });
  }
};

/* ============================================================
   🔵 LIST by client (admin)
============================================================ */
exports.listByClient = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const { limit, offset } = getPagination(req);
    const cid = toSafeInt(req.params.id);
    if (!cid) return res.status(400).json({ error: 'clientId requis' });

    const { rows, count } = await Property.findAndCountAll({
      where: { ownerId: cid },
      include: [
        { model: User, as: 'owner', attributes: ['id', 'firstName', 'lastName', 'email'] },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    res.json({
      properties: rows.map(addLabels),
      pagination: { limit, offset, total: count },
    });
  } catch (e) {
    console.error('❌ listByClient properties:', e);
    res.status(500).json({ error: 'Erreur lors de la récupération des biens' });
  }
};

/* ============================================================
   🔥 CREATE (ImageKit upload)
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
    } = req.body || {};

    if (!title || !type || !address || !city) {
      return res.status(400).json({ error: 'title, type, address, city sont requis' });
    }

    /* RESOLUTION DU PROPRIETAIRE */
    let targetOwnerId = req.user.id;

    if (req.user.role === 'admin') {
      const candidateId =
        toSafeInt(ownerId) ||
        toSafeInt(clientId) ||
        null;

      if (candidateId) {
        const user = await User.findByPk(candidateId);
        if (!user) return res.status(400).json({ error: 'ownerId/clientId invalide' });
        if (user.role !== 'client') return res.status(400).json({ error: 'Le propriétaire doit être un client' });
        targetOwnerId = user.id;
      } else if (ownerEmail) {
        const user = await User.findOne({ where: { email: ownerEmail } });
        if (!user || user.role !== 'client') {
          return res.status(400).json({ error: 'ownerEmail invalide ou non client' });
        }
        targetOwnerId = user.id;
      }
    }

    /* 🔥 UPLOAD ImageKit */
    const photos = req.files?.length ? await uploadPhotosToImageKit(req.files) : [];

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
      photos, // 🔥 intégration ImageKit
    });

    const property = await Property.findByPk(created.id, {
      include: [{ model: User, as: 'owner', attributes: ['id', 'firstName', 'lastName', 'email'] }],
    });

    return res.status(201).json({
      message: 'Bien créé',
      property: addLabels(property),
    });
  } catch (e) {
    console.error('❌ create property:', e);
    res.status(500).json({ error: 'Erreur lors de la création du bien' });
  }
};

/* ============================================================
   🔥 UPDATE (ImageKit upload + merge/replace)
============================================================ */
exports.update = async (req, res) => {
  try {
    const id = toSafeInt(req.params.id);
    const p = await Property.findByPk(id);
    if (!p) return res.status(404).json({ error: 'Bien introuvable' });

    if (req.user.role !== 'admin' && String(p.ownerId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    const {
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
      replacePhotos,
    } = req.body || {};

    const updates = {};
    if (title !== undefined) updates.title = String(title).trim();
    if (type !== undefined) updates.type = String(type).trim();
    if (address !== undefined) updates.address = String(address).trim();
    if (city !== undefined) updates.city = String(city).trim();
    if (postalCode !== undefined) updates.postalCode = toTrimOrNull(postalCode);
    if (latitude !== undefined) updates.latitude = toNullableNumber(latitude);
    if (longitude !== undefined) updates.longitude = toNullableNumber(longitude);
    if (surfaceArea !== undefined) updates.surfaceArea = toNullableNumber(surfaceArea);
    if (roomCount !== undefined) updates.roomCount = toNullableNumber(roomCount);
    if (description !== undefined) updates.description = toTrimOrNull(description);
    if (status !== undefined) updates.status = String(status).trim();

    /* 🔥 Nouveaux uploads */
    let newPhotos = [];
    if (req.files && req.files.length) {
      newPhotos = await uploadPhotosToImageKit(req.files);
    }

    if (newPhotos.length) {
      const shouldReplace = String(replacePhotos).toLowerCase() === 'true';

      if (shouldReplace) {
        // supprimer les anciennes images IK
        await deleteImageKitFiles(p.photos);

        updates.photos = newPhotos;
      } else {
        updates.photos = [...(p.photos || []), ...newPhotos];
      }
    }

    await p.update(updates);

    const property = await Property.findByPk(p.id, {
      include: [{ model: User, as: 'owner', attributes: ['id', 'firstName', 'lastName', 'email'] }],
    });

    res.json({ message: 'Bien mis à jour', property: addLabels(property) });
  } catch (e) {
    console.error('❌ update property:', e);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du bien' });
  }
};

/* ============================================================
   🔥 DELETE (suppression ImageKit)
============================================================ */
exports.remove = async (req, res) => {
  try {
    const id = toSafeInt(req.params.id);
    const p = await Property.findByPk(id);
    if (!p) return res.status(404).json({ error: 'Bien introuvable' });

    if (req.user.role !== 'admin' && String(p.ownerId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    /* 🔥 supprimer les fichiers ImageKit */
    await deleteImageKitFiles(p.photos || []);

    await p.destroy();

    res.json({ message: 'Bien supprimé' });
  } catch (e) {
    console.error('❌ delete property:', e);
    res.status(500).json({ error: 'Erreur lors de la suppression du bien' });
  }
};
