'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'teranga_currency_test_secret';

const bcrypt = require('bcrypt');
const request = require('supertest');
const app = require('../../src/app');
const db = require('../../models');

let country;
let client;
let admin;
let token;
let scopedToken;
let clientToken;
let foreignCountry;
let foreignTransaction;
let dbReady = false;
const userIds = [];

beforeAll(async () => {
  // Respecte la CI historique sans MySQL ; le mode strict exige la base
  // pour la recette de lancement d'un pays.
  try {
    await db.sequelize.authenticate();
    dbReady = true;
  } catch (error) {
    if (process.env.REQUIRE_INTEGRATION_DB === 'true') throw error;
    return;
  }
  for (let i = 0; i < 26; i += 1) {
    try {
      country = await db.Country.create({ name: `Currency-${Date.now()}`, isoCode: `Z${String.fromCharCode(65 + i)}`, currency: 'GHS', isActive: true });
      break;
    } catch (error) {
      if (error.name !== 'SequelizeUniqueConstraintError') throw error;
    }
  }
  if (!country) throw new Error('Aucun code pays de test disponible');
  const password = 'Password123!';
  const passwordHash = await bcrypt.hash(password, 10);
  for (const role of ['admin', 'client']) {
    const user = await db.User.create({ email: `currency_${role}_${Date.now()}@example.com`, passwordHash, role, countryId: role === 'client' ? country.id : null });
    userIds.push(user.id);
    if (role === 'admin') admin = user;
    else client = user;
  }
  const login = await request(app).post('/api/v1/auth/login').send({ email: admin.email, password });
  expect(login.status).toBe(200);
  token = login.body.token;
  const scoped = await db.User.create({ email: `currency_local_${Date.now()}@example.com`, passwordHash, role: 'admin', countryId: country.id });
  userIds.push(scoped.id);
  const scopedLogin = await request(app).post('/api/v1/auth/login').send({ email: scoped.email, password });
  expect(scopedLogin.status).toBe(200);
  scopedToken = scopedLogin.body.token;
  const clientLogin = await request(app).post('/api/v1/auth/login').send({ email: client.email, password });
  expect(clientLogin.status).toBe(200);
  clientToken = clientLogin.body.token;
});

afterAll(async () => {
  if (foreignTransaction) await foreignTransaction.destroy();
  if (userIds.length) await db.Transaction.destroy({ where: { userId: userIds } });
  if (country) {
    const countryIds = [country.id, foreignCountry?.id].filter(Boolean);
    await db.Territory.destroy({ where: { countryId: countryIds } });
    await db.Region.destroy({ where: { countryId: countryIds } });
    for (const model of [db.Transaction, db.Task, db.Service, db.Project, db.Notification, db.Activity]) {
      await model.destroy({ where: { countryId: countryIds } });
    }
  }
  if (userIds.length) {
    for (const model of [db.RefreshToken, db.RecoveryCode, db.PasswordResetToken]) {
      await model.destroy({ where: { userId: userIds } });
    }
    await db.User.destroy({ where: { id: userIds } });
  }
  if (country) await country.destroy();
  if (foreignCountry) await foreignCountry.destroy();
  await db.sequelize.close();
});

test('financial reports separate currencies and cannot replace a local administrator scope', async () => {
  if (!dbReady) return;
  const financeProject = await db.Project.create({ clientId: client.id, countryId: country.id, title: 'Rapport isolé', type: 'autre', currency: 'GHS', status: 'created' });
  await db.Transaction.bulkCreate(['GHS', 'GNF'].map((currency) => ({ userId: admin.id, projectId: financeProject.id, countryId: country.id, type: 'expense', amount: 50, currency, status: 'completed' })));
  const ownFilter = { countryId: country.id, projectId: financeProject.id };
  const summary = await request(app).get('/api/v1/transactions/summary').query(ownFilter).set('Authorization', `Bearer ${token}`);
  expect(summary.status).toBe(200);
  expect(summary.body).toEqual(expect.objectContaining({ multiCurrency: true, currency: null, expenses: null, balance: null }));
  expect(summary.body.byCurrency).toEqual(expect.arrayContaining([
    expect.objectContaining({ currency: 'GHS', expenses: 50, balance: -50 }),
    expect.objectContaining({ currency: 'GNF', expenses: 50, balance: -50 }),
  ]));
  const single = await request(app).get('/api/v1/transactions/summary').query({ ...ownFilter, currency: 'GHS' }).set('Authorization', `Bearer ${token}`);
  expect(single.status).toBe(200);
  expect(single.body).toEqual(expect.objectContaining({ currency: 'GHS', expenses: 50, balance: -50 }));

  for (let i = 0; i < 26; i += 1) {
    try {
      foreignCountry = await db.Country.create({ name: `Foreign-currency-${Date.now()}`, isoCode: `Y${String.fromCharCode(65 + i)}`, currency: 'USD', isActive: true });
      break;
    } catch (error) {
      if (error.name !== 'SequelizeUniqueConstraintError') throw error;
    }
  }
  if (!foreignCountry) throw new Error('Aucun code pays étranger de test disponible');
  foreignTransaction = await db.Transaction.create({ userId: admin.id, countryId: foreignCountry.id, type: 'revenue', amount: 987654, currency: 'USD', status: 'completed' });
  for (const endpoint of ['summary', 'report']) {
    const blocked = await request(app).get(`/api/v1/transactions/${endpoint}`).query({ countryId: foreignCountry.id }).set('Authorization', `Bearer ${scopedToken}`);
    expect(blocked.status).toBe(200);
    expect(blocked.body.byCurrency).toEqual([]);
    expect(blocked.body.count).toBe(0);
  }
  const report = await request(app).get('/api/v1/transactions/report').query(ownFilter).set('Authorization', `Bearer ${scopedToken}`);
  expect(report.status).toBe(200);
  expect(report.body.multiCurrency).toBe(true);
  expect(report.body.totals.expense).toBeNull();
  expect(report.body.byCurrency).toHaveLength(2);
  const invalid = await request(app).get('/api/v1/transactions/report').query({ startDate: 'invalid' }).set('Authorization', `Bearer ${token}`);
  expect(invalid.status).toBe(400);

  const forbiddenCreate = await request(app).post('/api/v1/transactions').set('Authorization', `Bearer ${scopedToken}`).send({ countryId: foreignCountry.id, type: 'revenue', amount: 10 });
  expect(forbiddenCreate.status).toBe(403);
  const ownTransaction = await db.Transaction.findOne({ where: { projectId: financeProject.id } });
  const forbiddenMove = await request(app).put(`/api/v1/transactions/${ownTransaction.id}`).set('Authorization', `Bearer ${scopedToken}`).send({ countryId: foreignCountry.id });
  expect(forbiddenMove.status).toBe(403);
  expect((await ownTransaction.reload()).countryId).toBe(country.id);

  const originRegion = await db.Region.create({ countryId: country.id, name: 'Région du compte', code: 'ORIGIN', isActive: true });
  await client.update({ regionId: originRegion.id });
  for (const [path, body] of [
    ['services', { type: 'errand', title: 'Service transfrontalier' }],
    ['projects', { type: 'autre', title: 'Projet transfrontalier' }],
  ]) {
    const invalidScope = await request(app).post(`/api/v1/${path}`).set('Authorization', `Bearer ${token}`).send({ ...body, clientId: client.id, countryId: foreignCountry.id, regionId: originRegion.id });
    expect(invalidScope.status).toBe(400);
    const destination = await request(app).post(`/api/v1/${path}`).set('Authorization', `Bearer ${token}`).send({ ...body, clientId: client.id, countryId: foreignCountry.id });
    expect(destination.status).toBe(201);
    const operation = destination.body.service || destination.body.project;
    expect(operation.currency).toBe('USD');
    expect(operation.countryId).toBe(foreignCountry.id);
    expect(operation.regionId).toBeNull();
    const detail = await request(app).get(`/api/v1/${path}/${operation.id}`).set('Authorization', `Bearer ${clientToken}`);
    expect(detail.status).toBe(200);
    const ownList = await request(app).get(`/api/v1/${path === 'services' ? 'services/me' : 'projects'}`).set('Authorization', `Bearer ${clientToken}`);
    expect(ownList.status).toBe(200);
    expect(ownList.body[path].map((item) => item.id)).toContain(operation.id);
    const edit = await request(app).put(`/api/v1/${path}/${operation.id}`).set('Authorization', `Bearer ${clientToken}`).send({ description: 'Précision du client depuis son pays de résidence' });
    expect(edit.status).toBe(200);
    const localDenied = await request(app).get(`/api/v1/${path}/${operation.id}`).set('Authorization', `Bearer ${scopedToken}`);
    expect(localDenied.status).toBe(403);
    if (path === 'projects') {
      for (const resource of ['project-documents', 'project-phases']) {
        const contents = await request(app).get(`/api/v1/${resource}`).query({ projectId: operation.id }).set('Authorization', `Bearer ${clientToken}`);
        expect(contents.status).toBe(200);
        const denied = await request(app).get(`/api/v1/${resource}`).query({ projectId: operation.id }).set('Authorization', `Bearer ${scopedToken}`);
        expect(denied.status).toBe(403);
      }
    }
    if (path === 'services') {
      const receipt = await request(app).post('/api/v1/transactions').set('Authorization', `Bearer ${token}`).send({ serviceId: operation.id, type: 'expense', amount: 20 });
      expect(receipt.status).toBe(201);
      const ownReceipts = await request(app).get('/api/v1/transactions').query({ serviceId: operation.id }).set('Authorization', `Bearer ${clientToken}`);
      expect(ownReceipts.status).toBe(200);
      expect(ownReceipts.body.transactions.map((item) => item.id)).toContain(receipt.body.transaction.id);
      const ownReceipt = await request(app).get(`/api/v1/transactions/${receipt.body.transaction.id}`).set('Authorization', `Bearer ${clientToken}`);
      expect(ownReceipt.status).toBe(200);
      const task = await request(app).post('/api/v1/tasks').set('Authorization', `Bearer ${token}`).send({ serviceId: operation.id, title: 'Exécution à destination', type: 'other' });
      expect(task.status).toBe(201);
      const ownTasks = await request(app).get(`/api/v1/tasks/service/${operation.id}`).set('Authorization', `Bearer ${clientToken}`);
      expect(ownTasks.status).toBe(200);
      expect(ownTasks.body.tasks.map((item) => item.id)).toContain(task.body.task.id);
    }
  }
});

test('the execution currency traverses service, task, project and transaction APIs', async () => {
  if (!dbReady) return;
  const post = (path, body) => request(app).post(`/api/v1/${path}`).set('Authorization', `Bearer ${token}`).send(body);
  const service = await post('services', { clientId: client.id, countryId: country.id, type: 'errand', title: 'Service en GHS' });
  expect(service.status).toBe(201);
  expect(service.body.service.currency).toBe('GHS');
  const serviceId = service.body.service.id;

  const task = await post('tasks', { serviceId, title: 'Tâche en GHS', type: 'other' });
  expect(task.status).toBe(201);
  expect(task.body.task.currency).toBe('GHS');

  const project = await post('projects', { clientId: client.id, countryId: country.id, title: 'Projet en GHS', type: 'autre' });
  expect(project.status).toBe(201);
  expect(project.body.project.currency).toBe('GHS');

  const inherited = await post('transactions', { serviceId, type: 'expense', amount: 50 });
  expect(inherited.status).toBe(201);
  expect(inherited.body.transaction.currency).toBe('GHS');

  const explicit = await post('transactions', { serviceId, type: 'expense', amount: 50, currency: ' gnf ' });
  expect(explicit.status).toBe(201);
  expect(explicit.body.transaction.currency).toBe('GNF');

  // Une nouvelle configuration pays ne réécrit pas la monnaie des opérations existantes.
  await country.update({ currency: 'GNF' });
  const followup = await post('tasks', { serviceId, title: 'Suivi du service historique', type: 'other' });
  expect(followup.status).toBe(201);
  expect(followup.body.task.currency).toBe('GHS');
});

test('project mutations validate territory, assignments and preserve financial history', async () => {
  if (!dbReady) return;
  const region = await db.Region.create({ countryId: country.id, name: 'Région de mutation', code: 'MUTATE', isActive: true });
  const agent = await db.User.create({ email: `currency_agent_${Date.now()}@example.com`, passwordHash: admin.passwordHash, role: 'agent', countryId: country.id, regionId: region.id });
  userIds.push(agent.id);
  const post = (body) => request(app).post('/api/v1/projects').set('Authorization', `Bearer ${token}`).send({ clientId: client.id, type: 'autre', title: 'Projet à corriger', ...body });
  expect((await post({ countryId: foreignCountry.id, agentId: agent.id })).status).toBe(403);
  const created = await post({ countryId: country.id, regionId: region.id, agentId: agent.id });
  expect(created.status).toBe(201);
  const projectId = created.body.project.id;
  const put = (body) => request(app).put(`/api/v1/projects/${projectId}`).set('Authorization', `Bearer ${token}`).send(body);
  expect((await put({ countryId: foreignCountry.id, regionId: region.id })).status).toBe(400);
  expect((await put({ countryId: foreignCountry.id })).status).toBe(403);
  expect((await put({ agentId: null })).status).toBe(200);
  const moved = await put({ countryId: foreignCountry.id });
  expect(moved.status).toBe(200);
  expect(moved.body.project).toMatchObject({ countryId: foreignCountry.id, regionId: null, agentId: null, currency: 'GNF' });
  const receipt = await request(app).post('/api/v1/transactions').set('Authorization', `Bearer ${token}`).send({ projectId, type: 'expense', amount: 10 });
  expect(receipt.status).toBe(201);
  expect((await put({ countryId: country.id })).status).toBe(409);
  expect((await db.Project.findByPk(projectId)).countryId).toBe(foreignCountry.id);
});

test('transaction relinking validates all targets and preserves the recorded currency', async () => {
  if (!dbReady) return;
  const origin = await db.Service.create({ clientId: client.id, countryId: country.id, type: 'errand', title: 'Origine paiement', currency: 'GHS' });
  const target = await db.Service.create({ clientId: client.id, countryId: foreignCountry.id, type: 'errand', title: 'Destination paiement', currency: 'USD' });
  const project = await db.Project.create({ clientId: client.id, countryId: country.id, type: 'autre', title: 'Projet origine paiement', currency: 'GHS' });
  const trx = await db.Transaction.create({ userId: admin.id, serviceId: origin.id, countryId: country.id, type: 'expense', amount: 50, currency: 'GHS', status: 'pending' });
  const put = (body) => request(app).put(`/api/v1/transactions/${trx.id}`).set('Authorization', `Bearer ${token}`).send(body);
  expect((await put({ serviceId: 2147483647 })).status).toBe(400);
  expect((await trx.reload()).serviceId).toBe(origin.id);
  expect((await put({ serviceId: target.id, projectId: project.id })).status).toBe(400);
  expect((await trx.reload()).countryId).toBe(country.id);
  const moved = await put({ serviceId: target.id });
  expect(moved.status).toBe(200);
  expect(moved.body.transaction).toMatchObject({ serviceId: target.id, countryId: foreignCountry.id, currency: 'GHS', amount: '50.00' });
  const localDenied = await request(app).put(`/api/v1/transactions/${trx.id}`).set('Authorization', `Bearer ${scopedToken}`).send({ description: 'Interdit' });
  expect(localDenied.status).toBe(403);
});

test('legacy service APIs respect the active local catalog while historical edits remain available', async () => {
  if (!dbReady) return;
  const stamp = `CURRENCY-${Date.now()}`;
  const territory = await db.Territory.create({ countryId: foreignCountry.id, code: `${stamp}:COUNTRY`, type: 'COUNTRY', name: 'Catalogue test', isActive: true });
  const organization = await db.Organization.create({ countryId: foreignCountry.id, code: stamp, type: 'MASTER', legalName: 'Opérateur de recette', status: 'active' });
  let definition;
  let availability;
  try {
    definition = await db.ServiceDefinition.create({ code: stamp, name: 'Course', family: 'core', executionProfile: 'agent', legacyServiceType: 'errand', isActive: true });
    availability = await db.ServiceAvailability.create({ serviceDefinitionId: definition.id, territoryId: territory.id, organizationId: organization.id, currency: 'USD', isActive: false });
    const post = () => request(app).post('/api/v1/services').set('Authorization', `Bearer ${token}`).send({ clientId: client.id, countryId: foreignCountry.id, type: 'errand', title: 'Catalogue local' });
    expect((await post()).status).toBe(409);
    await availability.update({ isActive: true });
    const service = await post();
    expect(service.status).toBe(201);
    const put = (body) => request(app).put(`/api/v1/services/${service.body.service.id}`).set('Authorization', `Bearer ${token}`).send(body);
    expect((await put({ type: 'payment' })).status).toBe(409);
    await availability.update({ isActive: false });
    expect((await put({ type: 'errand', title: 'Précision historique' })).status).toBe(200);
  } finally {
    if (availability) await availability.destroy();
    if (definition) await definition.destroy();
    await organization.destroy();
    await territory.destroy();
  }
});

test('pricing configuration validates local scope and prevents implicit currency relabeling', async () => {
  if (!dbReady) return;
  const region = await db.Region.create({ countryId: foreignCountry.id, name: 'Région tarifaire', code: 'PRICING', isActive: false });
  const ruleIds = [];
  try {
    const post = (body) => request(app).post('/api/v1/mission-pricing-rules').set('Authorization', `Bearer ${token}`).send({ countryId: country.id, serviceType: 'errand', pricingMode: 'fixed_estimate', estimatedDelayMinutes: 30, ...body });
    expect((await post({ basePrice: 10, regionId: region.id })).status).toBe(400);
    expect((await post({})).status).toBe(400);
    const quote = await post({ pricingMode: 'quote_only' });
    expect(quote.status).toBe(201);
    ruleIds.push(quote.body.pricingRule.id);
    const missingPrice = await request(app).patch(`/api/v1/mission-pricing-rules/${quote.body.pricingRule.id}`).set('Authorization', `Bearer ${token}`).send({ pricingMode: 'fixed_estimate' });
    expect(missingPrice.status).toBe(400);
    await foreignCountry.update({ isActive: false });
    const fixed = await post({ countryId: foreignCountry.id, regionId: region.id, basePrice: 10 });
    expect(fixed.status).toBe(201);
    ruleIds.push(fixed.body.pricingRule.id);
    const changeCurrency = () => request(app).put(`/api/v1/countries/${foreignCountry.id}`).set('Authorization', `Bearer ${token}`).send({ currency: 'GHS' });
    expect((await changeCurrency()).status).toBe(409);
    expect((await foreignCountry.reload()).currency).toBe('USD');
    const disabled = await request(app).delete(`/api/v1/mission-pricing-rules/${fixed.body.pricingRule.id}`).set('Authorization', `Bearer ${token}`);
    expect(disabled.status).toBe(200);
    expect((await changeCurrency()).status).toBe(200);
  } finally {
    if (ruleIds.length) await db.MissionPricingRule.destroy({ where: { id: ruleIds } });
    await region.destroy();
    await foreignCountry.update({ isActive: true, currency: 'USD' });
  }
});

test('territorial state and inherited timezones follow reference updates atomically', async () => {
  if (!dbReady) return;
  const region = await db.Region.create({ countryId: country.id, name: 'Région pilote', code: 'PILOT', timezone: null, isActive: true });
  const projectedCountry = await db.Territory.create({ countryId: country.id, code: `CURRENCY:COUNTRY:${country.id}`, type: 'COUNTRY', name: country.name, isActive: true });
  const projectedRegion = await db.Territory.create({ countryId: country.id, regionId: region.id, code: `CURRENCY:REGION:${region.id}`, type: 'REGION', name: region.name, isActive: true });
  const put = (path, body) => request(app).put(`/api/v1/${path}`).set('Authorization', `Bearer ${token}`).send(body);
  const updateProjection = jest.spyOn(db.Territory, 'update').mockRejectedValueOnce(new Error('Projection temporarily unavailable'));
  try {
    const failed = await put(`countries/${country.id}`, { isActive: false });
    expect(failed.status).toBe(500);
    expect((await db.Country.findByPk(country.id)).isActive).toBe(true);
  } finally {
    updateProjection.mockRestore();
  }
  const disabled = await put(`countries/${country.id}`, { isActive: false });
  expect(disabled.status).toBe(200);
  expect((await projectedCountry.reload()).isActive).toBe(false);
  const timezone = await put(`countries/${country.id}`, { timezone: 'Africa/Accra' });
  expect(timezone.status).toBe(200);
  expect((await projectedCountry.reload()).timezone).toBe('Africa/Accra');
  expect((await projectedRegion.reload()).timezone).toBe('Africa/Accra');
  const disabledRegion = await put(`regions/${region.id}`, { isActive: false });
  expect(disabledRegion.status).toBe(200);
  expect((await projectedRegion.reload()).isActive).toBe(false);
});
