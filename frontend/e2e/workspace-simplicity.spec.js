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

for (const width of [360, 1440]) {
  test(`client home prioritizes requests and review at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path !== '/services/me') return route.fallback();
      return route.fulfill({ json: { services: [{ id: 1, title: 'Intervention à vérifier', status: 'completed' }, { id: 2, title: 'Démarche en cours', status: 'in_progress' }], pagination: { total: 2 } } });
    });
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Une réponse est attendue de votre part' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Vérifier le résultat' })).toHaveAttribute('href', '/services/1');
    await expect(page.getByRole('heading', { name: 'Vos demandes en cours' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Demander un service', exact: true })).toBeVisible();
    await expect(page.getByText('Compléter le profil', { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath('client-home.png'), fullPage: true });
  });
}

test('agent home declares availability in one action without changing capacity', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await setup(page, 'agent');
  let available = false;
  let saved = null;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
    if (path === '/services/agent/services') return route.fulfill({ json: { services: [] } });
    if (path === '/operations/agent/assignments') return route.fulfill({ json: { items: [] } });
    if (path === '/operations/agent/capacity') {
      if (route.request().method() === 'PATCH') { saved = route.request().postDataJSON(); available = saved.available; }
      return route.fulfill({ json: { capacity: { available, maxConcurrent: 2, availableUntil: available ? '2030-01-01T12:00:00Z' : null }, activeAssignments: 0 } });
    }
    return route.fallback();
  });
  await page.goto('/dashboard');
  await page.getByLabel('Pour une durée de').selectOption('120');
  await page.getByRole('button', { name: 'Me rendre disponible', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Me rendre indisponible', exact: true })).toBeVisible();
  expect(saved).toEqual({ available: true, availableMinutes: 120 });
  await expect(page.getByLabel('Capacité simultanée')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
});

test('provider home shows current jobs before history and can become available', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await setup(page, 'provider');
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api(?:\/v1)?/, '');
    if (path === '/providers/me') return route.fulfill({ json: { provider: { id: 4, availabilityStatus: 'offline' } } });
    if (path === '/providers/me/availability') return route.fulfill({ json: { provider: { id: 4, availabilityStatus: 'available' } } });
    if (path === '/providers/me/dispatch-presence') return route.fulfill({ json: { eligibleVehicles: [] } });
    if (path === '/missions/mine') return route.fulfill({ json: { missions: [{ id: 10, title: url.searchParams.get('view') === 'history' ? 'Ancien travail' : 'Réparation en cours', missionStatus: url.searchParams.get('view') === 'history' ? 'VALIDATED' : 'IN_PROGRESS', tradeCategory: { name: 'Plomberie', slug: 'plomberie' } }], pagination: { total: 1 } } });
    return route.fallback();
  });
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Mon travail' })).toBeVisible();
  await expect(page.getByText('Réparation en cours')).toBeVisible();
  await page.getByRole('button', { name: 'Me rendre disponible', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Me rendre indisponible', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Voir les demandes terminées' }).click();
  await expect(page.getByText('Ancien travail')).toBeVisible();
  await expect(page.getByText('Réparation en cours')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
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
