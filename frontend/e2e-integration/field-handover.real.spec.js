const { test, expect } = require('@playwright/test');
const { API_BASE_URL, E2E_CLIENT_PASSWORD, loginAsSeededClient, seedAuthenticatedSession, blockExternalTracking } = require('./support/realApi');

test('terrain réel : démarrage, preuve consultable, remise et validation du client sur mobile', async ({ page, request, browser }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await blockExternalTracking(page);
  const login = await request.post(`${API_BASE_URL}/auth/login`, { data: { email: 'e2e.real.agent@example.com', password: E2E_CLIENT_PASSWORD } });
  expect(login.ok()).toBeTruthy();
  const agent = await login.json();
  await seedAuthenticatedSession(page, agent.user, agent.token);
  await page.goto('/agent/services');
  const card = page.getByRole('article').filter({ hasText: 'Service E2E Reelle - Entretien Villa' });
  await card.getByRole('button', { name: 'Je commence le service', exact: true }).click();
  await card.getByRole('link', { name: 'Préparer la remise au client' }).click();
  await expect(page.getByRole('button', { name: "J'ai terminé le service", exact: true })).toHaveCount(0);
  await page.getByLabel('Travaux réalisés, résultat et points à signaler').fill('Le document a été remis au bénéficiaire. La remise est confirmée par la photographie.');
  await page.getByLabel('Ajouter des justificatifs', { exact: true }).setInputFiles({ name: 'remise.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM90AAAAASUVORK5CYII=', 'base64') });
  await page.getByRole('button', { name: 'Enregistrer le compte rendu', exact: true }).click();
  const finish = page.getByRole('button', { name: "J'ai terminé le service", exact: true });
  await expect(finish.last()).toBeVisible();
  const detailUrl = page.url().split('#')[0];
  await finish.last().click();
  await expect(page.getByText('Le client a été informé et peut confirmer.', { exact: true })).toBeVisible();
  const client = await loginAsSeededClient(request);
  const clientContext = await browser.newContext({ viewport: { width: 360, height: 800 } });
  try {
    const clientPage = await clientContext.newPage();
    await blockExternalTracking(clientPage);
    await seedAuthenticatedSession(clientPage, client.user, client.token);
    await clientPage.goto(detailUrl);
    const evidence = clientPage.getByRole('link', { name: 'remise.png' });
    const proof = await request.get(await evidence.getAttribute('href'));
    expect(proof.ok()).toBeTruthy();
    expect(proof.headers()['content-type']).toContain('image/png');
    const validate = clientPage.getByRole('button', { name: "Je confirme que c'est terminé", exact: true });
    await expect(validate.last()).toBeVisible();
    await validate.last().click();
    await expect(clientPage.getByText('Service confirmé et clôturé', { exact: true }).first()).toBeVisible();
  } finally { await clientContext.close(); }
});
