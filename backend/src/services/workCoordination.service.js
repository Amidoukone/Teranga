'use strict';
const { Op } = require('sequelize');
const db = require('../../models');
const { canAccessGeoResource } = require('../utils/geoScope');
const covers = (resource, user) => canAccessGeoResource(resource, user, { strictRegionScope: true });
const { normalizePolicy } = require('./missionCoordination.service');
const { reserveAgent, agentLoad } = require('./agentCapacity.service');
const { raiseEscalation, remindEscalation } = require('./coordinationSupervision.service');
const { invalidateNotificationSummary } = require('./notification.service');
const logger = require('../utils/logger');

const MODELS = { project: 'Project', order: 'Order' };
const TERMINAL = { project: ['validated', 'cancelled'], order: ['fulfilled', 'delivered', 'cancelled', 'refunded'] };
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
function modelFor(type) {
  if (!MODELS[type]) fail('Type de demande invalide');
  return db[MODELS[type]];
}
async function notify(operation, resource, title, transaction, extra = []) {
  const ids = [...new Set([operation.ownerUserId, operation.executorUserId, resource.clientId || resource.userId, ...extra].filter(Boolean).map(Number))];
  const fields = { actorId: null, entityType: operation.entityType, entityId: resource.id, action: 'status_updated', title,
    message: `${resource.title || resource.code || `#${resource.id}`} : ${operation.reason || resource.status}`,
    entityStatus: resource.status, progress: operation.state === 'closed' ? 'done' : 'in_progress',
    countryId: resource.countryId, regionId: resource.regionId,
    metadata: { [`${operation.entityType}Id`]: resource.id, coordinationState: operation.state } };
  await db.Notification.bulkCreate(ids.map((userId) => ({ ...fields, userId, status: 'unread' })), { transaction });
  await db.Activity.bulkCreate(ids.map((userId) => ({ ...fields, userId })), { transaction });
  transaction.afterCommit(() => invalidateNotificationSummary(ids));
}
async function coordinateWork(type, id, { now = new Date(), configure = null, actor = null } = {}) {
  const Model = modelFor(type);
  for (let retry = 0; ; retry += 1) {
    try {
      return await db.sequelize.transaction(async (transaction) => {
        const resource = await Model.findByPk(id, { transaction, lock: true });
        if (!resource) fail('Demande introuvable', 404);
        if (actor && !covers(resource, actor)) fail('Demande hors de votre périmètre', 403);
        let operation = await db.WorkCoordination.findOne({ where: { entityType: type, entityId: id }, transaction });
        if (!operation) {
          const admins = await db.User.findAll({ where: { role: 'admin' }, transaction });
          const owner = admins.filter((user) => covers(resource, user)).sort((a, b) =>
            Number(Boolean(b.regionId)) - Number(Boolean(a.regionId)) || Number(Boolean(b.countryId)) - Number(Boolean(a.countryId)) || a.id - b.id)[0];
          operation = await db.WorkCoordination.create({ entityType: type, entityId: id, ownerUserId: owner?.id || null,
            executorUserId: type === 'project' ? resource.agentId : null, mode: 'manual', state: 'waiting',
            policy: normalizePolicy({ stageMinutes: type === 'project' ? 1440 : 60 }), attempts: [], nextActionAt: now }, { transaction });
        }
        if (configure) {
          const owner = await db.User.findByPk(configure.ownerUserId || operation.ownerUserId, { transaction });
          if (owner?.role !== 'admin' || !covers(resource, owner)) fail('Un responsable couvrant la demande est requis');
          if (configure.executorUserId !== undefined && String(configure.executorUserId) !== String(operation.executorUserId)) {
            if (resource.status !== 'created') fail('Une prise en charge commencée exige une intervention du responsable avant toute réaffectation', 409);
            const executor = configure.executorUserId ? await db.User.findByPk(configure.executorUserId, { transaction }) : null;
            if (configure.executorUserId && (executor?.role !== 'agent' || !covers(resource, executor))) fail('Agent hors du périmètre de la demande');
            if (executor) {
              const [capacity] = await db.AgentCapacity.findOrCreate({ where: { userId: executor.id }, defaults: { available: false, maxConcurrent: 1 }, transaction });
              await capacity.reload({ transaction, lock: true });
              if (await agentLoad(executor.id, transaction) >= capacity.maxConcurrent) fail('La capacité de cet agent est atteinte', 409);
            }
            const previousExecutor = operation.executorUserId;
            if (type === 'project') await resource.update({ agentId: executor?.id || null }, { transaction });
            await operation.update({ executorUserId: executor?.id || null }, { transaction });
            await notify(operation, resource, 'Affectation mise à jour', transaction, [previousExecutor]);
          }
          const mode = configure.mode || operation.mode;
          const policy = normalizePolicy({ ...operation.policy, ...configure.policy,
            ...(mode === 'automatic' && operation.mode !== 'automatic' ? { searchStartedAt: now.toISOString() } : {}) });
          if (mode === 'automatic' && resource.status !== 'created' && operation.mode !== 'automatic') fail('La demande doit être en attente pour activer l’affectation automatique', 409);
          await operation.update({ ownerUserId: owner.id, mode, policy: { ...policy, supervision: null }, state: 'waiting', reason: null, nextActionAt: now }, { transaction });
          await notify(operation, resource, 'Coordination mise à jour', transaction);
        }
        if (TERMINAL[type].includes(resource.status)) {
          const wasClosed = operation.state === 'closed';
          await operation.update({ state: 'closed', observedStatus: resource.status, nextActionAt: null, reason: null }, { transaction });
          if (!wasClosed) await notify(operation, resource, 'Demande clôturée', transaction);
          return operation;
        }
        if (type === 'project' && String(operation.executorUserId) !== String(resource.agentId)) {
          await operation.update({ executorUserId: resource.agentId }, { transaction });
        }
        if (operation.state === 'escalated' && !configure) {
          if (operation.observedStatus != null && operation.observedStatus !== resource.status) {
            await operation.update({ state: 'waiting', reason: null, policy: { ...operation.policy, supervision: null }, nextActionAt: now }, { transaction });
          } else {
            await remindEscalation(operation, resource, type, transaction, now);
            return operation;
          }
        }
        const escalate = async (reason) => {
          await raiseEscalation(operation, reason, resource.status, transaction, now);
          await notify(operation, resource, 'Une intervention est nécessaire', transaction);
          return operation;
        };
        const owner = operation.ownerUserId ? await db.User.findByPk(operation.ownerUserId, { transaction }) : null;
        if (owner?.role !== 'admin' || !covers(resource, owner)) return escalate('RESPONSABLE_REQUIS');
        const policy = normalizePolicy(operation.policy);
        const lastAttempt = operation.attempts.at(-1);
        if (operation.mode === 'automatic' && lastAttempt?.startDeadlineAt && lastAttempt.outcome === 'assigned' && String(lastAttempt.agentId) === String(operation.executorUserId)) {
          if (resource.status === 'created' && new Date(lastAttempt.startDeadlineAt) > now) {
            await operation.update({ state: 'offered', nextActionAt: new Date(lastAttempt.startDeadlineAt) }, { transaction });
            return operation;
          }
          if (resource.status === 'created') {
            if (type === 'project') await resource.update({ agentId: null }, { transaction });
            await db.AgentCapacity.update({ available: false, availableUntil: null }, { where: { userId: lastAttempt.agentId }, transaction });
            await operation.update({ executorUserId: null, attempts: operation.attempts.map((attempt, index, list) => index === list.length - 1 ? { ...attempt, outcome: 'no_start', endedAt: now.toISOString() } : attempt), state: 'waiting', reason: 'DEMARRAGE_NON_CONFIRME', nextActionAt: now }, { transaction });
            await notify(operation, resource, 'Affectation libérée faute de démarrage confirmé', transaction, [lastAttempt.agentId]);
          } else {
            await operation.update({ attempts: operation.attempts.map((attempt, index, list) => index === list.length - 1 ? { ...attempt, outcome: 'started', startedAt: now.toISOString() } : attempt) }, { transaction });
          }
        }
        if (operation.mode === 'automatic' && !operation.executorUserId && resource.status === 'created') {
          if (operation.nextActionAt && new Date(operation.nextActionAt) > now) return operation;
          if (process.env.MISSION_COORDINATION_ENABLED === 'false') return escalate('COORDINATION_SUSPENDUE');
          const country = resource.countryId ? await db.Country.findByPk(resource.countryId, { transaction }) : null;
          const region = resource.regionId ? await db.Region.findByPk(resource.regionId, { transaction }) : null;
          if (!country?.isActive || (resource.regionId && (!region?.isActive || String(region.countryId) !== String(country.id)))) return escalate('OFFRE_LOCALE_INDISPONIBLE');
          if (operation.attempts.length >= policy.maxAttempts || now - new Date(policy.searchStartedAt || operation.createdAt) >= policy.searchMinutes * 60000) return escalate('RECHERCHE_EPUISEE');
          const agent = await reserveAgent(resource, transaction, now, { excludedAgentIds: operation.attempts.filter((attempt) => attempt.agentId).map((attempt) => attempt.agentId) });
          if (!agent) {
            await operation.update({ state: 'waiting', reason: 'AUCUN_EXECUTANT_DISPONIBLE', nextActionAt: new Date(now.getTime() + policy.retrySeconds * 1000) }, { transaction });
            return operation;
          }
          if (type === 'project') await resource.update({ agentId: agent.id }, { transaction });
          const startDeadline = new Date(now.getTime() + policy.startMinutes * 60000);
          await operation.update({ executorUserId: agent.id, state: 'offered', reason: null, observedStatus: resource.status,
            attempts: [...operation.attempts, { agentId: agent.id, assignedAt: now.toISOString(), startDeadlineAt: startDeadline.toISOString(), outcome: 'assigned' }],
            nextActionAt: startDeadline }, { transaction });
          await notify(operation, resource, `Agent affecté : démarrez dans l’application sous ${policy.startMinutes} minutes`, transaction);
          return operation;
        }
        if (operation.executorUserId) {
          const executor = await db.User.findByPk(operation.executorUserId, { transaction });
          if (executor?.role !== 'agent' || !covers(resource, executor)) return escalate('EXECUTANT_HORS_PERIMETRE');
        }
        if (operation.observedStatus !== resource.status || operation.state === 'waiting' || configure) {
          const minutes = resource.status === 'completed' ? policy.validationMinutes : policy.stageMinutes;
          const started = configure ? now : resource.updatedAt || resource.updated_at || resource.createdAt || resource.created_at || now;
          await operation.update({ state: 'accepted', reason: null, observedStatus: resource.status,
            nextActionAt: new Date(new Date(started).getTime() + minutes * 60000) }, { transaction });
        }
        if (operation.nextActionAt && new Date(operation.nextActionAt) <= now) return escalate('DELAI_ETAPE_DEPASSE');
        return operation;
      });
    } catch (error) {
      if (retry >= 2 || !['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.original?.code || error.parent?.code)) throw error;
      await new Promise((resolve) => setTimeout(resolve, (retry + 1) * 20));
    }
  }
}

async function runWorkCoordination({ now = new Date(), limit = 100 } = {}) {
  const [scheduler] = await db.OperationSchedulerState.findOrCreate({ where: { key: 'work_coordination' }, defaults: { startedAt: now } });
  const stats = { checked: 0, failed: 0 };
  for (const type of Object.keys(MODELS)) {
    const Model = modelFor(type);
    const createdField = Model.rawAttributes.created_at ? 'created_at' : 'createdAt';
    const rows = await Model.findAll({ where: { [Op.or]: [
      { '$workCoordination.id$': null, [createdField]: { [Op.gte]: scheduler.startedAt }, status: { [Op.notIn]: TERMINAL[type] } },
      { '$workCoordination.next_action_at$': { [Op.lte]: now }, '$workCoordination.state$': { [Op.ne]: 'closed' } },
      { '$workCoordination.state$': 'escalated', '$workCoordination.next_action_at$': null },
      { [Op.and]: [db.sequelize.where(db.sequelize.col(`${MODELS[type]}.status`), Op.ne, db.sequelize.col('workCoordination.observed_status'))] },
    ] }, include: [{ model: db.WorkCoordination, as: 'workCoordination', required: false, attributes: [] }],
    attributes: ['id'], order: [['id', 'ASC']], limit, subQuery: false });
    for (const row of rows) {
      stats.checked += 1;
      try { await coordinateWork(type, row.id, { now }); }
      catch (error) { stats.failed += 1; logger.error({ err: error, entityType: type, entityId: row.id }, 'work.coordination.failed'); }
    }
  }
  await scheduler.update(stats.failed ? { lastError: `${stats.failed} demande(s) en échec` } : { lastSuccessAt: now, lastError: null });
  return stats;
}
async function advanceWork(type, id, actor, { status, summary }) {
  const Model = modelFor(type);
  return db.sequelize.transaction(async (transaction) => {
    const resource = await Model.findByPk(id, { transaction, lock: true });
    if (!resource) fail('Demande introuvable', 404);
    const operation = await db.WorkCoordination.findOne({ where: { entityType: type, entityId: id }, transaction });
    if (!operation) fail('Cette demande doit être prise en charge dans la coordination', 409);
    const clientValidation = type === 'project' && actor.role === 'client' && String(resource.clientId) === String(actor.id) && status === 'validated';
    const assigned = actor.role === 'agent' && String(operation.executorUserId) === String(actor.id) && (type !== 'project' || String(resource.agentId) === String(actor.id));
    if (!clientValidation && (!(actor.role === 'admin' || assigned) || !covers(resource, actor))) fail('Action non autorisée', 403);
    if (resource.status === status) return resource;
    const transitions = type === 'project' ? { created: ['in_progress'], in_progress: ['completed'], completed: ['validated'] }
      : { created: ['processing'], paid: ['processing', 'shipped'], processing: ['shipped'], shipped: ['delivered'] };
    if (!transitions[resource.status]?.includes(status)) fail('Transition de statut invalide', 409);
    if (status === 'validated' && !clientValidation) fail('La validation finale appartient au client', 403);
    let policy = operation.policy;
    if (['completed', 'delivered'].includes(status)) {
      if (!summary || summary.trim().length < 20 || summary.length > 4000) fail('Un compte rendu de 20 à 4 000 caractères est requis');
      if (type === 'project') {
        const phases = await db.ProjectPhase.findAll({ where: { projectId: id, status: { [Op.ne]: 'completed' } }, attributes: ['id'], transaction, lock: true });
        const tasks = await db.Task.findAll({ where: { projectId: id, status: { [Op.notIn]: ['completed', 'validated', 'cancelled'] } }, attributes: ['id'], transaction, lock: true });
        if (phases.length || tasks.length) fail('Terminez les phases et tâches du projet avant sa remise au client', 409);
      }
      const proof = type === 'project'
        ? await db.ProjectDocument.findOne({ where: { projectId: id, uploaderId: actor.id, kind: { [Op.in]: ['report', 'photo'] } }, transaction })
        : await db.Evidence.findOne({ where: { orderId: id, uploaderId: actor.id }, transaction });
      if (!proof) fail('Ajoutez un justificatif de réalisation à cette demande avant de la terminer', 409);
      policy = { ...policy, completionReport: { summary: summary.trim(), reporterId: actor.id, proofId: proof.id, submittedAt: new Date().toISOString() } };
    }
    await resource.update({ status }, { transaction });
    const closed = TERMINAL[type].includes(status);
    const minutes = status === 'completed' ? normalizePolicy(policy).validationMinutes : normalizePolicy(policy).stageMinutes;
    await operation.update({ policy, state: closed ? 'closed' : 'accepted', reason: null, observedStatus: status,
      nextActionAt: closed ? null : new Date(Date.now() + minutes * 60000) }, { transaction });
    await notify(operation, resource, closed ? 'Demande clôturée' : 'Avancement de votre demande', transaction);
    return resource;
  });
}
module.exports = { coordinateWork, runWorkCoordination, advanceWork, modelFor, TERMINAL };
