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
  tradeCategoryIds: [],
  serviceIds: [],
  savedLocationIds: [],
  ruleIds: [],
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
  const iso = `Q${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
  const country = await db.Country.create({
    name: `MissionCreate-${Date.now()}-${iso}`,
    isoCode: iso,
    currency: 'XOF',
    isActive: true,
  });
  created.countryIds.push(country.id);
  return country;
}

async function makeTradeCategory() {
  const slug = `mission-create-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const tc = await db.TradeCategory.create({ name: `Filiere ${slug}`, slug, isActive: true });
  created.tradeCategoryIds.push(tc.id);
  return tc;
}

async function makeClient(countryId) {
  const password = 'Password123!';
  const email = `mission_create_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await db.User.create({
    email,
    passwordHash,
    firstName: 'Mission',
    lastName: 'Client',
    role: 'client',
    countryId,
  });
  created.userIds.push(user.id);
  return { user, password };
}

async function loginAndGetToken(email, password) {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  return res.body?.token;
}

describe('Mission creation guidée (POST /api/v1/missions*, docs section 4.1)', () => {
  let country;
  let tradeCategory;
  let token;

  beforeAll(async () => {
    dbReady = await checkDatabase();
    if (!dbReady) return;

    country = await makeCountry();
    tradeCategory = await makeTradeCategory();

    const rule = await db.MissionPricingRule.create({
      countryId: country.id,
      tradeCategoryId: tradeCategory.id,
      pricingMode: 'fixed_estimate',
      basePrice: 7500,
      estimatedDelayMinutes: 90,
      isActive: true,
    });
    created.ruleIds.push(rule.id);

    const { user, password } = await makeClient(country.id);
    token = await loginAndGetToken(user.email, password);
  });

  afterAll(async () => {
    if (!dbReady) return;
    if (created.savedLocationIds.length) {
      await db.SavedLocation.destroy({ where: { id: created.savedLocationIds } });
    }
    if (created.serviceIds.length) {
      await db.Service.destroy({ where: { id: created.serviceIds } });
    }
    if (created.ruleIds.length) {
      await db.MissionPricingRule.destroy({ where: { id: created.ruleIds } });
    }
    if (created.userIds.length) {
      await db.RefreshToken.destroy({ where: { userId: created.userIds } });
      await db.RecoveryCode.destroy({ where: { userId: created.userIds } });
      await db.PasswordResetToken.destroy({ where: { userId: created.userIds } });
      await db.User.destroy({ where: { id: created.userIds } });
    }
    if (created.tradeCategoryIds.length) {
      await db.TradeCategory.destroy({ where: { id: created.tradeCategoryIds } });
    }
    if (created.countryIds.length) {
      await db.Country.destroy({ where: { id: created.countryIds } });
    }
    await db.sequelize.close();
  });

  test('POST /missions/estimate returns the fixed_estimate rule for the trade category', async () => {
    if (!dbReady) return;
    const res = await request(app)
      .post('/api/v1/missions/estimate')
      .set('Authorization', `Bearer ${token}`)
      .send({ executionType: 'provider', tradeCategoryId: tradeCategory.id });

    expect(res.status).toBe(200);
    expect(res.body.estimate.pricingMode).toBe('fixed_estimate');
    expect(res.body.estimate.basePrice).toBe(7500);
    expect(res.body.estimate.currency).toBe('XOF');
  });

  test('POST /missions/estimate rejects an inactive/invalid tradeCategoryId', async () => {
    if (!dbReady) return;
    const res = await request(app)
      .post('/api/v1/missions/estimate')
      .set('Authorization', `Bearer ${token}`)
      .send({ executionType: 'provider', tradeCategoryId: 999999999 });

    expect(res.status).toBe(400);
  });

  test('POST /missions creates a provider-track mission with client-supplied coordinates', async () => {
    if (!dbReady) return;
    const res = await request(app)
      .post('/api/v1/missions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        executionType: 'provider',
        tradeCategoryId: tradeCategory.id,
        title: 'Fuite d’eau dans la cuisine',
        address: 'Sebenicoro, Bamako',
        latitude: 12.65,
        longitude: -8.0,
      });

    expect(res.status).toBe(201);
    expect(res.body.mission.missionStatus).toBe('CREATED');
    expect(res.body.mission.latitude).not.toBeNull();
    expect(res.body.estimate.basePrice).toBe(7500);
    created.serviceIds.push(res.body.mission.id);
  });

  test('POST /missions accepts a classic service type with no address at all', async () => {
    if (!dbReady) return;
    const res = await request(app)
      .post('/api/v1/missions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        executionType: 'agent',
        serviceType: 'payment',
        title: 'Payer une facture ORANGE',
      });

    expect(res.status).toBe(201);
    expect(res.body.mission.latitude).toBeNull();
    expect(res.body.mission.missionStatus).toBeNull();
    created.serviceIds.push(res.body.mission.id);
  });

  test('POST /missions rejects an address that cannot be geocoded (no coordinates provided, no API key configured)', async () => {
    if (!dbReady) return;
    const res = await request(app)
      .post('/api/v1/missions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        executionType: 'agent',
        serviceType: 'errand',
        title: 'Course de test',
        address: 'Un lieu quelconque sans coordonnees',
      });

    expect(res.status).toBe(400);
  });

  test('POST /missions resolves address/coordinates from a saved location', async () => {
    if (!dbReady) return;
    const savedLocationRes = await request(app)
      .post('/api/v1/saved-locations')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Domicile', address: 'Sebenicoro, Bamako', latitude: 12.65, longitude: -8.0 });
    expect(savedLocationRes.status).toBe(201);
    const savedLocationId = savedLocationRes.body.savedLocation.id;
    created.savedLocationIds.push(savedLocationId);

    const res = await request(app)
      .post('/api/v1/missions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        executionType: 'agent',
        serviceType: 'errand',
        title: 'Course depuis un lieu enregistre',
        savedLocationId,
      });

    expect(res.status).toBe(201);
    expect(res.body.mission.address).toBe('Sebenicoro, Bamako');
    expect(Number(res.body.mission.latitude)).toBeCloseTo(12.65, 4);
    created.serviceIds.push(res.body.mission.id);
  });

  test('GET/POST/DELETE /saved-locations only ever exposes the caller’s own locations', async () => {
    if (!dbReady) return;
    const { user: otherUser, password: otherPassword } = await makeClient(country.id);
    const otherToken = await loginAndGetToken(otherUser.email, otherPassword);

    const createRes = await request(app)
      .post('/api/v1/saved-locations')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ address: 'Autre lieu', latitude: 12.6, longitude: -8.1 });
    expect(createRes.status).toBe(201);
    const otherLocationId = createRes.body.savedLocation.id;
    created.savedLocationIds.push(otherLocationId);

    const listRes = await request(app)
      .get('/api/v1/saved-locations')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.savedLocations.some((l) => l.id === otherLocationId)).toBe(false);

    const deleteRes = await request(app)
      .delete(`/api/v1/saved-locations/${otherLocationId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(403);
  });
});
