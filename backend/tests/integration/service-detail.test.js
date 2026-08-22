'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'teranga_sprint2_test_secret';

const bcrypt = require('bcrypt');
const request = require('supertest');
const app = require('../../src/app');
const db = require('../../models');

let dbReady = false;
const created = {
  userIds: [],
  countryIds: [],
  serviceIds: [],
};

async function checkDatabase() {
  try {
    await db.sequelize.authenticate();
    return true;
  } catch (_err) {
    return false;
  }
}

async function makeCountry() {
  // Deux lettres random (676 combinaisons) + retry sur collision : la suite complète fait
  // tourner plusieurs fichiers de test en parallèle sur la même base réelle, un préfixe fixe
  // à une seule lettre variable (26 combinaisons) collisionne trop souvent (même pattern que
  // lot3-providers.test.js).
  for (let i = 0; i < 30; i += 1) {
    const iso = `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(
      65 + Math.floor(Math.random() * 26)
    )}`;
    try {
      const country = await db.Country.create({
        name: `ServiceDetail-${Date.now()}-${iso}-${i}`,
        isoCode: iso,
        currency: 'XOF',
        isActive: true,
      });
      created.countryIds.push(country.id);
      return country;
    } catch (err) {
      if (err?.name !== 'SequelizeUniqueConstraintError') throw err;
    }
  }
  throw new Error('Impossible de créer un pays de test unique');
}

async function makeUser({ role, countryId = null }) {
  const password = 'Password123!';
  const email = `svcdetail_${role}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await db.User.create({
    email,
    passwordHash,
    firstName: 'Detail',
    lastName: role,
    role,
    countryId,
  });
  created.userIds.push(user.id);
  return { user, password };
}

async function loginAndGetToken(email, password) {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  return res.body?.token;
}

async function makeService({ clientId, agentId = null, countryId = null, status = 'created' }) {
  const service = await db.Service.create({
    clientId,
    agentId,
    type: 'errand',
    title: 'Course simple pour test detail',
    countryId,
    status,
  });
  created.serviceIds.push(service.id);
  return service;
}

describe('GET /api/services/:id — détail (client propriétaire, agent assigné, admin)', () => {
  let country;
  let otherCountry;

  beforeAll(async () => {
    dbReady = await checkDatabase();
    if (!dbReady) return;
    country = await makeCountry();
    otherCountry = await makeCountry();
  });

  afterAll(async () => {
    if (!dbReady) return;
    if (created.serviceIds.length) {
      await db.Service.destroy({ where: { id: created.serviceIds } });
    }
    if (created.userIds.length) {
      await db.RefreshToken.destroy({ where: { userId: created.userIds } });
      await db.RecoveryCode.destroy({ where: { userId: created.userIds } });
      await db.PasswordResetToken.destroy({ where: { userId: created.userIds } });
      await db.User.destroy({ where: { id: created.userIds } });
    }
    if (created.countryIds.length) {
      await db.Country.destroy({ where: { id: created.countryIds } });
    }
    await db.sequelize.close();
  });

  test('the owning client can fetch their service', async () => {
    if (!dbReady) return;
    const { user: client, password } = await makeUser({ role: 'client', countryId: country.id });
    const token = await loginAndGetToken(client.email, password);
    const service = await makeService({ clientId: client.id, countryId: country.id });

    const res = await request(app)
      .get(`/api/services/${service.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.service.id).toBe(service.id);
  });

  test('a different client cannot fetch someone else\'s service', async () => {
    if (!dbReady) return;
    const { user: owner } = await makeUser({ role: 'client', countryId: country.id });
    const { user: intruder, password: intruderPassword } = await makeUser({
      role: 'client',
      countryId: country.id,
    });
    const intruderToken = await loginAndGetToken(intruder.email, intruderPassword);
    const service = await makeService({ clientId: owner.id, countryId: country.id });

    const res = await request(app)
      .get(`/api/services/${service.id}`)
      .set('Authorization', `Bearer ${intruderToken}`);

    expect(res.status).toBe(403);
  });

  test('the assigned agent can fetch the service, an unassigned agent cannot', async () => {
    if (!dbReady) return;
    const { user: client } = await makeUser({ role: 'client', countryId: country.id });
    const { user: agent, password: agentPassword } = await makeUser({
      role: 'agent',
      countryId: country.id,
    });
    const { user: otherAgent, password: otherAgentPassword } = await makeUser({
      role: 'agent',
      countryId: country.id,
    });
    const agentToken = await loginAndGetToken(agent.email, agentPassword);
    const otherAgentToken = await loginAndGetToken(otherAgent.email, otherAgentPassword);
    const service = await makeService({ clientId: client.id, agentId: agent.id, countryId: country.id });

    const assignedRes = await request(app)
      .get(`/api/services/${service.id}`)
      .set('Authorization', `Bearer ${agentToken}`);
    expect(assignedRes.status).toBe(200);

    const unassignedRes = await request(app)
      .get(`/api/services/${service.id}`)
      .set('Authorization', `Bearer ${otherAgentToken}`);
    expect(unassignedRes.status).toBe(403);
  });

  test('a scoped admin can fetch a service in their own country, not in another country', async () => {
    if (!dbReady) return;
    const { user: client } = await makeUser({ role: 'client', countryId: country.id });
    const service = await makeService({ clientId: client.id, countryId: country.id });

    const { user: scopedAdmin, password: scopedAdminPassword } = await makeUser({
      role: 'admin',
      countryId: country.id,
    });
    const scopedAdminToken = await loginAndGetToken(scopedAdmin.email, scopedAdminPassword);

    const okRes = await request(app)
      .get(`/api/services/${service.id}`)
      .set('Authorization', `Bearer ${scopedAdminToken}`);
    expect(okRes.status).toBe(200);

    const { user: otherAdmin, password: otherAdminPassword } = await makeUser({
      role: 'admin',
      countryId: otherCountry.id,
    });
    const otherAdminToken = await loginAndGetToken(otherAdmin.email, otherAdminPassword);

    const forbiddenRes = await request(app)
      .get(`/api/services/${service.id}`)
      .set('Authorization', `Bearer ${otherAdminToken}`);
    expect(forbiddenRes.status).toBe(403);
  });

  test('returns 404 for a non-existent service', async () => {
    if (!dbReady) return;
    const { user: client, password } = await makeUser({ role: 'client', countryId: country.id });
    const token = await loginAndGetToken(client.email, password);

    const res = await request(app)
      .get('/api/services/999999999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  test('the owning client confirms a completed classic service', async () => {
    if (!dbReady) return;
    const { user: client, password } = await makeUser({ role: 'client', countryId: country.id });
    const token = await loginAndGetToken(client.email, password);
    const service = await makeService({
      clientId: client.id,
      countryId: country.id,
      status: 'completed',
    });

    const res = await request(app)
      .post(`/api/services/${service.id}/validate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.service.status).toBe('validated');
    await service.reload();
    expect(service.status).toBe('validated');
  });

  test('a client cannot confirm another client service', async () => {
    if (!dbReady) return;
    const { user: owner } = await makeUser({ role: 'client', countryId: country.id });
    const { user: intruder, password } = await makeUser({ role: 'client', countryId: country.id });
    const token = await loginAndGetToken(intruder.email, password);
    const service = await makeService({
      clientId: owner.id,
      countryId: country.id,
      status: 'completed',
    });

    const res = await request(app)
      .post(`/api/services/${service.id}/validate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});
