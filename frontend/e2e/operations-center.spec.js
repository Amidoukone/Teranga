const { test, expect } = require('@playwright/test');
const { installApiMocks, seedAuthenticatedSession } = require('./support/mockApi');

for (const role of ['client', 'provider']) {
  for (const width of [360, 1440]) {
    test(`${role}: one centre for reading and history at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const ctx = await installApiMocks(page, { user: { role } });
      ctx.state.notifications[0].title = 'Compte rendu disponible';
      ctx.state.notifications[0].progress = 'done';
      const writes = [];
      page.on('request', (request) => { if (request.method() === 'PATCH' && request.url().includes('/notifications')) writes.push(request.url()); });
      await seedAuthenticatedSession(page, ctx.user, ctx.token);
      await page.goto('/notifications');
      await expect(page).toHaveURL(/\/operations\?vue=a-lire$/);
      const main = page.getByRole('main');
      await expect(main.getByRole('heading', { name: 'Centre des opérations', exact: true })).toBeVisible();
      const card = main.getByRole('article', { name: 'Compte rendu disponible' });
      await expect(card).toBeVisible();
      expect(writes).toHaveLength(0);
      await expect(page.locator('a[href="/notifications"], a[href="/activities"], a[href="/admin/operations"]')).toHaveCount(0);
      await expect(main.getByRole('button', { name: 'Demandes à coordonner' })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
      await page.screenshot({ path: testInfo.outputPath('operations-center.png'), fullPage: true });
      await card.getByRole('button', { name: 'Marquer comme lu', exact: true }).click();
      await expect(main.getByRole('heading', { name: 'Vous êtes à jour' })).toBeVisible();
      await main.getByRole('button', { name: 'Tout le suivi', exact: true }).click();
      await expect(main.getByRole('article', { name: 'Compte rendu disponible' })).toHaveCount(1);
      expect(ctx.state.services[0].status).toBe('pending');
    });
  }
}

test('an activity bookmark opens the unified history including read information', async ({ page }) => {
  const ctx = await installApiMocks(page);
  ctx.state.notifications[0].status = 'read';
  await seedAuthenticatedSession(page, ctx.user, ctx.token);
  await page.goto('/activities');
  await expect(page).toHaveURL(/\/operations\?vue=historique$/);
  await expect(page.getByRole('article', { name: ctx.state.notifications[0].metadata.title })).toBeVisible();
});

test('a personal account cannot request the administrative queue through a view parameter', async ({ page }) => {
  const ctx = await installApiMocks(page);
  const queueRequests = [];
  page.on('request', (request) => {
    if (/\/api(?:\/v1)?\/operations(?:\?|$)/.test(request.url())) queueRequests.push(request.url());
  });
  await seedAuthenticatedSession(page, ctx.user, ctx.token);
  await page.goto('/operations?vue=coordonner');
  await expect(page.getByRole('button',{name:/^À faire/})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Aucune action pour le moment'})).toBeVisible();
  await expect(page.getByRole('button', { name: 'Demandes à coordonner' })).toHaveCount(0);
  expect(queueRequests).toHaveLength(0);
});
