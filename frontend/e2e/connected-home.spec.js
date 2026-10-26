const { test, expect } = require('@playwright/test');
const { installApiMocks, seedAuthenticatedSession } = require('./support/mockApi');

for (const role of ['client', 'agent', 'provider', 'admin']) {
  test(`${role} signs in directly to the operations centre`, async ({ page }) => {
    const ctx = await installApiMocks(page, { user: { role } });
    await page.goto('/login');
    await page.locator('form input[type="text"]').fill(ctx.user.email);
    await page.locator('form input[type="password"]').fill('Password123!');
    await page.locator('form button[type="submit"]').click();
    await expect(page).toHaveURL(/\/operations$/);
    await expect(page.getByRole('heading', { name: 'Centre des opérations', exact: true })).toBeVisible();
    await expect(page.getByRole('main').getByText('Bonjour E2E', { exact: true })).toBeVisible();
  });
}

test('login preserves the exact protected dossier destination', async ({ page }) => {
  const ctx = await installApiMocks(page);
  await page.goto('/orders/801?source=partage#preuves');
  await expect(page).toHaveURL(/\/login$/);
  await page.locator('form input[type="text"]').fill(ctx.user.email);
  await page.locator('form input[type="password"]').fill('Password123!');
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/orders\/801\?source=partage#preuves$/);
  await expect(page.getByRole('heading', { name: /CMD-E2E-001/ })).toBeVisible();
});

test('the public homepage remains accessible without a session', async ({ page }) => {
  await installApiMocks(page);
  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Centre des opérations', exact: true })).toHaveCount(0);
  await expect(page.locator('a[href="/login"]').first()).toBeVisible();
});

test('a client cannot open management or trigger its financial reads', async ({ page }) => {
  const ctx = await installApiMocks(page);
  await seedAuthenticatedSession(page, ctx.user, ctx.token);
  const financialReads = [], notificationWrites = [];
  page.on('request', (request) => {
    if (/\/(dashboard\/summary|transactions\/summary|admin\/metrics)(?:\?|$)/.test(request.url())) financialReads.push(request.url());
    if (/\/notifications\//.test(request.url()) && request.method() !== 'GET') notificationWrites.push(request.url());
  });
  await page.goto('/gestion');
  await expect(page).toHaveURL(/\/operations$/);
  await expect(page.getByRole('heading', { name: 'Centre des opérations', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Votre disponibilité', exact: true })).toHaveCount(0);
  expect(financialReads).toEqual([]);
  expect(notificationWrites).toEqual([]);
});

test('an unavailable provider profile does not block work in the queue', async ({ page }) => {
  const ctx = await installApiMocks(page, { user: { role: 'provider' } });
  ctx.state.workspaceItems = [{ id: 10, key: 'service:10', kind: 'service', title: 'Intervention prioritaire', missionStatus: 'IN_PROGRESS', slug: 'plomberie', action: { code: 'service_execute', kind: 'service', id: 10 } }];
  await seedAuthenticatedSession(page, ctx.user, ctx.token);
  await page.route('**/api/v1/providers/me', (route) => route.fulfill({ status: 503, json: { error: 'Indisponible' } }));
  await page.goto('/operations');
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
  await expect(page.getByRole('article', { name: 'Intervention prioritaire', exact: true }).locator('a[href="/missions/10/track"]').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Me rendre disponible', exact: true })).toHaveCount(0);
});
