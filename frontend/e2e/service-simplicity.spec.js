const { test, expect } = require('@playwright/test');
const { installApiMocks, seedAuthenticatedSession } = require('./support/mockApi');

for (const width of [360, 1440]) {
  test(`service request keeps three steps and confirmation at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const context = await installApiMocks(page);
    await seedAuthenticatedSession(page, context.user, context.token);
    await page.addInitScript(() => {
      localStorage.setItem('teranga_lang', 'fr');
      localStorage.setItem('i18nextLng', 'fr');
      localStorage.setItem('teranga_analytics_consent', 'denied');
    });
    let creations = 0;
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      if (path === '/trade-categories') return json({ tradeCategories: [{ id: 8, name: 'Plomberie', slug: 'plomberie' }] });
      if (path === '/service-catalog') return json({ configured: true, catalog: [{ definition: { legacyTradeCategoryId: 8 } }] });
      if (path === '/regions') return json({ regions: [] });
      if (path === '/saved-locations') return json({ savedLocations: [] });
      if (path === '/missions/estimate') return json({ estimate: { pricingMode: 'quote_only', currency: 'XOF', estimatedDelayMinutes: 60 } });
      if (path === '/missions' && route.request().method() === 'POST') {
        creations += 1;
        expect(route.request().postDataJSON()).toMatchObject({ title: 'Réparer une fuite', countryId: 1, tradeCategoryId: 8 });
        return json({ mission: { id: 803, missionStatus: 'CREATED' } });
      }
      return route.fallback();
    });

    await page.goto('/demandes/nouvelle');
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '3');
    await page.getByRole('button', { name: 'Plomberie', exact: true }).click();
    await page.getByRole('button', { name: 'Suivant', exact: true }).click();
    await page.getByLabel('Votre besoin en une phrase').fill('Réparer une fuite');
    await expect(page.locator('#mission-description')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Préciser sur la carte' })).toBeVisible();
    await expect(page.locator('script[src*="maps.googleapis.com"]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Suivant', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Confirmez votre demande' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Confirmez votre demande' })).toBeFocused();
    expect(creations).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: testInfo.outputPath('service-confirmation.png'), fullPage: true });
    await page.getByRole('button', { name: 'Confirmer la mission', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Suivre ma mission' })).toHaveAttribute('href', '/missions/803/track');
    expect(creations).toBe(1);
  });
}
