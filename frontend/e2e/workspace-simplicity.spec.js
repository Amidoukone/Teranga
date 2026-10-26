const { test, expect } = require('@playwright/test');
const { installApiMocks, seedAuthenticatedSession } = require('./support/mockApi');

async function setup(page, role = 'client') {
  const ctx = await installApiMocks(page, { user: { role, countryId: 1, regionId: null } });
  await seedAuthenticatedSession(page, ctx.user, ctx.token);
  await page.addInitScript(() => {
    localStorage.setItem('teranga_lang', 'fr'); localStorage.setItem('i18nextLng', 'fr');
    localStorage.setItem('teranga_analytics_consent', 'denied');
  });
  return ctx;
}


function workspaceItem(id, title, action = null, extra = {}) {
  return { id, key: 'service:' + id, kind: 'service', title, status: action?.code === 'result_review' ? 'completed' : 'in_progress', openStepCount: 0, action, ...extra };
}

for (const width of [360, 1440]) {
  test('client has one work queue and request shortcuts at ' + width + 'px', async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const ctx = await setup(page);
    ctx.state.workspaceItems = [workspaceItem(1, 'Intervention à vérifier', { code: 'result_review', kind: 'service', id: 1 }), workspaceItem(2, 'Démarche en cours')];
    const redundantReads = [];
    page.on('request', (request) => { if (/\/services\/me(?:\?|$)/.test(request.url())) redundantReads.push(request.url()); });
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/operations$/);
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'Centre des opérations', exact: true })).toBeVisible();
    await expect(main.getByRole('link', { name: 'Vérifier le résultat', exact: true })).toHaveAttribute('href', '/services/1');
    await expect(main.getByRole('article')).toHaveCount(1);
    await expect(main.getByRole('link', { name: 'Nouvelle demande', exact: true })).toHaveAttribute('href', '/demandes/nouvelle');
    await main.getByText('Taxi ou livraison', { exact: true }).click();
    await expect(main.locator('a[href="/taxi"]')).toBeVisible();
    await expect(main.locator('a[href="/livraison"]')).toBeVisible();
    await main.getByRole('button', { name: /^À suivre/ }).click();
    await expect(main.getByText('Démarche en cours', { exact: true })).toBeVisible();
    expect(redundantReads).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath('client-home.png'), fullPage: true });
  });
}

test('agent availability changes once without reading a second assignment list', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await setup(page, 'agent');
  let available = false, saved = null;
  const duplicateReads = [];
  page.on('request', (request) => { if (/\/(?:services\/agent\/services|operations\/agent\/assignments)(?:\?|$)/.test(request.url())) duplicateReads.push(request.url()); });
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
    if (path !== '/operations/agent/capacity') return route.fallback();
    if (route.request().method() === 'PATCH') { saved = route.request().postDataJSON(); available = saved.available; }
    return route.fulfill({ json: { capacity: { available, maxConcurrent: 2, availableUntil: available ? '2030-01-01T12:00:00Z' : null }, activeAssignments: 0 } });
  });
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/operations$/);
  await page.getByText('Durée et capacité', { exact: true }).click();
  await page.getByLabel('Pour une durée de').selectOption('120');
  await page.getByText('Durée et capacité', { exact: true }).click();
  await page.getByRole('button', { name: 'Me rendre disponible', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Me rendre indisponible', exact: true })).toBeVisible();
  expect(saved).toEqual({ available: true, availableMinutes: 120 });
  expect(duplicateReads).toEqual([]);
  await expect(page.getByLabel('Capacité simultanée')).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('agent-home.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
});

test('provider has one work queue and availability while the mission archive remains accessible', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 900 });
  const ctx = await setup(page, 'provider');
  ctx.state.workspaceItems = [workspaceItem(10, 'Réparation en cours', { code: 'service_execute', kind: 'service', id: 10 }, { missionStatus: 'IN_PROGRESS', slug: 'plomberie' })];
  let available = false;
  const missionReads = [];
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api(?:\/v1)?/, '');
    if (path === '/providers/me/availability') available = route.request().postDataJSON().availabilityStatus === 'available';
    if (path === '/providers/me' || path === '/providers/me/availability') return route.fulfill({ json: { provider: { id: 4, availabilityStatus: available ? 'available' : 'offline' } } });
    if (path === '/providers/me/dispatch-presence') return route.fulfill({ json: { eligibleVehicles: [] } });
    if (path === '/missions/mine') {
      missionReads.push(url.search);
      const history = url.searchParams.get('view') === 'history';
      return route.fulfill({ json: { missions: [{ id: 10, title: history ? 'Ancien travail' : 'Réparation en cours', missionStatus: history ? 'VALIDATED' : 'IN_PROGRESS', tradeCategory: { name: 'Plomberie', slug: 'plomberie' } }], pagination: { total: 1 } } });
    }
    return route.fallback();
  });
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Centre des opérations', exact: true })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Réparation en cours', exact: true })).toBeVisible();
  expect(missionReads).toEqual([]);
  await page.getByRole('button', { name: 'Me rendre disponible', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Me rendre indisponible', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('provider-home.png'), fullPage: true });
  await page.goto('/prestataire/services');
  await page.getByRole('button', { name: 'Voir les demandes terminées' }).click();
  await expect(page.getByText('Ancien travail')).toBeVisible();
  await expect(page.getByText('Réparation en cours')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Me rendre disponible', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
});

for (const width of [360, 1440]) {
  test('management tools remain usable when figures fail at ' + width + 'px', async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page, 'admin');
    const reads = [];
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path !== '/dashboard/summary' && path !== '/transactions/summary') return route.fallback();
      reads.push(path); return route.fulfill({ status: 503, json: { error: 'Indisponible' } });
    });
    await page.goto('/gestion');
    const main = page.getByRole('main');
    await expect(main.getByRole('link', { name: 'Traiter les demandes', exact: true })).toHaveAttribute('href', '/operations');
    expect(reads).toEqual([]);
    await expect(main.getByRole('link', { name: 'Agents', exact: true })).toBeHidden();
    await main.getByText('Outils de gestion', { exact: true }).click();
    await expect(main.getByRole('link', { name: 'Agents', exact: true })).toBeVisible();
    await expect(main.locator('a[href="/admin/metrics"]')).toHaveCount(0);
    await expect(main.locator('a[href="/admin/onboarding"]')).toHaveCount(0);
    await main.getByText('Consulter les montants par devise', { exact: true }).click();
    await expect(main.getByRole('alert')).toContainText('Le résumé financier est indisponible');
    await expect(main.getByRole('link', { name: 'Traiter les demandes', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath('management-home.png'), fullPage: true });
  });
}

test('the single queue shows every result requiring review', async ({ page }) => {
  const ctx = await setup(page);
  ctx.state.workspaceItems = Array.from({ length: 5 }, (_, index) => workspaceItem(index + 10, 'Résultat à examiner ' + (index + 1), { code: 'result_review', kind: 'service', id: index + 10 }));
  await page.goto('/dashboard');
  await expect(page.getByRole('main').getByRole('article')).toHaveCount(5);
  await expect(page.getByText('Résultat à examiner 5', { exact: true })).toBeVisible();
});

test('the operations overview keeps overlapping identifiers tied to their request type', async ({ page }) => {
  await setup(page, 'admin');
  let updatedPath;
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api(?:\/v1)?/, '');
    if (path === '/operations/readiness') return route.fulfill({ json: { ready: false, issues: [] } });
    if (path === '/service-catalog/admin') return route.fulfill({ json: { catalog: [] } });
    if (path === '/users') return route.fulfill({ json: { users: [] } });
    if (path === '/operations/work/project/9') { updatedPath = path; return route.fulfill({ json: { coordination: {} } }); }
    if (path === '/operations') {
      const type = url.searchParams.get('entityType');
      return route.fulfill({ json: { items: [{ id: 9, title: `Dossier ${type}`, status: 'created', coordination: { state: 'escalated' } }], pagination: { total: 1 } } });
    }
    return route.fallback();
  });
  await page.goto('/admin/operations');
  await expect(page.getByRole('link', { name: /Dossier service/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Dossier order/ })).toBeVisible();
  await page.getByRole('article', { name: /Dossier project/ }).getByRole('button', { name: 'Prendre en charge' }).click();
  await expect.poll(() => updatedPath).toBe('/operations/work/project/9');
});

test('reloading after a lost creation response resumes the same request key', async ({ page }) => {
  await setup(page);
  const keys = [];
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
    if (path === '/trade-categories') return route.fulfill({ json: { tradeCategories: [{ id: 8, name: 'Plomberie', slug: 'plomberie' }] } });
    if (path === '/service-catalog') return route.fulfill({ json: { configured: true, catalog: [{ definition: { legacyTradeCategoryId: 8 } }] } });
    if (path === '/regions') return route.fulfill({ json: { regions: [] } });
    if (path === '/saved-locations') return route.fulfill({ json: { savedLocations: [] } });
    if (path === '/missions/estimate') return route.fulfill({ json: { estimate: { pricingMode: 'quote_only', currency: 'XOF', estimatedDelayMinutes: 60 } } });
    if (path === '/missions' && route.request().method() === 'POST') {
      keys.push(route.request().postDataJSON().requestKey);
      if (keys.length === 1) return route.abort('failed');
      return route.fulfill({ json: { mission: { id: 805, missionStatus: 'CREATED' } } });
    }
    return route.fallback();
  });
  await page.goto('/demandes/nouvelle');
  await page.getByRole('button', { name: 'Plomberie', exact: true }).click();
  await page.getByRole('button', { name: 'Suivant', exact: true }).click();
  await page.getByLabel('Votre besoin en une phrase').fill('Réparer une fuite');
  await page.getByRole('button', { name: 'Suivant', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmer la mission' }).click();
  await expect.poll(() => keys.length).toBe(1);
  await page.reload();
  await expect(page.getByText(/Votre saisie précédente a été retrouvée/)).toBeVisible();
  await page.getByRole('button', { name: 'Plomberie', exact: true }).click();
  await page.getByRole('button', { name: 'Suivant', exact: true }).click();
  await expect(page.getByLabel('Votre besoin en une phrase')).toHaveValue('Réparer une fuite');
  await page.getByRole('button', { name: 'Suivant', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmer la mission' }).click();
  await expect(page.getByRole('link', { name: 'Suivre ma mission' })).toHaveAttribute('href', '/missions/805/track');
  expect(keys).toHaveLength(2);
  expect(keys[1]).toBe(keys[0]);
});
