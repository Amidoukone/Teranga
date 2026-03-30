const { test, expect } = require('@playwright/test');
const {
  blockExternalTracking,
  registerDisposableClient,
  seedUiPreferences,
} = require('./support/realApi');

const NEW_PASSWORD = 'Password456!';

async function loginUser(page, email, password) {
  await page.goto('/login');
  await expect(page).toHaveURL(/\/login$/);

  const loginForm = page.locator('form').first();
  await loginForm.locator('input[type="email"]').fill(email);
  await loginForm.locator('input[type="password"]').fill(password);
  await loginForm.locator('button[type="submit"]').click();
}

async function logoutUser(page) {
  const userMenuButton = page.locator('button[aria-controls="user-menu"]');
  await expect(userMenuButton).toBeVisible();
  await userMenuButton.click();

  const logoutAction = page
    .locator('#user-menu')
    .getByRole('menuitem', { name: /d(?:e|\u00e9)connexion|sign out/i });
  await expect(logoutAction).toBeVisible();
  await logoutAction.click();
}

test.describe('E2E Integration Reelle - Auth', () => {
  test('register via API puis login et acces dashboard', async ({
    page,
    request,
  }) => {
    await seedUiPreferences(page);
    await blockExternalTracking(page);

    const { payload } = await registerDisposableClient(request);
    await loginUser(page, payload.email, payload.password);

    await expect(page).toHaveURL(/\/dashboard$/);

    const token = await page.evaluate(() => localStorage.getItem('teranga_token'));
    expect(token).toBeTruthy();
  });

  test('logout affiche le message de succes puis autorise une nouvelle connexion', async ({
    page,
    request,
  }) => {
    await seedUiPreferences(page);
    await blockExternalTracking(page);

    const { payload } = await registerDisposableClient(request);
    await loginUser(page, payload.email, payload.password);

    await expect(page).toHaveURL(/\/dashboard$/);
    await logoutUser(page);

    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.locator('[role="status"]').filter({
        hasText:
          /d(?:e|\u00e9)connect(?:e|\u00e9) avec succ(?:e|\u00e8)s|signed out successfully/i,
      })
    ).toBeVisible();

    const tokenAfterLogout = await page.evaluate(() =>
      localStorage.getItem('teranga_token')
    );
    expect(tokenAfterLogout).toBeNull();

    await loginUser(page, payload.email, payload.password);
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('changement de mot de passe force la reconnexion puis accepte le nouveau mot de passe', async ({
    page,
    request,
  }) => {
    await seedUiPreferences(page);
    await blockExternalTracking(page);

    const { payload } = await registerDisposableClient(request);
    await loginUser(page, payload.email, payload.password);

    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto('/account/security');
    await expect(page).toHaveURL(/\/account\/security$/);

    await page.locator('#current-password').fill(payload.password);
    await page.locator('#new-password').fill(NEW_PASSWORD);
    await page.locator('#confirm-password').fill(NEW_PASSWORD);
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.locator('[role="status"]').filter({
        hasText:
          /mot de passe modifi(?:e|\u00e9)\. reconnectez-vous|password updated\. please sign in again/i,
      })
    ).toBeVisible();

    const tokenAfterPasswordChange = await page.evaluate(() =>
      localStorage.getItem('teranga_token')
    );
    expect(tokenAfterPasswordChange).toBeNull();

    await loginUser(page, payload.email, NEW_PASSWORD);
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
