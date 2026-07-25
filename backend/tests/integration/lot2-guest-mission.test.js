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
  tradeCategoryIds: [],
  serviceIds: [],
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

async function makeCountry({ withMaster = true } = {}) {
  for (let i = 0; i < 30; i += 1) {
    const iso = `W${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
    try {
      const country = await db.Country.create({
        name: `Lot2-${Date.now()}-${iso}-${i}`,
        isoCode: iso,
        isActive: true,
      });
      created.countryIds.push(country.id);

      if (withMaster) {
        const region = await db.Region.create({
          name: `Lot2-Region-${Date.now()}-${i}`,
          code: `R${i}`,
          countryId: country.id,
          isActive: true,
        });
        created.regionIds.push(region.id);

        const franchise = await db.Franchise.create({
          type: 'MASTER',
          status: 'active',
          legalName: `Lot2 Master ${Date.now()} ${i}`,
          countryId: country.id,
          regionId: null,
        });
        created.franchiseIds.push(franchise.id);
      }

      return country;
    } catch (err) {
      if (err?.name !== 'SequelizeUniqueConstraintError') throw err;
    }
  }
  throw new Error('Impossible de creer un pays de test unique');
}

async function makeTradeCategory() {
  const slug = `lot2-filiere-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const tc = await db.TradeCategory.create({ name: `Filiere ${slug}`, slug, isActive: true });
  created.tradeCategoryIds.push(tc.id);
  return tc;
}

function trackResponse(res) {
  if (res.body?.user?.id) created.userIds.push(res.body.user.id);
  if (res.body?.service?.id) created.serviceIds.push(res.body.service.id);
  return res;
}

describe('Lot 2 — demande de mission invitée (homepage, POST /api/v1/mission-requests)', () => {
  beforeAll(async () => {
    dbReady = await checkDatabase();
  });

  afterAll(async () => {
    if (!dbReady) return;

    if (created.serviceIds.length) {
      await db.Service.destroy({ where: { id: created.serviceIds } });
    }
    if (created.userIds.length) {
      await db.RecoveryCode.destroy({ where: { userId: created.userIds } });
      await db.RefreshToken.destroy({ where: { userId: created.userIds } });
      await db.User.destroy({ where: { id: created.userIds } });
    }
    if (created.franchiseIds.length) {
      await db.Franchise.destroy({ where: { id: created.franchiseIds } });
    }
    if (created.regionIds.length) {
      await db.Region.destroy({ where: { id: created.regionIds } });
    }
    if (created.tradeCategoryIds.length) {
      await db.TradeCategory.destroy({ where: { id: created.tradeCategoryIds } });
    }
    if (created.countryIds.length) {
      await db.Country.destroy({ where: { id: created.countryIds } });
    }

    await db.sequelize.close();
  });

  test('missing required fields are rejected by Joi validation (400)', async () => {
    if (!dbReady) return;
    const res = await request(app).post('/api/v1/mission-requests').send({
      phone: '+22370000000',
    });

    expect(res.status).toBe(400);
  });

  test('new phone + trade_category request creates account, session and a Pro mission', async () => {
    if (!dbReady) return;
    const country = await makeCountry();
    const tc = await makeTradeCategory();
    const phone = `+2237${Date.now().toString().slice(-8)}`;

    const res = await request(app).post('/api/v1/mission-requests').send({
      phone,
      pin: '1234',
      firstName: 'Awa',
      countryId: country.id,
      requestKind: 'trade_category',
      tradeCategoryId: tc.id,
      title: "J'ai besoin d'un plombier",
      description: 'Fuite dans la cuisine',
    });
    trackResponse(res);

    expect(res.status).toBe(201);
    expect(res.body.isNewAccount).toBe(true);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('client');
    expect(res.body.service.executionType).toBe('provider');
    expect(res.body.service.tradeCategoryId).toBe(tc.id);
    expect(res.body.service.missionStatus).toBe('CREATED');
    expect(res.body.recoveryCodes.length).toBeGreaterThan(0);

    // Session immédiate : le token émis fonctionne sur une route protégée.
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.id).toBe(res.body.user.id);
  });

  test('returning phone with the correct pin reuses the same account for a classic request', async () => {
    if (!dbReady) return;
    const country = await makeCountry();
    const phone = `+2237${Date.now().toString().slice(-8)}`;

    const first = await request(app).post('/api/v1/mission-requests').send({
      phone,
      pin: 'abcd',
      countryId: country.id,
      requestKind: 'classic',
      serviceType: 'errand',
      title: 'Course au marché',
    });
    trackResponse(first);
    expect(first.status).toBe(201);
    expect(first.body.isNewAccount).toBe(true);
    const userId = first.body.user.id;

    const second = await request(app).post('/api/v1/mission-requests').send({
      phone,
      pin: 'abcd',
      countryId: country.id,
      requestKind: 'classic',
      serviceType: 'payment',
      title: 'Payer une facture',
    });
    trackResponse(second);

    expect(second.status).toBe(201);
    expect(second.body.isNewAccount).toBe(false);
    expect(second.body.user.id).toBe(userId);
    expect(second.body.service.executionType).toBe('agent');
    expect(second.body.service.type).toBe('payment');
    expect(second.body.service.missionStatus).toBeNull();
  });

  test('returning phone with the wrong pin is rejected, never silently authenticated', async () => {
    if (!dbReady) return;
    const country = await makeCountry();
    const phone = `+2237${Date.now().toString().slice(-8)}`;

    const first = await request(app).post('/api/v1/mission-requests').send({
      phone,
      pin: 'correct-pin',
      countryId: country.id,
      requestKind: 'classic',
      serviceType: 'errand',
      title: 'Premiere demande',
    });
    trackResponse(first);
    expect(first.status).toBe(201);

    const wrongPin = await request(app).post('/api/v1/mission-requests').send({
      phone,
      pin: 'wrong-pin',
      countryId: country.id,
      requestKind: 'classic',
      serviceType: 'errand',
      title: 'Tentative usurpation',
    });

    expect(wrongPin.status).toBe(401);
  });

  test('a phone already tied to a non-client account is rejected (409)', async () => {
    if (!dbReady) return;
    const country = await makeCountry();
    const phone = `+2237${Date.now().toString().slice(-8)}`;
    const agent = await db.User.create({
      phone,
      passwordHash: await bcrypt.hash('whatever123', 10),
      role: 'agent',
      countryId: country.id,
    });
    created.userIds.push(agent.id);

    const res = await request(app).post('/api/v1/mission-requests').send({
      phone,
      pin: 'whatever123',
      countryId: country.id,
      requestKind: 'classic',
      serviceType: 'errand',
      title: 'Demande sur numero agent',
    });

    expect(res.status).toBe(409);
  });

  test('a country without an active master is rejected for a new account', async () => {
    if (!dbReady) return;
    const country = await makeCountry({ withMaster: false });
    const phone = `+2237${Date.now().toString().slice(-8)}`;

    const res = await request(app).post('/api/v1/mission-requests').send({
      phone,
      pin: '1234',
      countryId: country.id,
      requestKind: 'classic',
      serviceType: 'errand',
      title: 'Demande pays non couvert',
    });

    expect(res.status).toBe(400);
  });

  test('an invalid tradeCategoryId is rejected with 400', async () => {
    if (!dbReady) return;
    const country = await makeCountry();
    const phone = `+2237${Date.now().toString().slice(-8)}`;

    const res = await request(app).post('/api/v1/mission-requests').send({
      phone,
      pin: '1234',
      countryId: country.id,
      requestKind: 'trade_category',
      tradeCategoryId: 999999999,
      title: 'Filiere inexistante',
    });

    expect(res.status).toBe(400);
  });
});
