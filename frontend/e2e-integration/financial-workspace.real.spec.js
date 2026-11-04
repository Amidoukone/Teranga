const { test, expect } = require('@playwright/test');
const { API_BASE_URL, blockExternalTracking, loginAsSeededAdmin, loginAsSeededAgent, loginAsSeededClient, seedAuthenticatedSession } = require('./support/realApi');
const headers = (session) => ({ Authorization: `Bearer ${session.token}` });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8l8AAAAASUVORK5CYII=', 'base64');

test('real service receipt is recorded and visible to the customer without completing the service', async ({ page, request, browser }) => {
  const client = await loginAsSeededClient(request), admin = await loginAsSeededAdmin(request);
  const created = await request.post(`${API_BASE_URL}/services`, { headers: headers(client), data: { title: `Service financier ${Date.now()}`, type: 'other' } });
  expect(created.status()).toBe(201); const service = (await created.json()).service;
  await blockExternalTracking(page); await seedAuthenticatedSession(page, admin.user, admin.token);
  await page.goto(`/services/${service.id}/transactions`);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Enregistrer une opération', exact: true }).click();
  await main.getByRole('combobox', { name: 'Nature', exact: true }).selectOption('revenue');
  await main.getByLabel('Montant', { exact: true }).fill('1250,50');
  await main.getByLabel('Description', { exact: true }).fill('Règlement reçu à vérifier dans le dossier.');
  await main.getByLabel('Reçu ou justificatif de paiement', { exact: true }).setInputFiles({ name: 'recu.png', mimeType: 'image/png', buffer: png });
  const writing = page.waitForResponse((response) => response.url().endsWith('/transactions') && response.request().method() === 'POST');
  await main.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  const result = await writing;
  expect(result.status()).toBe(201); const transaction = (await result.json()).transaction;
  expect(Number(transaction.amount)).toBe(1250.50); expect(transaction.status).toBe('completed');
  await expect(main.getByRole('link', { name: 'Ouvrir le justificatif', exact: true })).toBeVisible();
  expect((await request.get(await main.getByRole('link', { name: 'Ouvrir le justificatif', exact: true }).getAttribute('href'))).status()).toBe(200);
  const state = await request.get(`${API_BASE_URL}/services/${service.id}`, { headers: headers(client) });
  expect(state.ok()).toBeTruthy(); expect((await state.json()).service.status).toBe(service.status);
  const context = await browser.newContext();
  try {
    const review = await context.newPage(); await blockExternalTracking(review); await seedAuthenticatedSession(review, client.user, client.token);
    await review.goto(`/services/${service.id}/transactions`);
    await expect(review.getByRole('article', { name: `Revenu #${transaction.id}`, exact: true })).toBeVisible();
    await expect(review.getByRole('button', { name: 'Enregistrer une opération', exact: true })).toHaveCount(0);
    await review.getByRole('link', { name: 'Retour au dossier', exact: true }).click();
    await expect(review).toHaveURL(new RegExp(`/services/${service.id}$`));
  } finally { await context.close(); }
});

test('real project uses its currency and an administrator controls an entry separately from project progress', async ({ page, request }) => {
  const client = await loginAsSeededClient(request), admin = await loginAsSeededAdmin(request);
  const created = await request.post(`${API_BASE_URL}/projects`, { headers: headers(client), data: { title: `Budget familial ${Date.now()}`, type: 'administratif', currency: 'GHS' } });
  expect(created.status()).toBe(201); const project = (await created.json()).project;
  await blockExternalTracking(page); await seedAuthenticatedSession(page, admin.user, admin.token);
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto(`/projects/${project.id}#dossier-finance`);
  const main = page.locator('#dossier-finance');
  await main.getByRole('button', { name: 'Ajouter un paiement ou une dépense', exact: true }).click();
  await main.getByText('Devise et options complémentaires', { exact: true }).click();
  await expect(main.getByRole('option', { name: `Devise du dossier (${project.currency})`, exact: true })).toBeAttached();
  await main.getByLabel('Montant', { exact: true }).fill('40');
  const writing = page.waitForResponse((response) => response.url().endsWith('/transactions') && response.request().method() === 'POST');
  await main.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  const result = await writing; expect(result.status()).toBe(201); const transaction = (await result.json()).transaction;
  expect(transaction.currency).toBe(project.currency);
  const card = main.getByRole('article', { name: `Dépense #${transaction.id}`, exact: true });
  await card.getByRole('button', { name: 'Modifier ou contrôler', exact: true }).click();
  await card.getByText('Devise et options complémentaires', { exact: true }).click();
  await card.getByLabel('Statut de l’écriture', { exact: true }).selectOption('pending');
  const changing = page.waitForResponse((response) => response.url().endsWith(`/transactions/${transaction.id}`) && response.request().method() === 'PUT');
  await card.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  expect((await changing).status()).toBe(200);
  await expect(card.getByText('En attente', { exact: true })).toBeVisible();
  const projectState = await request.get(`${API_BASE_URL}/projects/${project.id}`, { headers: headers(client) });
  expect((await projectState.json()).project.status).toBe(project.status);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
});

test('real order keeps one entry per type and never marks the order paid from a journal submission', async ({ page, request }) => {
  const client = await loginAsSeededClient(request);
  const created = await request.post(`${API_BASE_URL}/orders`, { headers: headers(client), data: { countryId: client.user.countryId, items: [{ name: 'Documents', quantity: 1, price: 5000 }] } });
  expect(created.status()).toBe(201); const order = (await created.json()).order;
  await blockExternalTracking(page); await seedAuthenticatedSession(page, client.user, client.token);
  await page.goto(`/orders/${order.id}#dossier-finance`);
  const main = page.locator('#dossier-finance');
  const ids = [];
  for (const amount of ['1500', '2000']) {
    await main.getByRole('button', { name: 'Ajouter un paiement ou une dépense', exact: true }).click();
    await main.getByLabel('Montant', { exact: true }).fill(amount);
    const writing = page.waitForResponse((response) => response.url().endsWith('/transactions') && response.request().method() === 'POST');
    await main.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    const result = await writing; expect(result.status()).toBe(201); ids.push((await result.json()).transaction.id);
    await expect(main.getByText('Écriture enregistrée.', { exact: true })).toBeVisible();
  }
  expect(ids[0]).toBe(ids[1]);
  await expect(main.getByRole('article')).toHaveCount(1);
  const state = await request.get(`${API_BASE_URL}/orders/${order.id}`, { headers: headers(client) });
  const current = (await state.json()).order;
  expect(current.paymentStatus).toBe('unpaid'); expect(current.status).toBe(order.status);
  await expect(page).toHaveURL(new RegExp(`/orders/${order.id}#dossier-finance$`));
});

test('real order payment review preserves its preparation status and refreshes the embedded journal', async ({ page, request }) => {
  const client = await loginAsSeededClient(request), admin = await loginAsSeededAdmin(request);
  const created = await request.post(`${API_BASE_URL}/orders`, { headers: headers(client), data: { countryId: client.user.countryId, items: [{ name: 'Fournitures du dossier', quantity: 1, price: 5000 }] } });
  expect(created.status()).toBe(201); const order = (await created.json()).order;
  await blockExternalTracking(page); await seedAuthenticatedSession(page, admin.user, admin.token);
  await page.goto(`/orders/${order.id}#dossier-finance`);
  const finance = page.locator('#dossier-finance');
  await finance.getByText('Contrôle du règlement de la commande', { exact: true }).click();
  const updating = page.waitForResponse(response => response.url().endsWith(`/orders/${order.id}`) && response.request().method() === 'PUT');
  await finance.getByRole('button', { name: /Marquer.*pay/i }).click();
  const response = await updating;
  expect(response.ok()).toBeTruthy();
  expect(response.request().postDataJSON()).toEqual({ paymentStatus: 'paid' });
  const state = (await (await request.get(`${API_BASE_URL}/orders/${order.id}`, { headers: headers(client) })).json()).order;
  expect(state.paymentStatus).toBe('paid'); expect(state.status).toBe(order.status);
  await expect(finance.getByRole('article')).toHaveCount(1);
  await expect(page).toHaveURL(new RegExp(`/orders/${order.id}#dossier-finance$`));
});

test('real step-only finance retains the agent access without exposing the parent service', async ({ page, request }) => {
  const client = await loginAsSeededClient(request), admin = await loginAsSeededAdmin(request), agent = await loginAsSeededAgent(request);
  const created = await request.post(`${API_BASE_URL}/services`, { headers: headers(client), data: { title: `Dossier privé ${Date.now()}`, type: 'other' } });
  expect(created.status()).toBe(201); const service = (await created.json()).service;
  const createdTask = await request.post(`${API_BASE_URL}/tasks`, { headers: headers(client), data: { serviceId: service.id, title: 'Vérification confiée seule', type: 'visit' } });
  expect(createdTask.status()).toBe(201); const task = (await createdTask.json()).task;
  expect((await request.put(`${API_BASE_URL}/tasks/${task.id}/assign`, { headers: headers(admin), data: { agentId: agent.user.id } })).status()).toBe(200);
  const recorded = await request.post(`${API_BASE_URL}/transactions`, { headers: headers(admin), data: { taskId: task.id, type: 'expense', amount: 17, status: 'pending', description: 'Frais uniques de l’intervention' } });
  expect(recorded.status()).toBe(201);
  expect([403,404]).toContain((await request.get(`${API_BASE_URL}/services/${service.id}`, { headers: headers(agent) })).status());
  await blockExternalTracking(page); await seedAuthenticatedSession(page, agent.user, agent.token);
  await page.goto(`/services/${service.id}/transactions?taskId=${task.id}`);
  await expect(page).toHaveURL(new RegExp(`/transactions\\?taskId=${task.id}$`));
  const main = page.getByRole('main');
  await expect(main.getByText('Frais uniques de l’intervention', { exact: true })).toBeVisible();
  await expect(main.getByText(service.title, { exact: true })).toHaveCount(0);
  await main.getByRole('link', { name: 'Retour au dossier', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/tasks/${task.id}$`));
  await expect(main.getByRole('link', { name: 'Retour au dossier du service', exact: true })).toHaveCount(0);
  await main.getByRole('link', { name: 'Frais et règlements de l’étape', exact: true }).click();
  await expect(main.getByText('Frais uniques de l’intervention', { exact: true })).toBeVisible();
});
