'use strict';

const request = require('supertest');
const app = require('../../src/app');
const db = require('../../models');

let dbReady = false;
const created = {
  userIds: [],
  countryIds: [],
  regionIds: [],
  franchiseIds: [],
};

async function checkDatabase() {
  try {
    await db.sequelize.authenticate();
    const tables = await db.sequelize.getQueryInterface().showAllTables();
    return Array.isArray(tables) && tables.length > 0;
  } catch (_err) {
    return false;
  }
}

async function makeCountryWithMaster() {
  for (let i = 0; i < 30; i += 1) {
    const iso = `Y${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
    try {
      const country = await db.Country.create({
        name: `IT-${Date.now()}-${iso}-${i}`,
        isoCode: iso,
        isActive: true,
      });
      created.countryIds.push(country.id);

      const region = await db.Region.create({
        name: `IT-Region-${Date.now()}-${i}`,
        code: `ITR-${i}`,
        countryId: country.id,
        isActive: true,
      });
      created.regionIds.push(region.id);

      const franchise = await db.Franchise.create({
        type: 'MASTER',
        status: 'active',
        legalName: `IT Master ${Date.now()} ${i}`,
        countryId: country.id,
        regionId: null,
      });
      created.franchiseIds.push(franchise.id);

      return { country, region, franchise };
    } catch (err) {
      if (err?.name !== 'SequelizeUniqueConstraintError') throw err;
    }
  }
  throw new Error('Impossible de creer un pays de test unique');
}

describe('P2-T1 critical integration flows', () => {
  beforeAll(async () => {
    dbReady = await checkDatabase();
  });

  afterAll(async () => {
    if (dbReady) {
      if (created.userIds.length) {
        await db.RefreshToken.destroy({ where: { userId: created.userIds } });
        await db.RecoveryCode.destroy({ where: { userId: created.userIds } });
        await db.PasswordResetToken.destroy({ where: { userId: created.userIds } });
        await db.User.destroy({ where: { id: created.userIds } });
      }

      if (created.franchiseIds.length) {
        await db.Franchise.destroy({ where: { id: created.franchiseIds } });
      }
      if (created.regionIds.length) {
        await db.Region.destroy({ where: { id: created.regionIds } });
      }
      if (created.countryIds.length) {
        await db.Country.destroy({ where: { id: created.countryIds } });
      }

      await db.sequelize.close();
    }
  });

  test('auth/me requires authentication', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('projects list requires authentication', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(401);
  });

  test('orders list requires authentication', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
  });

  test('evidences list requires authentication', async () => {
    const res = await request(app).get('/api/evidences');
    expect(res.status).toBe(401);
  });

  test('metrics endpoint requires authentication', async () => {
    const res = await request(app).get('/api/metrics');
    expect(res.status).toBe(401);
  });

  test('recover-with-code validates required fields', async () => {
    const res = await request(app)
      .post('/api/auth/recover-with-code')
      .send({ email: 'test@example.com' });
    expect(res.status).toBe(400);
  });

  test('recovery-codes regenerate requires authentication', async () => {
    const res = await request(app)
      .post('/api/auth/recovery-codes/regenerate')
      .send({ currentPassword: 'password' });
    expect(res.status).toBe(401);
  });

  test('manual password reset requires authentication', async () => {
    const res = await request(app)
      .post('/api/users/1/manual-password-reset')
      .send({ newPassword: 'Password123!' });
    expect(res.status).toBe(401);
  });

  test('manual password reset audit requires authentication', async () => {
    const res = await request(app).get('/api/users/1/manual-password-reset/audit');
    expect(res.status).toBe(401);
  });

  test('auth register/login + project create when DB is available', async () => {
    if (!dbReady) {
      return;
    }

    const { country } = await makeCountryWithMaster();
    const email = `test_${Date.now()}@example.com`;
    const password = 'Password123!';

    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email, password, countryId: country.id });

    expect([200, 201]).toContain(registerRes.status);
    if (registerRes.body?.user?.id) {
      created.userIds.push(registerRes.body.user.id);
    }

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body?.token).toBeTruthy();

    const token = loginRes.body.token;

    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Projet test',
        type: 'autre',
        description: 'Test integration',
      });

    expect([200, 201]).toContain(projectRes.status);
  });
});
