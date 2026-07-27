'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'teranga_sprint2_test_secret';

const bcrypt = require('bcrypt');
const request = require('supertest');
const app = require('../../src/app');
const db = require('../../models');

let dbReady = false;
const created = { userIds: [], countryIds: [], ruleIds: [] };

async function checkDatabase() {
  try {
    await db.sequelize.authenticate();
    return true;
  } catch (_err) {
    return false;
  }
}

async function makeCountry() {
  // isoCode est VARCHAR(2) (ISO 3166-1 alpha-2) — les deux caractères sont randomisés (pas un
  // préfixe fixe + 1 lettre) pour réduire le risque de collision entre les nombreux appels de ce
  // fichier (676 combinaisons plutôt que 26), avec une boucle de nouvelle tentative en dernier
  // recours comme dans lot3-providers.test.js/mission-creation.test.js.
  for (let i = 0; i < 30; i += 1) {
    const iso = String.fromCharCode(
      65 + Math.floor(Math.random() * 26),
      65 + Math.floor(Math.random() * 26)
    );
    try {
      const country = await db.Country.create({
        name: `PricingAdmin-${Date.now()}-${iso}-${i}`,
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

async function makeAdmin({ countryId = null } = {}) {
  const password = 'Password123!';
  const email = `pricing_admin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await db.User.create({
    email,
    passwordHash,
    firstName: 'Pricing',
    lastName: 'Admin',
    role: 'admin',
    countryId,
  });
  created.userIds.push(user.id);
  return { user, password };
}

async function loginAndGetToken(email, password) {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  return res.body?.token;
}

describe('Tarification de mission — CRUD admin (docs section 4.1)', () => {
  beforeAll(async () => {
    dbReady = await checkDatabase();
  });

  afterAll(async () => {
    if (!dbReady) return;
    if (created.ruleIds.length) await db.MissionPricingRule.destroy({ where: { id: created.ruleIds } });
    if (created.userIds.length) {
      await db.RefreshToken.destroy({ where: { userId: created.userIds } });
      await db.RecoveryCode.destroy({ where: { userId: created.userIds } });
      await db.PasswordResetToken.destroy({ where: { userId: created.userIds } });
      await db.User.destroy({ where: { id: created.userIds } });
    }
    if (created.countryIds.length) await db.Country.destroy({ where: { id: created.countryIds } });
    await db.sequelize.close();
  });

  test('a global admin can create a country-wide rule for any country', async () => {
    if (!dbReady) return;
    const country = await makeCountry();
    const { user, password } = await makeAdmin();
    const token = await loginAndGetToken(user.email, password);

    const res = await request(app)
      .post('/api/v1/mission-pricing-rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        countryId: country.id,
        serviceType: 'errand',
        pricingMode: 'fixed_estimate',
        basePrice: 1500,
        estimatedDelayMinutes: 60,
      });

    expect(res.status).toBe(201);
    created.ruleIds.push(res.body.pricingRule.id);
  });

  test('a country-scoped admin cannot create a rule for a different country', async () => {
    if (!dbReady) return;
    const ownCountry = await makeCountry();
    const otherCountry = await makeCountry();
    const { user, password } = await makeAdmin({ countryId: ownCountry.id });
    const token = await loginAndGetToken(user.email, password);

    const res = await request(app)
      .post('/api/v1/mission-pricing-rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        countryId: otherCountry.id,
        serviceType: 'payment',
        pricingMode: 'fixed_estimate',
        basePrice: 1000,
        estimatedDelayMinutes: 30,
      });

    // La règle est silencieusement créée dans le pays de l'admin (scope forcé),
    // jamais dans otherCountry — vérifié via la valeur réellement persistée.
    expect(res.status).toBe(201);
    expect(res.body.pricingRule.countryId).toBe(ownCountry.id);
    created.ruleIds.push(res.body.pricingRule.id);
  });

  test('a country-scoped admin cannot update a rule belonging to a different country', async () => {
    if (!dbReady) return;
    const ruleCountry = await makeCountry();
    const otherCountry = await makeCountry();

    const { user: globalAdmin, password: globalPassword } = await makeAdmin();
    const globalToken = await loginAndGetToken(globalAdmin.email, globalPassword);
    const createRes = await request(app)
      .post('/api/v1/mission-pricing-rules')
      .set('Authorization', `Bearer ${globalToken}`)
      .send({
        countryId: ruleCountry.id,
        serviceType: 'other',
        pricingMode: 'quote_only',
        estimatedDelayMinutes: 120,
      });
    expect(createRes.status).toBe(201);
    const ruleId = createRes.body.pricingRule.id;
    created.ruleIds.push(ruleId);

    const { user: scopedAdmin, password: scopedPassword } = await makeAdmin({ countryId: otherCountry.id });
    const scopedToken = await loginAndGetToken(scopedAdmin.email, scopedPassword);

    const res = await request(app)
      .patch(`/api/v1/mission-pricing-rules/${ruleId}`)
      .set('Authorization', `Bearer ${scopedToken}`)
      .send({ basePrice: 9999 });

    expect(res.status).toBe(403);
  });

  test('GET /mission-pricing-rules only returns rules within the caller scope', async () => {
    if (!dbReady) return;
    const country = await makeCountry();
    const otherCountry = await makeCountry();

    const { user: globalAdmin, password: globalPassword } = await makeAdmin();
    const globalToken = await loginAndGetToken(globalAdmin.email, globalPassword);

    const ruleA = await request(app)
      .post('/api/v1/mission-pricing-rules')
      .set('Authorization', `Bearer ${globalToken}`)
      .send({ countryId: country.id, serviceType: 'errand', pricingMode: 'fixed_estimate', basePrice: 1500, estimatedDelayMinutes: 60 });
    created.ruleIds.push(ruleA.body.pricingRule.id);

    const ruleB = await request(app)
      .post('/api/v1/mission-pricing-rules')
      .set('Authorization', `Bearer ${globalToken}`)
      .send({ countryId: otherCountry.id, serviceType: 'errand', pricingMode: 'fixed_estimate', basePrice: 1500, estimatedDelayMinutes: 60 });
    created.ruleIds.push(ruleB.body.pricingRule.id);

    const { user: scopedAdmin, password: scopedPassword } = await makeAdmin({ countryId: country.id });
    const scopedToken = await loginAndGetToken(scopedAdmin.email, scopedPassword);

    const listRes = await request(app)
      .get('/api/v1/mission-pricing-rules')
      .set('Authorization', `Bearer ${scopedToken}`);

    expect(listRes.status).toBe(200);
    const ids = listRes.body.pricingRules.map((r) => r.id);
    expect(ids).toContain(ruleA.body.pricingRule.id);
    expect(ids).not.toContain(ruleB.body.pricingRule.id);
  });

  test('DELETE soft-disables a rule instead of removing it', async () => {
    if (!dbReady) return;
    const country = await makeCountry();
    const { user, password } = await makeAdmin();
    const token = await loginAndGetToken(user.email, password);

    const createRes = await request(app)
      .post('/api/v1/mission-pricing-rules')
      .set('Authorization', `Bearer ${token}`)
      .send({ countryId: country.id, serviceType: 'other', pricingMode: 'quote_only', estimatedDelayMinutes: 120 });
    const ruleId = createRes.body.pricingRule.id;
    created.ruleIds.push(ruleId);

    const deleteRes = await request(app)
      .delete(`/api/v1/mission-pricing-rules/${ruleId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);

    const stillExists = await db.MissionPricingRule.findByPk(ruleId);
    expect(stillExists).not.toBeNull();
    expect(stillExists.isActive).toBe(false);
  });
});
