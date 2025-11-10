'use strict';

const { Op } = require('sequelize');
const { Transaction, User, Service, Task } = require('../../models');

/* --------- Helpers --------- */
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
function getPagination(req, defaultLimit = 25, maxLimit = 200) {
  const limit = Math.min(Math.max(parseInt(req.query.limit || defaultLimit), 1), maxLimit);
  const offset = Math.max(parseInt(req.query.offset || 0), 0);
  return { limit, offset };
}

/* --------- ACL Builder --------- */
function buildWhereWithACL(req) {
  const where = {};
  const sid = toSafeInt(req.query.serviceId);
  const tid = toSafeInt(req.query.taskId);

  if (sid) where.serviceId = sid;
  if (tid) where.taskId = tid;

  if (req.query.type) where.type = req.query.type;
  if (req.query.status) where.status = req.query.status;
  if (req.query.startDate && req.query.endDate) {
    where.createdAt = { [Op.between]: [new Date(req.query.startDate), new Date(req.query.endDate)] };
  }

  // IMPORTANT : chemins $alias.colonne$ ⇒ nécessite includes (required:false)
  const role = req.user.role;
  if (role === 'admin') {
    // admin ne nécessite pas d’OR ACL, mais on garde la recherche texte
  } else if (role === 'agent') {
    where[Op.or] = [
      { userId: req.user.id },
      { '$service.agentId$': req.user.id },
      { '$task.assignedTo$': req.user.id }
    ];
  } else if (role === 'client') {
    where[Op.or] = [
      { userId: req.user.id },
      { '$service.clientId$': req.user.id },
      { '$task.creatorId$': req.user.id }
    ];
  }

  const q = (req.query.q || '').trim();
  if (q) where.description = { [Op.like]: `%${q}%` };

  return where;
}

/** 
 * ✅ Un seul include par alias, required:false, pour autoriser les chemins $alias.col$
 *    et remonter les métadonnées pour l’affichage.
 */
const COMMON_INCLUDE = [
  { model: User,    as: 'user',    required: false, attributes: ['id','firstName','lastName','email','role'] },
  { model: Service, as: 'service', required: false, attributes: ['id','title','clientId','agentId'] },
  { model: Task,    as: 'task',    required: false, attributes: ['id','title','serviceId','assignedTo','creatorId'] },
];

module.exports = {
  toSafeInt,
  toNullableNumber,
  toTrimOrNull,
  getPagination,
  buildWhereWithACL,
  COMMON_INCLUDE
};
