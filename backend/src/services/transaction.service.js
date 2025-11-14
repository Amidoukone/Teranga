'use strict';

const { Op } = require('sequelize');
const {
  Transaction,
  User,
  Service,
  Task,
  Order,
  Project,
} = require('../../models');

/* =========================================================
   🔧 Helpers génériques
========================================================= */
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

/**
 * Pagination robuste et rétro-compatible :
 * - supporte limit/offset
 * - expose aussi page (si fourni) sinon calculé depuis offset/limit
 */
function getPagination(req, defaultLimit = 25, maxLimit = 200) {
  const q = req?.query || {};

  const rawLimit = parseInt(q.limit ?? defaultLimit, 10);
  const limit = Math.min(
    Math.max(Number.isFinite(rawLimit) ? rawLimit : defaultLimit, 1),
    maxLimit
  );

  const hasPage = q.page !== undefined && q.page !== null && q.page !== '';
  const rawPage = parseInt(q.page ?? 1, 10);
  const page =
    hasPage && Number.isFinite(rawPage) && rawPage > 0 ? rawPage : null;

  const rawOffset = parseInt(q.offset ?? 0, 10);
  const offset = page
    ? (page - 1) * limit
    : Number.isFinite(rawOffset) && rawOffset >= 0
    ? rawOffset
    : 0;

  return { limit, offset, page: page || Math.floor(offset / limit) + 1 };
}

/* =========================================================
   🔐 WHERE + ACL par rôle
   - filtre par serviceId / taskId / orderId / projectId
   - applique les règles admin / agent / client
========================================================= */
function buildWhereWithACL(req) {
  const where = {};
  const sid = toSafeInt(req.query.serviceId);
  const tid = toSafeInt(req.query.taskId);
  const oid = toSafeInt(req.query.orderId);
  const pid = toSafeInt(req.query.projectId);

  // 🔗 filtres directs sur les IDs liés
  if (sid) where.serviceId = sid;
  if (tid) where.taskId = tid;
  if (oid) where.orderId = oid;
  if (pid) where.projectId = pid;

  // type / status
  if (req.query.type) where.type = req.query.type;
  if (req.query.status) where.status = req.query.status;

  // filtrage par date
  if (req.query.startDate && req.query.endDate) {
    const start = new Date(req.query.startDate);
    const end = new Date(req.query.endDate);
    if (
      Number.isFinite(start.getTime()) &&
      Number.isFinite(end.getTime())
    ) {
      where.createdAt = { [Op.between]: [start, end] };
    }
  }

  const role = req.user?.role;
  const userId = req.user?.id;

  // ======================================================
  // ACL par rôle
  // ======================================================
  if (role === 'admin') {
    // admin : accès complet → pas de contrainte supplémentaire
  } else if (role === 'agent') {
    // Agent :
    //  - transactions créées par lui
    //  - liées à un service dont il est agent
    //  - liées à une task qui lui est assignée
    //  - liées à un projet dont il est agent
    where[Op.or] = [
      { userId },
      { '$service.agentId$': userId },
      { '$task.assignedTo$': userId },
      { '$project.agentId$': userId },
    ];
  } else if (role === 'client') {
    // Client :
    //  - transactions créées par lui
    //  - liées à un service où il est client
    //  - liées à une task qu’il a créée
    //  - liées à un projet dont il est client
    where[Op.or] = [
      { userId },
      { '$service.clientId$': userId },
      { '$task.creatorId$': userId },
      { '$project.clientId$': userId },
    ];
  }

  // Recherche texte simple (description + paymentMethod)
  const q = (req.query.q || '').trim();
  if (q) {
    where[Op.and] = where[Op.and] || [];
    where[Op.and].push({
      [Op.or]: [
        { description: { [Op.like]: `%${q}%` } },
        { paymentMethod: { [Op.like]: `%${q}%` } },
      ],
    });
  }

  return where;
}

/* =========================================================
   🔗 Includes communs pour toutes les queries de Transaction
   - permet ACL avec $alias.colonne$
   - permet affichage (service, task, order, project, user)
========================================================= */
const COMMON_INCLUDE = [
  {
    model: User,
    as: 'user',
    required: false,
    attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
  },
  {
    model: Service,
    as: 'service',
    required: false,
    attributes: ['id', 'title', 'clientId', 'agentId'],
  },
  {
    model: Task,
    as: 'task',
    required: false,
    attributes: ['id', 'title', 'serviceId', 'assignedTo', 'creatorId'],
  },
  {
    model: Order,
    as: 'order',
    required: false,
    attributes: ['id', 'code', 'status', 'userId'],
  },
  {
    model: Project,
    as: 'project',
    required: false,
    attributes: ['id', 'title', 'clientId', 'agentId', 'status'],
  },
];

/* =========================================================
   🔐 canAccessTransaction
   - vérifie l'accès à une transaction donnée
   - recharge la transaction avec COMMON_INCLUDE si besoin
========================================================= */
async function canAccessTransaction(req, trx) {
  try {
    const role = req.user?.role;
    const userId = req.user?.id;
    if (!role || !userId) return false;
    if (role === 'admin') return true;

    // S’assurer d’avoir les alias nécessaires
    const hasAll =
      trx?.user ||
      trx?.service ||
      trx?.task ||
      trx?.order ||
      trx?.project;

    let t = trx;
    if (!hasAll) {
      t = await Transaction.findByPk(trx.id, {
        include: COMMON_INCLUDE,
      });
      if (!t) return false;
    }

    // propriétaire direct
    if (t.userId === userId) return true;

    if (role === 'agent') {
      if (t?.service && t.service.agentId === userId) return true;
      if (t?.task && t.task.assignedTo === userId) return true;
      if (t?.project && t.project.agentId === userId) return true;
      return false;
    }

    if (role === 'client') {
      if (t?.service && t.service.clientId === userId) return true;
      if (t?.task && t.task.creatorId === userId) return true;
      if (t?.project && t.project.clientId === userId) return true;
      if (t.userId === userId) return true;
      return false;
    }

    return false;
  } catch (e) {
    console.error('❌ canAccessTransaction error:', e);
    return false;
  }
}

module.exports = {
  toSafeInt,
  toNullableNumber,
  toTrimOrNull,
  getPagination,
  buildWhereWithACL,
  COMMON_INCLUDE,
  canAccessTransaction,
};
