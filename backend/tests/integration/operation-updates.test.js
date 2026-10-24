'use strict';
process.env.NODE_ENV = 'test';
const crypto = require('crypto');
process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const bcrypt = require('bcrypt');
const request = require('supertest');
const db = require('../../models');
const app = require('../../src/app');
const { invalidateNotificationSummary } = require('../../src/services/notification.service');
const accounts = [];
let ready = false, country, foreign, service, otherService;
const now = Math.floor(Date.now() / 1000) * 1000;
const date = (days = 0) => new Date(now - days * 86400000);
const auth = (account) => ({ Authorization: `Bearer ${account.token}` });

async function makeCountry() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { return await db.Country.create({ isoCode: String.fromCharCode(65 + crypto.randomInt(26), 65 + crypto.randomInt(26)), name: `Operations centre ${crypto.randomUUID()}`, currency: 'XOF', timezone: 'Africa/Bamako', isActive: true }); }
    catch (error) { if (error.name !== 'SequelizeUniqueConstraintError') throw error; }
  }
  throw new Error('Country fixture unavailable');
}
async function event(account, extra = {}, withActivity = true) {
  const fields = { userId: account.id, actorId: null, entityType: 'service', entityId: service.id,
    action: 'status_updated', title: 'Prestation remise au client', message: 'Le compte rendu est disponible.', entityStatus: 'completed',
    progress: 'done', countryId: country.id, regionId: null, metadata: { serviceId: service.id }, createdAt: date(), updatedAt: date(), ...extra };
  const activity = withActivity ? await db.Activity.create(fields) : null;
  const notification = await db.Notification.create({ ...fields, status: extra.status || 'unread' });
  // Les hooks de timestamp ne doivent pas rajeunir les données historiques de recette.
  for (const [table, record] of [['notifications', notification], ['activities', activity]]) if (record) {
    await db.sequelize.query(`UPDATE ${table} SET createdAt = :createdAt, updatedAt = :updatedAt WHERE id = :id`, { replacements: { id: record.id, createdAt: fields.createdAt, updatedAt: fields.updatedAt }, logging: false });
    await record.reload();
  }
  return { activity, notification };
}
async function feed(account, params = {}) {
  return request(app).get('/api/v1/operations/updates').set(auth(account)).query(params);
}

beforeAll(async () => {
  try { await db.sequelize.authenticate(); ready = true; }
  catch (error) { if (process.env.REQUIRE_INTEGRATION_DB === 'true') throw error; return; }
  country = await makeCountry(); foreign = await makeCountry();
  const password = crypto.randomUUID(); const passwordHash = await bcrypt.hash(password, 10);
  for (const role of ['client', 'agent', 'provider', 'admin', 'category_manager']) {
    const user = await db.User.create({ role, countryId: country.id, email: `ops-${crypto.randomUUID()}@example.test`, passwordHash });
    const login = await request(app).post('/api/v1/auth/login').send({ email: user.email, password });
    expect(login.status).toBe(200); accounts.push({ id: user.id, role, token: login.body.token });
  }
  service = await db.Service.create({ clientId: accounts[0].id, type: 'other', executionType: 'agent', title: 'Dossier conservé', countryId: country.id, status: 'created' });
  otherService = await db.Service.create({ clientId: accounts[0].id, type: 'other', executionType: 'agent', title: 'Autre territoire', countryId: foreign.id, status: 'created' });
});
beforeEach(async () => {
  if (!ready) return;
  const userId = accounts.map((account) => account.id);
  await db.Notification.destroy({ where: { userId } }); await db.Activity.destroy({ where: { userId } });
  invalidateNotificationSummary(userId);
});
afterAll(async () => {
  if (ready) {
    const userId = accounts.map((account) => account.id);
    if (userId.length) {
      await db.Notification.destroy({ where: { userId } }); await db.Activity.destroy({ where: { userId } });
      for (const Model of [db.RefreshToken, db.RecoveryCode, db.PasswordResetToken]) await Model.destroy({ where: { userId } });
    }
    if (service) await service.destroy(); if (otherService) await otherService.destroy();
    if (userId.length) await db.User.destroy({ where: { id: userId } });
    if (country) await country.destroy(); if (foreign) await foreign.destroy();
  }
  await db.sequelize.close();
});

test.each(['client', 'agent', 'provider', 'admin', 'category_manager'])('%s receives only personal updates and cannot gain coordination rights through the feed', async (role) => {
  if (!ready) return;
  const account = accounts.find((entry) => entry.role === role);
  await event(account); await event(accounts.find((entry) => entry.id !== account.id), { title: 'Information privée d’un autre compte' });
  const result = await feed(account, { status: 'unread' });
  expect(result.status).toBe(200); expect(result.body.items).toHaveLength(1);
  expect(result.body.items[0].title).toBe('Prestation remise au client');
  expect(result.body.summary.unread).toBe(1);
  expect((await request(app).get('/api/notifications/summary').set(auth(account))).status).toBe(200);
  if (role !== 'admin') expect((await request(app).get('/api/v1/operations').set(auth(account))).status).toBe(403);
});

test('the unified history keeps older repeated events, activity-only events and overlapping entity identifiers', async () => {
  if (!ready) return;
  const account = accounts[0];
  const first = await event(account, { createdAt: date(2), updatedAt: date(2) });
  await first.notification.destroy();
  await event(account, { createdAt: date(1), updatedAt: date(1) });
  await db.Activity.create({ userId: account.id, entityType: 'user', entityId: account.id, action: 'created', title: 'Compte créé' });
  await event(account, { entityType: 'project', title: 'Projet du même numéro' });
  const result = await feed(account);
  expect(result.status).toBe(200); expect(result.body.pagination.total).toBe(4);
  expect(result.body.items).toHaveLength(4);
  expect(new Set(result.body.items.map((item) => item.key)).size).toBe(4);
  expect(result.body.items.filter((item) => item.title === 'Prestation remise au client')).toHaveLength(2);
});

test.each(['project', 'task', 'order'])('%s legacy status updates reconcile with history when the author changes', async (entityType) => {
  if (!ready) return;
  const { emitEvent } = require('../../src/services/activity.service');
  const payload = { recipients: [accounts[0].id], actorId: accounts[1].id, entityType, entityId: service.id,
    countryId: country.id, title: 'Demande reçue', action: 'created', entityStatus: 'created' };
  await emitEvent(payload);
  await emitEvent({ ...payload, actorId: accounts[3].id, action: 'status_updated', title: 'Nouvelle étape', entityStatus: 'in_progress', notificationMode: 'update' });
  const result = await feed(accounts[0]);
  expect(result.status).toBe(200); expect(result.body.pagination.total).toBe(2);
  expect(result.body.items.filter((row) => row.title === 'Nouvelle étape')).toHaveLength(1);
  expect(result.body.items.find((row) => row.title === 'Nouvelle étape').activityId).not.toBeNull();
});

test('pagination is applied after source reconciliation and remains stable after marking read', async () => {
  if (!ready) return;
  const account = accounts[0];
  for (let index = 0; index < 4; index += 1) await event(account, { entityId: service.id + index, title: `Étape ${index}`, createdAt: new Date(now - (index + 1) * 10000), updatedAt: new Date(now - (index + 1) * 10000) });
  const first = await feed(account, { limit: 2 }); const second = await feed(account, { limit: 2, page: 2 });
  expect(first.body.pagination.total).toBe(4); expect(first.body.items).toHaveLength(2); expect(second.body.items).toHaveLength(2);
  const item = first.body.items[0];
  expect((await request(app).patch(`/api/notifications/${item.notificationId}/read`).set(auth(account)).send({ version: item.version })).status).toBe(200);
  const again = await feed(account, { limit: 2 });
  expect(again.body.items.map((entry) => entry.key)).toEqual(first.body.items.map((entry) => entry.key));
  expect(again.body.pagination.total).toBe(4);
  expect((await feed(account, { status: 'unread' })).body.pagination.total).toBe(3);
});

test('stale reading and removal cannot erase a newer unread step', async () => {
  if (!ready) return;
  const account = accounts[0];
  const { notification } = await event(account);
  const item = (await feed(account)).body.items[0];
  await notification.update({ title: 'Nouvelle étape arrivée', updatedAt: new Date(now + 1000) }, { silent: true });
  expect((await request(app).patch(`/api/notifications/${notification.id}/read`).set(auth(account)).send({ version: item.version })).status).toBe(409);
  expect((await request(app).delete(`/api/v1/operations/updates/notification/${notification.id}`).set(auth(account)).send({ version: item.version })).status).toBe(409);
  expect((await notification.reload()).status).toBe('unread');
});

test('reading notification-only updates preserves their event date and cleanup keeps recently read information', async () => {
  if (!ready) return;
  const account = accounts[0];
  const { notification } = await event(account, { createdAt: date(45), updatedAt: date(2) }, false);
  const item = (await feed(account)).body.items[0];
  expect(new Date(item.occurredAt).getTime()).toBe(date(2).getTime());
  expect((await request(app).patch(`/api/notifications/${notification.id}/read`).set(auth(account)).send({ version: item.version })).status).toBe(200);
  expect((await feed(account)).body.items[0].occurredAt).toBe(item.occurredAt);
  const old = await event(account, { entityId: service.id + 100, createdAt: date(45), updatedAt: date(45) }, false);
  const before = (await feed(account)).body.items.map((row) => [row.key, row.occurredAt]);
  expect((await request(app).patch('/api/notifications/read-all').set(auth(account))).status).toBe(200);
  expect((await feed(account)).body.items.map((row) => [row.key, row.occurredAt])).toEqual(before);
  expect((await request(app).delete('/api/v1/operations/updates/cleanup').set(auth(account))).status).toBe(200);
  expect(await db.Notification.findByPk(old.notification.id)).not.toBeNull();
});

test('removal clears both copies atomically, never the case, and refuses another recipient', async () => {
  if (!ready) return;
  const account = accounts[0];
  const { notification, activity } = await event(account);
  const item = (await feed(account)).body.items[0];
  const path = `/api/v1/operations/updates/notification/${notification.id}`;
  expect((await request(app).delete(path).set(auth(accounts[1])).send({ version: item.version })).status).toBe(404);
  expect((await request(app).delete(path).set(auth(account)).send({ version: item.version })).status).toBe(200);
  expect(await db.Notification.findByPk(notification.id)).toBeNull(); expect(await db.Activity.findByPk(activity.id)).toBeNull();
  expect((await service.reload()).status).toBe('created');
});

test('failure to remove the activity rolls back notification removal', async () => {
  if (!ready) return;
  const account = accounts[0]; const { notification } = await event(account);
  const item = (await feed(account)).body.items[0];
  const failure = jest.spyOn(db.Activity, 'destroy').mockRejectedValueOnce(new Error('Storage unavailable'));
  try {
    const result = await request(app).delete(`/api/v1/operations/updates/notification/${notification.id}`).set(auth(account)).send({ version: item.version });
    expect(result.status).toBe(500); expect(await db.Notification.findByPk(notification.id)).not.toBeNull();
  } finally { failure.mockRestore(); }
});

test('cleanup preserves unread items, their history, recent information and other recipients', async () => {
  if (!ready) return;
  const account = accounts[0];
  const unread = await event(account, { createdAt: date(45), updatedAt: date(45) });
  const old = await event(account, { entityId: service.id + 100, status: 'read', createdAt: date(45), updatedAt: date(45) });
  const recent = await event(account, { entityId: service.id + 200, status: 'read', createdAt: date(2), updatedAt: date(2) });
  const other = await event(accounts[1], { status: 'read', createdAt: date(45), updatedAt: date(45) });
  const result = await request(app).delete('/api/v1/operations/updates/cleanup').set(auth(account));
  expect(result.status).toBe(200);
  expect(result.body.deleted).toBe(2);
  expect(await db.Notification.findByPk(old.notification.id)).toBeNull(); expect(await db.Activity.findByPk(old.activity.id)).toBeNull();
  for (const pair of [unread, recent, other]) { expect(await db.Notification.findByPk(pair.notification.id)).not.toBeNull(); expect(await db.Activity.findByPk(pair.activity.id)).not.toBeNull(); }
});

test('filters and focused coordination cannot broaden access to another country', async () => {
  if (!ready) return;
  expect((await feed(accounts[0], { userId: accounts[1].id })).status).toBe(400);
  expect((await feed(accounts[0], { from: date().toISOString(), to: date(2).toISOString() })).status).toBe(400);
  expect((await feed(accounts[0], { to: date().toISOString() })).status).toBe(200);
  const admin = accounts.find((account) => account.role === 'admin');
  const result = await request(app).get('/api/v1/operations').set(auth(admin)).query({ id: otherService.id, open: false });
  expect(result.status).toBe(200); expect(result.body.items).toHaveLength(0);
});

test('an activity without a notification can be removed without deleting its case', async () => {
  if (!ready) return;
  const account = accounts[0];
  const activity = await db.Activity.create({ userId: account.id, entityType: 'service', entityId: service.id, action: 'created', title: 'Demande créée' });
  const item = (await feed(account)).body.items[0];
  expect(item.source).toBe('activity');
  const result = await request(app).delete(`/api/v1/operations/updates/activity/${activity.id}`).set(auth(account)).send({ version: item.version });
  expect(result.status).toBe(200); expect(await db.Activity.findByPk(activity.id)).toBeNull();
  expect(await db.Service.findByPk(service.id)).not.toBeNull();
});
