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
  providerIds: [],
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
  const iso = `T${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
  const country = await db.Country.create({
    name: `MissionTracking-${Date.now()}-${iso}`,
    isoCode: iso,
    currency: 'XOF',
    isActive: true,
  });
  created.countryIds.push(country.id);
  return country;
}

async function makeTradeCategory() {
  const slug = `tracking-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const tc = await db.TradeCategory.create({ name: `Filiere ${slug}`, slug, isActive: true });
  created.tradeCategoryIds.push(tc.id);
  return tc;
}

async function makeUser({ role, countryId = null }) {
  const password = 'Password123!';
  const email = `tracking_${role}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await db.User.create({
    email,
    passwordHash,
    firstName: 'Tracking',
    lastName: role,
    role,
    countryId,
  });
  created.userIds.push(user.id);
  return { user, password };
}

async function makeActiveProvider({ userId, countryCode, tradeCategoryId }) {
  const provider = await db.Provider.create({
    userId,
    type: 'independent',
    displayFirstName: 'Moussa',
    phoneNumber: '+22300000002',
    countryCode,
    status: 'active',
  });
  created.providerIds.push(provider.id);
  await db.ProviderTradeCategory.create({ providerId: provider.id, tradeCategoryId });
  return provider;
}

async function loginAndGetToken(email, password) {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  return res.body?.token;
}

async function createProviderMission({ clientToken, tradeCategoryId }) {
  const res = await request(app)
    .post('/api/v1/missions')
    .set('Authorization', `Bearer ${clientToken}`)
    .send({
      executionType: 'provider',
      tradeCategoryId,
      title: 'Fuite sous évier',
      latitude: 12.65,
      longitude: -8.0,
    });
  created.serviceIds.push(res.body.mission.id);
  return res.body.mission;
}

describe('Suivi en direct — assignation, statut, position, track (docs section 4.2)', () => {
  let country;
  let tradeCategory;
  let clientToken;
  let clientUser;
  let adminToken;

  beforeAll(async () => {
    dbReady = await checkDatabase();
    if (!dbReady) return;

    country = await makeCountry();
    tradeCategory = await makeTradeCategory();

    await db.MissionPricingRule.create({
      countryId: country.id,
      tradeCategoryId: tradeCategory.id,
      pricingMode: 'quote_only',
      estimatedDelayMinutes: 90,
      isActive: true,
    }).then((r) => created.ruleId === undefined && (created.ruleId = r.id));

    const { user: client, password: clientPassword } = await makeUser({
      role: 'client',
      countryId: country.id,
    });
    clientUser = client;
    clientToken = await loginAndGetToken(client.email, clientPassword);

    const { user: admin, password: adminPassword } = await makeUser({ role: 'admin' });
    adminToken = await loginAndGetToken(admin.email, adminPassword);
  });

  afterAll(async () => {
    if (!dbReady) return;
    if (created.serviceIds.length) {
      await db.ExecutorLocation.destroy({ where: { serviceId: created.serviceIds } });
      await db.MissionStatusHistory.destroy({ where: { serviceId: created.serviceIds } });
      await db.Service.destroy({ where: { id: created.serviceIds } });
    }
    if (created.providerIds.length) {
      await db.ProviderTradeCategory.destroy({ where: { providerId: created.providerIds } });
      await db.Provider.destroy({ where: { id: created.providerIds } });
    }
    if (created.ruleId) await db.MissionPricingRule.destroy({ where: { id: created.ruleId } });
    if (created.userIds.length) {
      await db.RefreshToken.destroy({ where: { userId: created.userIds } });
      await db.RecoveryCode.destroy({ where: { userId: created.userIds } });
      await db.PasswordResetToken.destroy({ where: { userId: created.userIds } });
      await db.User.destroy({ where: { id: created.userIds } });
    }
    if (created.tradeCategoryIds.length) {
      await db.TradeCategory.destroy({ where: { id: created.tradeCategoryIds } });
    }
    if (created.countryIds.length) await db.Country.destroy({ where: { id: created.countryIds } });
    await db.sequelize.close();
  });

  test('assign rejects a provider that does not cover the mission trade category', async () => {
    if (!dbReady) return;
    const mission = await createProviderMission({ clientToken, tradeCategoryId: tradeCategory.id });
    const otherTradeCategory = await makeTradeCategory();

    const { user: providerUser, password: providerPassword } = await makeUser({
      role: 'provider',
      countryId: country.id,
    });
    const wrongProvider = await makeActiveProvider({
      userId: providerUser.id,
      countryCode: country.isoCode,
      tradeCategoryId: otherTradeCategory.id,
    });

    const res = await request(app)
      .post(`/api/v1/missions/${mission.id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ providerId: wrongProvider.id });

    expect(res.status).toBe(400);
    void providerPassword;
  });

  test('full happy path: assign -> en_route -> on_site -> in_progress -> completed -> validated, with history + legacy status sync', async () => {
    if (!dbReady) return;
    const mission = await createProviderMission({ clientToken, tradeCategoryId: tradeCategory.id });

    const { user: providerUser, password: providerPassword } = await makeUser({
      role: 'provider',
      countryId: country.id,
    });
    const provider = await makeActiveProvider({
      userId: providerUser.id,
      countryCode: country.isoCode,
      tradeCategoryId: tradeCategory.id,
    });
    const providerToken = await loginAndGetToken(providerUser.email, providerPassword);

    const assignRes = await request(app)
      .post(`/api/v1/missions/${mission.id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ providerId: provider.id });
    expect(assignRes.status).toBe(200);
    expect(assignRes.body.mission.missionStatus).toBe('ASSIGNED');
    expect(assignRes.body.mission.status).toBe('in_progress');

    const history = await db.MissionStatusHistory.findAll({
      where: { serviceId: mission.id },
      order: [['createdAt', 'ASC']],
    });
    expect(history.map((h) => h.toStatus)).toEqual(['SEARCHING_EXECUTOR', 'ASSIGNED']);

    // Un autre provider ne peut pas piloter cette mission.
    const { user: otherProviderUser, password: otherProviderPassword } = await makeUser({
      role: 'provider',
      countryId: country.id,
    });
    await makeActiveProvider({
      userId: otherProviderUser.id,
      countryCode: country.isoCode,
      tradeCategoryId: tradeCategory.id,
    });
    const otherProviderToken = await loginAndGetToken(otherProviderUser.email, otherProviderPassword);
    const forbiddenRes = await request(app)
      .patch(`/api/v1/missions/${mission.id}/status`)
      .set('Authorization', `Bearer ${otherProviderToken}`)
      .send({ toStatus: 'EN_ROUTE' });
    expect(forbiddenRes.status).toBe(403);

    const enRouteRes = await request(app)
      .patch(`/api/v1/missions/${mission.id}/status`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ toStatus: 'EN_ROUTE' });
    expect(enRouteRes.status).toBe(200);
    expect(enRouteRes.body.mission.missionStatus).toBe('EN_ROUTE');

    const locationRes = await request(app)
      .post(`/api/v1/missions/${mission.id}/location`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ latitude: 12.6, longitude: -8.01 });
    expect(locationRes.status).toBe(201);

    const trackRes = await request(app)
      .get(`/api/v1/missions/${mission.id}/track`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(trackRes.status).toBe(200);
    expect(trackRes.body.missionStatus).toBe('EN_ROUTE');
    expect(trackRes.body.position).toEqual(
      expect.objectContaining({ latitude: 12.6, longitude: -8.01 })
    );

    // Un autre client ne peut pas suivre cette mission.
    const { user: otherClient, password: otherClientPassword } = await makeUser({
      role: 'client',
      countryId: country.id,
    });
    const otherClientToken = await loginAndGetToken(otherClient.email, otherClientPassword);
    const forbiddenTrack = await request(app)
      .get(`/api/v1/missions/${mission.id}/track`)
      .set('Authorization', `Bearer ${otherClientToken}`);
    expect(forbiddenTrack.status).toBe(403);
    void otherClientPassword;

    await request(app)
      .patch(`/api/v1/missions/${mission.id}/status`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ toStatus: 'ON_SITE' })
      .expect(200);
    await request(app)
      .patch(`/api/v1/missions/${mission.id}/status`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ toStatus: 'IN_PROGRESS' })
      .expect(200);
    const completedRes = await request(app)
      .patch(`/api/v1/missions/${mission.id}/status`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ toStatus: 'COMPLETED' });
    expect(completedRes.status).toBe(200);
    expect(completedRes.body.mission.status).toBe('completed');

    // Le prestataire ne peut pas valider lui-même — c'est une action client.
    const providerValidateAttempt = await request(app)
      .patch(`/api/v1/missions/${mission.id}/status`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ toStatus: 'VALIDATED' });
    expect(providerValidateAttempt.status).toBe(403);

    const validatedRes = await request(app)
      .patch(`/api/v1/missions/${mission.id}/status`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ toStatus: 'VALIDATED' });
    expect(validatedRes.status).toBe(200);
    expect(validatedRes.body.mission.missionStatus).toBe('VALIDATED');
    expect(validatedRes.body.mission.status).toBe('validated');
  });

  test('a classic (agent-type) mission has no missionStatus and cannot use the status transition endpoint', async () => {
    if (!dbReady) return;
    const missionRes = await request(app)
      .post('/api/v1/missions')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ executionType: 'agent', serviceType: 'errand', title: 'Course simple' });
    const missionId = missionRes.body.mission.id;
    created.serviceIds.push(missionId);

    const res = await request(app)
      .patch(`/api/v1/missions/${missionId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ toStatus: 'SEARCHING_EXECUTOR' });

    expect(res.status).toBe(400);
  });
});
