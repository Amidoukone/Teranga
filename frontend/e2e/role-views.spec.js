const { test, expect } = require('@playwright/test');
const { installApiMocks, seedAuthenticatedSession } = require('./support/mockApi');

const roles = {
  client: { title: 'Mon suivi', action: 'result_review', cta: 'Vérifier le résultat' },
  agent: { title: 'Mon travail', action: 'service_execute', cta: 'Continuer la réalisation' },
  provider: { title: 'Mon activité', action: 'service_execute', cta: 'Continuer la réalisation' },
  admin: { title: 'Pilotage', action: 'coordinate', cta: 'Organiser la prise en charge' },
};

async function setup(page, role, dark = false) {
  const ctx = await installApiMocks(page, { user: { role, countryId: 1 } });
  await seedAuthenticatedSession(page, ctx.user, ctx.token);
  await page.addInitScript(({ dark }) => {
    localStorage.setItem('teranga_lang', 'fr'); localStorage.setItem('i18nextLng', 'fr');
    localStorage.setItem('teranga_analytics_consent', 'denied');
    localStorage.setItem('teranga_theme', dark ? 'dark' : 'light');
  }, { dark });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
    if (path === '/providers/me') return route.fulfill({ json: { provider: { id: 4, availabilityStatus: 'offline' } } });
    if (path === '/providers/me/dispatch-presence') return route.fulfill({ json: { eligibleVehicles: [] } });
    if (path === '/operations/agent/capacity') return route.fulfill({ json: { capacity: { available: false, maxConcurrent: 2 }, activeAssignments: 1 } });
    return route.fallback();
  });
  return ctx;
}

for (const [role, view] of Object.entries(roles)) {
  for (const width of [360, 1440]) {
    test(`${role}: primary work is visible immediately at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const ctx = await setup(page, role);
      ctx.state.workspaceItems = [{ id: 501, key: 'service:501', kind: 'service', title: 'Réparer la fuite de la cuisine', status: 'in_progress', missionStatus: 'IN_PROGRESS', slug: 'plomberie', openStepCount: 0, action: { code: view.action, kind: 'service', id: 501 } }];
      await page.goto('/operations');
      const main = page.getByRole('main');
      await expect(main.getByRole('heading', { name: view.title, exact: true })).toBeVisible();
      const card = main.getByRole('article', { name: 'Réparer la fuite de la cuisine', exact: true });
      const action = card.getByRole('link', { name: view.cta, exact: true });
      await expect(action).toBeInViewport();
      // The main action must also stay above the fixed mobile navigation.
      if (width === 360) {
        const actionBox = await action.boundingBox();
        const bottomNav = await page.locator('nav.fixed').boundingBox();
        if (bottomNav) expect(actionBox.y + actionBox.height).toBeLessThanOrEqual(bottomNav.y);
      }
      const fieldRole = role === 'provider' || role === 'agent';
      await expect(main.getByRole('region', { name: 'Votre disponibilité', exact: true })).toHaveCount(fieldRole ? 1 : 0);
      if (fieldRole && width === 1440) {
        const availability = await main.locator('#workspace-availability').boundingBox();
        const queue = await card.boundingBox();
        expect(availability.x).toBeGreaterThan(queue.x + queue.width);
      }
      await expect(main.getByRole('textbox', { name: 'Rechercher un dossier, une étape ou une référence' })).toBeVisible();
      await expect(main.getByRole('combobox', { name: 'Type de dossier' })).toBeVisible();
      if (role === 'admin') {
        await expect(page.locator('nav:visible a[href="/admin/taxi-dispatch"]')).toHaveCount(0);
        await expect(page.locator('nav:visible a[href="/admin/delivery-dispatch"]')).toHaveCount(0);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
      await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true });
    });
  }
}

test('agent supervision never offers provider acceptance or execution', async ({ page }) => {
  await setup(page, 'agent');
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
    if (path === '/missions/mine') return route.fulfill({ json: { missions: [{ id: 31, title: 'Course supervisée', missionStatus: 'ASSIGNED', acceptanceDeadlineAt: '2099-01-01T12:00:00Z', tradeCategory: { slug: 'mobilite' } }], pagination: { total: 1 } } });
    if (path === '/missions/31/track') return route.fulfill({ json: { missionId: 31, title: 'Course supervisée', missionStatus: 'ASSIGNED', viewerRole: 'agent', isExecutor: false, acceptanceDeadlineAt: '2099-01-01T12:00:00Z', tradeCategorySlug: 'mobilite', completion: { evidence: [], ready: false }, location: { address: 'Gare' }, client: { firstName: 'Awa' } } });
    return route.fallback();
  });
  const writes = [];
  page.on('request', request => { if (request.url().includes('/missions/') && request.method() !== 'GET') writes.push(request.url()); });
  await page.goto('/missions/mine');
  await expect(page.getByRole('heading', { name: 'Missions supervisées', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Superviser le dossier', exact: true }).click();
  await expect(page).toHaveURL(/\/missions\/31\/track$/);
  await expect(page.getByRole('main').getByText(/seul le prestataire assigné/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Accepter|Refuser|Démarrer|Commencer|Terminer/ })).toHaveCount(0);
  expect(writes).toEqual([]);
});

test('compact provider tools remain usable in dark mode on a phone', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await setup(page, 'provider', true);
  await page.goto('/operations');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Me rendre disponible', exact: true })).toBeVisible();
  await page.getByText('Options de disponibilité', { exact: true }).click();
  await expect(page.getByText('Options de disponibilité', { exact: true }).locator('..').locator('p')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('provider-dark.png'), fullPage: true });
});
