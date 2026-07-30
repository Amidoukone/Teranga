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
  tradeCategoryIds: [],
  providerIds: [],
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

async function makeCountry() {
  for (let i = 0; i < 30; i += 1) {
    const iso = `Y${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
    try {
      const country = await db.Country.create({
        name: `Lot3-${Date.now()}-${iso}-${i}`,
        isoCode: iso,
        isActive: true,
      });
      created.countryIds.push(country.id);
      return country;
    } catch (err) {
      if (err?.name !== 'SequelizeUniqueConstraintError') throw err;
    }
  }
  throw new Error('Impossible de creer un pays de test unique');
}

async function makeUser({ emailPrefix, role = 'client', countryId = null, regionId = null }) {
  const password = 'Password123!';
  const email = `${emailPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await db.User.create({
    email,
    passwordHash,
    firstName: 'Lot3',
    lastName: 'Test',
    role,
    countryId,
    regionId,
  });
  created.userIds.push(user.id);
  return { user, password };
}

async function loginAndGetToken(email, password) {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  return { res, token: res.body?.token };
}

async function makeTradeCategory({ requiresCompany = false } = {}) {
  const slug = `lot3-filiere-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const tc = await db.TradeCategory.create({
    name: `Filiere ${slug}`,
    slug,
    requiresCompany,
    isActive: true,
  });
  created.tradeCategoryIds.push(tc.id);
  return tc;
}

function providerPayload(overrides = {}) {
  return {
    type: 'independent',
    displayFirstName: 'Moussa',
    phoneNumber: '+22300000001',
    countryCode: overrides.countryCode,
    tradeCategoryIds: overrides.tradeCategoryIds,
    ...overrides,
  };
}

describe('Lot 3 — Teranga Pro (providers, trade-categories, onboarding)', () => {
  beforeAll(async () => {
    dbReady = await checkDatabase();
  });

  afterAll(async () => {
    if (!dbReady) return;

    if (created.providerIds.length) {
      await db.ProviderContract.destroy({ where: { providerId: created.providerIds } });
      await db.ProviderTradeCategory.destroy({ where: { providerId: created.providerIds } });
      await db.Provider.destroy({ where: { id: created.providerIds } });
    }
    if (created.userIds.length) {
      await db.CategoryManagerTradeCategory.destroy({ where: { userId: created.userIds } });
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

  test('GET /api/v1/trade-categories is public and lists active categories', async () => {
    if (!dbReady) return;
    const tc = await makeTradeCategory();

    const res = await request(app).get('/api/v1/trade-categories');
    expect(res.status).toBe(200);
    expect(res.body.tradeCategories.some((c) => c.id === tc.id)).toBe(true);
  });

  test('new Lot 3 routes are v1-only, never reachable under legacy /api', async () => {
    if (!dbReady) return;
    const v1 = await request(app).get('/api/v1/trade-categories');
    const legacy = await request(app).get('/api/trade-categories');

    expect(v1.status).toBe(200);
    expect(legacy.status).toBe(404);
  });

  test('a client-role account cannot submit a provider application', async () => {
    if (!dbReady) return;
    const country = await makeCountry();
    const { user, password } = await makeUser({ emailPrefix: 'client', role: 'client', countryId: country.id });
    const { token } = await loginAndGetToken(user.email, password);

    const res = await request(app)
      .post('/api/v1/providers')
      .set('Authorization', `Bearer ${token}`)
      .send(providerPayload({ countryCode: country.isoCode, tradeCategoryIds: [] }));

    expect(res.status).toBe(403);
  });

  test('provider-role account can submit a candidature, becomes status=pending', async () => {
    if (!dbReady) return;
    const country = await makeCountry();
    const tc = await makeTradeCategory();
    const { user, password } = await makeUser({ emailPrefix: 'prov', role: 'provider', countryId: country.id });
    const { token } = await loginAndGetToken(user.email, password);

    const res = await request(app)
      .post('/api/v1/providers')
      .set('Authorization', `Bearer ${token}`)
      .send(providerPayload({ countryCode: country.isoCode, tradeCategoryIds: [tc.id] }));

    expect(res.status).toBe(201);
    expect(res.body.provider.status).toBe('pending');
    expect(res.body.provider.userId).toBe(user.id);
    created.providerIds.push(res.body.provider.id);

    // Idempotence : une deuxième candidature pour le même compte est refusée.
    const dup = await request(app)
      .post('/api/v1/providers')
      .set('Authorization', `Bearer ${token}`)
      .send(providerPayload({ countryCode: country.isoCode, tradeCategoryIds: [tc.id] }));
    expect(dup.status).toBe(409);
  });

  test('candidature is rejected when a required-company trade category is picked with type=independent', async () => {
    if (!dbReady) return;
    const country = await makeCountry();
    const tc = await makeTradeCategory({ requiresCompany: true });
    const { user, password } = await makeUser({ emailPrefix: 'prov2', role: 'provider', countryId: country.id });
    const { token } = await loginAndGetToken(user.email, password);

    const res = await request(app)
      .post('/api/v1/providers')
      .set('Authorization', `Bearer ${token}`)
      .send(providerPayload({ countryCode: country.isoCode, tradeCategoryIds: [tc.id], type: 'independent' }));

    expect(res.status).toBe(400);
  });

  test('category_manager scoped to the matching trade category can read/onboard the provider; a client is always blocked', async () => {
    if (!dbReady) return;
    const country = await makeCountry();
    const tc = await makeTradeCategory();

    const { user: providerUser, password: providerPassword } = await makeUser({
      emailPrefix: 'prov3',
      role: 'provider',
      countryId: country.id,
    });
    const { token: providerToken } = await loginAndGetToken(providerUser.email, providerPassword);
    const createRes = await request(app)
      .post('/api/v1/providers')
      .set('Authorization', `Bearer ${providerToken}`)
      .send(providerPayload({ countryCode: country.isoCode, tradeCategoryIds: [tc.id] }));
    expect(createRes.status).toBe(201);
    const providerId = createRes.body.provider.id;
    created.providerIds.push(providerId);

    // Category manager SANS scope filière -> bloqué
    const { user: cmNoScope, password: cmNoScopePassword } = await makeUser({
      emailPrefix: 'cm_noscope',
      role: 'category_manager',
    });
    const { token: cmNoScopeToken } = await loginAndGetToken(cmNoScope.email, cmNoScopePassword);
    const blocked = await request(app)
      .get(`/api/v1/providers/${providerId}`)
      .set('Authorization', `Bearer ${cmNoScopeToken}`);
    expect(blocked.status).toBe(403);

    // Category manager avec la bonne filière -> autorisé
    const { user: cm, password: cmPassword } = await makeUser({ emailPrefix: 'cm', role: 'category_manager' });
    await db.CategoryManagerTradeCategory.create({ userId: cm.id, tradeCategoryId: tc.id });
    const { token: cmToken } = await loginAndGetToken(cm.email, cmPassword);

    const detail = await request(app)
      .get(`/api/v1/providers/${providerId}`)
      .set('Authorization', `Bearer ${cmToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.provider.id).toBe(providerId);
    // Usage interne admin/category_manager : les champs sensibles sont bien présents ici.
    expect(detail.body.provider.phoneNumber).toBeDefined();

    // Un client ne peut jamais accéder à cet endpoint (anti-fuite structurelle, 3.6).
    const { user: clientUser, password: clientPassword } = await makeUser({ emailPrefix: 'client2', role: 'client' });
    const { token: clientToken } = await loginAndGetToken(clientUser.email, clientPassword);
    const clientAttempt = await request(app)
      .get(`/api/v1/providers/${providerId}`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(clientAttempt.status).toBe(403);

    // Onboarding : pending -> probation (valide) puis probation -> pending (invalide)
    const advance = await request(app)
      .patch(`/api/v1/providers/${providerId}/status`)
      .set('Authorization', `Bearer ${cmToken}`)
      .send({ status: 'probation' });
    expect(advance.status).toBe(200);
    expect(advance.body.provider.status).toBe('probation');

    const invalidTransition = await request(app)
      .patch(`/api/v1/providers/${providerId}/status`)
      .set('Authorization', `Bearer ${cmToken}`)
      .send({ status: 'pending' });
    expect(invalidTransition.status).toBe(400);

    // Contrat signé, taux de commission dynamique (3.5)
    const contractRes = await request(app)
      .post(`/api/v1/providers/${providerId}/contracts`)
      .set('Authorization', `Bearer ${cmToken}`)
      .send({ commissionRate: 25, signedAt: new Date().toISOString() });
    expect(contractRes.status).toBe(201);
    expect(Number(contractRes.body.contract.commissionRate)).toBe(25);
    expect(contractRes.body.contract.providerId).toBe(providerId);
  });

  test('a global admin can onboard a provider on behalf of a provider-role account', async () => {
    if (!dbReady) return;
    const country = await makeCountry();
    const tc = await makeTradeCategory();

    const { user: providerUser } = await makeUser({
      emailPrefix: 'admin_onboard',
      role: 'provider',
      countryId: country.id,
    });
    const { user: globalAdmin, password: globalAdminPassword } = await makeUser({
      emailPrefix: 'global_admin',
      role: 'admin',
    });
    const { token: adminToken } = await loginAndGetToken(globalAdmin.email, globalAdminPassword);

    const res = await request(app)
      .post('/api/v1/providers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(
        providerPayload({
          userId: providerUser.id,
          countryCode: country.isoCode,
          tradeCategoryIds: [tc.id],
        })
      );

    expect(res.status).toBe(201);
    expect(res.body.provider.userId).toBe(providerUser.id);
    created.providerIds.push(res.body.provider.id);
  });

  test('admin onboarding a provider without userId, or targeting a non-provider account, is rejected', async () => {
    if (!dbReady) return;
    const country = await makeCountry();
    const tc = await makeTradeCategory();

    const { user: clientUser } = await makeUser({ emailPrefix: 'not_provider', role: 'client', countryId: country.id });
    const { user: globalAdmin, password: globalAdminPassword } = await makeUser({
      emailPrefix: 'global_admin2',
      role: 'admin',
    });
    const { token: adminToken } = await loginAndGetToken(globalAdmin.email, globalAdminPassword);

    const missingUserId = await request(app)
      .post('/api/v1/providers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(providerPayload({ countryCode: country.isoCode, tradeCategoryIds: [tc.id] }));
    expect(missingUserId.status).toBe(400);

    const wrongRole = await request(app)
      .post('/api/v1/providers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(
        providerPayload({
          userId: clientUser.id,
          countryCode: country.isoCode,
          tradeCategoryIds: [tc.id],
        })
      );
    expect(wrongRole.status).toBe(400);
  });

  test('a country-scoped admin cannot onboard a provider outside their own country', async () => {
    if (!dbReady) return;
    const providerCountry = await makeCountry();
    const otherCountry = await makeCountry();
    const tc = await makeTradeCategory();

    const { user: providerUser } = await makeUser({
      emailPrefix: 'scoped_onboard',
      role: 'provider',
      countryId: providerCountry.id,
    });
    const { user: scopedAdmin, password: scopedAdminPassword } = await makeUser({
      emailPrefix: 'scoped_admin2',
      role: 'admin',
      countryId: otherCountry.id,
    });
    const { token: scopedAdminToken } = await loginAndGetToken(scopedAdmin.email, scopedAdminPassword);

    const res = await request(app)
      .post('/api/v1/providers')
      .set('Authorization', `Bearer ${scopedAdminToken}`)
      .send(
        providerPayload({
          userId: providerUser.id,
          countryCode: providerCountry.isoCode,
          tradeCategoryIds: [tc.id],
        })
      );

    expect(res.status).toBe(403);
  });

  test('a country-scoped admin from a different country cannot manage the provider', async () => {
    if (!dbReady) return;
    const providerCountry = await makeCountry();
    const otherCountry = await makeCountry();
    const tc = await makeTradeCategory();

    const { user: providerUser, password: providerPassword } = await makeUser({
      emailPrefix: 'prov4',
      role: 'provider',
      countryId: providerCountry.id,
    });
    const { token: providerToken } = await loginAndGetToken(providerUser.email, providerPassword);
    const createRes = await request(app)
      .post('/api/v1/providers')
      .set('Authorization', `Bearer ${providerToken}`)
      .send(providerPayload({ countryCode: providerCountry.isoCode, tradeCategoryIds: [tc.id] }));
    expect(createRes.status).toBe(201);
    const providerId = createRes.body.provider.id;
    created.providerIds.push(providerId);

    const { user: scopedAdmin, password: scopedAdminPassword } = await makeUser({
      emailPrefix: 'scoped_admin',
      role: 'admin',
      countryId: otherCountry.id,
    });
    const { token: scopedAdminToken } = await loginAndGetToken(scopedAdmin.email, scopedAdminPassword);

    const res = await request(app)
      .get(`/api/v1/providers/${providerId}`)
      .set('Authorization', `Bearer ${scopedAdminToken}`);
    expect(res.status).toBe(403);
  });
});
