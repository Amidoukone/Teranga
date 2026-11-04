const { test, expect } = require('@playwright/test');
const { API_BASE_URL, blockExternalTracking, loginAsSeededAdmin, loginAsSeededClient, seedAuthenticatedSession } = require('./support/realApi');
const headers = session => ({ Authorization: `Bearer ${session.token}` });

for (const width of [360, 1440]) {
  test(`delivery information and assistance preserve the correct workspaces at ${width}px`, async ({ page, browser, request }, testInfo) => {
    const client = await loginAsSeededClient(request), admin = await loginAsSeededAdmin(request);
    const categories = await request.get(`${API_BASE_URL}/v1/trade-categories`);
    const category = (await categories.json()).tradeCategories.find(item => item.slug === 'livraison');
    expect(category).toBeTruthy();
    const title = `Colis et assistance ${Date.now()}`;
    const created = await request.post(`${API_BASE_URL}/v1/missions`, { headers: headers(client), data: {
      executionType: 'provider', tradeCategoryId: category.id, title, packageType: 'small',
      recipientName: 'Awa destinataire', recipientPhone: '+22370000004',
      pickupAddress: 'ACI 2000, Bamako', pickupLatitude: 12.6392, pickupLongitude: -8.0029,
      address: 'Badalabougou, Bamako', latitude: 12.6205, longitude: -7.9895,
    } });
    expect(created.status(), await created.text()).toBe(201);
    const mission = (await created.json()).mission;
    const managerContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      const manager = await managerContext.newPage();
      await blockExternalTracking(manager); await seedAuthenticatedSession(manager, admin.user, admin.token);
      await manager.goto('/operations?vue=informations&lecture=tout');
      const notice = manager.getByRole('article').filter({ hasText: title }).filter({ hasText: 'Nouveau service' }).first();
      await notice.getByRole('button', { name: 'Ouvrir le service', exact: true }).click();
      await expect(manager).toHaveURL(new RegExp(`/admin/livraisons\\?demande=${mission.id}$`));

      await page.setViewportSize({ width, height: 900 });
      await blockExternalTracking(page); await seedAuthenticatedSession(page, client.user, client.token);
      await page.goto('/operations?vue=informations&lecture=tout');
      await page.getByRole('article').filter({ hasText: title }).filter({ hasText: 'Nouveau service' }).first().getByRole('button', { name: 'Ouvrir le service', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/livraisons/${mission.id}$`));
      const list = `/demandes?type=delivery&q=${encodeURIComponent(title)}`;
      await page.goto(list);
      await page.getByRole('article', { name: title, exact: true }).getByRole('link', { name: 'Suivre ma demande', exact: true }).click();
      await page.locator('summary').filter({ hasText: 'Besoin d’aide ?' }).click();
      const assistance = page.waitForResponse(response => new URL(response.url()).pathname.endsWith(`/missions/${mission.id}/track`) && new URL(response.url()).searchParams.get('skipEta') === '1');
      await page.getByRole('link', { name: 'Aide pour cette demande', exact: true }).click();
      expect((await assistance).status()).toBe(200);
      await expect(page).toHaveURL(new RegExp(`/help-support\\?demande=${mission.id}&suivi=mission$`));
      await expect(page.getByRole('alert')).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath('assistance-context.png'), fullPage: true });
      await page.getByRole('link', { name: 'Retour au dossier', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/livraisons/${mission.id}$`));
      await page.getByRole('link', { name: /Retour aux demandes/ }).click();
      await expect(page).toHaveURL(url => url.pathname === '/demandes' && url.searchParams.get('type') === 'delivery' && url.searchParams.get('q') === title);
      await expect(page.getByRole('article', { name: title, exact: true })).toBeVisible();
      const track = await request.get(`${API_BASE_URL}/v1/missions/${mission.id}/track?skipEta=1`, { headers: headers(client) });
      expect((await track.json()).missionStatus).toBe('CREATED');
    } finally { await managerContext.close(); }
  });
}
