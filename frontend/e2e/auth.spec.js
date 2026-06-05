const { test, expect } = require('@playwright/test');
const { installApiMocks } = require('./support/mockApi');

test.describe('E2E Auth', () => {
  test('register then login and land on dashboard', async ({ page }) => {
    await installApiMocks(page);

    const uniqueEmail = `e2e_${Date.now()}@teranga.test`;
    const password = 'Password123!';

    await page.goto('/register');
    await expect(page).toHaveURL(/\/register$/);

    const registerForm = page.locator('form').first();
    const registerInputs = registerForm.locator('input');

    await registerInputs.nth(0).fill('E2E');
    await registerInputs.nth(1).fill('Client');
    await registerInputs.nth(2).fill('+22370000000');
    await registerInputs.nth(3).fill(uniqueEmail);
    await registerInputs.nth(4).fill('ML');
    await registerInputs.nth(5).fill(password);

    await registerForm.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/login$/);

    const loginForm = page.locator('form').first();
    await loginForm.locator('input[type="text"]').fill(uniqueEmail);
    await loginForm.locator('input[type="password"]').fill(password);
    await loginForm.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/dashboard$/);
    const token = await page.evaluate(() => localStorage.getItem('teranga_token'));
    expect(token).toBeTruthy();
  });
});
