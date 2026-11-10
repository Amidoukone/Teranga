const { test, expect } = require('@playwright/test');
const { installApiMocks, seedAuthenticatedSession } = require('./support/mockApi');

for (const role of ['client', 'agent', 'provider', 'admin']) {
  for (const width of [360, 1440]) {
    test(`${role}: centre first and specialized tools preserved at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const ctx = await installApiMocks(page, { user: { role } });
      await seedAuthenticatedSession(page, ctx.user, ctx.token);
      await page.goto('/operations');
      await expect(page.getByRole('heading', { name: { client: 'Mon suivi', agent: 'Mon travail', provider: 'Mon activité', admin: 'Pilotage' }[role], exact: true })).toBeVisible();
      const primary = page.locator('nav:visible');
      await expect(primary.locator('a[href="/operations"]:visible').filter({ hasText: 'Accueil' })).toHaveCount(1);
      await expect(primary.locator('a[href="/tasks"]')).toHaveCount(0);
      await expect(primary.locator('a[href="/dashboard"]')).toHaveCount(0);
      if (role === 'admin') await expect(primary.getByRole('link', { name: 'Gestion', exact: true })).toBeVisible();
      if (role === 'provider') {
        await expect(primary.locator('a[href="/prestataire/interventions"]:visible')).toBeVisible();
        await expect(primary.locator('a[href="/chauffeur/courses"]:visible')).toHaveCount(0);
        await expect(primary.locator('a[href="/livreur/livraisons"]:visible')).toHaveCount(0);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
      const consent = page.getByRole('button', { name: 'Refuser', exact: true });
      if (await consent.isVisible()) await consent.click();
      await page.screenshot({ path: testInfo.outputPath('navigation.png'), fullPage: true });
      if (role === 'admin') {
        await primary.getByRole('link', { name: 'Gestion', exact: true }).click();
        await page.getByRole('main').getByText('Opérations', { exact: true }).click();
        await page.getByRole('main').getByRole('link', { name: 'Interventions et historique', exact: true }).click();
      } else if (role === 'provider') {
        if (width < 768) {
          await page.getByRole('button', { name: 'Ouvrir le menu Plus', exact: true }).click();
          await expect(page.getByRole('dialog').locator('a[href="/settings"]')).toBeVisible();
        } else await expect(page.getByRole('button', { name: 'Plus', exact: true })).toHaveCount(0);
        return;
      } else {
        await page.getByRole('button', { name: width < 768 ? 'Ouvrir le menu Plus' : 'Plus', exact: true }).click();
        await page.getByRole(width < 768 ? 'link' : 'menuitem', { name: 'Interventions et historique', exact: true }).click();
      }
      await expect(page).toHaveURL(/\/tasks$/);
      await expect(page.getByRole('heading', { name: 'Interventions et historique' })).toBeVisible();
    });
  }
}

for (const width of [360, 1440]) {
  test(`a client can open the property and project hub from navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const ctx = await installApiMocks(page, { user: { role: 'client' } });
    await seedAuthenticatedSession(page, ctx.user, ctx.token);
    await page.goto('/operations');
    const consent = page.getByRole('button', { name: 'Refuser', exact: true });
    if (await consent.isVisible()) await consent.click();

    const mobile = width < 768;
    await page.getByRole('button', { name: mobile ? 'Ouvrir le menu Plus' : 'Plus', exact: true }).click();
    const dossierLink = mobile
      ? page.getByRole('dialog').getByRole('link', { name: 'Biens et projets', exact: true })
      : page.getByRole('menuitem', { name: 'Biens et projets', exact: true });
    await dossierLink.click();

    await expect(page).toHaveURL(/\/dossiers$/);
    await expect(page.getByRole('heading', { name: 'Biens et projets', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ouvrir mes biens', exact: true })).toHaveAttribute('href', '/properties');
    await expect(page.getByRole('link', { name: 'Ouvrir mes projets', exact: true })).toHaveAttribute('href', '/projects');
  });
}

test('a non-client cannot open the client dossier hub directly', async ({ page }) => {
  const ctx = await installApiMocks(page, { user: { role: 'agent' } });
  await seedAuthenticatedSession(page, ctx.user, ctx.token);
  await page.goto('/dossiers');

  await expect(page).toHaveURL(/\/operations$/);
  await expect(page.getByRole('heading', { name: 'Mon travail', exact: true })).toBeVisible();
});

test('a property retains its complete intervention archive and the return to page two', async ({ page }) => {
  const ctx = await installApiMocks(page);
  ctx.state.properties = [{ id: 301, title: 'Maison familiale', type: 'house', city: 'Bamako', createdAt: new Date().toISOString() }];
  ctx.state.tasks = Array.from({ length: 23 }, (_, index) => ({ id: 900 + index, propertyId: 301, title: `Relevé ancien ${index + 1}`, status: 'validated', type: 'visit', priority: 'normal' }));
  await seedAuthenticatedSession(page, ctx.user, ctx.token);
  await page.goto('/properties');
  await page.getByRole('link', { name: 'Ouvrir le bien', exact: true }).click();
  await page.getByText('Interventions et historique', { exact: true }).click();
  const history = page.locator('#property-interventions');
  await expect(history.getByRole('article')).toHaveCount(20);
  await history.getByRole('button', { name: 'Suivant', exact: true }).click();
  await expect(history.getByRole('article')).toHaveCount(3);
  await history.getByRole('article', { name: 'Relevé ancien 21', exact: true }).getByRole('link', { name: 'Ouvrir l’intervention', exact: true }).click();
  await expect(page).toHaveURL(/\/tasks\/920$/);
  await expect(page.getByRole('heading', { name: 'Relevé ancien 21', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Retour au dossier du service', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Retour au bien', exact: true }).click();
  await expect(page).toHaveURL(/\/properties\/301\?interventions_page=2#property-interventions$/);
  await expect(history.getByRole('article')).toHaveCount(3);
});
