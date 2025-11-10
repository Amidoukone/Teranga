'use strict';

const { Property, User, sequelize } = require('../../models');
const { Op } = require('sequelize');

// 🌍 Dictionnaire de labels centralisé (assure-toi que ces clés existent)
const {
  PROPERTY_TYPES,
  PROPERTY_STATUSES,
  getLabel,
  applyLabels, // si tu l’as côté backend; sinon on recalcule ci-dessous
} = require('../utils/labels');

/* ============================================================
   ⚙️ Helpers utilitaires
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
   🖼️ Fonction critique corrigée : chemins fichiers
   - produit toujours un chemin public commençant par /uploads/...
============================================================ */
function filePathsFromMulter(files = []) {
  if (!files || !files.length) return [];

  return files.map((f) => {
    try {
      // Normaliser Windows/Linux
      let p = String(f.path || '').replace(/\\/g, '/');

      // Si on retrouve /uploads/, on tronque avant pour garder un chemin public
      const idx = p.lastIndexOf('/uploads/');
      if (idx !== -1) {
        p = p.slice(idx); // ✅ garde uniquement la portion publique
      } else if (p.includes('uploads/')) {
        // cas fallback si le préfixe n'a pas de slash initial
        p = '/' + p.slice(p.indexOf('uploads/'));
      } else if (f.filename) {
        // dernier recours propre (convention properties)
        p = `/uploads/properties/${f.filename}`;
      } else {
        // si vraiment rien, on met une valeur neutre
        p = '/uploads/properties/unknown';
      }

      // enlever les doubles slash
      p = p.replace(/\/{2,}/g, '/');
      return p;
    } catch (_e) {
      return '/uploads/properties/unknown';
    }
  });
}

/* ============================================================
   🧭 Résolution du propriétaire cible (pour création côté admin)
   - Accepte ownerId / clientId (body ou query) ou ownerEmail (body)
   - Valide que l’utilisateur existe et a le rôle 'client'
============================================================ */
async function resolveTargetOwnerId(req) {
  // Par défaut: le créateur est le propriétaire (client ou admin qui crée pour lui-même)
  let targetOwnerId = req.user.id;

  // Admin peut créer pour un client spécifique
  // On accepte les variantes suivantes:
  //   body.ownerId | body.clientId | query.ownerId | query.clientId | body.ownerEmail
  if (req.user.role === 'admin') {
    const body = req.body || {};
    const q = req.query || {};

    const candidateId =
      toSafeInt(body.ownerId) ||
      toSafeInt(body.clientId) ||
      toSafeInt(q.ownerId) ||
      toSafeInt(q.clientId) ||
      null;

    const ownerEmail = body.ownerEmail ? String(body.ownerEmail).trim() : null;

    let targetUser = null;

    if (candidateId) {
      targetUser = await User.findByPk(candidateId);
      if (!targetUser) {
        throw new Error('ownerId/clientId invalide: utilisateur introuvable');
      }
    } else if (ownerEmail) {
      targetUser = await User.findOne({ where: { email: ownerEmail } });
      if (!targetUser) {
        throw new Error('ownerEmail invalide: utilisateur introuvable');
      }
    }

    if (targetUser) {
      if (String(targetUser.role) !== 'client') {
        // On force la logique business: un bien appartient à un client
        throw new Error(
          `L'utilisateur cible (id=${targetUser.id}) n'a pas le rôle "client" (role actuel: ${targetUser.role}).`
        );
      }
      targetOwnerId = targetUser.id;
    }
  }

  return targetOwnerId;
}

/* ============================================================
   📜 LISTE des biens
   - Client : ses propres biens
   - Admin  : peut voir tous ou filtrer par client
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
      } else if (String(all).toLowerCase() === 'true') {
        // tous les biens (pas de filtre supplémentaire)
      } else {
        // défaut admin : tous les biens (utile pour dashboard)
      }
    } else {
      // client : uniquement ses biens
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

    return res.json({
      properties: rows.map(addLabels),
      pagination: { limit, offset, total: count },
    });
  } catch (e) {
    console.error('❌ Erreur list properties:', e);
    return res.status(500).json({ error: 'Erreur lors de la récupération des biens' });
  }
};

/* ============================================================
   📜 LISTE des biens d’un client (admin)
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

    return res.json({
      properties: rows.map(addLabels),
      pagination: { limit, offset, total: count },
    });
  } catch (e) {
    console.error('❌ Erreur listByClient properties:', e);
    return res
      .status(500)
      .json({ error: 'Erreur lors de la récupération des biens du client' });
  }
};

/* ============================================================
   ➕ CRÉER un bien
   - Client : crée pour lui-même
   - Admin  : peut créer pour un client spécifique (ownerId|clientId|ownerEmail)
   - Upload : jusqu’à 5 fichiers via champ 'files'
============================================================ */
exports.create = async (req, res) => {
  try {
    const {
      // variantes d’aiguillage admin -> client
      ownerId,      // optionnel (admin)
      clientId,     // optionnel (admin)
      ownerEmail,   // optionnel (admin, fallback par email)

      // champs métier
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
      status, // optionnel
    } = req.body || {};

    if (!title || !type || !address || !city) {
      return res.status(400).json({ error: 'title, type, address, city sont requis' });
    }

    // 🔐 Résolution explicite du propriétaire cible
    let targetOwnerId;
    try {
      targetOwnerId = await resolveTargetOwnerId(req);
    } catch (err) {
      console.warn('⚠️ Aiguillage propriétaire refusé:', err.message);
      return res.status(400).json({ error: err.message });
    }

    const photos = filePathsFromMulter(req.files);
    console.log('📸 Photos uploadées (create):', photos);
    console.log(
      `🧾 Demande création bien par user=${req.user.id} (role=${req.user.role}) => ownerId=${targetOwnerId}` +
        (ownerId ? ` | body.ownerId=${ownerId}` : '') +
        (clientId ? ` | body.clientId=${clientId}` : '') +
        (ownerEmail ? ` | body.ownerEmail=${ownerEmail}` : '')
    );

    const created = await Property.create({
      ownerId: targetOwnerId,
      title: String(title).trim(),
      type: String(type).trim(),
      address: String(address).trim(),
      city: String(city).trim(),
      postalCode: toTrimOrNull(postalCode),
      latitude: toNullableNumber(latitude),
      longitude: toNullableNumber(longitude),
      surfaceArea: toNullableNumber(surfaceArea),
      roomCount: toNullableNumber(roomCount),
      description: toTrimOrNull(description),
      status: status ? String(status).trim() : 'active',
      photos,
    });

    const property = await Property.findByPk(created.id, {
      include: [{ model: User, as: 'owner', attributes: ['id', 'firstName', 'lastName', 'email'] }],
    });

    return res.status(201).json({
      message: 'Bien créé',
      property: addLabels(property),
    });
  } catch (e) {
    console.error('❌ Erreur create property:', e);
    return res.status(500).json({ error: 'Erreur lors de la création du bien' });
  }
};

/* ============================================================
   ✏️ METTRE À JOUR un bien
   - Merge ou remplacement complet des photos
============================================================ */
exports.update = async (req, res) => {
  try {
    const id = toSafeInt(req.params.id);
    const p = await Property.findByPk(id);
    if (!p) return res.status(404).json({ error: 'Bien introuvable' });

    // Vérif droits
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

    const newPhotos = filePathsFromMulter(req.files);
    if (newPhotos.length) {
      console.log('📸 Nouvelles photos uploadées (update):', newPhotos);
      const shouldReplace = String(replacePhotos).toLowerCase() === 'true';
      if (shouldReplace) {
        updates.photos = newPhotos;
      } else {
        updates.photos = [...(Array.isArray(p.photos) ? p.photos : []), ...newPhotos];
      }
    }

    await p.update(updates);

    const property = await Property.findByPk(p.id, {
      include: [{ model: User, as: 'owner', attributes: ['id', 'firstName', 'lastName', 'email'] }],
    });

    return res.json({ message: 'Bien mis à jour', property: addLabels(property) });
  } catch (e) {
    console.error('❌ Erreur update property:', e);
    return res.status(500).json({ error: 'Erreur lors de la mise à jour du bien' });
  }
};

/* ============================================================
   🗑️ SUPPRIMER un bien
============================================================ */
exports.remove = async (req, res) => {
  try {
    const id = toSafeInt(req.params.id);
    const p = await Property.findByPk(id);
    if (!p) return res.status(404).json({ error: 'Bien introuvable' });

    if (req.user.role !== 'admin' && String(p.ownerId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    await p.destroy();
    return res.json({ message: 'Bien supprimé' });
  } catch (e) {
    console.error('❌ Erreur delete property:', e);
    return res.status(500).json({ error: 'Erreur lors de la suppression du bien' });
  }
};
