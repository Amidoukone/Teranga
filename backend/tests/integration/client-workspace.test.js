'use strict';
process.env.NODE_ENV = 'test';
const crypto = require('crypto');
process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const bcrypt = require('bcrypt');
const request = require('supertest');
const db = require('../../models');
const app = require('../../src/app');
const accounts = [];
let country, legacyReview, missionReview;
const createdCategories = [];
const auth = (account) => ({ Authorization: `Bearer ${account.token}` });
const list = (query = {}) => request(app).get('/api/services/me').set(auth(accounts[0])).query(query);

beforeAll(async () => {
  await db.sequelize.authenticate();
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { country = await db.Country.create({ isoCode: String.fromCharCode(65 + crypto.randomInt(26), 65 + crypto.randomInt(26)), name: `Accueil ${crypto.randomUUID()}`, currency: 'XOF', timezone: 'Africa/Bamako', isActive: true }); break; }
    catch (error) { if (error.name !== 'SequelizeUniqueConstraintError') throw error; }
  }
  if (!country) throw Error('Country fixture unavailable');
  const password = crypto.randomUUID(); const passwordHash = await bcrypt.hash(password, 10);
  for (let index = 0; index < 2; index += 1) {
    const user = await db.User.create({ role: 'client', countryId: country.id, email: `home-${crypto.randomUUID()}@example.test`, passwordHash });
    const login = await request(app).post('/api/auth/login').send({ email: user.email, password });
    expect(login.status).toBe(200); accounts.push({ id: user.id, token: login.body.token });
  }
  const create = (fields) => db.Service.create({ clientId: accounts[0].id, countryId: country.id, type: 'other', executionType: 'agent', title: 'Dossier accueil', ...fields });
  legacyReview = await create({ title: 'Ancien résultat à vérifier', status: 'completed', createdAt: new Date('2026-01-01T00:00:00Z') });
  missionReview = await create({ status: 'created', executionType: 'provider', missionStatus: 'COMPLETED' });
  await create({ status: 'completed', missionStatus: 'CANCELLED_BY_CLIENT' });
  await create({ status: 'completed', missionStatus: 'IN_PROGRESS' });
  await create({ status: 'validated' });
  await create({ clientId: accounts[1].id, status: 'completed', title: 'Résultat privé' });
  await db.Service.bulkCreate(Array.from({ length: 101 }, (_, index) => ({ clientId: accounts[0].id, countryId: country.id, type: 'other', executionType: 'agent', status: 'created', title: `Demande récente ${index}` })));
  for (const [slug, service] of [['mobilite', legacyReview], ['livraison', missionReview]]) {
    const [category, created] = await db.TradeCategory.findOrCreate({ where: { slug }, defaults: { name: slug, isActive: true } });
    if (created) createdCategories.push(category);
    await service.update({ tradeCategoryId: category.id });
  }
});
afterAll(async () => {
  const ids = accounts.map((account) => account.id);
  if (ids.length) {
    await db.Service.destroy({ where: { clientId: ids } });
    for (const Model of [db.RefreshToken, db.RecoveryCode, db.PasswordResetToken]) await Model.destroy({ where: { userId: ids } });
    await db.User.destroy({ where: { id: ids } });
  }
  if (country) await country.destroy();
  for (const category of createdCategories) await category.destroy();
  await db.sequelize.close();
});

test('old results needing review are found before pagination even behind 100 recent requests', async () => {
  const result = await list({ view: 'review', limit: 1, sort: 'createdAt' });
  expect(result.status).toBe(200); expect(result.body.pagination.total).toBe(2);
  expect(result.body.services.map((row) => row.id)).toEqual([legacyReview.id]);
  const next = await list({ view: 'review', limit: 1, offset: 1, sort: 'createdAt' });
  expect(next.body.services.map((row) => row.id)).toEqual([missionReview.id]);
});
test('ongoing requests respect mission status and exclude results awaiting review and terminal cases', async () => {
  const result = await list({ view: 'ongoing', limit: 4 });
  expect(result.status).toBe(200); expect(result.body.pagination.total).toBe(102); expect(result.body.services).toHaveLength(4);
});
test('views do not bypass ownership, and omitted view preserves the existing list', async () => {
  const result = await list({ view: 'review', clientId: accounts[1].id });
  expect(result.body.pagination.total).toBe(2); expect(result.body.services.some((row) => row.title === 'Résultat privé')).toBe(false);
  const legacy = await list({ limit: 1 });
  expect(legacy.status).toBe(200); expect(legacy.body.pagination.total).toBe(106);
  expect((await list({ view: 'arbitrary' })).status).toBe(400);
  expect((await request(app).get('/api/services/me').query({ view: 'review' })).status).toBe(401);
});

test('active and historical views partition requests using the authoritative mission status', async () => {
  expect((await list({ view: 'active', limit: 1 })).body.pagination.total).toBe(104);
  const history = await list({ view: 'history' });
  expect(history.status).toBe(200); expect(history.body.pagination.total).toBe(2);
  expect(history.body.services.some((row) => row.missionStatus === 'CANCELLED_BY_CLIENT')).toBe(true);
});

test('family and search filters find old requests before counting and pagination', async () => {
  const taxi = await list({ view: 'review', kind: 'taxi', limit: 1 });
  expect(taxi.status).toBe(200); expect(taxi.body.pagination.total).toBe(1);
  expect(taxi.body.services[0].id).toBe(legacyReview.id);
  const delivery = await list({ view: 'review', kind: 'delivery' });
  expect(delivery.body.services.map((row) => row.id)).toEqual([missionReview.id]);
  expect((await list({ kind: 'service' })).body.pagination.total).toBe(104);
  expect((await list({ view: 'review', kind: 'taxi', q: 'Ancien résultat' })).body.pagination.total).toBe(1);
  expect((await list({ q: `#${legacyReview.id}` })).body.services.map((row) => row.id)).toEqual([legacyReview.id]);
  expect((await list({ kind: 'taxi', q: 'Résultat privé', clientId: accounts[1].id })).body.pagination.total).toBe(0);
  expect((await list({ kind: 'arbitrary' })).status).toBe(400);
});

test('equal creation timestamps have a deterministic order across pages', async () => {
  const first = await list({ view: 'active', limit: 20 });
  const next = await list({ view: 'active', limit: 20, offset: 20 });
  expect(first.body.services).toHaveLength(20); expect(next.body.services).toHaveLength(20);
  expect(new Set([...first.body.services, ...next.body.services].map((row) => row.id)).size).toBe(40);
  expect((await list({ view: 'active', limit: 20 })).body.services.map((row) => row.id)).toEqual(first.body.services.map((row) => row.id));
});
