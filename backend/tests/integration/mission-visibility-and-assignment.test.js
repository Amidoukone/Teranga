'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'teranga_sprint2_test_secret';

const bcrypt = require('bcrypt');
const request = require('supertest');
const app = require('../../src/app');
const db = require('../../models');

// Régression pour trois bugs signalés en production sur les missions filière (Teranga Pro) :
// 1) une mission créée par un client n'apparaissait pas dans sa propre liste de services quand
//    la région géocodée de la mission différait de la région de son compte (service.controller.js
//    listClient appliquait un filtre géo redondant sur une liste déjà restreinte à clientId).
// 2) un master régional ne voyait pas la mission dans sa liste quand le géocodage n'a pas pu
//    résoudre la région exacte (regionId NULL) — seul l'admin global la voyait.
// 3) un admin pouvait assigner à une mission un prestataire dont le pays ne couvre pas la
//    destination réelle de la mission (findActiveProviderForTradeCategory ne vérifiait que le
//    statut/la filière, jamais la géographie).

let dbReady = false;
const created = {
  userIds: [],
  countryIds: [],
  regionIds: [],
  franchiseIds: [],
  tradeCategoryIds: [],
  serviceIds: [],
  providerIds: [],
};

const originalFetch = global.fetch;
const originalKey = process.env.GOOGLE_MAPS_SERVER_KEY;

async function checkDatabase() {
  try {
    await db.sequelize.authenticate();
    return true;
  } catch (_err) {
    return false;
  }
}

async function makeCountry({ withMaster = true } = {}) {
  let country = null;
  for (let i = 0; i < 30; i += 1) {
    const isoCode = `Z${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
    try {
      country = await db.Country.create({
        name: `MissionVis-${isoCode}-${Date.now()}-${i}`,
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

  if (withMaster) {
    const franchise = await db.Franchise.create({
      type: 'MASTER',
      status: 'active',
      legalName: `MissionVis Master ${country.isoCode} ${Date.now()}`,
      countryId: country.id,
      regionId: null,
    });
    created.franchiseIds.push(franchise.id);
  }

  return country;
}

async function makeRegion(countryId, name) {
  const region = await db.Region.create({
    name,
    code: `R-${countryId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    countryId,
    isActive: true,
  });
  created.regionIds.push(region.id);
  return region;
}

async function makeTradeCategory() {
  const slug = `mission-vis-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const tc = await db.TradeCategory.create({ name: `Filiere ${slug}`, slug, isActive: true });
  created.tradeCategoryIds.push(tc.id);
  return tc;
}

async function makeUser({ emailPrefix, role, countryId = null, regionId = null }) {
  const password = 'Password123!';
  const email = `${emailPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await db.User.create({
    email,
    passwordHash,
    firstName: 'MissionVis',
    lastName: 'Test',
    role,
    countryId,
    regionId,
  });
  created.userIds.push(user.id);
  return { user, password };
}

async function makeProvider({ countryCode, tradeCategoryId }) {
  const { user } = await makeUser({ emailPrefix: 'provider', role: 'provider' });
  const provider = await db.Provider.create({
    userId: user.id,
    type: 'individual',
    displayFirstName: 'Presta',
    phoneNumber: `+22370${Date.now().toString().slice(-7)}`,
    countryCode,
    status: 'active',
  });
  created.providerIds.push(provider.id);
  const tc = await db.TradeCategory.findByPk(tradeCategoryId);
  await provider.addTradeCategories([tc]);
  return provider;
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

describe('Visibilité et assignation des missions filière (scope géo)', () => {
  let country;
  let regionA;
  let regionB;
  let tradeCategory;

  beforeAll(async () => {
    dbReady = await checkDatabase();
    if (!dbReady) return;

    country = await makeCountry({ withMaster: true });
    regionA = await makeRegion(country.id, `RegionA-${Date.now()}`);
    regionB = await makeRegion(country.id, `RegionB-${Date.now()}`);
    tradeCategory = await makeTradeCategory();
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
    if (created.serviceIds.length) await db.Service.destroy({ where: { id: created.serviceIds } });
    if (created.providerIds.length) {
      await db.ProviderTradeCategory.destroy({ where: { providerId: created.providerIds } });
      await db.Provider.destroy({ where: { id: created.providerIds } });
    }
    if (created.userIds.length) await db.User.destroy({ where: { id: created.userIds } });
    if (created.tradeCategoryIds.length) await db.TradeCategory.destroy({ where: { id: created.tradeCategoryIds } });
    if (created.franchiseIds.length) await db.Franchise.destroy({ where: { id: created.franchiseIds } });
    if (created.regionIds.length) await db.Region.destroy({ where: { id: created.regionIds } });
    if (created.countryIds.length) await db.Country.destroy({ where: { id: created.countryIds } });
  });

  test("le client voit sa propre mission dans /services/me même si sa région de compte diffère de la région de la mission", async () => {
    if (!dbReady) return;

    // Le compte du client est scopé sur Region A, mais la mission a lieu en Region B.
    const { user, password } = await makeUser({
      emailPrefix: 'client_regionA',
      role: 'client',
      countryId: country.id,
      regionId: regionA.id,
    });
    const token = await loginAndGetToken(user.email, password);

    mockGeocodeResponse({
      lat: 5.1,
      lng: -4.2,
      countryIso: country.isoCode,
      countryName: country.name,
      adminAreaName: regionB.name,
    });

    const createRes = await request(app)
      .post('/api/v1/missions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        executionType: 'provider',
        tradeCategoryId: tradeCategory.id,
        title: 'Mission en Region B pour client de Region A',
        address: 'Adresse en Region B',
      });

    expect(createRes.status).toBe(201);
    const missionId = createRes.body.mission.id;
    created.serviceIds.push(missionId);
    expect(createRes.body.mission.regionId).toBe(regionB.id);

    const listRes = await request(app)
      .get('/api/v1/services/me')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    const ids = (listRes.body.services || []).map((s) => s.id);
    expect(ids).toContain(missionId);
  });

  test("le master de Region B voit la mission dans /services même si le géocodage n'a pas pu résoudre la région exacte (regionId NULL, countryId OK)", async () => {
    if (!dbReady) return;

    const { user: clientUser, password: clientPassword } = await makeUser({
      emailPrefix: 'client_unresolved_region',
      role: 'client',
      countryId: country.id,
    });
    const clientToken = await loginAndGetToken(clientUser.email, clientPassword);

    // Nom de région renvoyé par Google totalement inconnu de la base -> regionId ne se résout pas.
    mockGeocodeResponse({
      lat: 5.2,
      lng: -4.3,
      countryIso: country.isoCode,
      countryName: country.name,
      adminAreaName: `Zone-Inconnue-${Date.now()}`,
    });

    const createRes = await request(app)
      .post('/api/v1/missions')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        executionType: 'provider',
        tradeCategoryId: tradeCategory.id,
        title: 'Mission dont la region ne se resout pas',
        address: 'Adresse en zone non repertoriee',
      });

    expect(createRes.status).toBe(201);
    const missionId = createRes.body.mission.id;
    created.serviceIds.push(missionId);
    expect(createRes.body.mission.countryId).toBe(country.id);
    expect(createRes.body.mission.regionId).toBeNull();

    const { user: masterUser, password: masterPassword } = await makeUser({
      emailPrefix: 'master_regionB',
      role: 'admin',
      countryId: country.id,
      regionId: regionB.id,
    });
    const masterToken = await loginAndGetToken(masterUser.email, masterPassword);

    const listRes = await request(app)
      .get('/api/v1/services')
      .set('Authorization', `Bearer ${masterToken}`);

    expect(listRes.status).toBe(200);
    const ids = (listRes.body.services || []).map((s) => s.id);
    expect(ids).toContain(missionId);
  });

  test("l'assignation d'un prestataire dont le pays ne couvre pas la destination de la mission est refusée", async () => {
    if (!dbReady) return;

    const otherCountry = await makeCountry({ withMaster: true });

    const { user: clientUser, password: clientPassword } = await makeUser({
      emailPrefix: 'client_assign',
      role: 'client',
      countryId: country.id,
    });
    const clientToken = await loginAndGetToken(clientUser.email, clientPassword);

    mockGeocodeResponse({
      lat: 5.3,
      lng: -4.1,
      countryIso: country.isoCode,
      countryName: country.name,
      adminAreaName: regionA.name,
    });

    const createRes = await request(app)
      .post('/api/v1/missions')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        executionType: 'provider',
        tradeCategoryId: tradeCategory.id,
        title: 'Mission pour test assignation hors perimetre',
        address: 'Adresse en Region A',
      });

    expect(createRes.status).toBe(201);
    const missionId = createRes.body.mission.id;
    created.serviceIds.push(missionId);

    // Prestataire actif, bonne filière, mais basé dans un AUTRE pays que la mission.
    const foreignProvider = await makeProvider({
      countryCode: otherCountry.isoCode,
      tradeCategoryId: tradeCategory.id,
    });

    const { user: adminUser, password: adminPassword } = await makeUser({
      emailPrefix: 'global_admin_assign',
      role: 'admin',
    });
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);

    const assignRes = await request(app)
      .post(`/api/v1/missions/${missionId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ providerId: foreignProvider.id });

    expect(assignRes.status).toBe(400);

    // Un prestataire du bon pays, lui, doit être accepté.
    const localProvider = await makeProvider({
      countryCode: country.isoCode,
      tradeCategoryId: tradeCategory.id,
    });

    const okAssignRes = await request(app)
      .post(`/api/v1/missions/${missionId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ providerId: localProvider.id });

    expect(okAssignRes.status).toBe(200);
    expect(okAssignRes.body.mission.providerId).toBe(localProvider.id);
  });
});
