// backend/src/controllers/evidence.controller.js
'use strict';

const path = require('path');
const fs = require('fs/promises');
const { Evidence, Task, Service, Property, User, Order } = require('../../models');
const { Op } = require('sequelize');

// 🌍 Dictionnaire de labels
const { EVIDENCE_KINDS, getLabel } = require('../utils/labels');

/* ======================================================
   🧩 Helpers utilitaires
====================================================== */
function toSafeInt(v) {
  if (v === null || v === undefined) return null;
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * Construit une URL de fichier POSIX relative (stable en prod)
 * → ex: /uploads/evidences/12345-file.jpg
 */
function buildEvidencePath(filename) {
  // path.posix garantit des "/" même si le serveur tourne sur Windows
  return path.posix.join('/uploads/evidences', filename);
}

function guessKind(mime) {
  if (!mime) return 'other';
  if (mime.startsWith('image/')) return 'photo';
  if (mime === 'application/pdf') return 'document';
  return 'other';
}

/**
 * 🏷️ Ajoute les labels + quelques alias utiles au front
 */
function addLabels(evidence) {
  if (!evidence) return null;
  const e = evidence.toJSON ? evidence.toJSON() : evidence;

  // Construit un nom complet uploaderName (fallback email)
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
   🔐 Chargement & ACL — TÂCHES
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
   🔐 Chargement & ACL — COMMANDES
   (défensif : userId | clientId | agentId possibles)
====================================================== */
async function loadOrderForAcl(orderId) {
  if (!orderId) return null;
  return Order.findByPk(orderId);
}

function canAccessOrder(user, order) {
  if (!user || !order) return false;
  if (user.role === 'admin') return true;

  const uid = String(user.id);
  const oUser   = order.userId   != null ? String(order.userId)   : null;
  const oClient = order.clientId != null ? String(order.clientId) : null;
  const oAgent  = order.agentId  != null ? String(order.agentId)  : null;

  if (user.role === 'client') {
    if (oUser && oUser === uid) return true;
    if (oClient && oClient === uid) return true;
    return false;
  }

  if (user.role === 'agent') {
    if (oAgent && oAgent === uid) return true;
    return false;
  }

  return false;
}

/* ======================================================
   🧰 Normalisation des fichiers envoyés (clé pour éviter 400)
   - Supporte req.files = Array (upload.array('files'))
   - Supporte req.files = { champ1:[..], champ2:[..] } (upload.fields([...]))
   - Supporte aussi le cas où Multer met un seul champ: req.file
====================================================== */
function normalizeUploadedFiles(req) {
  // Cas multer.single() (au cas où)
  if (req.file) return [req.file];

  // Cas array direct
  if (Array.isArray(req.files)) return req.files;

  // Cas fields: { files:[...], proofFile:[...], ... }
  if (req.files && typeof req.files === 'object') {
    const out = [];
    for (const key of Object.keys(req.files)) {
      const arr = req.files[key];
      if (Array.isArray(arr)) out.push(...arr);
    }
    return out;
  }

  return [];
}

/* ======================================================
   📸 Créer une ou plusieurs preuves
   ➕ Support taskId OU orderId (un des deux requis)
====================================================== */
exports.create = async (req, res) => {
  try {
    const taskId = toSafeInt(req.body?.taskId);
    const orderId = toSafeInt(req.body?.orderId);
    const notes = (req.body?.notes ?? null) || null;

    if (!taskId && !orderId) {
      return res.status(400).json({ error: 'taskId ou orderId requis' });
    }

    // Contexte + ACL
    let task = null;
    let order = null;

    if (taskId) {
      task = await loadTaskForAcl(taskId);
      if (!task) return res.status(404).json({ error: 'Tâche introuvable' });
      if (!canAccessTask(req.user, task)) {
        return res.status(403).json({ error: 'Accès interdit (tâche)' });
      }
    }

    if (orderId) {
      order = await loadOrderForAcl(orderId);
      if (!order) return res.status(404).json({ error: 'Commande introuvable' });
      if (!canAccessOrder(req.user, order)) {
        return res.status(403).json({ error: 'Accès interdit (commande)' });
      }
    }

    const files = normalizeUploadedFiles(req);
    if (!files.length) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const created = [];
    for (const f of files) {
      const record = await Evidence.create({
        taskId: task ? task.id : (taskId || null),
        orderId: order ? order.id : (orderId || null),
        uploaderId: req.user.id,
        kind: guessKind(f.mimetype),
        mimeType: f.mimetype || null,
        originalName: f.originalname || null,
        filePath: buildEvidencePath(f.filename), // ✅ chemin relatif POSIX
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

    const evidencesWithLabels = withIncludes.map(addLabels);

    return res.status(201).json({
      message: 'Preuve(s) ajoutée(s) avec succès',
      evidences: evidencesWithLabels,
    });
  } catch (e) {
    console.error('❌ Erreur create evidence:', e);
    return res.status(500).json({ error: "Erreur lors de l'ajout des preuves" });
  }
};

/* ======================================================
   📋 Liste des preuves (ACL)
   Support ?taskId=... ou ?orderId=...
   - Admin : peut lister sans filtre
   - Agent/Client : doivent fournir taskId ou orderId
====================================================== */
exports.list = async (req, res) => {
  try {
    const taskId = toSafeInt(req.query?.taskId);
    const orderId = toSafeInt(req.query?.orderId);

    if (req.user.role !== 'admin' && !taskId && !orderId) {
      return res.status(400).json({ error: 'taskId ou orderId requis pour ce rôle' });
    }

    const where = {};

    if (taskId) {
      const task = await loadTaskForAcl(taskId);
      if (!task) return res.status(404).json({ error: 'Tâche introuvable' });
      if (!canAccessTask(req.user, task)) {
        return res.status(403).json({ error: 'Accès interdit (tâche)' });
      }
      where.taskId = taskId;
    }

    if (orderId) {
      const order = await loadOrderForAcl(orderId);
      if (!order) return res.status(404).json({ error: 'Commande introuvable' });
      if (!canAccessOrder(req.user, order)) {
        return res.status(403).json({ error: 'Accès interdit (commande)' });
      }
      where.orderId = orderId;
    }

    const evidences = await Evidence.findAll({
      where,
      include: [
        { model: User, as: 'uploader', attributes: ['id', 'firstName', 'lastName', 'email'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.json({ evidences: evidences.map(addLabels) });
  } catch (e) {
    console.error('❌ Erreur list evidences:', e);
    return res.status(500).json({ error: "Erreur lors de la récupération des preuves" });
  }
};

/* ======================================================
   📂 Alias — Liste des preuves d’une tâche
====================================================== */
exports.listByTask = async (req, res) => {
  try {
    const taskId = toSafeInt(req.params?.id);
    if (!taskId) return res.status(400).json({ error: 'ID de tâche invalide' });

    const task = await loadTaskForAcl(taskId);
    if (!task) return res.status(404).json({ error: 'Tâche introuvable' });
    if (!canAccessTask(req.user, task)) {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const evidences = await Evidence.findAll({
      where: { taskId },
      include: [
        { model: User, as: 'uploader', attributes: ['id', 'firstName', 'lastName', 'email'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.json({ evidences: evidences.map(addLabels) });
  } catch (e) {
    console.error('❌ Erreur listByTask evidences:', e);
    return res.status(500).json({ error: "Erreur lors de la récupération des preuves" });
  }
};

/* ======================================================
   🆕 Alias — Liste des preuves d’une commande
====================================================== */
exports.listByOrder = async (req, res) => {
  try {
    const orderId = toSafeInt(req.params?.id);
    if (!orderId) return res.status(400).json({ error: 'ID de commande invalide' });

    const order = await loadOrderForAcl(orderId);
    if (!order) return res.status(404).json({ error: 'Commande introuvable' });
    if (!canAccessOrder(req.user, order)) {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const evidences = await Evidence.findAll({
      where: { orderId },
      include: [
        { model: User, as: 'uploader', attributes: ['id', 'firstName', 'lastName', 'email'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.json({ evidences: evidences.map(addLabels) });
  } catch (e) {
    console.error('❌ Erreur listByOrder evidences:', e);
    return res.status(500).json({ error: "Erreur lors de la récupération des preuves" });
  }
};

/* ======================================================
   🗑️ Suppression sécurisée (admin)
====================================================== */
exports.remove = async (req, res) => {
  try {
    const id = toSafeInt(req.params?.id);
    if (!id) return res.status(400).json({ error: 'ID invalide' });

    const ev = await Evidence.findByPk(id, {
      include: [
        { model: User, as: 'uploader', attributes: ['id', 'email', 'role'] },
        // conservé pour compat avec d'autres écrans
        { model: Task, as: 'task', include: [{ model: Service, as: 'service' }] },
      ],
    });

    if (!ev) return res.status(404).json({ error: 'Preuve introuvable' });

    // 🔒 Admin-only
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Suppression réservée à un administrateur.' });
    }

    // 🧹 Supprime le fichier physique si présent
    if (ev.filePath) {
      // On retire un éventuel / ou \ au début du chemin relatif
      const relative = ev.filePath.replace(/^[/\\]/, '');
      const abs = path.join(__dirname, '../../', relative);
      try {
        await fs.unlink(abs);
      } catch {
        // Non bloquant : le fichier peut avoir déjà été supprimé
      }
    }

    await ev.destroy();
    return res.json({ message: 'Preuve supprimée avec succès' });
  } catch (e) {
    console.error('❌ Erreur remove evidence:', e);
    return res.status(500).json({ error: "Erreur lors de la suppression de la preuve" });
  }
};
