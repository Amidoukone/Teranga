'use strict';
const { Op } = require('sequelize');
const db = require('../../models');
const { canAccessGeoResource } = require('../utils/geoScope');
const covers = (resource, user) => canAccessGeoResource(resource, user, { strictRegionScope: true });

// Locking reads see reservations committed by concurrent workers, even under REPEATABLE READ.
async function agentLoad(userId, transaction) {
  const options = { attributes: ['id'], transaction, ...(transaction ? { lock: true } : {}) };
  const services = await db.Service.findAll({ ...options, where: { agentId: userId, executionType: 'agent', [Op.or]: [
    { missionStatus: { [Op.in]: ['CREATED', 'SEARCHING_EXECUTOR', 'ASSIGNED', 'EN_ROUTE', 'ON_SITE', 'IN_PROGRESS', 'DISPUTED', 'RESOLVED_REDO'] } },
    { missionStatus: null, status: { [Op.in]: ['created', 'in_progress'] } },
  ] } });
  const projects = await db.Project.findAll({ ...options, where: { agentId: userId, status: { [Op.in]: ['created', 'in_progress'] } } });
  const orders = await db.WorkCoordination.findAll({ ...options, where: { entityType: 'order', executorUserId: userId, state: { [Op.ne]: 'closed' } } });
  return services.length + projects.length + orders.length;
}

// Version groupée de agentLoad pour éviter une requête (x3) par agent quand la charge de
// plusieurs agents doit être évaluée en même temps (ex: audit de préparation territoriale).
async function agentLoadBatch(userIds, transaction) {
  const ids = [...new Set((userIds || []).map(String))].filter(Boolean);
  const counts = new Map(ids.map((id) => [id, 0]));
  if (!ids.length) return counts;
  const options = { transaction, ...(transaction ? { lock: true } : {}) };
  const [services, projects, orders] = await Promise.all([
    db.Service.findAll({ ...options, attributes: ['agentId'], where: { agentId: { [Op.in]: ids }, executionType: 'agent', [Op.or]: [
      { missionStatus: { [Op.in]: ['CREATED', 'SEARCHING_EXECUTOR', 'ASSIGNED', 'EN_ROUTE', 'ON_SITE', 'IN_PROGRESS', 'DISPUTED', 'RESOLVED_REDO'] } },
      { missionStatus: null, status: { [Op.in]: ['created', 'in_progress'] } },
    ] } }),
    db.Project.findAll({ ...options, attributes: ['agentId'], where: { agentId: { [Op.in]: ids }, status: { [Op.in]: ['created', 'in_progress'] } } }),
    db.WorkCoordination.findAll({ ...options, attributes: ['executorUserId'], where: { entityType: 'order', executorUserId: { [Op.in]: ids }, state: { [Op.ne]: 'closed' } } }),
  ]);
  for (const row of services) counts.set(String(row.agentId), (counts.get(String(row.agentId)) || 0) + 1);
  for (const row of projects) counts.set(String(row.agentId), (counts.get(String(row.agentId)) || 0) + 1);
  for (const row of orders) counts.set(String(row.executorUserId), (counts.get(String(row.executorUserId)) || 0) + 1);
  return counts;
}

async function reserveAgent(resource, transaction, now = new Date(), { excludedAgentIds = [] } = {}) {
  const candidates = await db.AgentCapacity.findAll({ where: { available: true, availableUntil: { [Op.gt]: now }, ...(excludedAgentIds.length ? { userId: { [Op.notIn]: excludedAgentIds } } : {}) },
    include: [{ model: db.User, as: 'user', required: true, where: { role: 'agent', countryId: resource.countryId } }],
    order: [['lastAssignedAt', 'ASC'], ['userId', 'ASC']], transaction });
  for (const candidate of candidates) {
    if (!covers(resource, candidate.user)) continue;
    const capacity = await db.AgentCapacity.findByPk(candidate.userId, { transaction, lock: true });
    const user = await db.User.findByPk(candidate.userId, { transaction });
    if (!capacity?.available || !capacity.availableUntil || new Date(capacity.availableUntil) <= now || user?.role !== 'agent' || !covers(resource, user)) continue;
    if (await agentLoad(candidate.userId, transaction) >= capacity.maxConcurrent) continue;
    await capacity.update({ lastAssignedAt: now }, { transaction });
    return user;
  }
  return null;
}

module.exports = { agentLoad, agentLoadBatch, reserveAgent };
