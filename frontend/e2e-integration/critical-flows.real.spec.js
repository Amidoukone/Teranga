const { test, expect } = require('@playwright/test');
const {
  blockExternalTracking,
  loginAsSeededClient,
  seedAuthenticatedSession,
} = require('./support/realApi');

const SEEDED_SERVICE_TITLE = 'Service E2E Reelle - Entretien Villa';
const SEEDED_TASK_TITLE = 'Tache E2E Reelle - Controle dossier';
const SEEDED_NOTIFICATION_TITLE = 'Notification E2E Reelle';
const SEEDED_ORDER_CODE = 'CMD-E2E-REAL-001';

async function setupAuthenticatedPage(page, request) {
  await blockExternalTracking(page);
  const session = await loginAsSeededClient(request);
  await seedAuthenticatedSession(page, session.user, session.token);
  return session;
}

test.describe('E2E Integration Reelle - Parcours critiques', () => {
  test('services: affiche les donnees reelles et cree un service', async ({
    page,
    request,
  }) => {
    await setupAuthenticatedPage(page, request);

    const uniqueTitle = `Service E2E Reel ${Date.now()}`;

    await page.goto('/services');
    await expect(page).toHaveURL(/\/services$/);
    await expect(page.getByText(SEEDED_SERVICE_TITLE).first()).toBeVisible();

    const form = page.locator('form').first();
    await form.locator('input[required]').first().fill(uniqueTitle);
    await form
      .locator('textarea')
      .first()
      .fill('Creation service par test integration reelle');
    await form.locator('button[type="submit"]').click();

    await expect(page.getByText(uniqueTitle).first()).toBeVisible();
  });

  test('tasks: affiche les donnees reelles et cree une tache', async ({
    page,
    request,
  }) => {
    await setupAuthenticatedPage(page, request);

    const uniqueTitle = `Tache E2E Reelle ${Date.now()}`;

    await page.goto('/tasks');
    await expect(page).toHaveURL(/\/tasks$/);
    await expect(page.getByText(SEEDED_TASK_TITLE).first()).toBeVisible();

    const form = page.locator('form').first();
    await form.locator('select').first().selectOption({ index: 1 });
    await form.locator('input[required]').first().fill(uniqueTitle);
    await form.locator('button[type="submit"]').click();

    await expect(page.getByText(uniqueTitle).first()).toBeVisible();
  });

  test('notifications: affiche les notifications reelles', async ({
    page,
    request,
  }) => {
    await setupAuthenticatedPage(page, request);

    await page.goto('/notifications');
    await expect(page).toHaveURL(/\/notifications$/);
    await expect(page.getByText(SEEDED_NOTIFICATION_TITLE).first()).toBeVisible();
  });

  test('orders: affiche les donnees reelles et cree une commande', async ({
    page,
    request,
  }) => {
    await setupAuthenticatedPage(page, request);

    await page.goto('/orders');
    await expect(page).toHaveURL(/\/orders$/);
    await expect(page.getByText(SEEDED_ORDER_CODE).first()).toBeVisible();

    const form = page.locator('form').first();
    await form
      .locator('textarea')
      .first()
      .fill(`Commande E2E integration reelle ${Date.now()}`);
    await form.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/orders\/\d+$/);
  });
});
