'use strict';
const crypto = require('crypto');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const request = require('supertest');
const db = require('../../models');
const app = require('../../src/app');
let country, foreign, client, admin, agent, delegate, outsider, property;
const users = [], services = [], tasks = [];
const auth = (user) => ({ Authorization: `Bearer ${jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' })}` });
async function makeCountry() {
  for (let i = 0; i < 80; i += 1) {
    try { return await db.Country.create({ name: `Steps-${crypto.randomUUID()}`, isoCode: String.fromCharCode(65 + Math.floor(Math.random() * 26), 65 + Math.floor(Math.random() * 26)), currency: 'XOF', isActive: true }); }
    catch (error) { if (error.name !== 'SequelizeUniqueConstraintError') throw error; }
  }
  throw new Error('No test country available');
}
async function makeUser(role, countryId) {
  const user = await db.User.create({ role, countryId, email: `steps-${crypto.randomUUID()}@example.com`, passwordHash: await bcrypt.hash(crypto.randomUUID(), 4) });
  users.push(user.id); return user;
}
async function service(extra = {}) {
  const row = await db.Service.create({ type: 'errand', title: 'Service avec étapes', clientId: client.id, agentId: agent.id, countryId: country.id, currency: 'XOF', status: 'in_progress', ...extra }); services.push(row.id); return row;
}
async function task(serviceId, extra = {}) {
  const row = await db.Task.create({ title: 'Étape de réalisation', type: 'repair', serviceId, creatorId: client.id, assignedTo: agent.id, countryId: country.id, ...extra }); tasks.push(row.id); return row;
}
beforeAll(async () => {
  await db.sequelize.authenticate();
  country = await makeCountry(); foreign = await makeCountry();
  client = await makeUser('client', country.id); admin = await makeUser('admin', country.id);
  agent = await makeUser('agent', country.id); delegate = await makeUser('agent', country.id); outsider = await makeUser('admin', foreign.id);
  property = await db.Property.create({ title: 'Maison familiale', type: 'house', address: 'Adresse de recette', city: 'Bamako', ownerId: client.id, countryId: country.id });
});
afterAll(async () => {
  if (tasks.length) { await db.Evidence.destroy({ where: { taskId: tasks } }); await db.Task.destroy({ where: { id: tasks } }); }
  if (services.length) { await db.MissionCoordination.destroy({ where: { serviceId: services } }); await db.Service.destroy({ where: { id: services } }); }
  if (property) await property.destroy();
  if (users.length) { await db.Notification.destroy({ where: { userId: users } }); await db.Activity.destroy({ where: { userId: users } }); await db.User.destroy({ where: { id: users } }); }
  if (country) await country.destroy(); if (foreign) await foreign.destroy(); await db.sequelize.close();
});

test('workspace pagination counts all authorized steps with a stable order; legacy calls retain their full list', async () => {
  const parent = await service();
  const date = new Date('2026-01-02T12:00:00Z');
  const entries = [];
  for (let i = 0; i < 23; i += 1) entries.push(await task(parent.id, { title: `Étape ${i}`, createdAt: date }));
  const one = await request(app).get(`/api/tasks/service/${parent.id}?workspace=true&limit=20`).set(auth(client));
  const two = await request(app).get(`/api/tasks/service/${parent.id}?workspace=true&limit=20&page=2`).set(auth(client));
  expect(one.status).toBe(200); expect(one.body.pagination.total).toBe(23); expect(two.body.tasks).toHaveLength(3);
  expect(one.body.canCreate).toBe(true); expect(one.body.serviceContext.id).toBe(parent.id);
  expect([...one.body.tasks, ...two.body.tasks].map((entry) => entry.id)).toEqual(entries.map((entry) => entry.id).reverse());
  const focused = await request(app).get(`/api/tasks/service/${parent.id}?workspace=true&taskId=${entries[0].id}`).set(auth(client));
  expect(focused.status).toBe(200); expect(focused.body.pagination.total).toBe(1); expect(focused.body.tasks.map((entry) => entry.id)).toEqual([entries[0].id]);
  expect((await request(app).get(`/api/tasks/service/${parent.id}?workspace=true&taskId=bad`).set(auth(client))).status).toBe(400);
  const old = await request(app).get(`/api/tasks/service/${parent.id}`).set(auth(client));
  expect(old.status).toBe(200); expect(old.body.tasks).toHaveLength(23); expect(old.body.tasks[0].capabilities).toBeUndefined();
});

test('the intervention archive paginates property and service work, including completed history', async () => {
  const parent = await service({ propertyId: property.id });
  const prefix = `archive-${crypto.randomUUID()}`;
  const entries = [];
  for (let i = 0; i < 23; i += 1) entries.push(await task(i % 2 ? parent.id : null, { propertyId: i % 2 ? null : property.id, title: `${prefix} ${i}`, status: 'validated' }));
  await task(null, { title: prefix, status: 'validated' });
  const url = `/api/tasks?propertyId=${property.id}&q=${prefix}&status=validated&limit=20`;
  const one = await request(app).get(url).set(auth(client));
  const two = await request(app).get(`${url}&page=2`).set(auth(client));
  expect(one.status).toBe(200); expect(two.status).toBe(200);
  expect(one.body.pagination).toMatchObject({ total: 23, totalPages: 2, count: 20 });
  expect(two.body.pagination.count).toBe(3);
  expect([...one.body.tasks, ...two.body.tasks].map((entry) => entry.id)).toEqual(entries.map((entry) => entry.id).reverse());
  const ownService = await request(app).get(`${url}&serviceId=${parent.id}`).set(auth(client));
  expect(ownService.body.pagination.total).toBe(11);
});

test('property and search filters cannot widen a client or agent permission', async () => {
  const parent = await service({ propertyId: property.id, clientId: delegate.id, agentId: delegate.id });
  const title = `private-${crypto.randomUUID()}`;
  await task(null, { propertyId: property.id, title, creatorId: delegate.id, assignedTo: delegate.id });
  await task(parent.id, { title, creatorId: delegate.id, assignedTo: delegate.id });
  // Ownership grants the direct property intervention, but not an unrelated service's tasks.
  const clientResult = await request(app).get(`/api/tasks?propertyId=${property.id}&q=${title}`).set(auth(client));
  expect(clientResult.status).toBe(200); expect(clientResult.body.pagination.total).toBe(1);
  const agentResult = await request(app).get(`/api/tasks?propertyId=${property.id}&q=${title}`).set(auth(agent));
  expect(agentResult.status).toBe(200); expect(agentResult.body.pagination.total).toBe(0);
  const outside = await request(app).get(`/api/tasks?propertyId=${property.id}&q=${title}&countryId=${country.id}`).set(auth(outsider));
  expect(outside.status).toBe(200); expect(outside.body.pagination.total).toBe(0);
});

test('search covers the parent title and treats wildcard characters as literal text', async () => {
  const prefix = `lookup-${crypto.randomUUID()}`;
  const parent = await service({ title: `${prefix} remise` });
  const entry = await task(parent.id, { title: `${prefix} 100%_ok` });
  await task(null, { title: `${prefix} 100xyok` });
  const parentMatch = await request(app).get(`/api/tasks?q=${prefix}%20remise`).set(auth(client));
  expect(parentMatch.status).toBe(200); expect(parentMatch.body.tasks.map((row) => row.id)).toEqual([entry.id]);
  const exact = await request(app).get(`/api/tasks?q=${encodeURIComponent(`${prefix} 100%_ok`)}`).set(auth(client));
  expect(exact.status).toBe(200); expect(exact.body.tasks.map((row) => row.id)).toEqual([entry.id]);
});

test.each(['bad', '0', '-1', '1oops', ''])('invalid property filter %s never opens the unfiltered archive', async (value) => {
  const result = await request(app).get(`/api/tasks?propertyId=${value}`).set(auth(client));
  expect(result.status).toBe(400);
});

test('a supervising agent can see evidence but cannot advance a step assigned to another agent', async () => {
  const parent = await service(); const entry = await task(parent.id, { assignedTo: delegate.id });
  const result = await request(app).get(`/api/tasks/service/${parent.id}?workspace=true`).set(auth(agent));
  expect(result.status).toBe(200); expect(result.body.tasks[0].capabilities).toMatchObject({ canStart: false, canValidate: false, canAssign: false, canAccessEvidence: true });
  expect((await request(app).put(`/api/tasks/${entry.id}/status`).set(auth(agent)).send({ status: 'in_progress' })).status).toBe(403);
  expect((await request(app).get(`/api/tasks/${entry.id}/evidences`).set(auth(agent))).status).toBe(200);
});

test('an agent assigned only to a task retains the legacy entry without gaining service access', async () => {
  const parent = await service(); const own = await task(parent.id, { assignedTo: delegate.id }); await task(parent.id);
  const result = await request(app).get(`/api/tasks/service/${parent.id}?workspace=true`).set(auth(delegate));
  expect(result.status).toBe(200); expect(result.body.tasks.map((entry) => entry.id)).toEqual([own.id]);
  expect(result.body.serviceContext).toBeNull(); expect(result.body.canCreate).toBe(false);
  expect(result.body.tasks[0].capabilities.canStart).toBe(true);
  expect((await request(app).get(`/api/services/${parent.id}`).set(auth(delegate))).status).toBe(403);
  const hidden = await request(app).get(`/api/tasks/service/${parent.id}?workspace=true&taskId=${tasks[tasks.length - 1]}`).set(auth(delegate));
  expect(hidden.status).toBe(200); expect(hidden.body.tasks).toEqual([]); expect(hidden.body.serviceContext).toBeNull();
});

test('step completion and administrative review do not confirm or finish the service', async () => {
  const parent = await service(); const entry = await task(parent.id);
  for (const status of ['in_progress', 'completed']) expect((await request(app).put(`/api/tasks/${entry.id}/status`).set(auth(agent)).send({ status })).status).toBe(200);
  expect((await request(app).put(`/api/tasks/${entry.id}/status`).set(auth(client)).send({ status: 'validated' })).status).toBe(403);
  const result = await request(app).get(`/api/tasks/service/${parent.id}?workspace=true`).set(auth(admin));
  expect(result.body.tasks[0].capabilities.canValidate).toBe(true);
  expect((await request(app).put(`/api/tasks/${entry.id}/status`).set(auth(admin)).send({ status: 'validated' })).status).toBe(200);
  expect((await parent.reload()).status).toBe('in_progress');
});

test('an open step does not introduce a new business requirement on classic service completion', async () => {
  const parent = await service(); const entry = await task(parent.id);
  const result = await request(app).post(`/api/services/agent/services/${parent.id}/complete`).set(auth(agent));
  expect(result.status).toBe(200); expect((await entry.reload()).status).toBe('created');
  expect((await parent.reload()).status).toBe('completed');
});

test('foreign territory cannot retrieve steps or service metadata and proof permissions match their endpoint', async () => {
  const parent = await service(); const entry = await task(parent.id);
  const result = await request(app).get(`/api/tasks/service/${parent.id}?workspace=true`).set(auth(outsider));
  expect(result.status).toBe(200); expect(result.body.tasks).toEqual([]); expect(result.body.serviceContext).toBeNull(); expect(result.body.canCreate).toBe(false);
  expect((await request(app).get(`/api/tasks/${entry.id}/evidences`).set(auth(outsider))).status).toBe(403);
});

test('creating a service step does not inherit the service agent and a property-only task keeps its context', async () => {
  const parent = await service();
  const created = await request(app).post('/api/tasks').set(auth(client)).send({ serviceId: parent.id, title: 'Nouvelle étape', type: 'other' });
  expect(created.status).toBe(201); tasks.push(created.body.task.id); expect(created.body.task.assignedTo).toBeNull();
  const standalone = await request(app).post('/api/tasks').set(auth(client)).send({ propertyId: property.id, title: 'Relevé du compteur', type: 'visit' });
  expect(standalone.status).toBe(201); tasks.push(standalone.body.task.id); expect(standalone.body.task.serviceId).toBeNull(); expect(standalone.body.task.propertyId).toBe(property.id);
});

test('a client living outside the execution territory keeps service access without broadening evidence permissions', async () => {
  const remote = await makeUser('client', foreign.id);
  const parent = await service({ clientId: remote.id }); const entry = await task(parent.id, { creatorId: remote.id });
  const result = await request(app).get(`/api/tasks/service/${parent.id}?workspace=true`).set(auth(remote));
  expect(result.status).toBe(200); expect(result.body.canCreate).toBe(true); expect(result.body.serviceContext.id).toBe(parent.id);
  expect(result.body.tasks[0].capabilities.canAccessEvidence).toBe(false);
  expect((await request(app).get(`/api/tasks/${entry.id}/evidences`).set(auth(remote))).status).toBe(403);
});
