const { test, expect } = require('@playwright/test');
const { installApiMocks, seedAuthenticatedSession } = require('./support/mockApi');

async function setup(page, role = 'client', global = false) {
  await page.addInitScript(() => {
    localStorage.setItem('teranga_lang', 'fr');
    localStorage.setItem('teranga_analytics_consent', 'denied');
  });
  const ctx = await installApiMocks(page, { user: {
    role, country: 'CI', countryId: global ? null : 2, regionId: global ? null : 2,
    firstName: 'Awa Marie', lastName: 'Kouamé avec un nom très long',
  } });
  await page.route('**/api/countries*', route => route.fulfill({ json: { countries: [{ id: 2, name: 'Côte d’Ivoire', iso2: 'CI', isActive: true }] } }));
  await page.route('**/api/regions*', route => route.fulfill({ json: { regions: [{ id: 2, countryId: 2, name: 'Abidjan' }] } }));
  await seedAuthenticatedSession(page, ctx.user, ctx.token);
  await page.goto('/operations');
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
  return ctx;
}

async function withinViewport(page, locator) {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
}

for (const role of ['client', 'agent', 'provider', 'admin']) {
  for (const width of [360, 768, 1440]) {
    test(`${role}: clear top bar and usable account/territory panels at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 800 });
      await setup(page, role);
      const topbar = page.getByRole('navigation', { name: 'Navigation principale', exact: true });
      await withinViewport(page, topbar);
      expect((await topbar.boundingBox()).height).toBeLessThanOrEqual(66);
      await expect(topbar.getByRole('combobox')).toHaveCount(0);
      await expect(topbar.getByText('Awa Marie', { exact: false })).toHaveCount(0);
      for (const control of [topbar.locator('[aria-controls="user-menu"]'), topbar.locator('[aria-controls="topbar-territory"]'), topbar.locator('a[href="/operations?vue=a-lire"]')]) {
        const box = await control.boundingBox();
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      const trigger = topbar.getByRole('button', { name: 'Menu utilisateur', exact: true });
      await trigger.click();
      const account = page.getByRole('dialog', { name: 'Menu utilisateur', exact: true });
      await expect(account.getByText('Awa Marie Kouamé avec un nom très long')).toBeVisible();
      await expect(account.getByRole('combobox', { name: 'Langue', exact: true })).toBeVisible();
      await expect(account.locator('a[href="/settings"]')).toBeVisible();
      await expect(account.locator('a[href="/account/security"]')).toBeVisible();
      await expect(account.locator('a[href="/help-support"]')).toBeVisible();
      await withinViewport(page, account);
      await expect(account.getByRole('button', { name: 'Fermer le menu', exact: true })).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(account.getByRole('menuitem', { name: 'Déconnexion', exact: true })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(account.getByRole('button', { name: 'Fermer le menu', exact: true })).toBeFocused();
      await page.screenshot({ path: testInfo.outputPath('account.png') });
      await page.keyboard.press('Escape');
      await expect(account).toBeHidden();
      await expect(trigger).toBeFocused();
      await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');

      const territory = topbar.locator('[aria-controls="topbar-territory"]');
      await territory.click();
      const scope = page.getByRole('dialog', { name: 'Pays et région d’intervention', exact: true });
      await expect(scope.getByText('Côte d’Ivoire', { exact: true })).toBeVisible();
      await expect(scope.getByText('Abidjan', { exact: false })).toBeVisible();
      await expect(scope.getByRole('combobox')).toHaveCount(0);
      await withinViewport(page, scope);
      await trigger.click();
      await expect(scope).toBeHidden();
      await expect(account).toBeVisible();
      await account.locator('a[href="/settings"]').click();
      await expect(page).toHaveURL(/\/settings$/);
      await expect(account).toBeHidden();
      await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
    });
  }
}

test('global admin: territory selection persists and language remains accessible in the account', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await setup(page, 'admin', true);
  const territory = page.locator('button[aria-controls="topbar-territory"]');
  await territory.click();
  const scope = page.getByRole('dialog', { name: 'Pays et région d’intervention', exact: true });
  await expect(scope.getByRole('combobox', { name: 'Région', exact: true })).toBeDisabled();
  await scope.getByRole('combobox', { name: 'Pays', exact: true }).selectOption('2');
  await scope.getByRole('combobox', { name: 'Région', exact: true }).selectOption('2');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('teranga_geo_scope')))).toEqual({ countryId: 2, regionId: 2 });
  await page.keyboard.press('Escape');
  await page.locator('button[aria-controls="user-menu"]').click();
  const account = page.locator('#user-menu');
  await account.getByRole('combobox', { name: 'Langue', exact: true }).selectOption('en');
  await expect(account.getByRole('combobox', { name: 'Language', exact: true })).toHaveValue('en');
  await account.getByRole('button', { name: 'Close menu', exact: true }).click();
  await expect(account).toBeHidden();
  await page.reload();
  await page.locator('button[aria-controls="topbar-territory"]').click();
  await expect(page.locator('#topbar-geo-country')).toHaveValue('2');
  await expect(page.locator('#topbar-geo-region')).toHaveValue('2');
});

test('small screen: panels scroll in landscape and navigation unlocks when the viewport changes', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await setup(page);
  const topbar = page.getByRole('navigation', { name: 'Navigation principale', exact: true });
  await withinViewport(page, topbar);
  await page.locator('button[aria-controls="user-menu"]').click();
  await withinViewport(page, page.locator('#user-menu'));
  await page.setViewportSize({ width: 740, height: 360 });
  const account = page.locator('#user-menu');
  await withinViewport(page, account);
  await account.getByRole('menuitem', { name: 'Déconnexion', exact: true }).scrollIntoViewIfNeeded();
  await expect(account.getByRole('menuitem', { name: 'Déconnexion', exact: true })).toBeInViewport();
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1024, height: 800 });
  await topbar.getByRole('button', { name: 'Plus', exact: true }).click();
  await expect(page.locator('#desktop-more-menu')).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(page.locator('#desktop-more-menu')).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
});

test('public top bar keeps login, registration and language usable at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => {
    localStorage.setItem('teranga_lang', 'fr');
    localStorage.setItem('teranga_analytics_consent', 'denied');
  });
  await installApiMocks(page);
  await page.goto('/login');
  const topbar = page.getByRole('navigation', { name: 'Navigation principale', exact: true });
  await expect(topbar.getByRole('link', { name: 'Connexion', exact: true })).toBeVisible();
  await expect(topbar.getByRole('link', { name: /inscription/i })).toBeVisible();
  await expect(topbar.getByRole('combobox', { name: 'Langue', exact: true })).toBeVisible();
  await withinViewport(page, topbar);
});

test('dark mobile account keeps legal links reachable and information opens its own view', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('teranga_theme', 'dark'));
  await setup(page, 'provider');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.locator('button[aria-controls="user-menu"]').click();
  const account = page.locator('#user-menu');
  await expect(account.locator('a[href="/privacy"]')).toHaveCount(0);
  await account.getByRole('button', { name: 'Informations légales', exact: true }).click();
  await expect(account.locator('a[href="/privacy"]')).toBeVisible();
  await expect(account.locator('a[href="/terms"]')).toBeVisible();
  await expect(account.locator('a[href="/legal"]')).toBeVisible();
  await withinViewport(page, account);
  await page.screenshot({ path: testInfo.outputPath('account-dark.png') });
  await page.keyboard.press('Escape');
  const information = page.getByRole('navigation', { name: 'Navigation principale', exact: true }).getByRole('link', { name: 'Informations', exact: true });
  await expect(information).toHaveAccessibleDescription('1 information(s) à lire');
  await information.click();
  await expect(page).toHaveURL(/\/operations\?vue=a-lire$/);
  await expect(page.getByRole('button', { name: 'À lire', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: 'Votre suivi', exact: true })).toBeVisible();
});
