'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'teranga_sprint2_test_secret';

const bcrypt = require('bcrypt');
const request = require('supertest');
const app = require('../../src/app');
const db = require('../../models');

// Régression : la création de compte prestataire affichait "Aucune filière active pour le
// moment" car il n'existait aucun moyen de créer une filière depuis l'interface — seul un
// GET public en lecture seule existait. Puis : les filières créées par un master n'étaient pas
// distinguées par pays/région (toutes globales), donc incohérentes avec le périmètre du master
// et avec la mission qui en résultait (le master ne voyait pas sa propre mission). Désormais :
// - un master hérite TOUJOURS de son propre pays/région à la création (jamais du payload) ;
// - le catalogue public se filtre par pays/région (global + périmètre demandé) ;
// - une mission créée avec une filière scopée hérite du pays/région de LA FILIÈRE, pas du
//   géocodage de l'adresse (voir resolveMissionGeoScope.js tradeCategoryScope).

let dbReady = false;
const created = {
  userIds: [],
  tradeCategoryIds: [],
  countryIds: [],
  regionIds: [],
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
  for (let i = 0; i < 30; i += 1) {
    const iso = `W${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
    try {
      const country = await db.Country.create({
        name: `TradeCatScope-${Date.now()}-${iso}-${i}`,
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
  throw new Error('Impossible de creer un pays de test unique');
}

async function makeRegion(countryId, name) {
  const region = await db.Region.create({
    name,
    code: `TC-${countryId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    countryId,
    isActive: true,
  });
  created.regionIds.push(region.id);
  return region;
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

describe('Gestion des filières (trade categories) — scope pays/région', () => {
  let countryA;
  let regionA1;
  let countryB;

  beforeAll(async () => {
    dbReady = await checkDatabase();
    if (!dbReady) return;
    countryA = await makeCountry();
    regionA1 = await makeRegion(countryA.id, `RegionA1-${Date.now()}`);
    countryB = await makeCountry();
  });

  afterAll(async () => {
    if (!dbReady) return;
    if (created.tradeCategoryIds.length) {
      await db.TradeCategory.destroy({ where: { id: created.tradeCategoryIds } });
    }
    if (created.userIds.length) {
      await db.User.destroy({ where: { id: created.userIds } });
    }
    if (created.regionIds.length) {
      await db.Region.destroy({ where: { id: created.regionIds } });
    }
    if (created.countryIds.length) {
      await db.Country.destroy({ where: { id: created.countryIds } });
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

  test('un master (admin scopé) crée une filière automatiquement scopée à SON pays/région, pas au payload', async () => {
    if (!dbReady) return;

    const { user, password } = await makeUser({
      emailPrefix: 'master',
      role: 'admin',
      countryId: countryA.id,
      regionId: regionA1.id,
    });
    const token = await loginAndGetToken(user.email, password);

    const slug = `test-master-${Date.now()}`;
    const res = await request(app)
      .post('/api/v1/trade-categories')
      .set('Authorization', `Bearer ${token}`)
      // countryId/regionId ici doivent être IGNORÉS : un master ne peut pas créer une filière
      // pour un autre périmètre que le sien.
      .send({ name: `Filiere master ${slug}`, slug, countryId: countryB.id });

    expect(res.status).toBe(201);
    created.tradeCategoryIds.push(res.body.tradeCategory.id);
    expect(res.body.tradeCategory.slug).toBe(slug);
    expect(res.body.tradeCategory.isActive).toBe(true);
    expect(res.body.tradeCategory.countryId).toBe(countryA.id);
    expect(res.body.tradeCategory.regionId).toBe(regionA1.id);
  });

  test('un admin global peut créer une filière globale (par défaut) ou explicitement scopée à un pays', async () => {
    if (!dbReady) return;

    const { user, password } = await makeUser({ emailPrefix: 'global_admin2', role: 'admin' });
    const token = await loginAndGetToken(user.email, password);

    const globalSlug = `test-global-${Date.now()}`;
    const globalRes = await request(app)
      .post('/api/v1/trade-categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Filiere globale ${globalSlug}`, slug: globalSlug });
    expect(globalRes.status).toBe(201);
    created.tradeCategoryIds.push(globalRes.body.tradeCategory.id);
    expect(globalRes.body.tradeCategory.countryId).toBeNull();

    const scopedSlug = `test-scoped-by-global-${Date.now()}`;
    const scopedRes = await request(app)
      .post('/api/v1/trade-categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Filiere scopee ${scopedSlug}`, slug: scopedSlug, countryId: countryB.id });
    expect(scopedRes.status).toBe(201);
    created.tradeCategoryIds.push(scopedRes.body.tradeCategory.id);
    expect(scopedRes.body.tradeCategory.countryId).toBe(countryB.id);
    expect(scopedRes.body.tradeCategory.regionId).toBeNull();
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

  test('création sans auth refusée (401)', async () => {
    if (!dbReady) return;

    const res = await request(app)
      .post('/api/v1/trade-categories')
      .send({ name: 'Filiere sans auth' });

    expect(res.status).toBe(401);
  });

  test('GET /trade-categories (public) filtre par pays/région : globale + pays entier + région précise', async () => {
    if (!dbReady) return;

    const { user, password } = await makeUser({ emailPrefix: 'global_admin3', role: 'admin' });
    const token = await loginAndGetToken(user.email, password);

    const countryWideSlug = `test-country-wide-${Date.now()}`;
    const countryWideRes = await request(app)
      .post('/api/v1/trade-categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Filiere pays entier ${countryWideSlug}`, slug: countryWideSlug, countryId: countryA.id });
    created.tradeCategoryIds.push(countryWideRes.body.tradeCategory.id);

    const regionSlug = `test-region-only-${Date.now()}`;
    const regionRes = await request(app)
      .post('/api/v1/trade-categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Filiere region ${regionSlug}`, slug: regionSlug, countryId: countryA.id, regionId: regionA1.id });
    created.tradeCategoryIds.push(regionRes.body.tradeCategory.id);

    const countryBSlug = `test-other-country-${Date.now()}`;
    const countryBRes = await request(app)
      .post('/api/v1/trade-categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Filiere autre pays ${countryBSlug}`, slug: countryBSlug, countryId: countryB.id });
    created.tradeCategoryIds.push(countryBRes.body.tradeCategory.id);

    // Sans paramètre : uniquement les filières globales (jamais celles scopées à un pays).
    const noParamsRes = await request(app).get('/api/v1/trade-categories');
    const noParamsIds = (noParamsRes.body.tradeCategories || []).map((tc) => tc.id);
    expect(noParamsIds).not.toContain(countryWideRes.body.tradeCategory.id);
    expect(noParamsIds).not.toContain(regionRes.body.tradeCategory.id);

    // countryId=A : la filière "pays entier" de A et la filière régionale de A (sa région
    // appartient à A) doivent apparaître ; la filière de B jamais.
    const countryAScopedRes = await request(app)
      .get('/api/v1/trade-categories')
      .query({ countryId: countryA.id });
    const countryAIds = (countryAScopedRes.body.tradeCategories || []).map((tc) => tc.id);
    expect(countryAIds).toContain(countryWideRes.body.tradeCategory.id);
    expect(countryAIds).not.toContain(countryBRes.body.tradeCategory.id);

    // regionId=A1 : la filière régionale de A1 ET la filière "pays entier" de A (fallback pays
    // entier pour une région de ce pays) doivent apparaître.
    const regionScopedRes = await request(app)
      .get('/api/v1/trade-categories')
      .query({ countryId: countryA.id, regionId: regionA1.id });
    const regionScopedIds = (regionScopedRes.body.tradeCategories || []).map((tc) => tc.id);
    expect(regionScopedIds).toContain(regionRes.body.tradeCategory.id);
    expect(regionScopedIds).toContain(countryWideRes.body.tradeCategory.id);
    expect(regionScopedIds).not.toContain(countryBRes.body.tradeCategory.id);
  });

  test("GET /trade-categories/admin (master) voit les filières globales + les siennes, jamais celles d'un autre pays", async () => {
    if (!dbReady) return;

    const { user: globalUser, password: globalPassword } = await makeUser({
      emailPrefix: 'global_admin4',
      role: 'admin',
    });
    const globalToken = await loginAndGetToken(globalUser.email, globalPassword);

    const inactiveGlobalSlug = `test-admin-list-global-${Date.now()}`;
    const inactiveGlobalRes = await request(app)
      .post('/api/v1/trade-categories')
      .set('Authorization', `Bearer ${globalToken}`)
      .send({ name: `Filiere globale inactive ${inactiveGlobalSlug}`, slug: inactiveGlobalSlug, isActive: false });
    created.tradeCategoryIds.push(inactiveGlobalRes.body.tradeCategory.id);

    const countryBOnlySlug = `test-admin-list-countryb-${Date.now()}`;
    const countryBOnlyRes = await request(app)
      .post('/api/v1/trade-categories')
      .set('Authorization', `Bearer ${globalToken}`)
      .send({ name: `Filiere pays B ${countryBOnlySlug}`, slug: countryBOnlySlug, countryId: countryB.id });
    created.tradeCategoryIds.push(countryBOnlyRes.body.tradeCategory.id);

    const { user: masterUser, password: masterPassword } = await makeUser({
      emailPrefix: 'master_admin_list',
      role: 'admin',
      countryId: countryA.id,
    });
    const masterToken = await loginAndGetToken(masterUser.email, masterPassword);

    const adminListRes = await request(app)
      .get('/api/v1/trade-categories/admin')
      .set('Authorization', `Bearer ${masterToken}`);

    expect(adminListRes.status).toBe(200);
    const ids = (adminListRes.body.tradeCategories || []).map((tc) => tc.id);
    expect(ids).toContain(inactiveGlobalRes.body.tradeCategory.id); // globale, même inactive
    expect(ids).not.toContain(countryBOnlyRes.body.tradeCategory.id); // hors périmètre du master
  });

  test('un master ne peut ni modifier ni supprimer une filière globale ou hors de son périmètre', async () => {
    if (!dbReady) return;

    const { user: globalUser, password: globalPassword } = await makeUser({
      emailPrefix: 'global_admin5',
      role: 'admin',
    });
    const globalToken = await loginAndGetToken(globalUser.email, globalPassword);

    const globalSlug = `test-master-forbidden-global-${Date.now()}`;
    const globalRes = await request(app)
      .post('/api/v1/trade-categories')
      .set('Authorization', `Bearer ${globalToken}`)
      .send({ name: `Filiere globale ${globalSlug}`, slug: globalSlug });
    created.tradeCategoryIds.push(globalRes.body.tradeCategory.id);

    const countryBSlug = `test-master-forbidden-countryb-${Date.now()}`;
    const countryBRes = await request(app)
      .post('/api/v1/trade-categories')
      .set('Authorization', `Bearer ${globalToken}`)
      .send({ name: `Filiere pays B ${countryBSlug}`, slug: countryBSlug, countryId: countryB.id });
    created.tradeCategoryIds.push(countryBRes.body.tradeCategory.id);

    const { user: masterUser, password: masterPassword } = await makeUser({
      emailPrefix: 'master_forbidden',
      role: 'admin',
      countryId: countryA.id,
    });
    const masterToken = await loginAndGetToken(masterUser.email, masterPassword);

    const updateGlobalRes = await request(app)
      .put(`/api/v1/trade-categories/${globalRes.body.tradeCategory.id}`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ isActive: false });
    expect(updateGlobalRes.status).toBe(403);

    const updateCountryBRes = await request(app)
      .put(`/api/v1/trade-categories/${countryBRes.body.tradeCategory.id}`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ isActive: false });
    expect(updateCountryBRes.status).toBe(403);

    const deleteGlobalRes = await request(app)
      .delete(`/api/v1/trade-categories/${globalRes.body.tradeCategory.id}`)
      .set('Authorization', `Bearer ${masterToken}`);
    expect(deleteGlobalRes.status).toBe(403);
  });

  test('un master peut désactiver SA PROPRE filière (update) puis elle disparaît de la liste publique scopée', async () => {
    if (!dbReady) return;

    const { user, password } = await makeUser({
      emailPrefix: 'master_update',
      role: 'admin',
      countryId: countryA.id,
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

    const publicResBefore = await request(app)
      .get('/api/v1/trade-categories')
      .query({ countryId: countryA.id });
    expect((publicResBefore.body.tradeCategories || []).map((tc) => tc.id)).toContain(id);

    const updateRes = await request(app)
      .put(`/api/v1/trade-categories/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.tradeCategory.isActive).toBe(false);

    const publicResAfter = await request(app)
      .get('/api/v1/trade-categories')
      .query({ countryId: countryA.id });
    expect((publicResAfter.body.tradeCategories || []).map((tc) => tc.id)).not.toContain(id);
  });
});
