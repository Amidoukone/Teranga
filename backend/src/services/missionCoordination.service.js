'use strict';

const { Op } = require('sequelize');
const db = require('../../models');
const { canAccessGeoResource } = require('../utils/geoScope');
const covers = (resource, user) => canAccessGeoResource(resource, user, { strictRegionScope: true });
const { activeOfferingWhere, activeCatalogIncludes } = require('./localCatalog.service');
const { ACTIVE_STATUSES, transitionMissionStatus } = require('./missionStatus.service');
const { findEligibleVehicleForProvider } = require('./mobilityCompliance.service');
const { haversineMeters } = require('./mobilityDispatch.service');
const { getLocationAgeSeconds, getLocationMaxAgeSeconds } = require('./providerPresence.service');
const { invalidateNotificationSummary } = require('./notification.service');
const { reserveAgent } = require('./agentCapacity.service');
const logger = require('../utils/logger');

const TERMINAL = ['CLOSED', 'CANCELLED_BY_CLIENT', 'NO_EXECUTOR_FOUND', 'RESOLVED_REFUND', 'RESOLVED_CLOSED'];
const DEFAULT_POLICY = Object.freeze({ enabled: false, maxAttempts: 3, radiusKm: 8, acceptanceSeconds: 120, retrySeconds: 60, searchMinutes: 30, stageMinutes: 60, validationMinutes: 1440 });
const SEARCHING = ['CREATED', 'SEARCHING_EXECUTOR'];
const same = (a, b) => String(a ?? '') === String(b ?? '');
const statusOf = (service) => service.missionStatus || service.status;
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const isSearching = (service) => SEARCHING.includes(service.missionStatus) || (!service.missionStatus && service.status === 'created' && !service.agentId);
const isClosed = (service) => TERMINAL.includes(service.missionStatus) || (!service.missionStatus && service.status === 'validated');

function normalizePolicy(input = {}) {
  const policy = { ...DEFAULT_POLICY, ...input };
  const bounds = { maxAttempts: [1, 10], acceptanceSeconds: [30, 3600], retrySeconds: [30, 3600], searchMinutes: [1, 1440], stageMinutes: [1, 10080], validationMinutes: [1, 10080] };
  for (const [field, [min, max]] of Object.entries(bounds)) {
    const number = Number(policy[field]);
    policy[field] = Number.isInteger(number) && number >= min && number <= max ? number : DEFAULT_POLICY[field];
  }
  policy.enabled = policy.enabled === true;
  policy.radiusKm = Number.isFinite(Number(input.radiusKm)) && Number(input.radiusKm) >= 1 && Number(input.radiusKm) <= 50 ? Number(input.radiusKm) : DEFAULT_POLICY.radiusKm;
  return policy;
}

async function activeOffering(service, transaction) {
  if (!service.countryId) return null;
  const definition = service.tradeCategoryId ? { legacyTradeCategoryId: service.tradeCategoryId } : { legacyServiceType: service.type };
  const offerings = await db.ServiceAvailability.findAll({
    where: activeOfferingWhere(), include: activeCatalogIncludes(service, definition), transaction,
    order: [['id', 'ASC']],
  });
  return offerings.find((offering) => offering.territory?.type === 'REGION') || offerings[0] || null;
}

async function findOwner(service, transaction) {
  const admins = await db.User.findAll({ where: { role: 'admin' }, transaction });
  return admins.filter((admin) => covers(service, admin)).sort((a, b) =>
    Number(Boolean(b.regionId)) - Number(Boolean(a.regionId)) ||
    Number(Boolean(b.countryId)) - Number(Boolean(a.countryId)) || a.id - b.id
  )[0] || null;
}

async function notify(operation, service, title, message, recipients, transaction) {
  const ids = [...new Set(recipients.filter(Boolean).map(Number))].filter((id) => !service.parentServiceId || !same(id, service.clientId));
  if (!ids.length) return;
  const fields = {
    actorId: null, entityType: 'service', entityId: service.id, action: 'status_updated', title, message,
    entityStatus: service.status, progress: isClosed(service) ? 'done' : 'in_progress',
    countryId: service.countryId, regionId: service.regionId,
    metadata: { serviceId: service.id, missionStatus: service.missionStatus, coordinationState: operation.state },
  };
  // Les notifications internes et le journal sont persistés avec la décision métier.
  await db.Notification.bulkCreate(ids.map((userId) => ({ ...fields, userId, status: 'unread' })), { transaction });
  await db.Activity.bulkCreate(ids.map((userId) => ({ ...fields, userId })), { transaction });
  transaction.afterCommit(() => invalidateNotificationSummary(ids));
}

async function initialize(service, transaction, now) {
  let operation = await db.MissionCoordination.findOne({ where: { serviceId: service.id }, transaction });
  if (operation) return operation;
  const offering = await activeOffering(service, transaction);
  const owner = await findOwner(service, transaction);
  const policy = normalizePolicy({
    ...(offering?.slaMinutes ? { stageMinutes: offering.slaMinutes } : {}),
    ...offering?.providerRules?.coordination,
  });
  policy.requiredEvidenceTypes = offering?.providerRules?.requiredEvidenceTypes || offering?.definition?.requiredEvidenceTypes || [];
  policy.serviceOutcome = offering?.providerRules?.serviceOutcome || offering?.definition?.description || null;
  policy.completionReportRequired = policy.enabled && offering?.definition?.executionProfile !== 'mobility';
  const automatic = policy.enabled && isSearching(service);
  if (automatic) policy.searchStartedAt = now.toISOString();
  operation = await db.MissionCoordination.create({
    serviceId: service.id, ownerUserId: owner?.id || null, policy, attempts: [],
    mode: automatic ? 'automatic' : 'manual', state: 'waiting', observedStatus: statusOf(service), nextActionAt: now,
  }, { transaction });
  return operation;
}

async function releaseProvider(providerId, service, transaction, { expired = false } = {}) {
  if (!providerId) return;
  const provider = await db.Provider.findByPk(providerId, { transaction, lock: true });
  if (!provider || provider.availabilityStatus !== 'busy') return;
  const occupied = await db.Service.findOne({ where: { id: { [Op.ne]: service.id }, providerId, missionStatus: { [Op.in]: ACTIVE_STATUSES } }, attributes: ['id'], transaction, lock: true });
  if (occupied) return;
  await provider.update({ availabilityStatus: expired ? 'offline' : 'available' }, { transaction });
}

async function escalate(operation, service, reason, transaction) {
  await operation.update({ state: 'escalated', reason, observedStatus: statusOf(service), nextActionAt: null }, { transaction });
  await notify(operation, service, 'Une intervention est nécessaire',
    `Demande #${service.id} : ${reason}. Votre responsable vérifie la suite à donner.`,
    [operation.ownerUserId, service.clientId], transaction);
}

function finishAttempt(operation, outcome, now) {
  return (operation.attempts || []).map((attempt, index, list) => index === list.length - 1 && attempt.outcome === 'offered'
    ? { ...attempt, outcome, endedAt: now.toISOString() } : attempt);
}

function isOfferingOpen(offering, country, now) {
  const hours = offering.openingHours;
  if (!hours || !Object.keys(hours).length) return true;
  const timezone = country.timezone;
  if (!timezone) return false;
  let parts;
  try { parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now); }
  catch (_error) { return false; }
  const part = (type) => parts.find((value) => value.type === type)?.value;
  const time = `${part('hour')}:${part('minute')}`;
  const intervals = hours[String(part('weekday')).toLowerCase()];
  return Array.isArray(intervals) && intervals.some((interval) =>
    Array.isArray(interval) && interval.length === 2 && /^\d{2}:\d{2}$/.test(interval[0]) && /^\d{2}:\d{2}$/.test(interval[1]) &&
    interval[0] <= time && time < interval[1]);
}

async function findCandidate(service, category, country, operation, transaction) {
  const attempted = (operation.attempts || []).map((attempt) => Number(attempt.providerId));
  const providers = await db.Provider.findAll({
    where: { status: 'active', availabilityStatus: 'available', countryCode: country.isoCode, ...(attempted.length ? { id: { [Op.notIn]: attempted } } : {}) },
    include: [{ model: db.TradeCategory, as: 'tradeCategories', required: true, where: { id: service.tradeCategoryId, isActive: true }, through: { attributes: [] } },
      { model: db.User, as: 'user', required: true, attributes: ['id', 'regionId'], where: { [Op.or]: [{ regionId: null }, ...(service.regionId ? [{ regionId: service.regionId }] : [])] } },
      { model: db.ProviderLiveLocation, as: 'liveLocation', required: false }],
    order: [['completedMissionsCount', 'DESC'], ['id', 'ASC']], limit: 50, transaction,
  });
  const transport = ['mobilite', 'livraison'].includes(category.slug);
  const distance = (provider) => {
    if (service.pickupLatitude == null || service.pickupLongitude == null || provider.liveLocation?.latitude == null || provider.liveLocation?.longitude == null) return Infinity;
    return haversineMeters({ latitude: provider.liveLocation.latitude, longitude: provider.liveLocation.longitude }, { latitude: service.pickupLatitude, longitude: service.pickupLongitude });
  };
  if (transport) providers.sort((a, b) => distance(a) - distance(b) || a.id - b.id);
  for (const candidate of providers) {
    // Une restriction régionale de l'exécutant ne permet jamais une offre hors région.
    if (candidate.user?.regionId && !same(candidate.user.regionId, service.regionId)) continue;
    const provider = await db.Provider.findByPk(candidate.id, { transaction, lock: true });
    if (provider.status !== 'active' || provider.availabilityStatus !== 'available') continue;
    const occupied = await db.Service.findOne({ where: { providerId: provider.id, missionStatus: { [Op.in]: ACTIVE_STATUSES } }, attributes: ['id'], transaction, lock: true });
    if (occupied) continue;
    let vehicle = null;
    if (transport) {
      const age = getLocationAgeSeconds(candidate.liveLocation);
      if (age == null || age > getLocationMaxAgeSeconds() || distance(candidate) > normalizePolicy(operation.policy).radiusKm * 1000) continue;
      const eligibility = await findEligibleVehicleForProvider({ provider, transaction,
        requestedVehicleType: category.slug === 'mobilite' ? service.requestedVehicleType || 'motorcycle' : service.packageType === 'bulky' ? 'car' : null,
        vehicleId: candidate.liveLocation?.vehicleId || null });
      if (!eligibility.vehicle) continue;
      vehicle = eligibility.vehicle;
    }
    return { provider, vehicle };
  }
  return null;
}

async function coordinateMission(serviceId, { now = new Date(), configure = null, actor = null } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await db.sequelize.transaction(async (transaction) => {
        const service = await db.Service.findByPk(serviceId, { transaction, lock: true });
        if (!service) fail('Demande introuvable', 404);
        if (actor && !covers(service, actor)) fail('Demande hors de votre périmètre', 403);
        if (!service.missionStatus && service.executionType !== 'agent') fail('Cette demande ne dispose pas de parcours opérationnel');
        const operation = await initialize(service, transaction, now);
        if (configure) {
          let owner = configure.ownerUserId ? await db.User.findByPk(configure.ownerUserId, { transaction }) : await db.User.findByPk(operation.ownerUserId, { transaction });
          if (!owner || owner.role !== 'admin' || !covers(service, owner)) fail('Un responsable administrateur couvrant la demande est requis');
          const mode = configure.mode || operation.mode;
          if (mode === 'automatic' && !['agent', 'provider'].includes(service.executionType)) fail('Type d’exécution incompatible avec l’affectation automatique');
          if (mode === 'automatic' && !isSearching(service) && operation.mode !== 'automatic') fail('La mission doit être en attente pour activer l’affectation automatique', 409);
          let nextPolicy = { ...operation.policy };
          if (mode === 'automatic' && operation.mode !== 'automatic') {
            const offering = await activeOffering(service, transaction);
            nextPolicy = { ...nextPolicy, ...(offering?.slaMinutes ? { stageMinutes: offering.slaMinutes } : {}),
              ...offering?.providerRules?.coordination, enabled: true, searchStartedAt: now.toISOString(),
              requiredEvidenceTypes: offering?.providerRules?.requiredEvidenceTypes || offering?.definition?.requiredEvidenceTypes || [],
              serviceOutcome: offering?.providerRules?.serviceOutcome || offering?.definition?.description || null,
              completionReportRequired: offering?.definition?.executionProfile !== 'mobility' };
          }
          await operation.update({ ownerUserId: owner.id, mode, policy: normalizePolicy({ ...nextPolicy, ...configure.policy }),
            state: 'waiting', reason: null, nextActionAt: now }, { transaction });
          await notify(operation, service, 'Coordination mise à jour', `Le suivi de la demande #${service.id} a été mis à jour.`, [owner.id], transaction);
        }
        const currentStatus = statusOf(service);
        const lastAttempt = (operation.attempts || []).at(-1);
        if (service.missionStatus === 'VALIDATED' && operation.mode === 'automatic') {
          await transitionMissionStatus({ service, toStatus: 'CLOSED', actorType: 'system', actorId: null, transaction });
          await notify(operation, service, 'Demande clôturée', `La demande #${service.id} est clôturée après votre validation.`, [service.clientId, operation.ownerUserId], transaction);
        }
        if (isClosed(service)) {
          if (lastAttempt) await releaseProvider(lastAttempt.providerId, service, transaction);
          await operation.update({ state: 'closed', observedStatus: statusOf(service), nextActionAt: null }, { transaction });
          return operation;
        }
        if (service.missionStatus === 'DISPUTED' || service.missionStatus === 'RESOLVED_REDO') {
          if (operation.state !== 'escalated') await escalate(operation, service, 'ARBITRAGE_REQUIS', transaction);
          return operation;
        }
        if (operation.state === 'escalated' && !configure) {
          await operation.update({ observedStatus: currentStatus }, { transaction });
          return operation;
        }
        const owner = operation.ownerUserId ? await db.User.findByPk(operation.ownerUserId, { transaction }) : null;
        if (!owner || owner.role !== 'admin' || !covers(service, owner)) {
          await escalate(operation, service, 'RESPONSABLE_REQUIS', transaction);
          return operation;
        }
        const policy = normalizePolicy(operation.policy);
        if (lastAttempt?.outcome === 'offered') {
          if (same(service.providerId, lastAttempt.providerId) && service.missionStatus === 'ASSIGNED' && service.acceptanceDeadlineAt && new Date(service.acceptanceDeadlineAt) <= now) {
            await transitionMissionStatus({ service, toStatus: 'SEARCHING_EXECUTOR', actorType: 'system', actorId: null, transaction,
              extraFields: { providerId: null, vehicleId: null, acceptanceDeadlineAt: null } });
            await releaseProvider(lastAttempt.providerId, service, transaction, { expired: true });
            await operation.update({ attempts: finishAttempt(operation, 'expired', now), state: 'waiting', nextActionAt: now }, { transaction });
          } else if (!same(service.providerId, lastAttempt.providerId)) {
            await releaseProvider(lastAttempt.providerId, service, transaction);
            await operation.update({ attempts: finishAttempt(operation, 'released', now), state: 'waiting', nextActionAt: now }, { transaction });
          } else if (!service.acceptanceDeadlineAt) {
            await operation.update({ attempts: finishAttempt(operation, 'accepted', now), state: 'accepted', observedStatus: 'ACCEPTED' }, { transaction });
          }
        }
        if (service.acceptanceDeadlineAt && service.missionStatus === 'ASSIGNED') {
          await operation.update({ state: 'offered', nextActionAt: service.acceptanceDeadlineAt, observedStatus: statusOf(service) }, { transaction });
          return operation;
        }
        if (!isSearching(service) || operation.mode === 'manual') {
          if (lastAttempt && ['COMPLETED', 'VALIDATED'].includes(service.missionStatus)) await releaseProvider(lastAttempt.providerId, service, transaction);
          if (operation.observedStatus !== statusOf(service) || operation.state === 'waiting' || configure) {
            const validation = ['COMPLETED', 'VALIDATED'].includes(service.missionStatus) || service.status === 'completed';
            const minutes = validation ? policy.validationMinutes : policy.stageMinutes;
            const history = service.missionStatus ? await db.MissionStatusHistory.findOne({ where: { serviceId }, order: [['createdAt', 'DESC']], transaction }) : null;
            const startedAt = configure ? now : history?.createdAt || service.updatedAt || service.createdAt;
            await operation.update({ state: 'accepted', observedStatus: statusOf(service), nextActionAt: new Date(new Date(startedAt).getTime() + minutes * 60000) }, { transaction });
          }
          if (new Date(operation.nextActionAt) <= now) await escalate(operation, service, 'DELAI_ETAPE_DEPASSE', transaction);
          return operation;
        }
        if (operation.nextActionAt && new Date(operation.nextActionAt) > now) return operation;
        if (process.env.MISSION_COORDINATION_ENABLED === 'false') {
          await escalate(operation, service, 'COORDINATION_SUSPENDUE', transaction);
          return operation;
        }
        if ((operation.attempts || []).length >= policy.maxAttempts || now - new Date(policy.searchStartedAt || operation.createdAt) >= policy.searchMinutes * 60000) {
          await escalate(operation, service, 'RECHERCHE_EPUISEE', transaction);
          return operation;
        }
        const country = service.countryId ? await db.Country.findByPk(service.countryId, { transaction }) : null;
        const region = service.regionId ? await db.Region.findByPk(service.regionId, { transaction }) : null;
        const category = service.tradeCategoryId ? await db.TradeCategory.findByPk(service.tradeCategoryId, { transaction }) : null;
        const offering = await activeOffering(service, transaction);
        if (!country?.isActive || (service.regionId && (!region?.isActive || !same(region.countryId, country.id))) || (service.executionType === 'provider' && !category?.isActive) || !offering) {
          await escalate(operation, service, 'OFFRE_LOCALE_INDISPONIBLE', transaction);
          return operation;
        }
        if (offering.providerRules?.coordination?.enabled !== true) {
          await escalate(operation, service, 'AUTOMATISATION_SUSPENDUE', transaction);
          return operation;
        }
        if (!isOfferingOpen(offering, { timezone: region?.timezone || country.timezone }, now)) {
          await escalate(operation, service, 'HORAIRES_A_CONFIRMER', transaction);
          return operation;
        }
        if (service.executionType === 'agent') {
          const agent = await reserveAgent(service, transaction, now);
          if (!agent) {
            await operation.update({ state: 'waiting', reason: 'AUCUN_EXECUTANT_DISPONIBLE', nextActionAt: new Date(now.getTime() + policy.retrySeconds * 1000) }, { transaction });
            return operation;
          }
          if (service.missionStatus) {
            if (service.missionStatus === 'CREATED') await transitionMissionStatus({ service, toStatus: 'SEARCHING_EXECUTOR', actorType: 'system', actorId: null, transaction });
            await transitionMissionStatus({ service, toStatus: 'ASSIGNED', actorType: 'system', actorId: null, transaction, extraFields: { agentId: agent.id } });
          } else await service.update({ agentId: agent.id }, { transaction });
          await operation.update({ state: 'accepted', reason: null, observedStatus: statusOf(service),
            attempts: [...operation.attempts, { agentId: agent.id, assignedAt: now.toISOString(), outcome: 'assigned' }],
            nextActionAt: new Date(now.getTime() + policy.stageMinutes * 60000) }, { transaction });
          await notify(operation, service, 'Un agent prend en charge votre demande', `L’agent prend en charge la demande #${service.id}.`, [operation.ownerUserId, service.clientId, agent.id], transaction);
          return operation;
        }
        const candidate = await findCandidate(service, category, country, operation, transaction);
        if (!candidate) {
          await operation.update({ state: 'waiting', reason: 'AUCUN_EXECUTANT_DISPONIBLE', nextActionAt: new Date(now.getTime() + policy.retrySeconds * 1000) }, { transaction });
          return operation;
        }
        if (service.missionStatus === 'CREATED') await transitionMissionStatus({ service, toStatus: 'SEARCHING_EXECUTOR', actorType: 'system', actorId: null, transaction });
        const deadline = new Date(now.getTime() + policy.acceptanceSeconds * 1000);
        await candidate.provider.update({ availabilityStatus: 'busy' }, { transaction });
        await transitionMissionStatus({ service, toStatus: 'ASSIGNED', actorType: 'system', actorId: null, transaction,
          extraFields: { providerId: candidate.provider.id, vehicleId: candidate.vehicle?.id || null, acceptanceDeadlineAt: deadline } });
        await operation.update({ state: 'offered', reason: null, observedStatus: 'ASSIGNED', nextActionAt: deadline,
          attempts: [...operation.attempts, { providerId: candidate.provider.id, offeredAt: now.toISOString(), deadlineAt: deadline.toISOString(), outcome: 'offered' }] }, { transaction });
        await notify(operation, service, 'Proposition de mission', `La demande #${service.id} attend la confirmation de son exécutant.`,
          [operation.ownerUserId, service.clientId, candidate.provider.userId], transaction);
        return operation;
      });
    } catch (error) {
      const code = error.original?.code || error.parent?.code;
      if (!['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(code) || attempt >= 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
    }
  }
}

async function runMissionCoordination({ now = new Date(), limit = 100 } = {}) {
  const [scheduler] = await db.OperationSchedulerState.findOrCreate({ where: { key: 'mission_coordination' }, defaults: { startedAt: now } });
  const missing = await db.Service.findAll({
    where: { createdAt: { [Op.gte]: scheduler.startedAt }, '$coordination.id$': null, [Op.or]: [
      { missionStatus: { [Op.notIn]: TERMINAL } },
      { missionStatus: null, status: { [Op.in]: ['created', 'in_progress', 'completed'] } },
    ] },
    include: [{ model: db.MissionCoordination, as: 'coordination', required: false, attributes: ['id'] }],
    attributes: ['id'], order: [['id', 'ASC']], limit, subQuery: false,
  });
  const pending = await db.MissionCoordination.findAll({
    where: { nextActionAt: { [Op.lte]: now }, state: { [Op.notIn]: ['closed', 'escalated'] } },
    attributes: ['serviceId'], order: [['nextActionAt', 'ASC'], ['id', 'ASC']], limit,
  });
  // Les étapes qui avancent ou se terminent doivent libérer la capacité sans attendre le SLA.
  const changed = await db.Service.findAll({
    where: { [Op.and]: [db.sequelize.where(db.sequelize.fn('COALESCE', db.sequelize.col('Service.missionStatus'), db.sequelize.col('Service.status')), Op.ne, db.sequelize.col('coordination.observed_status'))] },
    include: [{ model: db.MissionCoordination, as: 'coordination', required: true, where: { state: { [Op.ne]: 'closed' } }, attributes: [] }],
    attributes: ['id'], order: [['updatedAt', 'ASC']], limit, subQuery: false,
  });
  const ids = [...new Set([...pending.map((row) => row.serviceId), ...changed.map((row) => row.id), ...missing.map((row) => row.id)])];
  const stats = { checked: ids.length, failed: 0 };
  for (const serviceId of ids) {
    try { await coordinateMission(serviceId, { now }); }
    catch (error) { stats.failed += 1; logger.error({ err: error, serviceId }, 'mission.coordination.failed'); }
  }
  await scheduler.update(stats.failed ? { lastError: `${stats.failed} demande(s) en échec lors du traitement` } : { lastSuccessAt: now, lastError: null });
  return stats;
}

module.exports = { DEFAULT_POLICY, TERMINAL, normalizePolicy, isOfferingOpen, coordinateMission, runMissionCoordination };
