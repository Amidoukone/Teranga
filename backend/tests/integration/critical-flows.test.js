'use strict';

const request = require('supertest');
const app = require('../../src/app');
const db = require('../../models');

let dbReady = false;

async function checkDatabase() {
  try {
    await db.sequelize.authenticate();
    const tables = await db.sequelize.getQueryInterface().showAllTables();
    return Array.isArray(tables) && tables.length > 0;
  } catch (_err) {
    return false;
  }
}

describe('P2-T1 critical integration flows', () => {
  beforeAll(async () => {
    dbReady = await checkDatabase();
  });

  afterAll(async () => {
    if (dbReady) {
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

    const email = `test_${Date.now()}@teranga.local`;
    const password = 'Password123!';

    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email, password });

    expect([200, 201]).toContain(registerRes.status);

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
