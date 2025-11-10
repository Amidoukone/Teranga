'use strict';

const { Task, Service, User, Property, Evidence } = require('../../models');
const { Op } = require('sequelize');

// 🌍 Dictionnaire de labels
const {
  TASK_TYPES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  SERVICE_TYPES,
  SERVICE_STATUSES,
  getLabel,
} = require('../utils/labels');

/* ----------------------------- Helpers ----------------------------- */
function toSafeInt(v) {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}
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
function getPagination(req, defaultLimit = 50, maxLimit = 200) {
  const rawL = parseInt(req.query?.limit, 10);
  const rawO = parseInt(req.query?.offset, 10);
  const limit = Number.isFinite(rawL) ? Math.min(Math.max(rawL, 1), maxLimit) : defaultLimit;
  const offset = Number.isFinite(rawO) ? Math.max(rawO, 0) : 0;
  return { limit, offset };
}

/* ------------------------- Includes réutilisables ------------------------- */
const BASE_INCLUDES = [
  { model: User, as: 'creator', attributes: ['id', 'firstName', 'lastName', 'email'] },
  { model: User, as: 'assignee', attributes: ['id', 'firstName', 'lastName', 'email'], required: false },
  {
    model: Service,
    as: 'service',
    required: false,
    attributes: ['id', 'title', 'type', 'status', 'budget', 'clientId', 'agentId', 'propertyId'],
    include: [
      { model: User, as: 'client', attributes: ['id', 'firstName', 'lastName', 'email'] },
      { model: User, as: 'agent', attributes: ['id', 'firstName', 'lastName', 'email'], required: false },
      { model: Property, as: 'property', attributes: ['id', 'title', 'city', 'address'], required: false },
    ],
  },
  {
    model: Property,
    as: 'property',
    required: false,
    attributes: ['id', 'title', 'city', 'address', 'ownerId', 'photos'],
  },
  {
    model: Evidence,
    as: 'evidences',
    required: false,
    attributes: ['id', 'kind', 'mimeType', 'originalName', 'filePath', 'fileSize', 'notes', 'createdAt'],
    include: [{ model: User, as: 'uploader', attributes: ['id', 'firstName', 'lastName', 'email'] }],
  },
];

/* ======================================================
   🧩 Fonction utilitaire : ajoute les labels français
====================================================== */
function addLabels(task) {
  if (!task) return null;
  const t = task.toJSON ? task.toJSON() : task;
  return {
    ...t,
    statusLabel: getLabel(t.status, TASK_STATUSES),
    typeLabel: getLabel(t.type, TASK_TYPES),
    priorityLabel: getLabel(t.priority, TASK_PRIORITIES),
    service: t.service
      ? {
          ...t.service,
          statusLabel: getLabel(t.service.status, SERVICE_STATUSES),
          typeLabel: getLabel(t.service.type, SERVICE_TYPES),
        }
      : null,
  };
}

/* ------------------------------- CREATE ------------------------------- */
exports.create = async (req, res) => {
  console.log('\n🟢 [CREATE TASK] Requête reçue avec body:', req.body);
  try {
    let {
      serviceId,
      propertyId,
      title,
      type,
      description,
      priority,
      dueDate,
      estimatedCost,
      assignedTo,
    } = req.body || {};

    title = String(title || '').trim();
    type = String(type || '').trim();
    if (!title || !type) return res.status(400).json({ error: 'Titre et type requis' });

    const sid = toSafeInt(serviceId);
    let pid = propertyId ? toSafeInt(propertyId) : null;

    if (!pid && sid) {
      console.log('🔎 Recherche du propertyId via le serviceId:', sid);
      const serv = await Service.findByPk(sid, { attributes: ['propertyId'] });
      if (serv) {
        pid = serv.propertyId || null;
        console.log('✅ propertyId récupéré depuis service:', pid);
      }
    }

    const newTask = {
      serviceId: sid || null,
      propertyId: pid,
      creatorId: req.user.id,
      assignedTo: assignedTo ? toSafeInt(assignedTo) : null,
      title,
      type,
      description: toTrimOrNull(description),
      priority: priority || 'normal',
      dueDate: dueDate ? new Date(dueDate) : null,
      estimatedCost: toNullableNumber(estimatedCost),
      status: 'created',
    };
    console.log('🧱 Données utilisées pour création:', newTask);

    const task = await Task.create(newTask);
    console.log('✅ Tâche créée avec ID:', task.id);

    const reloaded = await Task.findByPk(task.id, { include: BASE_INCLUDES });
    return res.status(201).json({ message: 'Tâche créée', task: addLabels(reloaded) });
  } catch (e) {
    console.error('❌ [CREATE] Erreur création tâche:', e);
    if (e.errors) console.error('Détails Sequelize:', e.errors);
    return res.status(500).json({ error: e.message || 'Erreur lors de la création de la tâche' });
  }
};

/* -------------------------------- LIST -------------------------------- */
exports.list = async (req, res) => {
  console.log('\n🟡 [LIST TASKS] Récupération des tâches...');
  try {
    const { limit, offset } = getPagination(req);
    const qServiceId = toSafeInt(req.query?.serviceId);
    const qAssignedTo = toSafeInt(req.query?.assignedTo);
    const qStatus = req.query?.status ? String(req.query.status).trim() : null;
    const qType = req.query?.type ? String(req.query.type).trim() : null;
    const qPriority = req.query?.priority ? String(req.query.priority).trim() : null;

    const where = {};
    if (qServiceId) where.serviceId = qServiceId;
    if (qAssignedTo) where.assignedTo = qAssignedTo;
    if (qStatus) where.status = qStatus;
    if (qType) where.type = qType;
    if (qPriority) where.priority = qPriority;

    // ACL
    if (req.user?.role === 'agent') {
      where[Op.or] = [{ assignedTo: req.user.id }, { '$service.agentId$': req.user.id }];
    } else if (req.user?.role === 'client') {
      where[Op.or] = [
        { creatorId: req.user.id },
        { '$service.clientId$': req.user.id },
        { '$property.ownerId$': req.user.id },
      ];
    }

    console.log('📦 Filtres where:', where);
    console.log('👥 Utilisateur courant:', req.user?.id, req.user?.role);
    console.log('⚙️ Includes utilisés:', BASE_INCLUDES.map(i => i.as));

    const tasks = await Task.findAll({
      where,
      include: [...BASE_INCLUDES],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      subQuery: false,
    });

    console.log(`✅ ${tasks.length} tâche(s) récupérée(s).`);
    return res.json({
      tasks: tasks.map(addLabels),
      pagination: { limit, offset, count: tasks.length },
    });
  } catch (e) {
    console.error('❌ [LIST] Erreur récupération tâches:', e);
    if (e.errors) console.error('Détails Sequelize:', e.errors);
    return res.status(500).json({ error: e.message || 'Erreur lors de la récupération des tâches' });
  }
};

/* ---------------------- LIST BY SERVICE ---------------------- */
exports.listByService = async (req, res) => {
  console.log('\n🟢 [LIST BY SERVICE] serviceId:', req.params?.serviceId || req.params?.id);
  try {
    const serviceId = toSafeInt(req.params?.serviceId || req.params?.id);
    if (!serviceId) return res.status(400).json({ error: 'serviceId invalide' });

    const where = { serviceId };
    if (req.user?.role === 'agent') {
      where[Op.or] = [{ assignedTo: req.user.id }, { '$service.agentId$': req.user.id }];
    } else if (req.user?.role === 'client') {
      where[Op.or] = [{ creatorId: req.user.id }, { '$service.clientId$': req.user.id }];
    }

    console.log('📦 Filtres where (service):', where);

    const tasks = await Task.findAll({
      where,
      include: [...BASE_INCLUDES],
      order: [['createdAt', 'DESC']],
      subQuery: false,
    });

    console.log(`✅ ${tasks.length} tâche(s) récupérée(s) pour le service ${serviceId}`);
    return res.json({ tasks: tasks.map(addLabels) });
  } catch (e) {
    console.error('❌ [LIST BY SERVICE] Erreur:', e);
    if (e.errors) console.error('Détails Sequelize:', e.errors);
    return res.status(500).json({ error: e.message || 'Erreur lors de la récupération des tâches du service' });
  }
};

/* ---------------------------- UPDATE STATUS ---------------------------- */
exports.updateStatus = async (req, res) => {
  console.log('\n🟠 [UPDATE STATUS] Requête reçue:', req.params.id, req.body);
  try {
    const id = toSafeInt(req.params.id);
    const status = String(req.body?.status || '').trim();
    if (!id) return res.status(400).json({ error: 'ID invalide' });

    const task = await Task.findByPk(id, { include: BASE_INCLUDES });
    if (!task) return res.status(404).json({ error: 'Tâche introuvable' });

    console.log('🔎 Tâche actuelle:', { id: task.id, status: task.status, assignedTo: task.assignedTo });

    if (req.user?.role === 'agent' && task.assignedTo !== req.user.id) {
      console.warn('⛔ Agent non autorisé à modifier cette tâche');
      return res.status(403).json({ error: 'Non autorisé' });
    }
    if (req.user?.role === 'client' && task.creatorId !== req.user.id) {
      console.warn('⛔ Client non autorisé à modifier cette tâche');
      return res.status(403).json({ error: 'Non autorisé' });
    }

    const allowedTransitions = {
      created: ['in_progress'],
      in_progress: ['completed'],
      completed: ['validated'],
      validated: [],
      cancelled: [],
    };

    if (!allowedTransitions[task.status]?.includes(status)) {
      console.warn(`⛔ Transition ${task.status} → ${status} interdite`);
      return res.status(400).json({ error: `Transition ${task.status} → ${status} non autorisée` });
    }
    if (status === 'validated' && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Seul un admin peut valider une tâche' });
    }

    await task.update({ status });
    console.log('✅ Tâche mise à jour avec nouveau statut:', status);

    const updated = await Task.findByPk(task.id, { include: BASE_INCLUDES });
    return res.json({ message: 'Statut mis à jour', task: addLabels(updated) });
  } catch (e) {
    console.error('❌ [UPDATE STATUS] Erreur:', e);
    if (e.errors) console.error('Détails Sequelize:', e.errors);
    return res.status(500).json({ error: e.message || 'Erreur lors de la mise à jour du statut' });
  }
};

/* --------------------------- ASSIGN AGENT (ADMIN) --------------------------- */
exports.assignAgent = async (req, res) => {
  console.log('\n🟢 [ASSIGN AGENT] Tâche:', req.params.id, '→ Agent:', req.body?.agentId);
  try {
    const id = toSafeInt(req.params.id);
    const { agentId } = req.body;
    if (!id || !agentId) return res.status(400).json({ error: 'Paramètres manquants.' });

    const task = await Task.findByPk(id);
    if (!task) return res.status(404).json({ error: 'Tâche introuvable' });

    if (task.status !== 'created') {
      console.warn('⛔ Tentative de réassignation d’une tâche déjà en cours');
      return res.status(400).json({ error: 'Impossible de réassigner une tâche déjà en cours.' });
    }

    const agent = await User.findByPk(agentId);
    if (!agent || agent.role !== 'agent') {
      console.warn('⛔ Agent invalide ou non trouvé');
      return res.status(400).json({ error: 'Agent invalide.' });
    }

    await task.update({ assignedTo: agent.id });
    console.log('✅ Tâche assignée à l’agent:', agent.id);

    const updated = await Task.findByPk(task.id, { include: BASE_INCLUDES });
    return res.json({ message: 'Tâche assignée avec succès', task: addLabels(updated) });
  } catch (e) {
    console.error('❌ [ASSIGN AGENT] Erreur:', e);
    if (e.errors) console.error('Détails Sequelize:', e.errors);
    return res.status(500).json({ error: e.message || 'Erreur lors de l’assignation de la tâche' });
  }
};
