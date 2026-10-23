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

async function reserveAgent(resource, transaction, now = new Date()) {
  const candidates = await db.AgentCapacity.findAll({ where: { available: true },
    include: [{ model: db.User, as: 'user', required: true, where: { role: 'agent', countryId: resource.countryId } }],
    order: [['lastAssignedAt', 'ASC'], ['userId', 'ASC']], transaction });
  for (const candidate of candidates) {
    if (!covers(resource, candidate.user)) continue;
    const capacity = await db.AgentCapacity.findByPk(candidate.userId, { transaction, lock: true });
    const user = await db.User.findByPk(candidate.userId, { transaction });
    if (!capacity?.available || user?.role !== 'agent' || !covers(resource, user)) continue;
    if (await agentLoad(candidate.userId, transaction) >= capacity.maxConcurrent) continue;
    await capacity.update({ lastAssignedAt: now }, { transaction });
    return user;
  }
  return null;
}

module.exports = { agentLoad, reserveAgent };
