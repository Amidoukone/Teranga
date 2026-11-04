const { test, expect } = require('@playwright/test');
const { API_BASE_URL, E2E_CLIENT_PASSWORD, blockExternalTracking, loginAsSeededAdmin, loginAsSeededClient, seedAuthenticatedSession } = require('./support/realApi');
const headers = session => ({ Authorization: `Bearer ${session.token}` });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM90AAAAASUVORK5CYII=', 'base64');

async function transportSession(request) {
  const response = await request.post(`${API_BASE_URL}/auth/login`, { data: { email: 'e2e.real.transport@example.com', password: E2E_CLIENT_PASSWORD } });
  expect(response.ok()).toBeTruthy();
  const session = await response.json();
  const profile = await request.get(`${API_BASE_URL}/v1/providers/me`, { headers: headers(session) });
  session.provider = (await profile.json()).provider;
  return session;
}
async function screenFor(browser, session, width) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  await blockExternalTracking(page); await seedAuthenticatedSession(page, session.user, session.token);
  return { page, context };
}
async function createTransport(request, client, slug) {
  const response = await request.get(`${API_BASE_URL}/v1/trade-categories`);
  const category = (await response.json()).tradeCategories.find(item => item.slug === slug);
  expect(category).toBeTruthy();
  const created = await request.post(`${API_BASE_URL}/v1/missions`, { headers: headers(client), data: {
    executionType: 'provider', tradeCategoryId: category.id, title: `Recette ${slug} ${Date.now()}`,
    pickupAddress: 'ACI 2000, Bamako', pickupLatitude: 12.6392, pickupLongitude: -8.0029,
    address: 'Badalabougou, Bamako', latitude: 12.6205, longitude: -7.9895,
    ...(slug === 'mobilite' ? { requestedVehicleType: 'car' } : { packageType: 'small', recipientName: 'Awa destinataire', recipientPhone: '+22370000004' }),
  } });
  expect(created.status(), await created.text()).toBe(201);
  return (await created.json()).mission;
}
async function assign(request, admin, driver, mission) {
  const vehicles = await request.get(`${API_BASE_URL}/v1/providers/${driver.provider.id}/vehicles`, { headers: headers(admin) });
  const vehicleId = (await vehicles.json()).vehicles[0].id;
  const response = await request.post(`${API_BASE_URL}/v1/missions/${mission.id}/assign`, { headers: headers(admin), data: { providerId: driver.provider.id, ...(mission.requestedVehicleType ? { vehicleId } : {}) } });
  expect(response.status(), await response.text()).toBe(200);
}

for (const slug of ['mobilite', 'livraison']) {
  test(`parcours réel ${slug} : offre, déplacement, remise, confirmation et historique`, async ({ browser, request }, testInfo) => {
    test.setTimeout(150000);
    const client = await loginAsSeededClient(request), admin = await loginAsSeededAdmin(request), driver = await transportSession(request);
    const worker = await screenFor(browser, driver, slug === 'mobilite' ? 360 : 1440);
    const customer = await screenFor(browser, client, slug === 'mobilite' ? 1440 : 360);
    const manager = await screenFor(browser, admin, 1440);
    try {
      await worker.page.goto('/operations');
      const available = worker.page.getByRole('button', { name: 'Me rendre disponible', exact: true });
      await expect(available.or(worker.page.getByRole('button', { name: 'Me rendre indisponible', exact: true })).first()).toBeVisible();
      if (await available.isVisible()) await available.click();
      await expect(worker.page.getByRole('button', { name: 'Me rendre indisponible', exact: true })).toBeVisible();
      const mission = await createTransport(request, client, slug);
      if (slug === 'mobilite') {
        await manager.page.goto(`/admin/taxi-dispatch?missionId=${mission.id}`);
        await manager.page.getByRole('button', { name: 'Affecter le meilleur chauffeur', exact: true }).click();
        await expect.poll(async () => (await (await request.get(`${API_BASE_URL}/v1/missions/${mission.id}/track?skipEta=1`, { headers: headers(client) })).json()).missionStatus).toBe('ASSIGNED');
        const unavailable = await request.patch(`${API_BASE_URL}/v1/providers/me/availability`, { headers: headers(driver), data: { availabilityStatus: 'offline' } });
        expect(unavailable.status()).toBe(409);
      } else await assign(request, admin, driver, mission);
      const kind = slug === 'mobilite' ? 'taxi' : 'delivery';
      await worker.page.goto(`/prestataire/interventions?vue=offres&type=${kind}&q=${encodeURIComponent(mission.title)}`);
      const card = worker.page.getByRole('article', { name: mission.title, exact: true });
      await card.getByRole('link', { name: 'Voir les détails', exact: true }).click();
      await expect(worker.page.getByText(/Répondez à cette offre avant le/)).toBeVisible();
      await worker.page.getByRole('button', { name: slug === 'mobilite' ? 'Accepter la course' : 'Accepter la livraison', exact: true }).click();
      await worker.page.getByRole('button', { name: slug === 'mobilite' ? 'Je suis en route' : 'Je pars au retrait', exact: true }).filter({ visible: true }).click();
      await worker.page.getByRole('button', { name: slug === 'mobilite' ? 'Je suis arrivé sur place' : 'Je suis au point de retrait', exact: true }).filter({ visible: true }).click();
      const path = slug === 'mobilite' ? `/courses/${mission.id}` : `/livraisons/${mission.id}`;
      await customer.page.goto(path);
      if (slug === 'mobilite') {
        const tracking = await request.get(`${API_BASE_URL}/v1/missions/${mission.id}/track?skipEta=1`, { headers: headers(client) });
        const code = (await tracking.json()).startCode;
        await expect(customer.page.getByText(code, { exact: true })).toBeVisible();
        const input = worker.page.getByLabel('Code donné par le client', { exact: true }).filter({ visible: true });
        await input.fill(code === '9999' ? '0000' : '9999');
        await worker.page.getByRole('button', { name: 'Vérifier et démarrer', exact: true }).filter({ visible: true }).click();
        await expect(worker.page.getByText(/Code de d.marrage incorrect/i)).toBeVisible();
        await input.fill(code);
        await worker.page.getByRole('button', { name: 'Vérifier et démarrer', exact: true }).filter({ visible: true }).click();
        await expect(worker.page.getByText('Ajouter un compte rendu et des justificatifs (facultatif)', { exact: true })).toBeVisible();
        await worker.page.getByRole('button', { name: 'Marquer comme terminée', exact: true }).filter({ visible: true }).click();
      } else {
        await worker.page.getByRole('button', { name: 'J’ai récupéré le colis', exact: true }).filter({ visible: true }).click();
        await expect(worker.page.getByRole('link', { name: /Appeler le destinataire/ })).toHaveAttribute('href', 'tel:+22370000004');
        await worker.page.getByLabel('Travaux réalisés, résultat et points à signaler').fill('Le colis a été remis à la destinataire, qui a confirmé son bon état. Une photo présente la remise.');
        await worker.page.getByLabel('Ajouter des justificatifs', { exact: true }).setInputFiles({ name: 'remise.png', mimeType: 'image/png', buffer: png });
        await worker.page.getByRole('button', { name: 'Enregistrer le compte rendu', exact: true }).click();
        await expect(worker.page.getByText('Compte rendu enregistré.', { exact: false })).toBeVisible();
        const amount = worker.page.getByRole('spinbutton', { name: 'Montant reçu à la remise (XOF, facultatif)' });
        await amount.fill('750');
        await worker.page.getByRole('button', { name: 'J’ai livré le colis', exact: true }).filter({ visible: true }).click();
        await expect(worker.page.getByText(/Montant déclaré à la remise : 750/)).toBeVisible();
      }
      await expect(worker.page.getByText('Résultat remis — confirmation du client attendue', { exact: true })).toBeVisible();
      await expect(worker.page.getByRole('button', { name: 'Voir la carte (facultatif)', exact: true })).toHaveCount(0);
      await customer.page.getByRole('button', { name: 'Actualiser', exact: true }).click();
      if (slug === 'livraison') {
        await expect(customer.page.getByRole('link', { name: 'remise.png', exact: true })).toBeVisible();
        const amounts = customer.page.locator('details').filter({ has: customer.page.locator('summary', { hasText: 'Prix et règlement' }) });
        await amounts.locator('summary').click();
        await expect(amounts.getByText('Montant déclaré par le livreur (à rapprocher)', { exact: true })).toBeVisible();
        const track = await request.get(`${API_BASE_URL}/v1/missions/${mission.id}/track?skipEta=1`, { headers: headers(client) });
        const body = await track.json(); expect(Number(body.collectedAmount)).toBe(750); expect(Number(body.paymentState.recordedPayments)).toBe(0);
      }
      await customer.page.getByRole('button', { name: slug === 'mobilite' ? 'Valider la mission' : 'Confirmer la livraison', exact: true }).click();
      await expect.poll(async () => (await (await request.get(`${API_BASE_URL}/v1/missions/${mission.id}/track?skipEta=1`, { headers: headers(client) })).json()).missionStatus).toBe('VALIDATED');
      await worker.page.getByRole('link', { name: /Retour aux interventions/ }).click();
      await expect(worker.page.getByRole('textbox', { name: 'Rechercher par titre, adresse ou numéro' })).toHaveValue(mission.title);
      await worker.page.getByRole('button', { name: 'Historique', exact: true }).click();
      await expect(worker.page.getByRole('article', { name: mission.title, exact: true })).toBeVisible();
      for (const page of [worker.page, customer.page]) expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
      await worker.page.screenshot({ path: testInfo.outputPath('intervention-confirmee.png'), fullPage: true });
      await customer.page.screenshot({ path: testInfo.outputPath('dossier-confirme.png'), fullPage: true });
    } finally { await worker.context.close(); await customer.context.close(); await manager.context.close(); }
  });
}

test('le refus depuis le dossier retourne aux offres filtrées et libère la prise en charge', async ({ browser, request }) => {
  const client = await loginAsSeededClient(request), admin = await loginAsSeededAdmin(request), driver = await transportSession(request);
  const worker = await screenFor(browser, driver, 360);
  try {
    const mission = await createTransport(request, client, 'mobilite');
    expect((await request.patch(`${API_BASE_URL}/v1/providers/me/availability`, { headers: headers(driver), data: { availabilityStatus: 'available' } })).ok()).toBeTruthy();
    await assign(request, admin, driver, mission);
    await worker.page.goto(`/prestataire/interventions?vue=offres&type=taxi&q=${encodeURIComponent(mission.title)}`);
    await worker.page.getByRole('link', { name: 'Voir les détails', exact: true }).click();
    await worker.page.getByRole('button', { name: 'Refuser la course', exact: true }).click();
    await expect(worker.page).toHaveURL(url => url.pathname === '/prestataire/interventions' && url.searchParams.get('q') === mission.title && url.searchParams.get('type') === 'taxi' && url.searchParams.get('vue') === 'offres');
    await expect(worker.page.getByRole('main').getByRole('article')).toHaveCount(0);
    const track = await request.get(`${API_BASE_URL}/v1/missions/${mission.id}/track?skipEta=1`, { headers: headers(client) });
    expect((await track.json()).missionStatus).toBe('SEARCHING_EXECUTOR');
    const revoked = await request.get(`${API_BASE_URL}/v1/missions/${mission.id}/track?skipEta=1`, { headers: headers(driver) });
    expect(revoked.status()).toBe(403);
  } finally { await worker.context.close(); }
});
