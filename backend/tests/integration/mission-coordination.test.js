'use strict';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'coordination_test_secret';
const bcrypt = require('bcrypt');
const request = require('supertest');
const app = require('../../src/app');
const db = require('../../models');
const { coordinateMission, runMissionCoordination } = require('../../src/services/missionCoordination.service');
const media = require('../../src/services/mediaUpload.service');
let ready = false;
const users = [];
const services = [];
const providers = [];
let country, otherCountry, owner, admin, client, category, territory, organization, definition, offering;
let adminToken, ownerToken;
const password = 'Password123!';
let passwordHash;
async function user(role, countryId = null) {
  const row = await db.User.create({ role, countryId, email: `coord-${role}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`, passwordHash });
  users.push(row.id); return row;
}
async function makeCountry(currency) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { return await db.Country.create({ name: `Coordination-${Date.now()}-${attempt}`, isoCode: String.fromCharCode(65 + Math.floor(Math.random() * 26), 65 + Math.floor(Math.random() * 26)), currency, timezone: 'Africa/Accra', defaultLanguage: 'en', isActive: true }); }
    catch (error) { if (error.name !== 'SequelizeUniqueConstraintError') throw error; }
  }
  throw new Error('Country fixture unavailable');
}
async function mission(extra = {}) {
  const row = await db.Service.create({ clientId: client.id, countryId: country.id, type: 'other', title: 'Vérification terrain', executionType: 'provider', tradeCategoryId: category.id, missionStatus: 'CREATED', currency: 'GHS', ...extra });
  services.push(row.id); return row;
}
async function login(account) {
  const result = await request(app).post('/api/v1/auth/login').send({ email: account.email, password });
  expect(result.status).toBe(200); return result.body.token;
}
beforeAll(async () => {
  try { await db.sequelize.authenticate(); ready = true; }
  catch (error) { if (process.env.REQUIRE_INTEGRATION_DB === 'true') throw error; return; }
  await db.sequelize.getQueryInterface().describeTable('mission_coordinations');
  passwordHash = await bcrypt.hash(password, 10);
  country = await makeCountry('GHS'); otherCountry = await makeCountry('USD');
  admin = await user('admin'); owner = await user('admin', country.id); client = await user('client', otherCountry.id);
  adminToken = await login(admin); ownerToken = await login(owner);
  const stamp = `COORD-${Date.now()}`;
  category = await db.TradeCategory.create({ name: 'Vérification de recette', slug: stamp.toLowerCase(), countryId: country.id });
  territory = await db.Territory.create({ code: stamp, name: 'Territoire pilote', type: 'COUNTRY', countryId: country.id, isActive: true });
  organization = await db.Organization.create({ code: stamp, type: 'MASTER', legalName: 'Opérateur de recette', countryId: country.id, status: 'active' });
  definition = await db.ServiceDefinition.create({ code: stamp, name: 'Vérification terrain', executionProfile: 'provider', legacyTradeCategoryId: category.id });
  offering = await db.ServiceAvailability.create({ serviceDefinitionId: definition.id, territoryId: territory.id, organizationId: organization.id,
    currency: 'GHS', slaMinutes: 60, providerRules: { serviceOutcome: 'Compte rendu de vérification remis au client', coordination: { enabled: true, maxAttempts: 2, acceptanceSeconds: 30 } } });
  for (let index = 0; index < 3; index += 1) {
    const account = await user('provider', country.id);
    const provider = await db.Provider.create({ userId: account.id, type: 'independent', displayFirstName: `Exécutant ${index}`, phoneNumber: '+233000000000', countryCode: country.isoCode,
      status: 'active', availabilityStatus: 'available', completedMissionsCount: 10 - index });
    await provider.addTradeCategories([category]); providers.push(provider);
  }
});
beforeEach(async () => {
  if (!ready) return;
  await db.Provider.update({ availabilityStatus: 'available' }, { where: { id: providers.map((provider) => provider.id) } });
  if (services.length) {
    await db.MissionStatusHistory.destroy({ where: { serviceId: services } });
    await db.Evidence.destroy({ where: { serviceId: services } });
    await db.Service.destroy({ where: { id: services.splice(0) } });
  }
  await offering.update({ isActive: true, openingHours: null, providerRules: { serviceOutcome: 'Compte rendu de vérification remis au client', coordination: { enabled: true, maxAttempts: 2, acceptanceSeconds: 30 } } });
});
afterAll(async () => {
  if (services.length) {
    await db.MissionStatusHistory.destroy({ where: { serviceId: services } });
    await db.Evidence.destroy({ where: { serviceId: services } });
    await db.Service.destroy({ where: { id: services } });
  }
  if (country) {
    for (const model of [db.Notification, db.Activity]) await model.destroy({ where: { countryId: country.id } });
  }
  if (providers.length) {
    await db.ProviderTradeCategory.destroy({ where: { providerId: providers.map((provider) => provider.id) } });
    await db.Provider.destroy({ where: { id: providers.map((provider) => provider.id) } });
  }
  if (offering) await offering.destroy();
  if (territory) await db.Membership.destroy({ where: { territoryId: territory.id } });
  if (territory) await db.OrganizationTerritory.destroy({ where: { territoryId: territory.id } });
  if (definition) await definition.destroy();
  if (organization) await organization.destroy();
  if (territory) await territory.destroy();
  if (category) await category.destroy();
  if (users.length) {
    for (const model of [db.RefreshToken, db.RecoveryCode, db.PasswordResetToken]) await model.destroy({ where: { userId: users } });
    await db.User.destroy({ where: { id: users } });
  }
  if (country) await country.destroy(); if (otherCountry) await otherCountry.destroy();
  await db.sequelize.close();
});

test('automatic intake reserves one eligible provider and repeated processing is idempotent', async () => {
  if (!ready) return;
  const service = await mission();
  const operation = await coordinateMission(service.id);
  expect(operation).toMatchObject({ mode: 'automatic', state: 'offered', ownerUserId: owner.id });
  expect(operation.attempts).toHaveLength(1);
  expect((await service.reload()).providerId).toBe(providers[0].id);
  expect((await providers[0].reload()).availabilityStatus).toBe('busy');
  const notifications = await db.Notification.count({ where: { entityId: service.id, entityType: 'service' } });
  await coordinateMission(service.id);
  expect((await operation.reload()).attempts).toHaveLength(1);
  expect(await db.Notification.count({ where: { entityId: service.id, entityType: 'service' } })).toBe(notifications);
});

test('refusal tries a different provider, expiration stops at the configured limit and escalates once', async () => {
  if (!ready) return;
  const service = await mission();
  const operation = await coordinateMission(service.id);
  const account = await db.User.findByPk(providers[0].userId);
  const providerToken = await login(account);
  const declined = await request(app).post(`/api/v1/missions/${service.id}/decline`).set('Authorization', `Bearer ${providerToken}`);
  expect(declined.status).toBe(200);
  await coordinateMission(service.id);
  expect((await service.reload()).providerId).toBe(providers[1].id);
  expect((await operation.reload()).attempts).toHaveLength(2);
  const expiredAt = new Date(new Date(service.acceptanceDeadlineAt).getTime() + 1000);
  await coordinateMission(service.id, { now: expiredAt });
  expect((await operation.reload()).state).toBe('escalated');
  expect(operation.reason).toBe('RECHERCHE_EPUISEE');
  expect((await providers[1].reload()).availabilityStatus).toBe('offline');
  const count = await db.Notification.count({ where: { entityId: service.id, entityType: 'service' } });
  await coordinateMission(service.id, { now: expiredAt });
  expect(await db.Notification.count({ where: { entityId: service.id, entityType: 'service' } })).toBe(count);
});

test('concurrent workers cannot assign two providers to one request', async () => {
  if (!ready) return;
  const service = await mission();
  await Promise.all([coordinateMission(service.id), coordinateMission(service.id)]);
  const operation = await db.MissionCoordination.findOne({ where: { serviceId: service.id } });
  expect(operation.attempts).toHaveLength(1);
  expect(await db.Provider.count({ where: { id: providers.map((provider) => provider.id), availabilityStatus: 'busy' } })).toBe(1);
});

test('a notification persistence failure rolls back the offer and the reservation', async () => {
  if (!ready) return;
  const service = await mission();
  const failure = jest.spyOn(db.Notification, 'bulkCreate').mockRejectedValueOnce(new Error('Notification storage unavailable'));
  try { await expect(coordinateMission(service.id)).rejects.toThrow('Notification storage unavailable'); }
  finally { failure.mockRestore(); }
  expect((await service.reload()).missionStatus).toBe('CREATED');
  expect(await db.MissionCoordination.count({ where: { serviceId: service.id } })).toBe(0);
  expect((await providers[0].reload()).availabilityStatus).toBe('available');
});

test('the operator queue intersects country filters with permissions and rejects foreign mutations', async () => {
  if (!ready) return;
  const service = await mission();
  const foreign = await mission({ countryId: otherCountry.id });
  const filtered = await request(app).get('/api/v1/operations').query({ countryId: otherCountry.id }).set('Authorization', `Bearer ${ownerToken}`);
  expect(filtered.status).toBe(200); expect(filtered.body.items).toEqual([]);
  const denied = await request(app).patch(`/api/v1/operations/${foreign.id}`).set('Authorization', `Bearer ${ownerToken}`).send({ mode: 'manual', ownerUserId: owner.id });
  expect(denied.status).toBe(403);
  const configured = await request(app).patch(`/api/v1/operations/${service.id}`).set('Authorization', `Bearer ${ownerToken}`).send({ mode: 'manual', ownerUserId: owner.id });
  expect(configured.status).toBe(200);
  const queue = await request(app).get('/api/v1/operations').set('Authorization', `Bearer ${ownerToken}`);
  expect(queue.status).toBe(200); expect(queue.body.items.map((item) => item.id)).toContain(service.id);
  expect(queue.body.items.map((item) => item.id)).not.toContain(foreign.id);
});

test('persisted deadlines resume after a worker restart and inactive offerings stop automatic assignment', async () => {
  if (!ready) return;
  const service = await mission();
  const first = await coordinateMission(service.id);
  const deadline = new Date(new Date(first.nextActionAt).getTime() + 1000);
  await offering.update({ isActive: false });
  const result = await runMissionCoordination({ now: deadline });
  expect(result.failed).toBe(0);
  expect((await first.reload()).state).toBe('escalated');
  expect(first.reason).toBe('OFFRE_LOCALE_INDISPONIBLE');
  expect(first.attempts).toHaveLength(1);
});

test('readiness reports missing assistance and a local manager can inspect its country', async () => {
  if (!ready) return;
  const result = await request(app).get('/api/v1/operations/readiness').query({ countryId: country.id }).set('Authorization', `Bearer ${ownerToken}`);
  expect(result.status).toBe(200);
  expect(result.body.ready).toBe(false);
  expect(result.body.issues.map((issue) => issue.code)).toContain('ASSISTANCE_MISSING');
  const denied = await request(app).get('/api/v1/operations/readiness').query({ countryId: otherCountry.id }).set('Authorization', `Bearer ${ownerToken}`);
  expect(denied.status).toBe(403);
  const clientToken = await login(client);
  expect((await request(app).get('/api/v1/operations').set('Authorization', `Bearer ${clientToken}`)).status).toBe(403);
});

test('a retry after a lost creation response reuses the request and rejects changed content', async () => {
  if (!ready) return;
  const clientToken = await login(client);
  const payload = { requestKey: `request-${Date.now()}`, executionType: 'agent', serviceType: 'errand', title: 'Demande sans doublon' };
  const post = (body) => request(app).post('/api/v1/missions').set('Authorization', `Bearer ${clientToken}`).send(body);
  const first = await post(payload);
  expect(first.status).toBe(201); services.push(first.body.mission.id);
  const replay = await post(payload);
  expect(replay.status).toBe(200);
  expect(replay.body.mission.id).toBe(first.body.mission.id);
  expect(replay.body.replayed).toBe(true);
  expect((await post({ ...payload, title: 'Une autre demande' })).status).toBe(409);
  expect(await db.Service.count({ where: { clientId: client.id, clientRequestKey: payload.requestKey } })).toBe(1);
});

test('the complete service requires its report, retains proof and closes only after customer validation', async () => {
  if (!ready) return;
  await offering.update({ providerRules: { ...offering.providerRules, requiredEvidenceTypes: ['document'] } });
  const service = await mission();
  await coordinateMission(service.id);
  const providerAccount = await db.User.findByPk(providers[0].userId);
  const providerToken = await login(providerAccount);
  const clientToken = await login(client);
  const transition = (toStatus, token = providerToken) => request(app).patch(`/api/v1/missions/${service.id}/status`).set('Authorization', `Bearer ${token}`).send({ toStatus });
  expect((await request(app).post(`/api/v1/missions/${service.id}/accept`).set('Authorization', `Bearer ${providerToken}`)).status).toBe(200);
  for (const toStatus of ['EN_ROUTE', 'ON_SITE', 'IN_PROGRESS']) expect((await transition(toStatus)).status).toBe(200);
  expect((await transition('COMPLETED')).status).toBe(400);
  const requestKey = `report-${Date.now()}`;
  const report = (token) => request(app).post(`/api/v1/missions/${service.id}/completion-report`).set('Authorization', `Bearer ${token}`)
    .field('summary', 'Vérification réalisée et compte rendu détaillé remis au bénéficiaire.').field('requestKey', requestKey)
    .attach('files', Buffer.from('%PDF-1.4 test'), { filename: 'rapport.pdf', contentType: 'application/pdf' });
  expect((await report(clientToken)).status).toBe(403);
  const enabled = jest.spyOn(media, 'isImageKitEnabled').mockReturnValue(false);
  const storage = jest.spyOn(media, 'saveFileLocally').mockResolvedValue({ url: '/uploads/mission-completions/recipe.pdf', fileId: null });
  try {
    const saved = await report(providerToken);
    expect(saved.status).toBe(200);
    expect(saved.body.completion.report.attachments).toHaveLength(1);
    expect((await report(providerToken)).status).toBe(200);
    expect(storage).toHaveBeenCalledTimes(1);
    expect(await db.Evidence.count({ where: { serviceId: service.id } })).toBe(1);
  } finally { enabled.mockRestore(); storage.mockRestore(); }
  expect((await transition('COMPLETED')).status).toBe(200);
  expect((await providers[0].reload()).availabilityStatus).toBe('available');
  const track = await request(app).get(`/api/v1/missions/${service.id}/track`).set('Authorization', `Bearer ${clientToken}`);
  expect(track.status).toBe(200);
  expect(track.body.completion.report.attachments).toHaveLength(1);
  await coordinateMission(service.id);
  expect((await service.reload()).missionStatus).toBe('COMPLETED');
  expect((await transition('VALIDATED', clientToken)).status).toBe(200);
  await coordinateMission(service.id);
  expect((await service.reload()).missionStatus).toBe('CLOSED');
  expect((await db.MissionCoordination.findOne({ where: { serviceId: service.id } })).state).toBe('closed');
});

test('two simultaneous requests cannot reserve the same available executor', async () => {
  if (!ready) return;
  await db.Provider.update({ availabilityStatus: 'offline' }, { where: { id: providers.slice(1).map((provider) => provider.id) } });
  const first = await mission(); const second = await mission();
  await Promise.all([coordinateMission(first.id), coordinateMission(second.id)]);
  await first.reload(); await second.reload();
  expect([first.providerId, second.providerId].filter((value) => value === providers[0].id)).toHaveLength(1);
});

test('technical readiness becomes positive only after the local prerequisites and a successful worker run', async () => {
  if (!ready) return;
  await country.update({ contactPhone: '+233000000000' });
  await territory.update({ aliases: [country.isoCode] });
  await db.OrganizationTerritory.create({ organizationId: organization.id, territoryId: territory.id, status: 'active', isPrimary: true });
  await db.Membership.create({ userId: owner.id, organizationId: organization.id, territoryId: territory.id, roleKey: 'country_admin', status: 'active' });
  await user('agent', country.id);
  await runMissionCoordination();
  await require('../../src/services/workCoordination.service').runWorkCoordination();
  const previousRoot = process.env.UPLOADS_ROOT;
  process.env.UPLOADS_ROOT = require('path').resolve(__dirname, '../../uploads');
  try {
    const result = await request(app).get('/api/v1/operations/readiness').query({ countryId: country.id }).set('Authorization', `Bearer ${ownerToken}`);
    expect(result.status).toBe(200);
    expect(result.body.issues).toEqual([]);
    expect(result.body.ready).toBe(true);
    expect(result.body.automation).toMatchObject({ enabledOffers: 1, manualOffers: 0 });
    expect(result.body.remainingChecks).toContain('LOCAL_OPERATING_APPROVAL');
  } finally {
    if (previousRoot === undefined) delete process.env.UPLOADS_ROOT; else process.env.UPLOADS_ROOT = previousRoot;
  }
});

test('a provider already executing remains assigned while unanswered escalation reaches supervisors', async () => {
  if (!ready) return;
  const foreignAdmin = await user('admin', otherCountry.id);
  await offering.update({ providerRules: { serviceOutcome: 'Compte rendu de vérification remis au client', coordination: { enabled: true, stageMinutes: 1, escalationMinutes: 1, maxAttempts: 2, acceptanceSeconds: 30 } } });
  const service = await mission();
  const operation = await coordinateMission(service.id);
  const providerId = (await service.reload()).providerId;
  const providerToken = await login(await db.User.findByPk(providers[0].userId));
  expect((await request(app).post(`/api/v1/missions/${service.id}/accept`).set('Authorization', `Bearer ${providerToken}`)).status).toBe(200);
  expect((await request(app).patch(`/api/v1/missions/${service.id}/status`).set('Authorization', `Bearer ${providerToken}`).send({ toStatus: 'EN_ROUTE' })).status).toBe(200);
  await coordinateMission(service.id);
  const overdue = new Date(Date.now() + 61000);
  await coordinateMission(service.id, { now: overdue });
  expect((await operation.reload()).state).toBe('escalated');
  await runMissionCoordination({ now: new Date(overdue.getTime() + 61000) });
  expect((await service.reload()).providerId).toBe(providerId);
  expect(service.missionStatus).toBe('EN_ROUTE');
  expect((await operation.reload()).attempts).toHaveLength(1);
  expect(operation.policy.supervision.reminderCount).toBe(1);
  const recipients = (await db.Notification.findAll({ where: { entityType: 'service', entityId: service.id, title: 'Relance de supervision' } })).map((row) => row.userId);
  expect(recipients).toEqual(expect.arrayContaining([owner.id, admin.id]));
  expect(recipients).not.toContain(foreignAdmin.id);
});
