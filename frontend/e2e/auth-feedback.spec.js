/* eslint-disable testing-library/prefer-screen-queries */
const { test, expect } = require('@playwright/test');
const {
  DEFAULT_PASSWORD,
  installApiMocks,
  seedAuthenticatedSession,
} = require('./support/mockApi');

const NEW_PASSWORD = 'Password456!';

async function seedUiPreferences(page, language = 'fr') {
  await page.addInitScript(({ lang }) => {
    localStorage.setItem('teranga_lang', lang);
    localStorage.setItem('teranga_analytics_consent', 'denied');
  }, { lang: language });
}

async function setupAuthenticatedPage(page, options = {}) {
  await seedUiPreferences(page, options.language || 'fr');
  const ctx = await installApiMocks(page, options);
  await seedAuthenticatedSession(page, ctx.user, ctx.token);
  return ctx;
}

async function submitLogin(page, email, password) {
  const loginForm = page.locator('form').first();
  await loginForm.locator('input[type="text"]').fill(email);
  await loginForm.locator('input[type="password"]').fill(password);
  await loginForm.locator('button[type="submit"]').click();
}

test.describe('E2E Auth Feedback', () => {
  test('logout returns to login with a success message and cleared local session', async ({
    page,
  }) => {
    await seedUiPreferences(page);
    const ctx = await installApiMocks(page);

    await page.goto('/login');
    await expect(page).toHaveURL(/\/login$/);

    await submitLogin(page, ctx.user.email, DEFAULT_PASSWORD);
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.locator('button[aria-controls="user-menu"]').click();
    const logoutAction = page
      .locator('#user-menu')
      .getByRole('menuitem', { name: /déconnexion|sign out/i });
    await expect(logoutAction).toBeVisible();
    await logoutAction.click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByText(/déconnecté avec succès|signed out successfully/i)
    ).toBeVisible();

    const storageState = await page.evaluate(() => ({
      token: localStorage.getItem('teranga_token'),
      legacyToken: localStorage.getItem('token'),
      cachedUser: localStorage.getItem('teranga_user'),
    }));

    expect(storageState).toEqual({
      token: null,
      legacyToken: null,
      cachedUser: null,
    });

    await submitLogin(page, ctx.user.email, DEFAULT_PASSWORD);
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('change password forces a fresh login and accepts the new password', async ({
    page,
  }) => {
    const ctx = await setupAuthenticatedPage(page);

    await page.goto('/account/security');
    await expect(page).toHaveURL(/\/account\/security$/);

    await page.locator('#current-password').fill(DEFAULT_PASSWORD);
    await page.locator('#new-password').fill(NEW_PASSWORD);
    await page.locator('#confirm-password').fill(NEW_PASSWORD);
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByText(/mot de passe modifié\. reconnectez-vous|password updated\. please sign in again/i)
    ).toBeVisible();

    const storageState = await page.evaluate(() => ({
      token: localStorage.getItem('teranga_token'),
      legacyToken: localStorage.getItem('token'),
      cachedUser: localStorage.getItem('teranga_user'),
    }));

    expect(storageState).toEqual({
      token: null,
      legacyToken: null,
      cachedUser: null,
    });

    await submitLogin(page, ctx.user.email, NEW_PASSWORD);
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
