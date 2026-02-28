const { test, expect } = require('@playwright/test');
const {
  installApiMocks,
  seedAuthenticatedSession,
} = require('./support/mockApi');

async function setupAuthenticatedPage(page) {
  const ctx = await installApiMocks(page);
  await seedAuthenticatedSession(page, ctx.user, ctx.token);
  return ctx;
}

test.describe('E2E Critical Flows', () => {
  test('services page renders the current user services', async ({ page }) => {
    const ctx = await setupAuthenticatedPage(page);
    await page.goto('/services');

    await expect(page).toHaveURL(/\/services$/);
    await expect(page.getByText(ctx.state.services[0].title)).toBeVisible();
  });

  test('tasks page renders current tasks', async ({ page }) => {
    const ctx = await setupAuthenticatedPage(page);
    await page.goto('/tasks');

    await expect(page).toHaveURL(/\/tasks$/);
    await expect(page.getByText(ctx.state.tasks[0].title)).toBeVisible();
  });

  test('notifications page renders incoming notifications', async ({ page }) => {
    const ctx = await setupAuthenticatedPage(page);
    await page.goto('/notifications');

    await expect(page).toHaveURL(/\/notifications$/);
    await expect(
      page.getByText(ctx.state.notifications[0].metadata.title)
    ).toBeVisible();
  });

  test('orders page renders customer orders', async ({ page }) => {
    const ctx = await setupAuthenticatedPage(page);
    await page.goto('/orders');

    await expect(page).toHaveURL(/\/orders$/);
    await expect(page.getByText(ctx.state.orders[0].code)).toBeVisible();
  });
});
