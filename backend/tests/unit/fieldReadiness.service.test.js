'use strict';
jest.mock('../../src/services/pilotReadiness.service', () => ({ loadPilotReadiness: jest.fn(async () => ({ issues: [] })) }));
jest.mock('../../src/services/localCatalog.service', () => ({ activeOfferingWhere: () => ({}), activeCatalogIncludes: () => [] }));
jest.mock('../../src/services/mobilityCompliance.service', () => ({ toComplianceSummary: jest.fn() }));
jest.mock('../../src/services/providerPresence.service', () => ({ isLocationFresh: jest.fn() }));
jest.mock('../../src/services/missionStatus.service', () => ({ ACTIVE_STATUSES: ['ASSIGNED', 'IN_PROGRESS'] }));
jest.mock('../../src/services/agentCapacity.service', () => ({ agentLoad: jest.fn() }));
const { loadFieldReadiness } = require('../../src/services/fieldReadiness.service');
const { agentLoad } = require('../../src/services/agentCapacity.service');
const { toComplianceSummary } = require('../../src/services/mobilityCompliance.service');
const { isLocationFresh } = require('../../src/services/providerPresence.service');
let db, offer, provider, previousRoot;
beforeEach(() => {
  previousRoot = process.env.UPLOADS_ROOT; process.env.UPLOADS_ROOT = '/persistent-test-uploads';
  offer = { id: 1, serviceDefinitionId: 1, slaMinutes: 60, definition: { name: 'Service', executionProfile: 'provider', legacyTradeCategoryId: 8 }, providerRules: { serviceOutcome: 'Résultat vérifiable', coordination: { enabled: true } } };
  provider = { id: 20, user: { id: 30, regionId: null }, availabilityStatus: 'available', tradeCategories: [{ id: 8, slug: 'plomberie', isActive: true }] };
  const scheduler = { findByPk: jest.fn(async () => ({ lastSuccessAt: new Date() })) };
  const schema = { client_request_key: {}, request_payload_hash: {}, completion_report: {} };
  db = {
    Country: { findByPk: jest.fn(async () => ({ id: 1, isoCode: 'ML', name: 'Mali', currency: 'XOF', defaultLanguage: 'fr', timezone: 'Africa/Bamako', contactPhone: '+22370000000', isActive: true })) },
    Region: { findByPk: jest.fn(async () => ({ id: 2, countryId: 1, isActive: true })) },
    User: { findAll: jest.fn(async ({ where }) => where.role === 'admin' ? [{ id: 4, role: 'admin', countryId: 1 }] : [{ id: 5, role: 'agent', countryId: 1 }]) },
    MissionCoordination: { findOne: jest.fn() }, WorkCoordination: { findOne: jest.fn() }, CreationRequest: { findOne: jest.fn() }, OperationSchedulerState: scheduler,
    AgentCapacity: { findOne: jest.fn(), findAll: jest.fn(async () => [{ userId: 5, maxConcurrent: 1 }]) },
    sequelize: { getQueryInterface: () => ({ describeTable: async () => schema }) },
    ServiceAvailability: { findAll: jest.fn(async () => [offer]) }, Provider: { findAll: jest.fn(async () => [provider]) }, Service: { findAll: jest.fn(async () => []) },
  };
  agentLoad.mockResolvedValue(0);
  toComplianceSummary.mockReturnValue({ driverEligible: true, hasEligibleVehicle: true, vehicles: [{ id: 7, eligible: true }] });
  isLocationFresh.mockReturnValue(true);
});
afterEach(() => { if (previousRoot === undefined) delete process.env.UPLOADS_ROOT; else process.env.UPLOADS_ROOT = previousRoot; });
const check = () => loadFieldReadiness(db, { countryId: 1, regionId: 2 });
test('configured territory reports remaining field evidence separately', async () => {
  const result = await check(); expect(result.ready).toBe(true); expect(result.remainingChecks).toContain('TEST_COMPLETE_SERVICE');
});
test('a provider restricted to another region cannot make this territory ready', async () => {
  provider.user.regionId = 9;
  expect((await check()).issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'SERVICE_EXECUTOR_MISSING' })]));
});
test.each(['offline', 'occupied', 'staleLocation', 'vehicleRejected'])('automatic transport cannot rely on a provider with %s', async (reason) => {
  provider.tradeCategories[0].slug = 'mobilite';
  if (reason === 'offline') provider.availabilityStatus = 'offline';
  if (reason === 'occupied') db.Service.findAll.mockResolvedValue([{ providerId: 20 }]);
  if (reason === 'staleLocation') isLocationFresh.mockReturnValue(false);
  if (reason === 'vehicleRejected') toComplianceSummary.mockReturnValue({ driverEligible: false, hasEligibleVehicle: true });
  expect((await check()).issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'PROVIDER_AVAILABILITY_MISSING' })]));
});
test('an available agent with no free capacity cannot make automatic intake ready', async () => {
  offer.definition = { executionProfile: 'agent', name: 'Course' };
  agentLoad.mockResolvedValue(1);
  const result = await check();
  expect(result.automation.availableAgents).toBe(0);
  expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'AGENT_AVAILABILITY_MISSING' })]));
});
