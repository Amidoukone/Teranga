'use strict';

const { Op } = require('sequelize');
const db = require('../../models');
const { applyGeoScopeForModel, canAccessGeoResource } = require('../utils/geoScope');
const { getPagination } = require('../utils/pagination');
const { coordinateMission, TERMINAL } = require('../services/missionCoordination.service');
const { loadFieldReadiness } = require('../services/fieldReadiness.service');
const { coordinateWork, advanceWork, modelFor, TERMINAL: WORK_TERMINAL } = require('../services/workCoordination.service');
const { agentLoad } = require('../services/agentCapacity.service');
const logger = require('../utils/logger');

function handleError(error, res) {
  if (error.status) return res.status(error.status).json({ error: error.message });
  if (error.original?.code === 'ER_NO_SUCH_TABLE' || error.parent?.code === 'ER_NO_SUCH_TABLE') {
    return res.status(503).json({ error: 'La préparation de la coordination doit être terminée avant son utilisation.', code: 'COORDINATION_MIGRATION_REQUIRED' });
  }
  logger.error({ err: error }, 'operations.request.failed');
  return res.status(500).json({ error: 'Impossible de charger le suivi opérationnel' });
}

exports.list = async (req, res) => {
  try {
    if (req.query.entityType && req.query.entityType !== 'service') return await listWork(req, res);
    const clauses = [];
    for (const field of ['countryId', 'regionId']) {
      if (req.query[field]) {
        const value = Number(req.query[field]);
        if (!Number.isSafeInteger(value) || value <= 0) return res.status(400).json({ error: 'Périmètre invalide' });
        clauses.push({ [field]: value });
      }
    }
    if (req.query.q) clauses.push({ [Op.or]: [{ title: { [Op.like]: `%${String(req.query.q).slice(0, 100)}%` } }, ...(Number.isInteger(Number(req.query.q)) ? [{ id: Number(req.query.q) }] : [])] });
    if (req.query.attention === 'true') clauses.push({ '$coordination.state$': 'escalated' });
    if (req.query.open !== 'false') clauses.push({ [Op.or]: [
      { missionStatus: { [Op.notIn]: TERMINAL } },
      { missionStatus: null, status: { [Op.in]: ['created', 'in_progress', 'completed'] } },
    ] });
    let where = applyGeoScopeForModel({}, req.user, db.Service);
    where = { [Op.and]: [where, ...clauses] };
    const pagination = getPagination(req, 25, 100);
    const { rows, count } = await db.Service.findAndCountAll({
      where, include: [
        { model: db.MissionCoordination, as: 'coordination', required: false, include: [{ model: db.User, as: 'owner', attributes: ['id', 'firstName', 'lastName', 'email'] }] },
        { model: db.TradeCategory, as: 'tradeCategory', attributes: ['id', 'name', 'slug'] },
        { model: db.Country, as: 'country', attributes: ['id', 'name', 'currency'] },
        { model: db.Region, as: 'region', attributes: ['id', 'name'] },
      ],
      order: [['createdAt', 'ASC'], ['id', 'ASC']], limit: pagination.limit, offset: pagination.offset,
      distinct: true, subQuery: false,
    });
    return res.json({ items: rows, pagination: { ...pagination, total: count }, serverTime: new Date().toISOString() });
  } catch (error) { return handleError(error, res); }
};

async function listWork(req, res) {
  const type = req.query.entityType;
  const Model = modelFor(type);
  const clauses = [applyGeoScopeForModel({}, req.user, Model)];
  for (const field of ['countryId', 'regionId']) if (req.query[field]) {
    const value = Number(req.query[field]);
    if (!Number.isSafeInteger(value) || value <= 0) return res.status(400).json({ error: 'Périmètre invalide' });
    clauses.push({ [field]: value });
  }
  if (req.query.attention === 'true') clauses.push({ '$workCoordination.state$': 'escalated' });
  if (req.query.open !== 'false') clauses.push({ status: { [Op.notIn]: WORK_TERMINAL[type] } });
  const pagination = getPagination(req, 25, 100);
  const { rows, count } = await Model.findAndCountAll({ where: { [Op.and]: clauses }, include: [
    { model: db.WorkCoordination, as: 'workCoordination', required: false, include: [
      { model: db.User, as: 'owner', attributes: ['id', 'email', 'firstName', 'lastName'] },
      { model: db.User, as: 'executor', attributes: ['id', 'firstName', 'lastName'] },
    ] },
    { model: db.Country, as: 'country', attributes: ['id', 'name', 'currency'] },
    { model: db.Region, as: 'region', attributes: ['id', 'name'] },
  ], order: [[Model.rawAttributes.created_at ? 'created_at' : 'createdAt', 'ASC'], ['id', 'ASC']], limit: pagination.limit, offset: pagination.offset, distinct: true, subQuery: false });
  return res.json({ items: rows.map((row) => ({ ...row.toJSON(), entityType: type, title: row.title || row.code,
    coordination: row.workCoordination })), pagination: { ...pagination, total: count }, serverTime: new Date().toISOString() });
}

exports.updateWork = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'Identifiant invalide' });
    return res.json({ coordination: await coordinateWork(req.params.type, id, { configure: req.body, actor: req.user }) });
  } catch (error) { return handleError(error, res); }
};
exports.capacity = async (req, res) => {
  try {
    if (req.user.role !== 'agent') return res.status(403).json({ error: 'Espace réservé aux agents' });
    const [capacity] = await db.AgentCapacity.findOrCreate({ where: { userId: req.user.id }, defaults: { available: false, maxConcurrent: 1 } });
    // Capacity changes are deliberately restricted to the agent's own profile.
    if (req.method === 'PATCH') {
      const { availableMinutes = 60, ...changes } = req.body;
      if (changes.available !== undefined) changes.availableUntil = changes.available ? new Date(Date.now() + availableMinutes * 60000) : null;
      await capacity.update(changes);
    }
    const value = capacity.toJSON();
    const fresh = Boolean(value.availableUntil && new Date(value.availableUntil) > new Date());
    return res.json({ capacity: { ...value, available: value.available && fresh, availabilityExpired: value.available && !fresh }, activeAssignments: await agentLoad(req.user.id) });
  } catch (error) { return handleError(error, res); }
};
exports.mine = async (req, res) => {
  try {
    if (req.user.role !== 'agent') return res.status(403).json({ error: 'Espace réservé aux agents' });
    const operations = await db.WorkCoordination.findAll({ where: { executorUserId: req.user.id, state: { [Op.ne]: 'closed' } }, order: [['nextActionAt', 'ASC']], limit: 100 });
    const items = [];
    for (const operation of operations) {
      const resource = await modelFor(operation.entityType).findByPk(operation.entityId);
      if (!resource || !canAccessGeoResource(resource, req.user) || WORK_TERMINAL[operation.entityType].includes(resource.status)) continue;
      if (operation.entityType === 'project' && String(resource.agentId) !== String(req.user.id)) continue;
      items.push({ ...resource.toJSON(), entityType: operation.entityType, coordination: operation });
    }
    return res.json({ items });
  } catch (error) { return handleError(error, res); }
};
exports.advance = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'Identifiant invalide' });
    return res.json({ resource: await advanceWork(req.params.type, id, req.user, req.body) });
  } catch (error) { return handleError(error, res); }
};

exports.detailWork = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'Identifiant invalide' });
    const type = req.params.type;
    const resource = await modelFor(type).findByPk(id);
    if (!resource) return res.status(404).json({ error: 'Demande introuvable' });
    const operation = await db.WorkCoordination.findOne({ where: { entityType: type, entityId: id } });
    const own = req.user.role === 'client' && String(resource.clientId || resource.userId) === String(req.user.id);
    const assigned = req.user.role === 'agent' && (type === 'project' ? String(resource.agentId) === String(req.user.id) : String(operation?.executorUserId) === String(req.user.id));
    const staff = (req.user.role === 'admin' || assigned) && canAccessGeoResource(resource, req.user);
    if (!own && !staff) return res.status(403).json({ error: 'Accès non autorisé' });
    return res.json({ item: { ...resource.toJSON(), entityType: type, coordination: operation }, canAdvance: staff, canValidate: type === 'project' && own });
  } catch (error) { return handleError(error, res); }
};

exports.update = async (req, res) => {
  try {
    const serviceId = Number(req.params.id);
    if (!Number.isSafeInteger(serviceId) || serviceId <= 0) return res.status(400).json({ error: 'Identifiant invalide' });
    const operation = await coordinateMission(serviceId, { configure: req.body, actor: req.user });
    return res.json({ coordination: operation });
  } catch (error) { return handleError(error, res); }
};

exports.readiness = async (req, res) => {
  try {
    const countryId = Number(req.query.countryId || req.user.countryId);
    const regionId = Number(req.query.regionId || req.user.regionId) || null;
    if (!Number.isSafeInteger(countryId) || countryId <= 0) return res.status(400).json({ error: 'Choisissez un pays pour vérifier sa préparation' });
    if (!canAccessGeoResource({ countryId, regionId }, req.user)) return res.status(403).json({ error: 'Pays hors de votre périmètre' });
    return res.json(await loadFieldReadiness(db, { countryId, regionId }));
  } catch (error) { return handleError(error, res); }
};
