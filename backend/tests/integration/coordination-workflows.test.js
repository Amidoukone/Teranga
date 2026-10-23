'use strict';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'workflow_test_secret';
const bcrypt = require('bcrypt');
const request = require('supertest');
const crypto = require('crypto');
const db = require('../../models');
const app = require('../../src/app');
const { coordinateMission } = require('../../src/services/missionCoordination.service');
const { coordinateWork, runWorkCoordination } = require('../../src/services/workCoordination.service');
const { suspendOffer } = require('../../scripts/suspend-service-offer');
let ready = false;
let country, foreign, owner, agent, client, outsider, territory, org, definition, offering, product;
const users = [], serviceIds = [], projectIds = [], orderIds = [], receiptIds = [];
const tokens = {};
let passwordHash;
async function makeCountry(currency) {
  for (let index = 0; index < 80; index += 1) {
    try { return await db.Country.create({ name: `Workflow-${Date.now()}-${index}`, isoCode: String.fromCharCode(65 + Math.floor(Math.random() * 26), 65 + Math.floor(Math.random() * 26)), currency, timezone: 'Africa/Accra', isActive: true }); }
    catch (error) { if (error.name !== 'SequelizeUniqueConstraintError') throw error; }
  }
  throw new Error('Country fixture unavailable');
}
async function user(role, countryId) {
  const row = await db.User.create({ role, countryId, email: `workflow-${crypto.randomUUID()}@example.com`, passwordHash }); users.push(row.id);
  const result = await request(app).post('/api/v1/auth/login').send({ email: row.email, password: 'Password123!' });
  expect(result.status).toBe(200); tokens[row.id] = result.body.token; return row;
}
const auth = (account) => ({ Authorization: `Bearer ${tokens[account.id]}` });
function receipt(channel, account, key) {
  receiptIds.push(crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${channel}:${account.id}:${key}`).digest('hex'));
  return { ...auth(account), 'Idempotency-Key': key };
}
async function service(extra = {}) {
  const row = await db.Service.create({ type: 'errand', title: 'Demande coordonnée', executionType: 'agent', countryId: country.id, clientId: client.id, currency: 'GHS', ...extra }); serviceIds.push(row.id); return row;
}
async function project(extra = {}) {
  const row = await db.Project.create({ type: 'administratif', title: 'Projet coordonné', countryId: country.id, clientId: client.id, currency: 'GHS', ...extra }); projectIds.push(row.id); return row;
}
async function order(extra = {}) {
  const row = await db.Order.create({ userId: client.id, countryId: country.id, currency: 'GHS', ...extra }); orderIds.push(row.id); return row;
}
beforeAll(async () => {
  try { await db.sequelize.authenticate(); ready = true; }
  catch (error) { if (process.env.REQUIRE_INTEGRATION_DB === 'true') throw error; return; }
  passwordHash = await bcrypt.hash('Password123!', 10);
  country = await makeCountry('GHS'); foreign = await makeCountry('USD');
  owner = await user('admin', country.id); agent = await user('agent', country.id); client = await user('client', foreign.id); outsider = await user('admin', foreign.id);
  const code = `WORK-${Date.now()}`;
  territory = await db.Territory.create({ code, name: code, type: 'COUNTRY', countryId: country.id, isActive: true });
  org = await db.Organization.create({ code, type: 'MASTER', legalName: code, countryId: country.id, status: 'active' });
  definition = await db.ServiceDefinition.create({ code, name: 'Course administrative', executionProfile: 'agent', legacyServiceType: 'errand' });
  offering = await db.ServiceAvailability.create({ serviceDefinitionId: definition.id, territoryId: territory.id, organizationId: org.id, currency: 'GHS', slaMinutes: 30,
    providerRules: { serviceOutcome: 'Documents remis avec un compte rendu vérifiable', coordination: { enabled: true, stageMinutes: 30 } } });
  product = await db.Product.create({ name: 'Produit local', slug: code.toLowerCase(), price: 15, currency: 'GHS', stock: 2, countryId: country.id });
});
beforeEach(async () => {
  if (!ready) return;
  if (orderIds.length) {
    await db.Transaction.destroy({ where: { orderId: orderIds } }); await db.Evidence.destroy({ where: { orderId: orderIds } }); await db.OrderItem.destroy({ where: { orderId: orderIds } });
    await db.WorkCoordination.destroy({ where: { entityType: 'order', entityId: orderIds } }); await db.Order.destroy({ where: { id: orderIds.splice(0) } });
  }
  if (projectIds.length) {
    await db.ProjectPhase.destroy({ where: { projectId: projectIds } }); await db.ProjectDocument.destroy({ where: { projectId: projectIds } });
    await db.WorkCoordination.destroy({ where: { entityType: 'project', entityId: projectIds } }); await db.Project.destroy({ where: { id: projectIds.splice(0) } });
  }
  if (serviceIds.length) {
    await db.MissionStatusHistory.destroy({ where: { serviceId: serviceIds } }); await db.Evidence.destroy({ where: { serviceId: serviceIds } });
    await db.Service.destroy({ where: { id: serviceIds.splice(0) } });
  }
  await db.AgentCapacity.upsert({ userId: agent.id, available: false, maxConcurrent: 1 });
  await product.update({ stock: 2 });
});
afterAll(async () => {
  if (ready) {
    if (receiptIds.length) await db.CreationRequest.destroy({ where: { id: receiptIds } });
    if (serviceIds.length) { await db.MissionStatusHistory.destroy({ where: { serviceId: serviceIds } }); await db.Evidence.destroy({ where: { serviceId: serviceIds } }); await db.Service.destroy({ where: { id: serviceIds } }); }
    if (orderIds.length) { await db.Transaction.destroy({ where: { orderId: orderIds } }); await db.Evidence.destroy({ where: { orderId: orderIds } }); await db.OrderItem.destroy({ where: { orderId: orderIds } }); await db.WorkCoordination.destroy({ where: { entityType: 'order', entityId: orderIds } }); await db.Order.destroy({ where: { id: orderIds } }); }
    if (projectIds.length) { await db.ProjectPhase.destroy({ where: { projectId: projectIds } }); await db.ProjectDocument.destroy({ where: { projectId: projectIds } }); await db.WorkCoordination.destroy({ where: { entityType: 'project', entityId: projectIds } }); await db.Project.destroy({ where: { id: projectIds } }); }
    await db.Notification.destroy({ where: { countryId: country.id } }); await db.Activity.destroy({ where: { countryId: country.id } });
    await product.destroy(); await offering.destroy(); await definition.destroy(); await org.destroy(); await territory.destroy();
    for (const Model of [db.RefreshToken, db.RecoveryCode, db.PasswordResetToken, db.AgentCapacity]) await Model.destroy({ where: { userId: users } });
    await db.User.destroy({ where: { id: users } }); await country.destroy(); await foreign.destroy();
  }
  await db.sequelize.close();
});

test('automatic agent assignment requires opt-in, respects concurrent capacity and releases it on completion', async () => {
  if (!ready) return;
  const first = await service();
  let operation = await coordinateMission(first.id);
  expect(operation.state).toBe('waiting'); expect((await first.reload()).agentId).toBeNull();
  expect((await request(app).patch('/api/v1/operations/agent/capacity').set(auth(agent)).send({ available: true, maxConcurrent: 1 })).status).toBe(200);
  const second = await service();
  const now = new Date(Date.now() + 61000);
  await Promise.all([coordinateMission(first.id, { now }), coordinateMission(second.id, { now })]);
  await first.reload(); await second.reload();
  expect([first.agentId, second.agentId].filter(Boolean)).toHaveLength(1);
  const assigned = first.agentId ? first : second;
  const waiting = first.agentId ? second : first;
  expect((await request(app).post(`/api/v1/services/agent/services/${assigned.id}/start`).set(auth(agent))).status).toBe(200);
  expect((await request(app).post(`/api/v1/services/agent/services/${assigned.id}/complete`).set(auth(agent))).status).toBe(400);
  await db.MissionCoordination.update({ completionReport: { reporterId: agent.id, summary: 'Les documents sont remis au client.', evidenceIds: [], submittedAt: new Date().toISOString() } }, { where: { serviceId: assigned.id } });
  expect((await request(app).post(`/api/v1/services/agent/services/${assigned.id}/complete`).set(auth(agent))).status).toBe(200);
  await coordinateMission(waiting.id, { now: new Date(now.getTime() + 61000) });
  expect((await waiting.reload()).agentId).toBe(agent.id);
  const detail = await request(app).get(`/api/v1/services/${assigned.id}`).set(auth(client));
  expect(detail.body.service.completion.report.summary).toContain('documents');
});

test('the operator can activate agent automation through the catalogue and the same coordination API', async () => {
  if (!ready) return;
  await offering.update({ providerRules: { serviceOutcome: 'Documents remis avec justificatif', coordination: { enabled: false } } });
  const s = await service(); expect((await coordinateMission(s.id)).mode).toBe('manual');
  const activate = await request(app).patch(`/api/v1/service-catalog/availabilities/${offering.id}`).set(auth(owner)).send({ providerRules: { serviceOutcome: 'Documents remis avec justificatif', coordination: { enabled: true } } });
  expect(activate.status).toBe(200);
  await db.AgentCapacity.update({ available: true }, { where: { userId: agent.id } });
  const configured = await request(app).patch(`/api/v1/operations/${s.id}`).set(auth(owner)).send({ mode: 'automatic' });
  expect(configured.status).toBe(200); expect((await s.reload()).agentId).toBe(agent.id);
  expect(configured.body.coordination.policy.completionReportRequired).toBe(true);
});

test('an agent restricted to a region is not automatically assigned to an unresolved region', async () => {
  if (!ready) return;
  const region = await db.Region.create({ name: 'Région de recette', code: `WR-${Date.now()}`, countryId: country.id, isActive: true });
  let local;
  try {
    await agent.update({ regionId: region.id });
    await db.AgentCapacity.update({ available: true }, { where: { userId: agent.id } });
    const unresolved = await service(); await coordinateMission(unresolved.id);
    expect((await unresolved.reload()).agentId).toBeNull();
    local = await service({ regionId: region.id }); await coordinateMission(local.id);
    expect((await local.reload()).agentId).toBe(agent.id);
  } finally {
    await agent.update({ regionId: null });
    if (local) await local.destroy();
    await db.Notification.destroy({ where: { regionId: region.id } }); await db.Activity.destroy({ where: { regionId: region.id } });
    await region.destroy();
  }
});

test('service, project and order assignments share the same agent capacity', async () => {
  if (!ready) return;
  await db.AgentCapacity.update({ available: true }, { where: { userId: agent.id } });
  const p = await project(); const o = await order(); const s = await service();
  await coordinateWork('project', p.id, { actor: owner, configure: { mode: 'automatic' } });
  expect((await p.reload()).agentId).toBe(agent.id);
  const operation = await coordinateWork('order', o.id, { actor: owner, configure: { mode: 'automatic' } });
  expect(operation.executorUserId).toBeNull();
  expect((await coordinateMission(s.id)).state).toBe('waiting');
  await p.update({ status: 'validated' }); await coordinateWork('project', p.id);
  await coordinateWork('order', o.id, { now: new Date(Date.now() + 61000) });
  expect((await operation.reload()).executorUserId).toBe(agent.id);
  const mine = await request(app).get('/api/v1/operations/agent/assignments').set(auth(agent));
  expect(mine.status).toBe(200); expect(mine.body.items.map((item) => item.entityType)).toEqual(['order']);
});

test('project completion checks remaining phases, proof and client validation; deadlines escalate only once', async () => {
  if (!ready) return;
  const p = await project({ agentId: agent.id });
  const operation = await coordinateWork('project', p.id, { actor: owner, configure: { policy: { stageMinutes: 1 } } });
  const path = `/api/v1/operations/work/project/${p.id}/status`;
  expect((await request(app).post(path).set(auth(outsider)).send({ status: 'in_progress' })).status).toBe(403);
  expect((await request(app).post(path).set(auth(agent)).send({ status: 'in_progress' })).status).toBe(200);
  const phase = await db.ProjectPhase.create({ projectId: p.id, title: 'Contrôle', status: 'active' });
  expect((await request(app).post(path).set(auth(agent)).send({ status: 'completed', summary: 'Travaux réalisés et vérifiés sur place.' })).status).toBe(409);
  await phase.update({ status: 'completed' });
  await db.ProjectDocument.create({ projectId: p.id, uploaderId: agent.id, kind: 'report', filePath: '/uploads/fixture-report.pdf' });
  expect((await request(app).post(path).set(auth(agent)).send({ status: 'completed', summary: 'Travaux réalisés et vérifiés sur place.' })).status).toBe(200);
  expect((await request(app).post(path).set(auth(agent)).send({ status: 'validated' })).status).toBe(403);
  expect((await request(app).post(path).set(auth(client)).send({ status: 'validated' })).status).toBe(200);
  expect((await operation.reload()).state).toBe('closed');
  const o = await order(); const overdue = await coordinateWork('order', o.id, { actor: owner, configure: { policy: { stageMinutes: 1 } } });
  const now = new Date(Date.now() + 61000);
  await coordinateWork('order', o.id, { now }); expect((await overdue.reload()).reason).toBe('DELAI_ETAPE_DEPASSE');
  const count = await db.Notification.count({ where: { entityType: 'order', entityId: o.id } });
  await coordinateWork('order', o.id, { now }); expect(await db.Notification.count({ where: { entityType: 'order', entityId: o.id } })).toBe(count);
});

test('orders appear in the scoped queue and completion does not manufacture a payment', async () => {
  if (!ready) return;
  await db.AgentCapacity.update({ available: true }, { where: { userId: agent.id } });
  const o = await order(); await coordinateWork('order', o.id, { actor: owner, configure: { mode: 'automatic' } });
  const list = await request(app).get('/api/v1/operations').query({ entityType: 'order', countryId: country.id }).set(auth(owner));
  expect(list.status).toBe(200); expect(list.body.items.some((item) => item.id === o.id)).toBe(true);
  const path = `/api/v1/operations/work/order/${o.id}/status`;
  for (const status of ['processing', 'shipped']) expect((await request(app).post(path).set(auth(agent)).send({ status })).status).toBe(200);
  expect((await request(app).post(path).set(auth(agent)).send({ status: 'delivered', summary: 'Colis livré au destinataire désigné.' })).status).toBe(409);
  await db.Evidence.create({ orderId: o.id, uploaderId: agent.id, kind: 'photo', filePath: '/uploads/fixture-delivery.jpg' });
  expect((await request(app).post(path).set(auth(agent)).send({ status: 'delivered', summary: 'Colis livré au destinataire désigné.' })).status).toBe(200);
  expect((await o.reload()).paymentStatus).toBe('unpaid');
  expect(await db.Transaction.count({ where: { orderId: o.id } })).toBe(0);
  const confirmations = await Promise.all([1, 2].map(() => request(app).put(`/api/v1/orders/${o.id}`).set(auth(owner)).send({ paymentStatus: 'paid' })));
  expect(confirmations.map((result) => result.status)).toEqual([200, 200]);
  expect(await db.Transaction.count({ where: { orderId: o.id } })).toBe(1);
  expect((await o.reload()).status).toBe('delivered');
  await runWorkCoordination();
  expect((await db.OperationSchedulerState.findByPk('work_coordination')).lastError).toBeNull();
});

test.each(['service', 'project', 'order'])('%s intake replays a stable request key and rejects changed content', async (type) => {
  if (!ready) return;
  const body = type === 'order' ? { countryId: country.id, items: [] } : { countryId: country.id, title: 'Demande sans doublon', type: type === 'service' ? 'errand' : 'administratif' };
  const headers = receipt(type, client, `replay-${type}-${Date.now()}`);
  const first = await request(app).post(`/api/v1/${type}s`).set(headers).send(body);
  expect(first.status).toBe(201);
  const resource = first.body[type]; ({ service: serviceIds, project: projectIds, order: orderIds })[type].push(resource.id);
  const second = await request(app).post(`/api/v1/${type}s`).set(headers).send(body);
  expect(second.status).toBe(200); expect(second.body.replayed).toBe(true); expect(second.body[type].id).toBe(resource.id);
  const conflict = await request(app).post(`/api/v1/${type}s`).set(headers).send({ ...body, ...(type === 'order' ? { note: 'changed' } : { title: 'changed' }) });
  expect(conflict.status).toBe(409);
  if (type === 'order') expect(resource.currency).toBe('GHS');
});

test('concurrent duplicate orders reserve stock once and use the execution country currency and server price', async () => {
  if (!ready) return;
  const body = { countryId: country.id, items: [{ productId: product.id, quantity: 1, unitPrice: 1 }], status: 'paid', paymentStatus: 'paid' };
  const headers = receipt('order', client, `concurrent-order-${Date.now()}`);
  const results = await Promise.all([request(app).post('/api/v1/orders').set(headers).send(body), request(app).post('/api/v1/orders').set(headers).send(body)]);
  const created = results.find((result) => result.status === 201);
  expect(created).toBeDefined(); orderIds.push(created.body.order.id);
  expect(results.map((result) => result.status).sort()).toEqual(expect.arrayContaining([201]));
  expect(results.every((result) => [200, 201, 409].includes(result.status))).toBe(true);
  expect((await product.reload()).stock).toBe(1);
  expect(created.body.order).toMatchObject({ currency: 'GHS', status: 'created', paymentStatus: 'unpaid' });
  expect(Number(created.body.order.total)).toBe(15);
  const edited = await request(app).put(`/api/v1/orders/${created.body.order.id}`).set(auth(owner)).send({ note: 'Coordination confirmée' });
  expect(edited.status).toBe(200); expect(edited.body.order.currency).toBe('GHS'); expect(edited.body.order.status).toBe('created');
});

test('stock failure rolls the whole order back and a corrected retry remains possible', async () => {
  if (!ready) return;
  const headers = receipt('order', client, `stock-${Date.now()}`);
  const count = await db.Order.count({ where: { userId: client.id } });
  const bad = await request(app).post('/api/v1/orders').set(headers).send({ countryId: country.id, items: [{ productId: product.id, quantity: 3 }] });
  expect(bad.status).toBe(400); expect(await db.Order.count({ where: { userId: client.id } })).toBe(count); expect((await product.reload()).stock).toBe(2);
  const good = await request(app).post('/api/v1/orders').set(headers).send({ countryId: country.id, items: [{ productId: product.id, quantity: 1 }] });
  expect(good.status).toBe(201); orderIds.push(good.body.order.id);
});

test('operator and public intake use the selected execution country and never replay credentials', async () => {
  if (!ready) return;
  const phone = `+233${String(Date.now()).slice(-9)}`;
  await client.update({ phone });
  const body = { phone, countryId: country.id, requestKind: 'classic', serviceType: 'errand', title: 'Démarche dans le pays choisi' };
  const headers = receipt('phone-order', owner, `operator-${Date.now()}`);
  const first = await request(app).post('/api/v1/missions/phone-order').set(headers).send(body);
  expect(first.status).toBe(201); serviceIds.push(first.body.mission.id);
  expect(first.body.mission.countryId).toBe(country.id);
  const replay = await request(app).post('/api/v1/missions/phone-order').set(headers).send(body);
  expect(replay.status).toBe(200); expect(replay.body.mission.id).toBe(first.body.mission.id);
  expect(replay.body.generatedPin).toBeUndefined(); expect(replay.body.recoveryCodes).toBeUndefined();
  const key = `public-${Date.now()}`;
  receiptIds.push(crypto.createHmac('sha256', process.env.JWT_SECRET).update(`public-request:${phone}:${key}`).digest('hex'));
  const publicBody = { ...body, pin: 'Password123!' };
  const publicFirst = await request(app).post('/api/v1/mission-requests').set('Idempotency-Key', key).send(publicBody);
  expect(publicFirst.status).toBe(201); serviceIds.push(publicFirst.body.service.id);
  expect(publicFirst.body.service.countryId).toBe(country.id);
  const again = await request(app).post('/api/v1/mission-requests').set('Idempotency-Key', key).send(publicBody);
  expect(again.status).toBe(409); expect(again.body.code).toBe('REQUEST_ALREADY_CREATED');
  expect(again.body.token).toBeUndefined(); expect(again.body.user).toBeUndefined();
  const stored = await db.CreationRequest.findByPk(receiptIds.at(-1));
  expect(JSON.stringify(stored.toJSON())).not.toContain('Password123!');
  expect(JSON.stringify(stored.toJSON())).not.toContain(phone);
});

test('a pending reservation survives an ambiguous response and cannot create another service', async () => {
  if (!ready) return;
  const key = `pending-${Date.now()}`;
  const headers = receipt('service', client, key);
  const body = { title: 'Demande en vérification', type: 'errand', countryId: country.id };
  const { canonical } = require('../../src/middleware/creationRequest.middleware');
  await db.CreationRequest.create({ id: receiptIds.at(-1), payloadHash: crypto.createHmac('sha256', process.env.JWT_SECRET).update(JSON.stringify(canonical(body))).digest('hex') });
  const count = await db.Service.count({ where: { clientId: client.id } });
  const result = await request(app).post('/api/v1/services').set(headers).send(body);
  expect(result.status).toBe(409); expect(result.body.code).toBe('REQUEST_PENDING');
  expect(await db.Service.count({ where: { clientId: client.id } })).toBe(count);
});

test('a failure after durable creation is automatically recovered without a duplicate', async () => {
  if (!ready) return;
  const headers = receipt('service', client, `durable-${Date.now()}`);
  const body = { title: 'Reprise après création', type: 'errand', countryId: country.id };
  const hydrate = jest.spyOn(db.Service, 'findByPk').mockRejectedValueOnce(new Error('Response hydration interrupted'));
  try {
    const first = await request(app).post('/api/v1/services').set(headers).send(body);
    expect(first.status).toBe(500);
  } finally { hydrate.mockRestore(); }
  const stored = await db.CreationRequest.findByPk(receiptIds.at(-1));
  serviceIds.push(stored.resourceId); expect(stored.state).toBe('completed');
  const replay = await request(app).post('/api/v1/services').set(headers).send(body);
  expect(replay.status).toBe(200); expect(replay.body.service.id).toBe(stored.resourceId);
  expect(await db.Service.count({ where: { clientId: client.id, title: body.title } })).toBe(1);
});

test('a failure after starting an order transaction rolls back both the order and its receipt completion', async () => {
  if (!ready) return;
  const headers = receipt('order', client, `rollback-${Date.now()}`);
  const count = await db.Order.count({ where: { userId: client.id } });
  const body = { countryId: country.id, items: [{ name: 'Demande personnalisée', quantity: 1, price: -5 }] };
  expect((await request(app).post('/api/v1/orders').set(headers).send(body)).status).toBe(400);
  expect(await db.Order.count({ where: { userId: client.id } })).toBe(count);
  expect(await db.CreationRequest.findByPk(receiptIds.at(-1))).toBeNull();
  const corrected = await request(app).post('/api/v1/orders').set(headers).send({ ...body, items: [{ name: 'Demande personnalisée', quantity: 1, price: 5 }] });
  expect(corrected.status).toBe(201); orderIds.push(corrected.body.order.id);
});

test('a rejected public offering does not create a client account', async () => {
  if (!ready) return;
  const phone = `+233${String(Date.now()).slice(-9)}`;
  const result = await request(app).post('/api/v1/mission-requests').send({ phone, pin: 'Password123!', countryId: country.id, requestKind: 'classic', serviceType: 'administrative', title: 'Offre non ouverte sur ce territoire' });
  expect(result.status).toBe(409);
  expect(await db.User.count({ where: { phone } })).toBe(0);
});

test('switching the selected country filters users, providers and pricing without widening a local admin scope', async () => {
  if (!ready) return;
  const globalAdmin = await user('admin', null);
  const legacy = await user('client', null); await legacy.update({ country: country.isoCode });
  const homeProviderUser = await user('provider', country.id);
  const foreignProviderUser = await user('provider', foreign.id);
  const createdProviders = [], rules = [];
  try {
    const homeProvider = await db.Provider.create({ userId: homeProviderUser.id, type: 'independent', displayFirstName: 'Home executor', phoneNumber: '+233000000001', countryCode: country.isoCode, status: 'active' }); createdProviders.push(homeProvider.id);
    let response = await request(app).get('/api/v1/providers').query({ countryId: foreign.id }).set(auth(globalAdmin));
    expect(response.status).toBe(200); expect(response.body.providers).toEqual([]);
    const foreignProvider = await db.Provider.create({ userId: foreignProviderUser.id, type: 'independent', displayFirstName: 'Foreign executor', phoneNumber: '+233000000002', countryCode: foreign.isoCode, status: 'active' }); createdProviders.push(foreignProvider.id);
    response = await request(app).get('/api/v1/providers').query({ countryId: foreign.id }).set(auth(globalAdmin));
    expect(response.status).toBe(200); expect(response.body.providers.map((row) => row.id)).toEqual([foreignProvider.id]);
    response = await request(app).get('/api/v1/providers').query({ countryId: foreign.id }).set(auth(owner));
    expect(response.status).toBe(200); expect(response.body.providers).toEqual([]);

    response = await request(app).get('/api/v1/users').query({ role: 'client', countryId: country.id }).set(auth(globalAdmin));
    expect(response.status).toBe(200); expect(response.body.users.map((row) => row.id)).toContain(legacy.id);
    response = await request(app).get('/api/v1/users').query({ role: 'client', countryId: foreign.id }).set(auth(globalAdmin));
    expect(response.status).toBe(200); expect(response.body.users.map((row) => row.id)).not.toContain(legacy.id);
    response = await request(app).get('/api/v1/users').query({ role: 'client', countryId: foreign.id }).set(auth(owner));
    expect(response.status).toBe(200); expect(response.body.users).toEqual([]);

    for (const countryId of [country.id, foreign.id]) rules.push(await db.MissionPricingRule.create({ countryId, serviceType: 'errand', pricingMode: 'fixed_estimate', basePrice: 1000, estimatedDelayMinutes: 60 }));
    response = await request(app).get('/api/v1/mission-pricing-rules').query({ countryId: foreign.id }).set(auth(globalAdmin));
    expect(response.status).toBe(200); expect(response.body.pricingRules.map((row) => row.id)).toEqual([rules[1].id]);
    response = await request(app).get('/api/v1/mission-pricing-rules').query({ countryId: foreign.id }).set(auth(owner));
    expect(response.status).toBe(200); expect(response.body.pricingRules).toEqual([]);
    response = await request(app).get('/api/v1/property-listings/admin').query({ countryId: foreign.id }).set(auth(globalAdmin));
    expect(response.status).toBe(200); expect(response.body.listings).toEqual([]);
  } finally {
    if (rules.length) await db.MissionPricingRule.destroy({ where: { id: rules.map((row) => row.id) } });
    if (createdProviders.length) await db.Provider.destroy({ where: { id: createdProviders } });
  }
});

test('suspending an offering closes new requests only in its country and preserves existing work', async () => {
  if (!ready) return;
  const existingService = await service();
  const before = (await offering.reload()).toJSON();
  const args = { countryCode: country.isoCode, availabilityId: offering.id };
  try {
    await expect(suspendOffer(db, { ...args, countryCode: foreign.isoCode, apply: true })).rejects.toThrow('selected country');
    expect((await offering.reload()).isActive).toBe(before.isActive);
    expect((await suspendOffer(db, args)).applied).toBe(false);
    expect((await offering.reload()).toJSON()).toEqual(before);
    expect(await suspendOffer(db, { ...args, apply: true })).toMatchObject({ applied: true, changed: true, offering: { isActive: false } });
    expect((await suspendOffer(db, { ...args, apply: true })).changed).toBe(false);
    const after = (await offering.reload()).toJSON();
    expect(after.providerRules).toEqual(before.providerRules);
    expect(after.slaMinutes).toBe(before.slaMinutes);
    expect((await existingService.reload()).status).toBe('created');
    const catalog = await request(app).get('/api/v1/service-catalog').query({ countryId: country.id });
    expect(catalog.status).toBe(200);
    expect(catalog.body.catalog).toEqual([]);
    expect(catalog.body.configured).toBe(true);
  } finally { await offering.update({ isActive: before.isActive }); }
});
