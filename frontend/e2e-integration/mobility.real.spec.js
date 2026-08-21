const { test, expect } = require('@playwright/test');
const {
  blockExternalTracking,
  loginAsSeededAdmin,
  loginAsSeededClient,
  seedAuthenticatedSession,
} = require('./support/realApi');

const MOBILITY_DRAFT_KEY = 'teranga_taxi_booking_draft_v1';

async function seedMobilityDraft(page) {
  await page.addInitScript(({ draftKey }) => {
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        vehicleType: 'car',
        pickupAddress: 'ACI 2000, Bamako',
        pickup: { latitude: 12.6392, longitude: -8.0029 },
        destinationAddress: 'Badalabougou, Bamako',
        destination: { latitude: 12.6205, longitude: -7.9895 },
        updatedAt: new Date().toISOString(),
      })
    );
  }, { draftKey: MOBILITY_DRAFT_KEY });
}

test('mobilite reelle: commande, PIN client et notification admin vers le dispatch', async ({
  page,
  request,
}) => {
  await blockExternalTracking(page);

  const clientSession = await loginAsSeededClient(request);
  await seedAuthenticatedSession(page, clientSession.user, clientSession.token);
  await seedMobilityDraft(page);

  await page.goto('/taxi');
  await expect(page.getByRole('heading', { name: /Quel v.hicule souhaitez-vous/i })).toBeVisible();
  await page.getByRole('button', { name: /Voiture/i }).click();
  await page.getByRole('button', { name: /Continuer/i }).click();

  await expect(page.getByLabel(/Point de d.part/i)).toHaveValue('ACI 2000, Bamako');
  await expect(page.getByLabel(/Destination/i)).toHaveValue('Badalabougou, Bamako');
  await page.getByRole('button', { name: /Voir le trajet et le prix/i }).click();

  await expect(page.getByText(/Estimation de votre course/i)).toBeVisible();
  const missionResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/missions') &&
      response.request().method() === 'POST' &&
      response.status() === 201
  );
  await page.getByRole('button', { name: /Commander cette voiture/i }).click();
  const missionResponse = await missionResponsePromise;
  const created = await missionResponse.json();
  const missionId = created?.mission?.id;
  const startCode = created?.startCode;

  expect(missionId).toBeTruthy();
  expect(startCode).toMatch(/^\d{4}$/);
  await expect(page.getByText(/Course confirm.e/i)).toBeVisible();
  await expect(page.getByText(startCode, { exact: true })).toBeVisible();

  await page.getByRole('link', { name: /Suivre ma course/i }).click();
  await expect(page).toHaveURL(new RegExp(`/missions/${missionId}/track$`));
  await expect(page.getByText(startCode, { exact: true })).toBeVisible();

  const adminSession = await loginAsSeededAdmin(request);
  await page.evaluate(() => localStorage.clear());
  await seedAuthenticatedSession(page, adminSession.user, adminSession.token);
  await page.goto('/notifications');

  const missionNotification = page
    .locator('.app-list-card')
    .filter({ hasText: /Course Teranga en voiture/i })
    .first();
  await expect(missionNotification).toBeVisible();
  await missionNotification.getByRole('button', { name: /Voir/i }).click();

  await expect(page).toHaveURL(
    new RegExp(`/admin/taxi-dispatch\\?missionId=${missionId}$`)
  );
  await expect(page.getByText(/Impossible de charger le suivi de cette mission/i)).toHaveCount(0);
});
