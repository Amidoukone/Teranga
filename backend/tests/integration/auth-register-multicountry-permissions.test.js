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

async function makeCountry({ withMaster = false } = {}) {
  for (let i = 0; i < 30; i += 1) {
    const iso = `X${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
    try {
      const country = await db.Country.create({
        name: `S2-${Date.now()}-${iso}-${i}`,
        isoCode: iso,
        isActive: true,
      });
      created.countryIds.push(country.id);

      const region = await db.Region.create({
        name: `S2-Region-${Date.now()}-${i}`,
        code: `R${i}`,
        countryId: country.id,
        isActive: true,
      });
      created.regionIds.push(region.id);

      if (withMaster) {
        const franchise = await db.Franchise.create({
          type: 'MASTER',
          status: 'active',
          legalName: `S2 Master ${Date.now()} ${i}`,
          countryId: country.id,
          regionId: null,
        });
        created.franchiseIds.push(franchise.id);
      }

      return { country, region };
    } catch (err) {
      if (err?.name !== 'SequelizeUniqueConstraintError') throw err;
    }
  }
  throw new Error('Impossible de creer un pays de test unique');
}

async function makeUser({
  emailPrefix,
  password = 'Password123!',
  role = 'client',
  countryId = null,
  regionId = null,
}) {
  const email = `${emailPrefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}@sprint2.local`;
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await db.User.create({
    email,
    passwordHash,
    firstName: 'S2',
    lastName: 'Test',
    role,
    countryId,
    regionId,
  });
  created.userIds.push(user.id);
  return { user, password };
}

async function loginAndGetToken(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return { res, token: res.body?.token };
}

describe('Sprint 2 - auth/register/multi-country/permissions', () => {
  beforeAll(async () => {
    dbReady = await checkDatabase();
  });

  afterAll(async () => {
    if (!dbReady) return;

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
  });

  test('register rejects an unsupported country', async () => {
    if (!dbReady) return;

    const res = await request(app).post('/api/auth/register').send({
      email: `no_country_${Date.now()}@sprint2.local`,
      password: 'Password123!',
      country: 'ZZ',
    });

    expect(res.status).toBe(400);
    expect(typeof res.body?.error).toBe('string');
  });

  test('register blocks country without active master', async () => {
    if (!dbReady) return;
    const { country } = await makeCountry({ withMaster: false });

    const res = await request(app).post('/api/auth/register').send({
      email: `blocked_${Date.now()}@sprint2.local`,
      password: 'Password123!',
      countryId: country.id,
    });

    expect(res.status).toBe(400);
    expect(String(res.body?.error || '').toLowerCase()).toContain('services');
  });

  test('register succeeds when country has active master', async () => {
    if (!dbReady) return;
    const { country } = await makeCountry({ withMaster: true });

    const res = await request(app).post('/api/auth/register').send({
      email: `ok_${Date.now()}@sprint2.local`,
      password: 'Password123!',
      countryId: country.id,
      language: 'fr',
    });

    expect(res.status).toBe(201);
    expect(res.body?.user?.role).toBe('client');
    expect(Number(res.body?.user?.countryId)).toBe(Number(country.id));
  });

  test('master admin cannot create another admin', async () => {
    if (!dbReady) return;
    const { country } = await makeCountry({ withMaster: true });
    const { user: master, password } = await makeUser({
      emailPrefix: 'master',
      password: 'Master123!',
      role: 'admin',
      countryId: country.id,
    });

    const login = await loginAndGetToken(master.email, password);
    expect(login.res.status).toBe(200);

    const createRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${login.token}`)
      .send({
        email: `new_admin_${Date.now()}@sprint2.local`,
        password: 'Admin123!',
        role: 'admin',
        firstName: 'New',
        lastName: 'Admin',
      });

    expect(createRes.status).toBe(403);
  });

  test('global admin can create a scoped admin', async () => {
    if (!dbReady) return;
    const { country, region } = await makeCountry({ withMaster: true });
    const { user: globalAdmin, password } = await makeUser({
      emailPrefix: 'global',
      password: 'Global123!',
      role: 'admin',
      countryId: null,
      regionId: null,
    });

    const login = await loginAndGetToken(globalAdmin.email, password);
    expect(login.res.status).toBe(200);

    const createRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${login.token}`)
      .send({
        email: `scoped_admin_${Date.now()}@sprint2.local`,
        password: 'Admin123!',
        role: 'admin',
        firstName: 'Scoped',
        lastName: 'Admin',
        countryId: country.id,
        regionId: region.id,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body?.user?.role).toBe('admin');
    expect(Number(createRes.body?.user?.countryId)).toBe(Number(country.id));
    expect(Number(createRes.body?.user?.regionId)).toBe(Number(region.id));
  });
});

