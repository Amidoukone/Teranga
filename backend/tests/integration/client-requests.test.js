'use strict';
const crypto = require('crypto');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const db = require('../../models');
const app = require('../../src/app');
let country, client, other, admin, oldProject, oldOrder, reviewProject, reviewService;
const users = [], countries = [], serviceIds = [], projectIds = [], orderIds = [], categories = [];
const auth = user => ({ Authorization: `Bearer ${jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' })}` });
const list = (query = {}, user = client) => request(app).get('/api/v1/requests').set(auth(user)).query(query);
async function makeCountry() {
  for (let i = 0; i < 100; i += 1) {
    try { const row = await db.Country.create({ name: `Requests-${crypto.randomUUID()}`, isoCode: String.fromCharCode(65 + crypto.randomInt(26), 65 + crypto.randomInt(26)), currency: 'XOF', isActive: true }); countries.push(row); return row; }
    catch (error) { if (error.name !== 'SequelizeUniqueConstraintError') throw error; }
  }
  throw new Error('No country for request fixtures');
}
async function user(role, countryId) {
  const row = await db.User.create({ role, countryId, email: `requests-${crypto.randomUUID()}@example.test`, passwordHash: 'unused-in-token-test' }); users.push(row.id); return row;
}
async function service(extra = {}) {
  const row = await db.Service.create({ clientId: client.id, countryId: country.id, title: 'Service récent', type: 'other', executionType: 'agent', status: 'created', ...extra }); serviceIds.push(row.id); return row;
}
async function project(extra = {}) {
  const row = await db.Project.create({ clientId: client.id, countryId: country.id, title: 'Projet récent', type: 'autre', ...extra }); projectIds.push(row.id); return row;
}
async function order(extra = {}) {
  const row = await db.Order.create({ userId: client.id, countryId: country.id, code: `REQ-${crypto.randomUUID().slice(0, 24)}`, ...extra }); orderIds.push(row.id); return row;
}
beforeAll(async () => {
  await db.sequelize.authenticate();
  country = await makeCountry(); const residence = await makeCountry();
  client = await user('client', residence.id); other = await user('client', country.id); admin = await user('admin', country.id);
  oldProject = await project({ title: 'Ancien projet 50%_!', description: 'Pièces à vérifier', createdAt: new Date('2020-01-01') });
  oldOrder = await order({ notes: 'Ancienne commande recherchable', status: 'shipped', paymentStatus: 'paid', createdAt: new Date('2020-01-02') });
  for (let i = 0; i < 25; i += 1) await service({ createdAt: new Date('2026-01-01') });
  for (let i = 0; i < 23; i += 1) await project({ createdAt: new Date('2026-01-01') });
  reviewProject = await project({ status: 'completed' });
  await db.WorkCoordination.create({ entityType: 'project', entityId: reviewProject.id, state: 'completed' });
  reviewService = await service({ status: 'created', missionStatus: 'COMPLETED' });
  await project({ status: 'completed', title: 'Projet historique sans coordination' });
  await project({ status: 'validated' }); await order({ status: 'fulfilled' }); await service({ missionStatus: 'CANCELLED_BY_CLIENT' });
  await service({ parentServiceId: reviewService.id, title: 'Reprise déjà liée au dossier' });
  await service({ clientId: other.id, title: 'Service privé' }); await project({ clientId: other.id, title: 'Projet privé' }); await order({ userId: other.id, notes: 'Commande privée' });
  for (const [index, slug] of ['mobilite', 'livraison'].entries()) {
    const [category, created] = await db.TradeCategory.findOrCreate({ where: { slug }, defaults: { name: slug, isActive: true } });
    if (created) categories.push(category);
    await db.Service.update({ tradeCategoryId: category.id }, { where: { id: serviceIds[index] } });
  }
});
afterAll(async () => {
  if (projectIds.length) await db.WorkCoordination.destroy({ where: { entityType: 'project', entityId: projectIds } });
  if (serviceIds.length) { await db.Service.update({ parentServiceId: null }, { where: { id: serviceIds } }); await db.Service.destroy({ where: { id: serviceIds } }); }
  if (projectIds.length) await db.Project.destroy({ where: { id: projectIds } });
  if (orderIds.length) await db.Order.destroy({ where: { id: orderIds } });
  if (users.length) await db.User.destroy({ where: { id: users } });
  for (const row of categories) await row.destroy();
  for (const row of countries) await row.destroy();
  await db.sequelize.close();
});

test('global pagination includes every family, exact totals and old cross-border dossiers without overlap', async () => {
  const responses = await Promise.all([1, 2, 3].map(page => list({ view: 'all', page, limit: 20 })));
  responses.forEach(response => expect(response.status).toBe(200));
  expect(responses.map(response => response.body.items.length)).toEqual([20, 20, 16]);
  responses.forEach(response => expect(response.body.pagination.total).toBe(56));
  const rows = responses.flatMap(response => response.body.items);
  expect(new Set(rows.map(row => row.key)).size).toBe(56);
  expect(rows).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'project', id: oldProject.id }), expect.objectContaining({ kind: 'order', id: oldOrder.id })]));
  expect(rows.some(row => row.title.includes('privé'))).toBe(false);
  expect((await list({ view: 'all', limit: 20 })).body.items.map(row => row.key)).toEqual(rows.slice(0, 20).map(row => row.key));
});
test('search and family filtering happen before pagination, including order descriptions and references', async () => {
  const projectResult = await list({ q: 'Ancien projet', kind: 'project', limit: 1 });
  expect(projectResult.status).toBe(200); expect(projectResult.body.pagination.total).toBe(1); expect(projectResult.body.items[0].id).toBe(oldProject.id);
  expect((await list({ q: 'recherchable', kind: 'order' })).body.items[0]).toMatchObject({ id: oldOrder.id, summary: 'Ancienne commande recherchable' });
  expect((await list({ q: oldOrder.code })).body.items[0].id).toBe(oldOrder.id);
  expect((await list({ q: `#${oldProject.id}`, kind: 'project' })).body.items[0].id).toBe(oldProject.id);
  expect((await list({ q: 'privé', view: 'all' })).body.pagination.total).toBe(0);
});
test('search treats LIKE metacharacters literally and binds injection-shaped strings', async () => {
  const literal = await list({ q: '50%_!' });
  expect(literal.status).toBe(200); expect(literal.body.items.map(row => row.key)).toEqual([`project:${oldProject.id}`]);
  expect((await list({ q: "' OR 1=1 --" })).body.pagination.total).toBe(0);
});
test('taxi and delivery remain distinct service categories in the common collection', async () => {
  const taxi = await list({ kind: 'taxi' }), delivery = await list({ kind: 'delivery' }), services = await list({ kind: 'service', view: 'all' });
  expect(taxi.status).toBe(200); expect(delivery.status).toBe(200);
  expect(taxi.body.items).toEqual([expect.objectContaining({ kind: 'service', id: serviceIds[0], tradeCategory: expect.objectContaining({ slug: 'mobilite' }) })]);
  expect(delivery.body.items).toEqual([expect.objectContaining({ kind: 'service', id: serviceIds[1], tradeCategory: expect.objectContaining({ slug: 'livraison' }) })]);
  expect(services.body.pagination.total).toBe(25);
});
test('the executor field resolves correctly for both an agent-executed and a provider-executed service', async () => {
  const agentAccount = await db.User.create({ role: 'agent', countryId: country.id, firstName: 'Awa', lastName: 'Diallo', email: `requests-agent-${crypto.randomUUID()}@example.test`, passwordHash: 'unused-in-token-test' });
  users.push(agentAccount.id);
  const agentService = await service({ title: 'Suivi avec agent', executionType: 'agent', agentId: agentAccount.id });

  const providerAccount = await db.User.create({ role: 'provider', countryId: country.id, email: `requests-provider-${crypto.randomUUID()}@example.test`, passwordHash: 'unused-in-token-test' });
  users.push(providerAccount.id);
  const provider = await db.Provider.create({ userId: providerAccount.id, type: 'independent', displayFirstName: 'Fatou', phoneNumber: '+22370000001', countryCode: 'ML', status: 'active' });
  const providerService = await service({ title: 'Suivi avec prestataire', executionType: 'provider', providerId: provider.id });

  const result = await list({ view: 'all', q: 'Suivi avec' });
  expect(result.status).toBe(200);
  const byKey = Object.fromEntries(result.body.items.map((item) => [item.key, item]));
  expect(byKey[`service:${agentService.id}`].agent).toEqual({ firstName: 'Awa Diallo' });
  expect(byKey[`service:${providerService.id}`].agent).toEqual({ firstName: 'Fatou' });

  // Nettoyage immédiat : ces deux services ne doivent pas fausser les comptages absolus
  // des autres tests du fichier, qui partagent le même jeu de données de `beforeAll`.
  await db.Service.destroy({ where: { id: [agentService.id, providerService.id] } });
  await provider.destroy();
  await db.User.destroy({ where: { id: [agentAccount.id, providerAccount.id] } });
});
test('review only includes actionable results, never shipped or paid orders or legacy projects', async () => {
  const result = await list({ view: 'review' });
  expect(result.status).toBe(200); expect(result.body.pagination.total).toBe(2);
  expect(new Set(result.body.items.map(row => row.key))).toEqual(new Set([`project:${reviewProject.id}`, `service:${reviewService.id}`]));
  expect((await list({ view: 'review', kind: 'order' })).body.pagination.total).toBe(0);
});
test('active and historical views partition requests using their authoritative work status', async () => {
  const active = await list(), history = await list({ view: 'history' });
  expect(active.status).toBe(200); expect(history.status).toBe(200);
  expect(active.body.pagination.total).toBe(53); expect(history.body.pagination.total).toBe(3);
  expect(history.body.items.every(row => row.history)).toBe(true);
  const shipped = await list({ kind: 'order' });
  expect(shipped.body.items).toEqual([expect.objectContaining({ id: oldOrder.id, status: 'shipped', paymentStatus: 'paid', review: false, history: false })]);
});
test('ownership cannot be overridden, and non-client roles and anonymous requests are rejected', async () => {
  expect((await list({ clientId: other.id })).status).toBe(400);
  expect((await list({}, other)).body.pagination.total).toBe(3);
  expect((await list({}, admin)).status).toBe(403);
  expect((await request(app).get('/api/v1/requests')).status).toBe(401);
});
test('invalid or unbounded filters fail instead of silently returning a different collection', async () => {
  for (const query of [{ page: 0 }, { page: 100001 }, { limit: 51 }, { kind: 'unknown' }, { view: 'unknown' }, { q: 'x'.repeat(201) }, { countryId: country.id }]) expect((await list(query)).status).toBe(400);
  expect((await list()).headers['cache-control']).toBe('no-store');
});
