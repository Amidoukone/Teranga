'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'teranga_sprint2_test_secret';

const bcrypt = require('bcrypt');
const request = require('supertest');
const app = require('../../src/app');
const db = require('../../models');

// Régression : la création de compte prestataire affichait "Aucune filière active pour le
// moment" car il n'existait aucun moyen de créer une filière depuis l'interface — seul un
// GET public en lecture seule existait (backend/src/controllers/tradeCategory.controller.js).
// Le super admin ET le master doivent tous deux pouvoir gérer les filières (ce n'est pas une
// ressource scopée par pays/région, contrairement aux régions).

let dbReady = false;
const created = {
  userIds: [],
  tradeCategoryIds: [],
};

async function checkDatabase() {
  try {
    await db.sequelize.authenticate();
    return true;
  } catch (_err) {
    return false;
  }
}

async function makeUser({ emailPrefix, role, countryId = null, regionId = null }) {
  const password = 'Password123!';
  const email = `${emailPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await db.User.create({
    email,
    passwordHash,
    firstName: 'TradeCat',
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
  return res.body?.token;
}

describe('Gestion des filières (trade categories) — super admin ET master', () => {
  beforeAll(async () => {
    dbReady = await checkDatabase();
  });

  afterAll(async () => {
    if (!dbReady) return;
    if (created.tradeCategoryIds.length) {
      await db.TradeCategory.destroy({ where: { id: created.tradeCategoryIds } });
    }
    if (created.userIds.length) {
      await db.User.destroy({ where: { id: created.userIds } });
    }
  });

  test('GET /trade-categories (public) ne renvoie jamais une filière inactive', async () => {
    if (!dbReady) return;

    const { user, password } = await makeUser({ emailPrefix: 'global_admin', role: 'admin' });
    const token = await loginAndGetToken(user.email, password);

    const slug = `test-inactive-${Date.now()}`;
    const createRes = await request(app)
      .post('/api/v1/trade-categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Filiere inactive ${slug}`, slug, isActive: false });

    expect(createRes.status).toBe(201);
    created.tradeCategoryIds.push(createRes.body.tradeCategory.id);

    const publicRes = await request(app).get('/api/v1/trade-categories');
    expect(publicRes.status).toBe(200);
    const ids = (publicRes.body.tradeCategories || []).map((tc) => tc.id);
    expect(ids).not.toContain(createRes.body.tradeCategory.id);
  });

  test('un master (admin scopé) peut créer une filière, pas seulement le super admin', async () => {
    if (!dbReady) return;

    const { user, password } = await makeUser({
      emailPrefix: 'master',
      role: 'admin',
      countryId: 1,
    });
    const token = await loginAndGetToken(user.email, password);

    const slug = `test-master-${Date.now()}`;
    const res = await request(app)
      .post('/api/v1/trade-categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Filiere master ${slug}`, slug });

    expect(res.status).toBe(201);
    created.tradeCategoryIds.push(res.body.tradeCategory.id);
    expect(res.body.tradeCategory.slug).toBe(slug);
    expect(res.body.tradeCategory.isActive).toBe(true);
  });

  test('un client ne peut pas créer de filière', async () => {
    if (!dbReady) return;

    const { user, password } = await makeUser({ emailPrefix: 'client_denied', role: 'client' });
    const token = await loginAndGetToken(user.email, password);

    const res = await request(app)
      .post('/api/v1/trade-categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Filiere refusee' });

    expect(res.status).toBe(403);
  });

  test('création sans auth refusée (401), lecture publique OK', async () => {
    if (!dbReady) return;

    const res = await request(app)
      .post('/api/v1/trade-categories')
      .send({ name: 'Filiere sans auth' });

    expect(res.status).toBe(401);
  });

  test('GET /trade-categories/admin (master) renvoie aussi les filières inactives', async () => {
    if (!dbReady) return;

    const { user: masterUser, password: masterPassword } = await makeUser({
      emailPrefix: 'master_admin_list',
      role: 'admin',
      regionId: 1,
    });
    const masterToken = await loginAndGetToken(masterUser.email, masterPassword);

    const { user: creatorUser, password: creatorPassword } = await makeUser({
      emailPrefix: 'global_admin_creator',
      role: 'admin',
    });
    const creatorToken = await loginAndGetToken(creatorUser.email, creatorPassword);

    const slug = `test-admin-list-${Date.now()}`;
    const createRes = await request(app)
      .post('/api/v1/trade-categories')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ name: `Filiere pour liste admin ${slug}`, slug, isActive: false });
    expect(createRes.status).toBe(201);
    created.tradeCategoryIds.push(createRes.body.tradeCategory.id);

    const adminListRes = await request(app)
      .get('/api/v1/trade-categories/admin')
      .set('Authorization', `Bearer ${masterToken}`);

    expect(adminListRes.status).toBe(200);
    const ids = (adminListRes.body.tradeCategories || []).map((tc) => tc.id);
    expect(ids).toContain(createRes.body.tradeCategory.id);
  });

  test('un master peut désactiver une filière (update) puis elle disparaît de la liste publique', async () => {
    if (!dbReady) return;

    const { user, password } = await makeUser({
      emailPrefix: 'master_update',
      role: 'admin',
      countryId: 1,
    });
    const token = await loginAndGetToken(user.email, password);

    const slug = `test-deactivate-${Date.now()}`;
    const createRes = await request(app)
      .post('/api/v1/trade-categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Filiere a desactiver ${slug}`, slug });
    expect(createRes.status).toBe(201);
    const id = createRes.body.tradeCategory.id;
    created.tradeCategoryIds.push(id);

    const publicResBefore = await request(app).get('/api/v1/trade-categories');
    expect((publicResBefore.body.tradeCategories || []).map((tc) => tc.id)).toContain(id);

    const updateRes = await request(app)
      .put(`/api/v1/trade-categories/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.tradeCategory.isActive).toBe(false);

    const publicResAfter = await request(app).get('/api/v1/trade-categories');
    expect((publicResAfter.body.tradeCategories || []).map((tc) => tc.id)).not.toContain(id);
  });
});
