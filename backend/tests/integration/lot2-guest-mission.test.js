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
  ruleIds: [],
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

async function findOrCreatePickupCategory(slug) {
  const existing = await db.TradeCategory.findOne({ where: { slug } });
  if (existing) return existing;
  const category = await db.TradeCategory.create({
    name: slug === 'mobilite' ? 'Mobilité' : 'Livraison / Courses',
    slug,
    isActive: true,
  });
  created.tradeCategoryIds.push(category.id);
  return category;
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
    if (created.ruleIds.length) {
      await db.MissionPricingRule.destroy({ where: { id: created.ruleIds } });
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

  test('a first request can use the phone only and returns a generated Teranga code', async () => {
    if (!dbReady) return;
    const country = await makeCountry();
    const phone = `+2237${Date.now().toString().slice(-8)}`;

    const res = await request(app).post('/api/v1/mission-requests').send({
      phone,
      firstName: 'Awa',
      countryId: country.id,
      requestKind: 'classic',
      serviceType: 'errand',
      title: 'Première demande simplifiée',
    });
    trackResponse(res);

    expect(res.status).toBe(201);
    expect(res.body.isNewAccount).toBe(true);
    expect(res.body.generatedPin).toMatch(/^\d{6}$/);
    expect(res.body.generatedPin).toMatch(/^\d{6}$/);
    expect(res.body.token).toBeTruthy();
  });

  test.each([
    ['mobilite', 'Course Taxi publique'],
    ['livraison', 'Livraison publique'],
  ])(
    'guest can directly order %s with pickup, destination and a distance estimate',
    async (slug, title) => {
      if (!dbReady) return;
      const country = await makeCountry();
      const tradeCategory = await findOrCreatePickupCategory(slug);
      const rule = await db.MissionPricingRule.create({
        countryId: country.id,
        tradeCategoryId: tradeCategory.id,
        pricingMode: 'fixed_estimate',
        basePrice: 1000,
        pricePerKm: 100,
        estimatedDelayMinutes: 45,
        isActive: true,
      });
      created.ruleIds.push(rule.id);
      const phone = `+2237${Date.now().toString().slice(-7)}${slug === 'mobilite' ? '1' : '2'}`;

      const res = await request(app).post('/api/v1/mission-requests').send({
        phone,
        pin: '1234',
        firstName: 'Awa',
        countryId: country.id,
        requestKind: 'trade_category',
        tradeCategoryId: tradeCategory.id,
        title,
        pickupAddress: 'Point de départ, Bamako',
        pickupLatitude: 12.6392,
        pickupLongitude: -8.0029,
        address: 'Destination, Bamako',
        latitude: 12.6205,
        longitude: -7.9895,
        ...(slug === 'mobilite' ? { requestedVehicleType: 'car' } : {}),
        ...(slug === 'livraison' ? { packageType: 'standard' } : {}),
      });
      trackResponse(res);

      expect(res.status).toBe(201);
      expect(res.body.isNewAccount).toBe(true);
      expect(res.body.service.missionStatus).toBe('CREATED');
      expect(res.body.service.pickupAddress).toBe('Point de départ, Bamako');
      expect(Number(res.body.service.pickupLatitude)).toBeCloseTo(12.6392, 4);
      expect(Number(res.body.service.latitude)).toBeCloseTo(12.6205, 4);
      expect(Number(res.body.service.budget)).toBeGreaterThan(1000);
      expect(res.body.estimate.distanceKm).toBeGreaterThan(0);
      expect(res.body.service.requestedVehicleType).toBe(slug === 'mobilite' ? 'car' : null);
      expect(res.body.service.packageType).toBe(slug === 'livraison' ? 'standard' : null);
      if (slug === 'mobilite') {
        expect(res.body.startCode).toMatch(/^\d{4}$/);
        const tracking = await request(app)
          .get(`/api/v1/missions/${res.body.service.id}/track`)
          .set('Authorization', `Bearer ${res.body.token}`);
        expect(tracking.status).toBe(200);
        expect(tracking.body.missionStatus).toBe('CREATED');
        expect(tracking.body.startCode).toBe(res.body.startCode);
      } else {
        expect(res.body.startCode).toBeNull();
      }
    }
  );

  test('public Taxi estimate returns a vehicle-specific price without creating an account', async () => {
    if (!dbReady) return;
    const country = await makeCountry();
    const tradeCategory = await findOrCreatePickupCategory('mobilite');
    const rule = await db.MissionPricingRule.create({
      countryId: country.id,
      tradeCategoryId: tradeCategory.id,
      vehicleType: 'car',
      pricingMode: 'fixed_estimate',
      basePrice: 3000,
      pricePerKm: 100,
      estimatedDelayMinutes: 30,
      isActive: true,
    });
    created.ruleIds.push(rule.id);
    const usersBefore = await db.User.count();

    const res = await request(app).post('/api/v1/mission-requests/estimate').send({
      countryId: country.id,
      tradeCategoryId: tradeCategory.id,
      requestedVehicleType: 'car',
      pickupLatitude: 12.6392,
      pickupLongitude: -8.0029,
      latitude: 12.6205,
      longitude: -7.9895,
    });

    expect(res.status).toBe(200);
    expect(res.body.estimate.requestedVehicleType).toBe('car');
    expect(res.body.estimate.basePrice).toBeGreaterThan(3000);
    expect(await db.User.count()).toBe(usersBefore);
  });

  test('guest Taxi order without pickup and destination is rejected before account creation', async () => {
    if (!dbReady) return;
    const country = await makeCountry();
    const tradeCategory = await findOrCreatePickupCategory('mobilite');
    const phone = `+2237${Date.now().toString().slice(-8)}`;

    const res = await request(app).post('/api/v1/mission-requests').send({
      phone,
      pin: '1234',
      countryId: country.id,
      requestKind: 'trade_category',
      tradeCategoryId: tradeCategory.id,
      title: 'Course incomplète',
    });

    expect(res.status).toBe(400);
    expect(await db.User.count({ where: { phone } })).toBe(0);
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

  test('a known phone still requires its Teranga code', async () => {
    if (!dbReady) return;
    const country = await makeCountry();
    const phone = `+2237${Date.now().toString().slice(-8)}`;

    const first = await request(app).post('/api/v1/mission-requests').send({
      phone,
      pin: '2468',
      countryId: country.id,
      requestKind: 'classic',
      serviceType: 'errand',
      title: 'Première demande',
    });
    trackResponse(first);
    expect(first.status).toBe(201);

    const withoutPin = await request(app).post('/api/v1/mission-requests').send({
      phone,
      countryId: country.id,
      requestKind: 'classic',
      serviceType: 'errand',
      title: 'Nouvelle demande',
    });

    expect(withoutPin.status).toBe(401);
    expect(withoutPin.body.code).toBe('PIN_REQUIRED');
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

  test('client-supplied coordinates (Places Autocomplete) are stored as-is, no geocoding call', async () => {
    if (!dbReady) return;
    const country = await makeCountry();
    const phone = `+2237${Date.now().toString().slice(-8)}`;

    const res = await request(app).post('/api/v1/mission-requests').send({
      phone,
      pin: '1234',
      countryId: country.id,
      requestKind: 'classic',
      serviceType: 'errand',
      title: 'Course avec adresse geolocalisee',
      address: 'Marche de Medine, Bamako',
      latitude: 12.6392,
      longitude: -8.0029,
    });
    trackResponse(res);

    expect(res.status).toBe(201);
    expect(Number(res.body.service.latitude)).toBeCloseTo(12.6392, 4);
    expect(Number(res.body.service.longitude)).toBeCloseTo(-8.0029, 4);
  });

  test('an address without coordinates is rejected when server-side geocoding is unavailable', async () => {
    if (!dbReady) return;
    const country = await makeCountry();
    const phone = `+2237${Date.now().toString().slice(-8)}`;

    // GOOGLE_MAPS_SERVER_KEY absent en environnement de test : le géocodage
    // échoue systématiquement, ce qui exerce le chemin de rejet 400 (jamais
    // de mission avec une adresse saisie mais des coordonnées nulles).
    const previousServerKey = process.env.GOOGLE_MAPS_SERVER_KEY;
    delete process.env.GOOGLE_MAPS_SERVER_KEY;

    let res;
    try {
      res = await request(app).post('/api/v1/mission-requests').send({
        phone,
        pin: '1234',
        countryId: country.id,
        requestKind: 'classic',
        serviceType: 'errand',
        title: 'Course avec adresse texte libre',
        address: 'Quelque part a Bamako',
      });
    } finally {
      if (previousServerKey === undefined) delete process.env.GOOGLE_MAPS_SERVER_KEY;
      else process.env.GOOGLE_MAPS_SERVER_KEY = previousServerKey;
    }

    expect(res.status).toBe(400);
  });
});
