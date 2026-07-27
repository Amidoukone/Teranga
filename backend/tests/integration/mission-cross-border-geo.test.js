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
    return true;
  } catch (_err) {
    return false;
  }
}

async function makeCountry({ withMaster = true, regionName } = {}) {
  let country = null;
  for (let i = 0; i < 30; i += 1) {
    const isoCode = `X${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
    try {
      country = await db.Country.create({
        name: `CrossBorder-${isoCode}-${Date.now()}-${i}`,
        isoCode,
        currency: 'XOF',
        isActive: true,
      });
      break;
    } catch (err) {
      if (err?.name !== 'SequelizeUniqueConstraintError') throw err;
    }
  }
  if (!country) throw new Error('Impossible de creer un pays de test unique');
  created.countryIds.push(country.id);

  let region = null;
  if (regionName) {
    region = await db.Region.create({
      name: regionName,
      code: `R-${country.isoCode}-${Date.now()}`,
      countryId: country.id,
      isActive: true,
    });
    created.regionIds.push(region.id);
  }

  if (withMaster) {
    const franchise = await db.Franchise.create({
      type: 'MASTER',
      status: 'active',
      legalName: `CrossBorder Master ${country.isoCode} ${Date.now()}`,
      countryId: country.id,
      regionId: null,
    });
    created.franchiseIds.push(franchise.id);
  }

  return { country, region };
}

async function makeTradeCategory() {
  const slug = `cross-border-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const tc = await db.TradeCategory.create({ name: `Filiere ${slug}`, slug, isActive: true });
  created.tradeCategoryIds.push(tc.id);
  return tc;
}

async function makeClient(countryId) {
  const password = 'Password123!';
  const email = `cross_border_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await db.User.create({
    email,
    passwordHash,
    firstName: 'CrossBorder',
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

function mockGeocodeResponse({ lat, lng, countryIso, countryName, adminAreaName }) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      status: 'OK',
      results: [
        {
          formatted_address: `${adminAreaName}, ${countryName}`,
          geometry: { location: { lat, lng } },
          address_components: [
            {
              long_name: adminAreaName,
              short_name: adminAreaName,
              types: ['administrative_area_level_1'],
            },
            { long_name: countryName, short_name: countryIso, types: ['country'] },
          ],
        },
      ],
    }),
  });
}

describe('Mission transfrontalière — routage/tarif selon la destination, pas le compte (docs section 3.5/4.1)', () => {
  let originCountry;
  let destinationCountry;
  let destinationRegion;
  let tradeCategory;

  const originalFetch = global.fetch;
  const originalKey = process.env.GOOGLE_MAPS_SERVER_KEY;

  beforeAll(async () => {
    dbReady = await checkDatabase();
    if (!dbReady) return;

    ({ country: originCountry } = await makeCountry({ withMaster: true }));
    ({ country: destinationCountry, region: destinationRegion } = await makeCountry({
      withMaster: true,
      regionName: `Lagunes-${Date.now()}`,
    }));
    tradeCategory = await makeTradeCategory();

    const rule = await db.MissionPricingRule.create({
      countryId: destinationCountry.id,
      tradeCategoryId: tradeCategory.id,
      pricingMode: 'fixed_estimate',
      basePrice: 9999,
      estimatedDelayMinutes: 45,
      isActive: true,
    });
    created.ruleIds.push(rule.id);
  });

  beforeEach(() => {
    process.env.GOOGLE_MAPS_SERVER_KEY = 'test-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  afterAll(async () => {
    process.env.GOOGLE_MAPS_SERVER_KEY = originalKey;
    if (!dbReady) return;
    if (created.serviceIds.length) {
      await db.Service.destroy({ where: { id: created.serviceIds } });
    }
    if (created.userIds.length) {
      await db.User.destroy({ where: { id: created.userIds } });
    }
    if (created.ruleIds.length) {
      await db.MissionPricingRule.destroy({ where: { id: created.ruleIds } });
    }
    if (created.tradeCategoryIds.length) {
      await db.TradeCategory.destroy({ where: { id: created.tradeCategoryIds } });
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
  });

  test('guest mission request (homepage): client scoped to origin country, address geocoded to destination — mission routed/priced there', async () => {
    if (!dbReady) return;

    mockGeocodeResponse({
      lat: 5.36,
      lng: -4.0083,
      countryIso: destinationCountry.isoCode,
      countryName: destinationCountry.name,
      adminAreaName: destinationRegion.name,
    });

    const phone = `+2237${Date.now().toString().slice(-8)}`;
    const res = await request(app).post('/api/v1/mission-requests').send({
      phone,
      pin: '1234',
      countryId: originCountry.id, // le visiteur se déclare "du" pays d'origine
      requestKind: 'trade_category',
      tradeCategoryId: tradeCategory.id,
      title: 'Mission a Abidjan demandee depuis Bamako',
      address: 'Rue du Plateau, Abidjan',
    });

    if (res.body?.user?.id) created.userIds.push(res.body.user.id);
    if (res.body?.service?.id) created.serviceIds.push(res.body.service.id);

    expect(res.status).toBe(201);
    expect(res.body.service.countryId).toBe(destinationCountry.id);
    expect(res.body.service.regionId).toBe(destinationRegion.id);
    expect(res.body.service.countryId).not.toBe(originCountry.id);
  });

  test('authenticated mission creation: client account scoped to origin, mission address in destination — countryId/regionId and price follow the destination', async () => {
    if (!dbReady) return;
    const { user, password } = await makeClient(originCountry.id);
    const token = await loginAndGetToken(user.email, password);

    mockGeocodeResponse({
      lat: 5.36,
      lng: -4.0083,
      countryIso: destinationCountry.isoCode,
      countryName: destinationCountry.name,
      adminAreaName: destinationRegion.name,
    });

    const estimateRes = await request(app)
      .post('/api/v1/missions/estimate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        executionType: 'provider',
        tradeCategoryId: tradeCategory.id,
        address: 'Rue du Plateau, Abidjan',
      });

    expect(estimateRes.status).toBe(200);
    expect(estimateRes.body.estimate.pricingMode).toBe('fixed_estimate');
    expect(Number(estimateRes.body.estimate.basePrice)).toBe(9999);

    mockGeocodeResponse({
      lat: 5.36,
      lng: -4.0083,
      countryIso: destinationCountry.isoCode,
      countryName: destinationCountry.name,
      adminAreaName: destinationRegion.name,
    });

    const createRes = await request(app)
      .post('/api/v1/missions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        executionType: 'provider',
        tradeCategoryId: tradeCategory.id,
        title: 'Mission a Abidjan demandee depuis Bamako (compte)',
        address: 'Rue du Plateau, Abidjan',
      });

    if (createRes.body?.mission?.id) created.serviceIds.push(createRes.body.mission.id);

    expect(createRes.status).toBe(201);
    expect(createRes.body.mission.countryId).toBe(destinationCountry.id);
    expect(createRes.body.mission.regionId).toBe(destinationRegion.id);
    expect(createRes.body.mission.countryId).not.toBe(originCountry.id);
  });

  test('mission creation is rejected when the geocoded destination country is not supported at all', async () => {
    if (!dbReady) return;
    const { user, password } = await makeClient(originCountry.id);
    const token = await loginAndGetToken(user.email, password);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'OK',
        results: [
          {
            formatted_address: 'Paris, France',
            geometry: { location: { lat: 48.8566, lng: 2.3522 } },
            address_components: [
              { long_name: 'Ile-de-France', short_name: 'Ile-de-France', types: ['administrative_area_level_1'] },
              { long_name: 'France', short_name: 'FR', types: ['country'] },
            ],
          },
        ],
      }),
    });

    const res = await request(app)
      .post('/api/v1/missions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        executionType: 'provider',
        tradeCategoryId: tradeCategory.id,
        title: 'Mission a Paris (non desservie)',
        address: 'Rue de Rivoli, Paris',
      });

    expect(res.status).toBe(400);
  });
});
