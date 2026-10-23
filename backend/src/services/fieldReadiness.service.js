'use strict';
const { Op } = require('sequelize');

const { loadPilotReadiness } = require('./pilotReadiness.service');
const { canAccessGeoResource } = require('../utils/geoScope');
const covers = (resource, user) => canAccessGeoResource(resource, user, { strictRegionScope: true });
const { activeOfferingWhere, activeCatalogIncludes } = require('./localCatalog.service');
const { isImageKitConfigured, hasCustomUploadsRoot } = require('../utils/mediaStoragePolicy');

async function loadFieldReadiness(db, { countryId, regionId = null } = {}) {
  const issues = [];
  const country = await db.Country.findByPk(countryId);
  if (!country) throw Object.assign(new Error('Pays introuvable'), { status: 404 });
  const region = regionId ? await db.Region.findByPk(regionId) : null;
  if (regionId && (!region || String(region.countryId) !== String(country.id))) throw Object.assign(new Error('Région incompatible avec le pays'), { status: 400 });
  const add = (code, message, extra = {}) => issues.push({ code, severity: 'blocking', message, ...extra });
  if (process.env.MISSION_COORDINATION_ENABLED === 'false') add('COORDINATION_DISABLED', 'Le suivi automatique est désactivé sur le serveur.');
  if (!country.isActive || (region && !region.isActive)) add('TERRITORY_INACTIVE', 'Le territoire est encore inactif.');
  if (!/^[A-Z]{3}$/.test(country.currency || '') || !country.defaultLanguage || !(region?.timezone || country.timezone)) add('LOCAL_SETTINGS_INCOMPLETE', 'Devise, langue et fuseau horaire doivent être renseignés.');
  if (!(region?.contactPhone || country.contactPhone)) add('ASSISTANCE_MISSING', 'Un numéro d’assistance local est requis.');
  const admins = await db.User.findAll({ where: { role: 'admin' } });
  const localOwners = admins.filter((admin) => (admin.countryId || admin.regionId) && covers({ countryId, regionId }, admin));
  if (!localOwners.length) add('LOCAL_OWNER_MISSING', 'Un responsable local doit couvrir ce territoire.');
  let pilot = null;
  let offerings = [];
  let automation = { enabledOffers: 0, manualOffers: 0, availableAgents: 0 };
  try {
    await db.MissionCoordination.findOne({ attributes: ['id'] });
    await db.WorkCoordination.findOne({ attributes: ['id'] });
    await db.AgentCapacity.findOne({ attributes: ['userId'] });
    await db.CreationRequest.findOne({ attributes: ['id'] });
    const workScheduler = await db.OperationSchedulerState.findByPk('work_coordination');
    if (!workScheduler?.lastSuccessAt || Date.now() - new Date(workScheduler.lastSuccessAt).getTime() > 5 * 60000 || workScheduler.lastError) add('WORK_SCHEDULER_NOT_RUNNING', 'Le suivi des projets et commandes doit avoir réussi dans les cinq dernières minutes.');
    const scheduler = await db.OperationSchedulerState.findByPk('mission_coordination');
    if (!scheduler?.lastSuccessAt || Date.now() - new Date(scheduler.lastSuccessAt).getTime() > 5 * 60000) add('SCHEDULER_NOT_RUNNING', 'Le traitement de coordination doit avoir réussi dans les cinq dernières minutes.');
    if (scheduler?.lastError) add('SCHEDULER_FAILURE', 'Le dernier traitement de coordination contient des demandes en échec.');
    const schema = await db.sequelize.getQueryInterface().describeTable('services');
    if (!schema.client_request_key || !schema.request_payload_hash) add('REQUEST_KEYS_MISSING', 'Appliquer la migration de protection contre les demandes en double.');
    const coordinationSchema = await db.sequelize.getQueryInterface().describeTable('mission_coordinations');
    if (!coordinationSchema.completion_report) add('COMPLETION_SCHEMA_MISSING', 'La migration des comptes rendus doit être terminée.');
    pilot = await loadPilotReadiness(db, country.isoCode);
    issues.push(...pilot.issues);
    offerings = await db.ServiceAvailability.findAll({ where: activeOfferingWhere(), include: activeCatalogIncludes({ countryId, regionId }) });
    const specific = new Map();
    for (const offering of offerings) {
      const key = String(offering.serviceDefinitionId);
      if (!specific.has(key) || offering.territory?.type === 'REGION') specific.set(key, offering);
    }
    offerings = [...specific.values()];
    const providers = await db.Provider.findAll({ where: { status: 'active', countryCode: country.isoCode }, include: [{ model: db.TradeCategory, as: 'tradeCategories', through: { attributes: [] }, attributes: ['id'] }] });
    const agents = await db.User.findAll({ where: { role: 'agent' } });
    const capacities = await db.AgentCapacity.findAll({ where: { available: true, availableUntil: { [Op.gt]: new Date() } } });
    const enabledOffers = offerings.filter((offer) => offer.providerRules?.coordination?.enabled === true).length;
    automation = { enabledOffers, manualOffers: offerings.length - enabledOffers,
      availableAgents: agents.filter((agent) => String(agent.countryId) === String(countryId) && covers({ countryId, regionId }, agent) && capacities.some((capacity) => String(capacity.userId) === String(agent.id))).length };
    for (const offering of offerings) {
      const label = offering.definition?.name || String(offering.id);
      if (!offering.slaMinutes) add('SERVICE_DEADLINE_MISSING', `${label} : délai d’exécution à définir.`, { availabilityId: offering.id });
      if (!(offering.providerRules?.serviceOutcome || offering.definition?.description)?.trim()) add('SERVICE_RESULT_MISSING', `${label} : résultat attendu à décrire.`, { availabilityId: offering.id });
      if (offering.definition?.legacyTradeCategoryId && !providers.some((provider) => provider.tradeCategories?.some((category) => String(category.id) === String(offering.definition.legacyTradeCategoryId)))) {
        add('SERVICE_EXECUTOR_MISSING', `${label} : aucun prestataire actif ne couvre cette filière dans le pays.`, { availabilityId: offering.id });
      }
      if (offering.definition?.executionProfile === 'agent' && offering.providerRules?.coordination?.enabled && !agents.some((agent) => String(agent.countryId) === String(countryId) && covers({ countryId, regionId }, agent) && capacities.some((capacity) => String(capacity.userId) === String(agent.id)))) add('AGENT_AVAILABILITY_MISSING', `${label} : aucun agent disponible n’a activé sa prise en charge automatique.`, { availabilityId: offering.id });
      if (offering.definition?.executionProfile === 'agent' && !agents.some((agent) => covers({ countryId, regionId }, agent))) {
        add('SERVICE_AGENT_MISSING', `${label} : aucun agent ne couvre ce territoire.`, { availabilityId: offering.id });
      }
    }
    if (!offerings.length) add('LOCAL_CATALOG_EMPTY', 'Aucune offre locale active ne peut être exécutée.');
  } catch (error) {
    if (['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(error.original?.code || error.parent?.code)) add('SCHEMA_INCOMPLETE', 'Les migrations de coordination et de catalogue doivent être appliquées.');
    else throw error;
  }
  // Ce contrôle constate une configuration ; les essais d'envoi et de restauration restent des preuves de recette séparées.
  if (!isImageKitConfigured(process.env) && !hasCustomUploadsRoot(process.env)) add('DURABLE_PROOFS_MISSING', 'Configurer un stockage durable pour les justificatifs.');
  return { ready: !issues.some((issue) => issue.severity === 'blocking'), country: { id: country.id, isoCode: country.isoCode, name: country.name },
    regionId, localOwners: localOwners.map((owner) => ({ id: owner.id, name: [owner.firstName, owner.lastName].filter(Boolean).join(' ') || owner.email })),
    activeOffers: offerings.length, automation, issues, checkedAt: new Date().toISOString(),
    remainingChecks: ['TEST_NOTIFICATION_DELIVERY', 'TEST_BACKUP_RESTORE', 'TEST_COMPLETE_SERVICE', 'LOCAL_OPERATING_APPROVAL'] };
}
module.exports = { loadFieldReadiness };
