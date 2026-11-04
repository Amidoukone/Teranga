'use strict';
const crypto = require('crypto');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const db = require('../../models');
const app = require('../../src/app');
const { MISSION_HISTORY_STATUSES } = require('../../src/constants/missionStatus');
const users = [], providers = [], services = [], countries = [], categories = [];
let country, client, worker, other, provider, agent, old, offer, expired, completed;
const auth = user => ({ Authorization: `Bearer ${jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' })}` });
const list = (query = {}, user = worker) => request(app).get('/api/v1/missions/mine').set(auth(user)).query(query);
async function makeCountry() {
  for (let i = 0; i < 100; i += 1) {
    try { const row = await db.Country.create({ name: `ProviderWorkspace-${crypto.randomUUID()}`, isoCode: String.fromCharCode(65 + crypto.randomInt(26), 65 + crypto.randomInt(26)), currency: 'XOF', isActive: true }); countries.push(row); return row; }
    catch (error) { if (error.name !== 'SequelizeUniqueConstraintError') throw error; }
  }
  throw new Error('No country available');
}
async function user(role, countryId) {
  const row = await db.User.create({ role, countryId, email: `workspace-${crypto.randomUUID()}@example.test`, passwordHash: 'unused-token-test' }); users.push(row.id); return row;
}
async function makeProvider(account) {
  const row = await db.Provider.create({ userId: account.id, type: 'independent', displayFirstName: 'Prestataire', phoneNumber: '+22300000000', countryCode: country.isoCode, status: 'active' }); providers.push(row.id); return row;
}
async function mission(extra = {}) {
  const row = await db.Service.create({ clientId: client.id, providerId: provider.id, countryId: country.id, title: 'Travail récent', type: 'other', executionType: 'provider', missionStatus: 'IN_PROGRESS', status: 'in_progress', ...extra }); services.push(row.id); return row;
}
beforeAll(async () => {
  await db.sequelize.authenticate();
  country = await makeCountry(); const residence = await makeCountry();
  client = await user('client', country.id); worker = await user('provider', residence.id); other = await user('provider', country.id); agent = await user('agent', country.id);
  provider = await makeProvider(worker); const outsider = await makeProvider(other);
  const trades = {};
  for (const slug of ['mobilite', 'livraison']) {
    const [category, created] = await db.TradeCategory.findOrCreate({ where: { slug }, defaults: { name: slug, isActive: true } });
    trades[slug] = category.id; if (created) categories.push(category);
  }
  old = await mission({ title: 'Ancienne réparation 50%_!', createdAt: new Date('2020-01-01'), agentId: agent.id });
  for (let i = 0; i < 25; i += 1) await mission({ createdAt: new Date('2026-01-01') });
  offer = await mission({ title: 'Taxi proposé', tradeCategoryId: trades.mobilite, missionStatus: 'ASSIGNED', acceptanceDeadlineAt: new Date(Date.now() + 600000), createdAt: new Date('2020-01-02') });
  expired = await mission({ title: 'Offre expirée', missionStatus: 'ASSIGNED', acceptanceDeadlineAt: new Date('2020-01-01') });
  completed = await mission({ title: 'Colis remis', tradeCategoryId: trades.livraison, missionStatus: 'COMPLETED' });
  for (const missionStatus of MISSION_HISTORY_STATUSES) await mission({ title: `Archive ${missionStatus}`, missionStatus });
  await mission({ title: 'Travail confidentiel', providerId: outsider.id });
});
afterAll(async () => {
  if (services.length) {
    await db.MissionStatusHistory.destroy({ where: { serviceId: services } });
    await db.Notification.destroy({ where: { entityType: 'service', entityId: services } });
    await db.Activity.destroy({ where: { entityType: 'service', entityId: services } });
  }
  if (providers.length) await db.ProviderTradeCategory.destroy({ where: { providerId: providers } });
  if (services.length) await db.Service.destroy({ where: { id: services } });
  if (providers.length) await db.Provider.destroy({ where: { id: providers } });
  if (users.length) await db.User.destroy({ where: { id: users } });
  for (const category of categories) await category.destroy();
  for (const row of countries) await row.destroy();
  await db.sequelize.close();
});

test('complete pagination prioritizes offers across all pages and keeps the owner scope across borders', async () => {
  const first = await list({ view: 'active', limit: 20, page: 1 }), second = await list({ view: 'active', limit: 20, page: 2 });
  expect(first.status).toBe(200); expect(second.status).toBe(200);
  expect(first.headers['cache-control']).toBe('no-store');
  expect(first.body.pagination.total).toBe(29); expect(second.body.pagination.total).toBe(29);
  expect(first.body.missions[0].id).toBe(offer.id);
  const rows = [...first.body.missions, ...second.body.missions];
  expect(new Set(rows.map(row => row.id)).size).toBe(29);
  expect(rows.some(row => row.id === old.id)).toBe(true);
  expect(rows.some(row => row.title === 'Travail confidentiel')).toBe(false);
});

test('offers require a live deadline and completed work remains active until client confirmation', async () => {
  const offers = await list({ view: 'offers' });
  expect(offers.status).toBe(200); expect(offers.body.missions.map(row => row.id)).toEqual([offer.id]);
  expect(offers.body.missions.some(row => row.id === expired.id)).toBe(false);
  const history = await list({ view: 'history' });
  expect(history.body.missions.map(row => row.missionStatus).sort()).toEqual([...MISSION_HISTORY_STATUSES].sort());
  expect(history.body.missions.some(row => row.id === completed.id)).toBe(false);
  expect((await list({ q: `#${completed.id}`, view: 'active' })).body.missions[0].id).toBe(completed.id);
});

test('search finds older results before pagination and treats SQL metacharacters literally', async () => {
  for (const q of ['Ancienne réparation', '50%_!', `#${old.id}`]) {
    const response = await list({ q, limit: 1 });
    expect(response.status).toBe(200); expect(response.body.pagination.total).toBe(1); expect(response.body.missions[0].id).toBe(old.id);
  }
  expect((await list({ q: "' OR 1=1 --" })).body.pagination.total).toBe(0);
});

test('the three types filter on the server without dropping uncategorized services', async () => {
  expect((await list({ kind: 'taxi', view: 'active' })).body.missions.map(row => row.id)).toEqual([offer.id]);
  expect((await list({ kind: 'delivery', view: 'active' })).body.missions.map(row => row.id)).toEqual([completed.id]);
  expect((await list({ kind: 'service', view: 'active' })).body.pagination.total).toBe(27);
});

test('providers cannot select another owner and agents keep only their supervised missions', async () => {
  expect((await list({ q: 'Ancienne' }, other)).body.pagination.total).toBe(0);
  const supervised = await list({ view: 'active' }, agent);
  expect(supervised.status).toBe(200); expect(supervised.body.missions.map(row => row.id)).toEqual([old.id]);
  expect((await list({}, client)).status).toBe(403);
  expect((await list({ providerId: provider.id }, other)).status).toBe(400);
});

test('invalid view, kind, search and pagination are rejected explicitly', async () => {
  for (const query of [{ view: 'unknown' }, { kind: 'project' }, { q: 'a'.repeat(201) }, { page: 0 }, { page: 100001 }, { limit: 0 }, { limit: 201 }, { offset: -1 }]) expect((await list(query)).status).toBe(400);
});

test('a refusal cannot undo an accepted offer or revive an expired offer', async () => {
  const pending = await mission({ missionStatus: 'ASSIGNED', acceptanceDeadlineAt: new Date(Date.now() + 600000) });
  expect((await request(app).post(`/api/v1/missions/${pending.id}/accept`).set(auth(worker))).status).toBe(200);
  expect((await request(app).post(`/api/v1/missions/${pending.id}/decline`).set(auth(worker))).status).toBe(409);
  await pending.reload();
  expect(pending.providerId).toBe(provider.id); expect(pending.acceptanceDeadlineAt).toBeNull();
  expect(pending.missionStatus).toBe('ASSIGNED');
  expect((await request(app).post(`/api/v1/missions/${expired.id}/decline`).set(auth(worker))).status).toBe(409);
  expect((await expired.reload()).providerId).toBe(provider.id);
});

test('simultaneous acceptance and refusal produce one response without undoing the winner', async () => {
  const pending = await mission({ missionStatus: 'ASSIGNED', acceptanceDeadlineAt: new Date(Date.now() + 600000) });
  const results = await Promise.all(['accept', 'decline'].map(action => request(app).post(`/api/v1/missions/${pending.id}/${action}`).set(auth(worker))));
  expect(results.filter(result => result.status === 200)).toHaveLength(1);
  expect(results.every(result => [200, 403, 409].includes(result.status))).toBe(true);
  await pending.reload();
  if (results[0].status === 200) {
    expect(pending.missionStatus).toBe('ASSIGNED'); expect(pending.providerId).toBe(provider.id);
  } else {
    expect(pending.missionStatus).toBe('SEARCHING_EXECUTOR'); expect(pending.providerId).toBeNull();
  }
  expect(pending.acceptanceDeadlineAt).toBeNull();
});

test('a driver reservation cannot be erased by the self-service availability endpoint', async () => {
  const mobility = await db.TradeCategory.findOne({ where: { slug: 'mobilite' } });
  await db.ProviderTradeCategory.create({ providerId: provider.id, tradeCategoryId: mobility.id });
  await provider.update({ availabilityStatus: 'busy' });
  for (const availabilityStatus of ['offline', 'available']) {
    const response = await request(app).patch('/api/v1/providers/me/availability').set(auth(worker)).send({ availabilityStatus });
    expect(response.status).toBe(409);
    expect((await provider.reload()).availabilityStatus).toBe('busy');
  }
});

test('the delivery declaration is visible without inventing a payment entry', async () => {
  const category = await db.TradeCategory.findOne({ where: { slug: 'livraison' } });
  const delivery = await mission({ missionStatus: 'IN_PROGRESS', tradeCategoryId: category.id });
  const invalid = await request(app).patch(`/api/v1/missions/${delivery.id}/status`).set(auth(worker)).send({ toStatus: 'COMPLETED', collectedAmount: 1e20 });
  expect(invalid.status).toBe(400); expect((await delivery.reload()).missionStatus).toBe('IN_PROGRESS');
  const submitted = await request(app).patch(`/api/v1/missions/${delivery.id}/status`).set(auth(worker)).send({ toStatus: 'COMPLETED', collectedAmount: 0 });
  expect(submitted.status).toBe(200); expect(Number(submitted.body.mission.collectedAmount)).toBe(0);
  const response = await request(app).get(`/api/v1/missions/${delivery.id}/track?skipEta=1`).set(auth(client));
  expect(response.status).toBe(200); expect(Number(response.body.collectedAmount)).toBe(0);
  expect(Number(response.body.paymentState.recordedPayments)).toBe(0);
  expect(await db.Transaction.count({ where: { serviceId: delivery.id } })).toBe(0);
});
