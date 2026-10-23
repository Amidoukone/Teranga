const { test, expect } = require('@playwright/test');
const { installApiMocks, seedAuthenticatedSession } = require('./support/mockApi');

test('Mali to Côte d’Ivoire changes the request scope and never reuses Mali rows or regions', async ({ page }) => {
  const context = await installApiMocks(page, { user: { role: 'admin', countryId: null, regionId: null } });
  await seedAuthenticatedSession(page, context.user, context.token);
  await page.addInitScript(() => {
    localStorage.setItem('teranga_lang', 'fr'); localStorage.setItem('i18nextLng', 'fr');
    localStorage.setItem('teranga_geo_scope', JSON.stringify({ countryId: 1, regionId: 10 }));
    localStorage.setItem('teranga_analytics_consent', 'denied');
  });
  let lastScope;
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api(?:\/v1)?/, '');
    const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/countries') return json({ countries: [{ id: 1, name: 'Mali', isoCode: 'ML', isActive: true }, { id: 2, name: 'Côte d’Ivoire', isoCode: 'CI', isActive: true }] });
    if (path === '/regions') return json({ regions: url.searchParams.get('countryId') === '2' ? [{ id: 20, countryId: 2, name: 'Abidjan' }] : [{ id: 10, countryId: 1, name: 'Bamako' }] });
    if (path === '/operations/readiness') return json({ ready: false, issues: [] });
    if (path === '/service-catalog/admin') return json({ catalog: [] });
    if (path === '/operations') {
      lastScope = { countryId: url.searchParams.get('countryId'), regionId: url.searchParams.get('regionId') };
      const items = lastScope.countryId === '2' ? [] : [{ id: 501, title: 'Dossier existant au Mali', country: { name: 'Mali' }, coordination: { state: 'waiting' } }];
      return json({ items, pagination: { total: items.length } });
    }
    return route.fallback();
  });
  await page.goto('/admin/operations');
  await expect(page.getByRole('link', { name: /Dossier existant au Mali/ })).toBeVisible();
  await page.locator('#geo-country').selectOption('2');
  await expect(page.getByText(/Aucune demande dans ce périmètre|No requests in this territory/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Dossier existant au Mali/ })).toHaveCount(0);
  expect(lastScope).toEqual({ countryId: '2', regionId: null });
  await expect(page.locator('#geo-region option', { hasText: 'Bamako' })).toHaveCount(0);
  await page.locator('#geo-region').selectOption('20');
  await expect.poll(() => lastScope).toEqual({ countryId: '2', regionId: '20' });
  await page.locator('#geo-country').selectOption('1');
  await expect(page.getByRole('link', { name: /Dossier existant au Mali/ })).toBeVisible();
  expect(lastScope).toEqual({ countryId: '1', regionId: null });
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`operations can take responsibility at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const context = await installApiMocks(page, { user: { role: 'admin', countryId: 1, regionId: null } });
    await seedAuthenticatedSession(page, context.user, context.token);
    await page.addInitScript(() => { localStorage.setItem('teranga_lang', 'fr'); localStorage.setItem('i18nextLng', 'fr'); localStorage.setItem('teranga_analytics_consent', 'denied'); });
    let owned = false;
    let orderOwned = false;
    let orderAssigned = false;
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      if (path === '/countries') return json({ countries: [{ id: 1, name: 'Mali', isoCode: 'ML', isActive: true }] });
      if (path === '/operations/readiness') return json({ ready: false, issues: [{ code: 'ASSISTANCE_MISSING', message: 'Assistance locale à renseigner' }] });
      if (path === '/service-catalog/admin') return json({ catalog: [] });
      if (path === '/users') return json({ users: [{ id: 42, role: 'agent', firstName: 'Awa', countryId: 1, regionId: null }] });
      if (path === '/operations/work/order/501' && route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON();
        if (body.executorUserId) {
          expect(body).toEqual({ executorUserId: 42, mode: 'manual', policy: { stageMinutes: 120 } });
          orderAssigned = true;
        } else expect(body).toEqual({ mode: 'manual', ownerUserId: context.user.id });
        orderOwned = true; return json({ coordination: { state: 'accepted' } });
      }
      if (path === '/operations/501' && route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON();
        expect(body).toEqual({ mode: 'manual', ownerUserId: context.user.id });
        owned = true; return json({ coordination: { state: 'accepted' } });
      }
      if (path === '/operations') {
        if (new URL(route.request().url()).searchParams.get('entityType') === 'order') return json({ items: [{ id: 501, entityType: 'order', title: 'Commande terrain', status: 'created', countryId: 1, country: { name: 'Mali' }, coordination: { state: orderOwned ? 'accepted' : 'waiting', owner: orderOwned ? { email: context.user.email } : null, executorUserId: orderAssigned ? 42 : null, policy: { stageMinutes: orderAssigned ? 120 : 60 } } }], pagination: { total: 1 } });
        return json({ items: [{ id: 501, title: 'Vérification avant travaux', executionType: 'provider', missionStatus: 'CREATED', country: { name: 'Mali' }, coordination: { state: owned ? 'accepted' : 'escalated', owner: owned ? { email: context.user.email } : null } }], pagination: { total: 1 } });
      }
      return route.fallback();
    });
    await page.goto('/admin/operations');
    await expect(page.getByRole('heading', { name: /Centre des opérations|Operations centre/i })).toBeVisible();
    await expect(page.getByText('Assistance locale à renseigner')).toBeVisible();
    await expect(page.getByRole('link', { name: /Vérification avant travaux/ })).toBeVisible();
    await page.getByRole('button', { name: /Prendre en charge|Take ownership/i }).click();
    await expect(page.getByText(context.user.email, { exact: false }).last()).toBeVisible();
    await expect.poll(() => owned).toBe(true);
    await page.getByLabel(/Type de demande|Request type/i).selectOption('order');
    await expect(page.getByRole('link', { name: /Commande terrain/ })).toHaveAttribute('href', '/orders/501');
    await page.getByRole('button', { name: /Prendre en charge|Take ownership/i }).click();
    await expect.poll(() => orderOwned).toBe(true);
    await page.getByLabel(/Agent chargé de la demande|Assigned agent/i).selectOption('42');
    await page.getByLabel(/Délai par étape|Time per stage/i).fill('120');
    await page.getByRole('button', { name: /^(Enregistrer|Save)$/i }).click();
    await expect.poll(() => orderAssigned).toBe(true);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow).toBe(false);
  });
}
