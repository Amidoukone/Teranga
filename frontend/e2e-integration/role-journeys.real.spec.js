const { test, expect } = require('@playwright/test');
const { API_BASE_URL, E2E_CLIENT_PASSWORD, blockExternalTracking, loginAsSeededAdmin, loginAsSeededAgent, loginAsSeededClient, seedAuthenticatedSession } = require('./support/realApi');

const headers = (session) => ({ Authorization: `Bearer ${session.token}` });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM90AAAAASUVORK5CYII=', 'base64');

async function openSession(browser, session, width) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  await blockExternalTracking(page);
  await seedAuthenticatedSession(page, session.user, session.token);
  return { context, page };
}

for (const role of ['agent', 'provider']) {
  test(`recette continue ${role} : demande, affectation, réalisation, justificatifs, paiement et confirmation`, async ({ browser, request }, testInfo) => {
    test.setTimeout(120_000);
    const client = await loginAsSeededClient(request), admin = await loginAsSeededAdmin(request);
    let executor;
    if (role === 'agent') {
      executor = await loginAsSeededAgent(request);
      expect((await request.patch(`${API_BASE_URL}/v1/operations/agent/capacity`, { headers: headers(executor), data: { available: false } })).ok()).toBeTruthy();
    } else {
      const response = await request.post(`${API_BASE_URL}/auth/login`, { data: { email: 'e2e.real.provider@example.com', password: E2E_CLIENT_PASSWORD } });
      expect(response.ok()).toBeTruthy(); executor = await response.json();
      expect((await request.patch(`${API_BASE_URL}/v1/providers/me/availability`, { headers: headers(executor), data: { availabilityStatus: 'offline' } })).ok()).toBeTruthy();
    }
    const customer = await openSession(browser, client, role === 'agent' ? 360 : 1440);
    const manager = await openSession(browser, admin, 1440);
    const worker = await openSession(browser, executor, 360);
    try {
      const title = `Recette ${role} ${Date.now()}`;
      await customer.page.goto('/operations');
      await customer.page.getByRole('main').getByRole('link', { name: 'Nouvelle demande', exact: true }).click();
      await customer.page.getByRole('button', { name: role === 'agent' ? 'Autre service' : 'Plomberie E2E', exact: true }).click();
      await customer.page.getByRole('button', { name: 'Suivant', exact: true }).click();
      await customer.page.getByLabel('Votre besoin en une phrase').fill(title);
      await customer.page.getByRole('button', { name: 'Suivant', exact: true }).click();
      const creation = customer.page.waitForResponse((response) => response.url().endsWith('/v1/missions') && response.request().method() === 'POST');
      await customer.page.getByRole('button', { name: 'Envoyer ma demande', exact: true }).click();
      const created = await creation; expect(created.status()).toBe(201);
      const mission = (await created.json()).mission;
      await customer.page.getByRole('link', { name: 'Suivre ma demande', exact: true }).click();
      await expect(customer.page.getByRole('heading', { name: title, exact: true })).toBeVisible();

      await manager.page.goto(`/operations?vue=coordonner&type=service&demande=${mission.id}`);
      const card = manager.page.getByRole('article', { name: title, exact: true });
      const ownership = manager.page.waitForResponse((response) => response.url().endsWith(`/operations/${mission.id}`) && response.request().method() === 'PATCH');
      await card.getByRole('button', { name: 'Prendre en charge', exact: true }).click();
      expect((await ownership).ok()).toBeTruthy();
      await card.getByText('Organiser la prise en charge', { exact: true }).click();
      if (role === 'agent') {
        await card.getByRole('button', { name: 'Affectation manuelle', exact: true }).click();
        await card.getByRole('combobox', { name: 'Agent chargé de la demande', exact: true }).selectOption(String(executor.user.id));
        const assignment = manager.page.waitForResponse((response) => response.url().endsWith('/services/assign') && response.request().method() === 'POST');
        await card.getByRole('button', { name: 'Enregistrer', exact: true }).click();
        expect((await assignment).ok()).toBeTruthy();
      } else {
        await card.getByRole('link', { name: 'Affectation manuelle', exact: true }).click();
        const row = manager.page.getByRole('row').filter({ hasText: title });
        const assignment = manager.page.waitForResponse((response) => response.url().endsWith(`/missions/${mission.id}/assign`) && response.request().method() === 'POST');
        const providers = row.getByRole('combobox').first();
        const providerOption = providers.getByRole('option').filter({ hasText: 'Awa E2E' });
        await expect(providerOption).toHaveCount(1);
        await providers.selectOption(await providerOption.getAttribute('value'));
        expect((await assignment).ok()).toBeTruthy();
      }

      await worker.page.goto('/operations');
      await worker.page.getByRole('button', { name: 'Me rendre disponible', exact: true }).click();
      await expect(worker.page.getByRole('button', { name: 'Me rendre indisponible', exact: true })).toBeVisible();
      await worker.page.getByRole('article', { name: title, exact: true }).getByRole('link', { name: 'Continuer la réalisation', exact: true }).click();
      const dossier = worker.page.url();
      await worker.page.locator('summary').filter({ hasText: 'Besoin d’aide ?' }).click();
      await worker.page.getByRole('link', { name: 'Aide pour cette demande', exact: true }).click();
      await expect(worker.page.getByRole('link', { name: 'Retour au dossier', exact: true })).toBeVisible();
      await worker.page.getByRole('link', { name: 'Retour au dossier', exact: true }).click();
      await expect(worker.page).toHaveURL(dossier);
      if (role === 'provider') {
        await worker.page.getByRole('button', { name: 'Je suis en route', exact: true }).last().click();
        await worker.page.getByRole('button', { name: 'Je suis arrivé', exact: true }).last().click();
      }
      await worker.page.getByRole('button', { name: 'Je commence le service', exact: true }).last().click();
      await expect(worker.page.getByRole('button', { name: "J'ai terminé le service", exact: true })).toHaveCount(0);
      await worker.page.getByLabel('Travaux réalisés, résultat et points à signaler').fill('Le travail demandé a été réalisé et contrôlé sur place. La photographie présente le résultat remis au client.');
      await worker.page.getByLabel('Ajouter des justificatifs', { exact: true }).setInputFiles({ name: 'resultat.png', mimeType: 'image/png', buffer: png });
      const report = worker.page.waitForResponse((response) => response.url().endsWith(`/missions/${mission.id}/completion-report`) && response.request().method() === 'POST');
      await worker.page.getByRole('button', { name: 'Enregistrer le compte rendu', exact: true }).click();
      expect((await report).ok()).toBeTruthy();
      await worker.page.getByRole('button', { name: "J'ai terminé le service", exact: true }).last().click();
      await expect.poll(async () => (await (await request.get(`${API_BASE_URL}/services/${mission.id}`, { headers: headers(client) })).json()).service.status).toBe('completed');
      expect(await worker.page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
      await worker.page.screenshot({ path: testInfo.outputPath('realisation-mobile.png'), fullPage: true });

      if (role === 'provider') {
        await worker.page.goto('/prestataire/interventions');
        const list = worker.page.getByRole('main');
        await list.getByRole('combobox', { name: 'Type de dossier', exact: true }).selectOption('service');
        await list.getByRole('textbox', { name: 'Rechercher par titre, adresse ou numéro' }).fill(title);
        await list.getByRole('button', { name: 'Rechercher', exact: true }).click();
        await expect(list.getByRole('article')).toHaveCount(1);
        await expect(list.getByText('Résultat remis — confirmation du client attendue', { exact: true })).toBeVisible();
        await list.getByRole('link', { name: 'Compte rendu et justificatifs', exact: true }).click();
        await expect(worker.page.getByRole('link', { name: 'resultat.png', exact: true })).toBeVisible();
        await worker.page.getByRole('link', { name: /Retour aux interventions/ }).click();
        await expect(list.getByRole('textbox', { name: 'Rechercher par titre, adresse ou numéro' })).toHaveValue(title);
        await expect(list.getByRole('combobox', { name: 'Type de dossier', exact: true })).toHaveValue('service');
      }

      await manager.page.goto(`/services/${mission.id}/transactions`);
      await manager.page.getByRole('button', { name: 'Enregistrer une opération', exact: true }).click();
      await manager.page.getByRole('combobox', { name: 'Nature', exact: true }).selectOption('revenue');
      await manager.page.getByLabel('Montant', { exact: true }).fill('15000');
      await manager.page.getByLabel('Reçu ou justificatif de paiement', { exact: true }).setInputFiles({ name: 'reglement.png', mimeType: 'image/png', buffer: png });
      const recording = manager.page.waitForResponse((response) => response.url().endsWith('/transactions') && response.request().method() === 'POST');
      await manager.page.getByRole('main').getByRole('button', { name: 'Enregistrer', exact: true }).click();
      expect((await recording).status()).toBe(201);
      const beforeConfirmation = await request.get(`${API_BASE_URL}/services/${mission.id}`, { headers: headers(client) });
      expect((await beforeConfirmation.json()).service.status).toBe('completed');

      await customer.page.goto('/operations');
      await customer.page.getByRole('article', { name: title, exact: true }).getByRole('link', { name: 'Vérifier le résultat', exact: true }).click();
      const proof = customer.page.getByRole('link', { name: 'resultat.png', exact: true });
      await expect(proof).toBeVisible();
      const file = await request.get(await proof.getAttribute('href'));
      expect(file.ok()).toBeTruthy(); expect(file.headers()['content-type']).toContain('image/png');
      await customer.page.getByRole('button', { name: "Je confirme que c'est terminé", exact: true }).click();
      const amounts = customer.page.locator('details').filter({ has: customer.page.locator('summary', { hasText: 'Prix et règlement' }) });
      await amounts.locator('summary').click();
      await expect(customer.page.getByRole('link', { name: 'Ouvrir le justificatif', exact: true })).toBeVisible();
      const receipt = await request.get(await customer.page.getByRole('link', { name: 'Ouvrir le justificatif', exact: true }).getAttribute('href'));
      expect(receipt.ok()).toBeTruthy();
      await expect(customer.page.getByRole('heading', { name: title, exact: true })).toBeVisible();
      await expect.poll(async () => (await (await request.get(`${API_BASE_URL}/services/${mission.id}`, { headers: headers(client) })).json()).service.status).toBe('validated');
      expect(await customer.page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
      if (role === 'provider') {
        await expect(customer.page.getByRole('main')).not.toContainText('serviceMission.');
        await expect(customer.page.getByText('Suivi du service', { exact: true })).toBeVisible();
        await expect(customer.page.getByRole('button', { name: 'Voir la carte (facultatif)', exact: true })).toHaveCount(0);
        await expect(customer.page.getByText('Comment s’est passée la prestation ?', { exact: true })).toBeVisible();
      }
      await customer.page.screenshot({ path: testInfo.outputPath('dossier-confirme.png'), fullPage: true });
      if (role === 'provider') {
        await worker.page.getByRole('button', { name: 'Historique', exact: true }).click();
        await expect(worker.page.getByText(title, { exact: true })).toBeVisible();
        await expect(worker.page.getByText('Confirmée par le client', { exact: true })).toBeVisible();
      }
    } finally {
      await customer.context.close(); await manager.context.close(); await worker.context.close();
    }
  });
}
