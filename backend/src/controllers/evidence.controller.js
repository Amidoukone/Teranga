'use strict';

const { Evidence, Task, Service, Property, User, Order } = require('../../models');
const { Op } = require('sequelize');
const imageKit = require('../helpers/teranga-imagekit'); // 🔥 toujours correct ici

// 🌍 Labels
const { EVIDENCE_KINDS, getLabel } = require('../utils/labels');

/* ======================================================
   🛡️ Vérifier si ImageKit est activé
====================================================== */
function isImageKitEnabled() {
  return Boolean(
    process.env.IMAGEKIT_PUBLIC_KEY &&
      process.env.IMAGEKIT_PRIVATE_KEY &&
      process.env.IMAGEKIT_URL_ENDPOINT
  );
}

/* ======================================================
   🧩 Helpers utilitaires
====================================================== */
function toSafeInt(v) {
  if (v === null || v === undefined) return null;
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}

function guessKind(mime) {
  if (!mime) return 'other';
  if (mime.startsWith('image/')) return 'photo';
  if (mime === 'application/pdf') return 'document';
  return 'other';
}

function addLabels(evidence) {
  if (!evidence) return null;
  const e = evidence.toJSON ? evidence.toJSON() : evidence;

  let uploaderName = null;
  if (e.uploader) {
    const fn = e.uploader.firstName || e.uploader.firstname || '';
    const ln = e.uploader.lastName || e.uploader.lastname || '';
    const full = `${fn} ${ln}`.trim();
    uploaderName = full || e.uploader.email || null;
  }

  return {
    ...e,
    kindLabel: getLabel(e.kind, EVIDENCE_KINDS),
    uploaderName,
  };
}

/* ======================================================
   🔐 ACL — Tâches
====================================================== */
async function loadTaskForAcl(taskId) {
  if (!taskId) return null;
  return Task.findByPk(taskId, {
    include: [
      { model: Service, as: 'service', attributes: ['id', 'clientId', 'agentId'] },
      { model: Property, as: 'property', attributes: ['id', 'ownerId'] },
    ],
  });
}

function canAccessTask(user, task) {
  if (!user || !task) return false;
  if (user.role === 'admin') return true;

  if (user.role === 'agent') {
    if (task.assignedTo === user.id) return true;
    if (task.service && task.service.agentId === user.id) return true;
    return false;
  }

  if (user.role === 'client') {
    if (task.creatorId === user.id) return true;
    if (task.service && task.service.clientId === user.id) return true;
    if (task.property && task.property.ownerId === user.id) return true;
    return false;
  }

  return false;
}

/* ======================================================
   🔐 ACL — Commandes
====================================================== */
async function loadOrderForAcl(orderId) {
  if (!orderId) return null;
  return Order.findByPk(orderId);
}

function canAccessOrder(user, order) {
  if (!user || !order) return false;
  if (user.role === 'admin') return true;

  const uid = String(user.id);
  const oUser = order.userId != null ? String(order.userId) : null;
  const oClient = order.clientId != null ? String(order.clientId) : null;
  const oAgent = order.agentId != null ? String(order.agentId) : null;

  if (user.role === 'client') {
    return oUser === uid || oClient === uid;
  }

  if (user.role === 'agent') {
    return oAgent === uid;
  }

  return false;
}

/* ======================================================
   🧰 Normalisation des fichiers envoyés
====================================================== */
function normalizeUploadedFiles(req) {
  if (req.file) return [req.file];
  if (Array.isArray(req.files)) return req.files;

  if (req.files && typeof req.files === 'object') {
    const out = [];
    for (const arr of Object.values(req.files)) {
      if (Array.isArray(arr)) out.push(...arr);
    }
    return out;
  }
  return [];
}

/* ======================================================
   🔼 Upload — wrapper sécurisé ImageKit
====================================================== */
async function uploadToImageKit(file) {
  if (!isImageKitEnabled()) {
    console.warn('⚠️ ImageKit désactivé — upload ignoré');
    return {
      url: null,
      fileId: null,
    };
  }

  try {
    const uploaded = await imageKit.upload({
      file: file.buffer,
      fileName: `evidence_${Date.now()}_${file.originalname}`,
      folder: '/teranga/evidences',
    });

    return {
      url: uploaded.url,
      fileId: uploaded.fileId,
    };
  } catch (err) {
    console.error(`❌ Échec upload ImageKit (${file.originalname}):`, err);
    return {
      url: null,
      fileId: null,
    };
  }
}

/* ======================================================
   📸 CREATE — Upload Evidence
====================================================== */
exports.create = async (req, res) => {
  try {
    const taskId = toSafeInt(req.body?.taskId);
    const orderId = toSafeInt(req.body?.orderId);
    const notes = req.body?.notes || null;

    if (!taskId && !orderId)
      return res.status(400).json({ error: 'taskId ou orderId requis' });

    let task = null;
    let order = null;

    // Vérification ACL tâche
    if (taskId) {
      task = await loadTaskForAcl(taskId);
      if (!task) return res.status(404).json({ error: 'Tâche introuvable' });
      if (!canAccessTask(req.user, task))
        return res.status(403).json({ error: 'Accès interdit (tâche)' });
    }

    // Vérification ACL commande
    if (orderId) {
      order = await loadOrderForAcl(orderId);
      if (!order) return res.status(404).json({ error: 'Commande introuvable' });
      if (!canAccessOrder(req.user, order))
        return res.status(403).json({ error: 'Accès interdit (commande)' });
    }

    const files = normalizeUploadedFiles(req);
    if (!files.length)
      return res.status(400).json({ error: 'Aucun fichier fourni' });

    const created = [];

    for (const f of files) {
      // 🚀 Upload ImageKit sécurisé
      const uploaded = await uploadToImageKit(f);

      const record = await Evidence.create({
        taskId: task ? task.id : taskId,
        orderId: order ? order.id : orderId,
        uploaderId: req.user.id,

        // Métadonnées fichier
        kind: guessKind(f.mimetype),
        mimeType: f.mimetype || null,
        originalName: f.originalname || null,
        filePath: uploaded.url,   // URL CDN
        fileId: uploaded.fileId,   // Nécessaire pour delete
        fileSize: f.size || null,
        thumbnailPath: null,

        notes,
      });

      created.push(record);
    }

    const withIncludes = await Evidence.findAll({
      where: { id: { [Op.in]: created.map((c) => c.id) } },
      include: [
        { model: User, as: 'uploader', attributes: ['id', 'firstName', 'lastName', 'email'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.status(201).json({
      message: 'Preuve(s) ajoutée(s) avec succès',
      evidences: withIncludes.map(addLabels),
    });
  } catch (e) {
    console.error('❌ create evidence:', e);
    return res.status(500).json({ error: 'Erreur lors de l’ajout des preuves' });
  }
};

/* ======================================================
   📋 LIST — Filtrage par ACL
====================================================== */
exports.list = async (req, res) => {
  try {
    const taskId = toSafeInt(req.query?.taskId);
    const orderId = toSafeInt(req.query?.orderId);

    if (req.user.role !== 'admin' && !taskId && !orderId) {
      return res.status(400).json({ error: 'taskId ou orderId requis' });
    }

    const where = {};

    // Tâche
    if (taskId) {
      const task = await loadTaskForAcl(taskId);
      if (!task) return res.status(404).json({ error: 'Tâche introuvable' });
      if (!canAccessTask(req.user, task))
        return res.status(403).json({ error: 'Accès interdit (tâche)' });
      where.taskId = taskId;
    }

    // Commande
    if (orderId) {
      const order = await loadOrderForAcl(orderId);
      if (!order) return res.status(404).json({ error: 'Commande introuvable' });
      if (!canAccessOrder(req.user, order))
        return res.status(403).json({ error: 'Accès interdit (commande)' });
      where.orderId = orderId;
    }

    const evidences = await Evidence.findAll({
      where,
      include: [{ model: User, as: 'uploader', attributes: ['id', 'firstName', 'lastName', 'email'] }],
      order: [['createdAt', 'DESC']],
    });

    return res.json({ evidences: evidences.map(addLabels) });
  } catch (e) {
    console.error('❌ list evidences:', e);
    return res.status(500).json({ error: 'Erreur lors de la récupération des preuves' });
  }
};

/* ======================================================
   📂 LIST BY TASK
====================================================== */
exports.listByTask = async (req, res) => {
  try {
    const taskId = toSafeInt(req.params?.id);
    if (!taskId) return res.status(400).json({ error: 'ID de tâche invalide' });

    const task = await loadTaskForAcl(taskId);
    if (!task) return res.status(404).json({ error: 'Tâche introuvable' });
    if (!canAccessTask(req.user, task))
      return res.status(403).json({ error: 'Accès interdit' });

    const evidences = await Evidence.findAll({
      where: { taskId },
      include: [{ model: User, as: 'uploader', attributes: ['id', 'firstName', 'lastName', 'email'] }],
      order: [['createdAt', 'DESC']],
    });

    return res.json({ evidences: evidences.map(addLabels) });
  } catch (e) {
    console.error('❌ listByTask:', e);
    return res.status(500).json({ error: 'Erreur lors de la récupération des preuves' });
  }
};

/* ======================================================
   📦 LIST BY ORDER
====================================================== */
exports.listByOrder = async (req, res) => {
  try {
    const orderId = toSafeInt(req.params?.id);
    if (!orderId) return res.status(400).json({ error: 'ID de commande invalide' });

    const order = await loadOrderForAcl(orderId);
    if (!order) return res.status(404).json({ error: 'Commande introuvable' });
    if (!canAccessOrder(req.user, order))
      return res.status(403).json({ error: 'Accès interdit' });

    const evidences = await Evidence.findAll({
      where: { orderId },
      include: [{ model: User, as: 'uploader', attributes: ['id', 'firstName', 'lastName', 'email'] }],
      order: [['createdAt', 'DESC']],
    });

    return res.json({ evidences: evidences.map(addLabels) });
  } catch (e) {
    console.error('❌ listByOrder:', e);
    return res.status(500).json({ error: 'Erreur lors de la récupération des preuves' });
  }
};

/* ======================================================
   🗑️ DELETE — suppression ImageKit + ACL 100% sécurisée
====================================================== */
exports.remove = async (req, res) => {
  try {
    const id = toSafeInt(req.params?.id);
    if (!id) return res.status(400).json({ error: 'ID invalide' });

    const ev = await Evidence.findByPk(id, {
      include: [
        { model: User, as: 'uploader', attributes: ['id', 'email', 'role'] },
        {
          model: Task,
          as: 'task',
          include: [{ model: Service, as: 'service' }],
        },
      ],
    });

    if (!ev) return res.status(404).json({ error: 'Preuve introuvable' });

    // Seul un admin peut supprimer
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Suppression réservée aux administrateurs.' });
    }

    // Suppression ImageKit
    if (ev.fileId && isImageKitEnabled()) {
      try {
        await imageKit.deleteFile(ev.fileId);
      } catch (e) {
        console.warn('⚠️ Impossible de supprimer le fichier ImageKit:', e.message);
      }
    }

    await ev.destroy();
    return res.json({ message: 'Preuve supprimée avec succès' });
  } catch (e) {
    console.error('❌ remove evidence:', e);
    return res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
};
