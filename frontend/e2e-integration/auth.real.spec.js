const { test, expect } = require('@playwright/test');
const {
  buildRegisterPayload,
  blockExternalTracking,
} = require('./support/realApi');

test.describe('E2E Integration Reelle - Auth', () => {
  test('register puis login et acces dashboard', async ({ page }) => {
    const registerPayload = buildRegisterPayload();

    await page.addInitScript(() => {
      localStorage.setItem('teranga_lang', 'fr');
      localStorage.setItem('teranga_analytics_consent', 'denied');
    });
    await blockExternalTracking(page);

    await page.goto('/register');
    await expect(page).toHaveURL(/\/register$/);

    const registerForm = page.locator('form').first();
    const registerInputs = registerForm.locator('input');

    await registerInputs.nth(0).fill(registerPayload.firstName);
    await registerInputs.nth(1).fill(registerPayload.lastName);
    await registerInputs.nth(2).fill(registerPayload.email);
    await registerInputs.nth(3).fill(registerPayload.phone);
    await registerInputs.nth(4).fill(registerPayload.country);
    await registerInputs.nth(5).fill(registerPayload.password);

    const registerSubmit = registerForm.locator('button[type="submit"]');
    await expect(registerSubmit).toBeEnabled({ timeout: 20_000 });
    await registerSubmit.click();

    await expect(page).toHaveURL(/\/login$/);

    const loginForm = page.locator('form').first();
    await loginForm.locator('input[type="email"]').fill(registerPayload.email);
    await loginForm
      .locator('input[type="password"]')
      .fill(registerPayload.password);
    await loginForm.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/dashboard$/);

    const token = await page.evaluate(() => localStorage.getItem('teranga_token'));
    expect(token).toBeTruthy();
  });
});
