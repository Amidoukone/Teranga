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
      const review = new URL(route.request().url()).searchParams.get('view') === 'review';
      return route.fulfill({ json: { services: review ? [{ id: 1, title: 'Intervention à vérifier', status: 'completed' }] : [{ id: 2, title: 'Démarche en cours', status: 'in_progress' }], pagination: { total: 1 } } });
    });
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Une réponse est attendue de votre part' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Vérifier le résultat' })).toHaveAttribute('href', '/services/1');
    await expect(page.getByRole('heading', { name: /Vos demandes en cours/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Demander un service', exact: true })).toBeVisible();
    await expect(page.getByText('Compléter le profil', { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath('client-home.png'), fullPage: true });
  });
}

test('agent home declares availability in one action without changing capacity', async ({ page }, testInfo) => {
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
  await page.screenshot({ path: testInfo.outputPath('agent-home.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
});

test('provider home shows current jobs before history and can become available', async ({ page }, testInfo) => {
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
  await expect(page.getByRole('link', { name: 'Poursuivre l’intervention', exact: true })).toHaveAttribute('href', '/missions/10/track');
  await page.screenshot({ path: testInfo.outputPath('provider-home.png'), fullPage: true });
  await page.getByRole('button', { name: 'Me rendre disponible', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Me rendre indisponible', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Voir les demandes terminées' }).click();
  await expect(page.getByText('Ancien travail')).toBeVisible();
  await expect(page.getByText('Réparation en cours')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
});

for (const width of [360, 1440]) {
  test(`management keeps operational actions usable when financial figures fail at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page, 'admin');
    const reads = [];
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/dashboard/summary' || path === '/transactions/summary') {
        reads.push(path);
        return route.fulfill({ status: 503, json: { error: 'Indisponible' } });
      }
      return route.fallback();
    });
    await page.goto('/dashboard');
    const main = page.getByRole('main');
    await expect(main.getByRole('link', { name: 'Traiter les demandes', exact: true })).toHaveAttribute('href', '/operations');
    expect(reads).toEqual([]);
    await expect(main.getByRole('link', { name: 'Agents', exact: true })).toBeHidden();
    await main.getByText('Outils de gestion', { exact: true }).click();
    await expect(main.getByRole('link', { name: 'Agents', exact: true })).toBeVisible();
    await main.getByText('Consulter les montants par devise', { exact: true }).click();
    await expect(main.getByRole('alert')).toContainText('Le résumé financier est indisponible');
    await expect(main.getByRole('link', { name: 'Traiter les demandes', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath('management-home.png'), fullPage: true });
  });
}

test('the client can open all results requiring review from a bounded home preview', async ({ page }) => {
  await setup(page);
  const rows = Array.from({ length: 5 }, (_, index) => ({ id: index + 10, title: `Résultat à examiner ${index + 1}`, status: 'completed' }));
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (!/\/services\/me$/.test(url.pathname)) return route.fallback();
    const review = url.searchParams.get('view') === 'review';
    return route.fulfill({ json: { services: review ? rows.slice(0, Number(url.searchParams.get('limit') || 100)) : [], pagination: { total: review ? 5 : 0 } } });
  });
  await page.goto('/dashboard');
  const main = page.getByRole('main');
  await expect(main.getByRole('article')).toHaveCount(3);
  await main.getByRole('link', { name: 'Voir les 5 résultats à vérifier', exact: true }).click();
  await expect(page).toHaveURL(/\/demandes\?vue=a-verifier$/);
  await expect(main.getByText('Résultat à examiner 5')).toBeVisible();
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
