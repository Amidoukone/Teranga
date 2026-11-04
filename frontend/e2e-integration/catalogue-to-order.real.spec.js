const { test, expect } = require('@playwright/test');
const { API_BASE_URL, blockExternalTracking, loginAsSeededClient, loginAsSeededAdmin, seedAuthenticatedSession } = require('./support/realApi');
const headers = session => ({ Authorization: `Bearer ${session.token}` });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8l8AAAAASUVORK5CYII=', 'base64');

async function setup(page, request, suffix) {
  const client = await loginAsSeededClient(request), admin = await loginAsSeededAdmin(request);
  const name = `Article parcours ${suffix} ${Date.now()}`;
  const created = await request.post(`${API_BASE_URL}/products`, {
    headers: headers(admin), multipart: { name, description: 'Article de recette dans la base isolée.', price: '1575.5', currency: 'XOF', stock: '10', countryId: String(client.user.countryId), regionId: String(client.user.regionId) },
  });
  expect(created.status(), await created.text()).toBe(201);
  const product = (await created.json()).product;
  await blockExternalTracking(page); await seedAuthenticatedSession(page, client.user, client.token);
  return { client, admin, product, name };
}

test('real catalogue order uses the server price, reserves stock and keeps its receipt in the same dossier', async ({ page, request }, testInfo) => {
  const { client, product, name } = await setup(page, request, 'catalogue');
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto(`/shop?q=${encodeURIComponent(name)}`);
  const card = page.getByRole('article', { name, exact: true });
  await card.getByText('Commander', { exact: true }).click();
  const form = card.getByRole('form');
  await form.getByLabel('Quantité', { exact: true }).fill('3');
  await form.getByLabel('Précision pour la commande (facultatif)', { exact: true }).fill('Article commandé depuis le catalogue.');
  const creating = page.waitForResponse(response => response.url().endsWith('/orders') && response.request().method() === 'POST');
  await form.getByRole('button', { name: 'Créer la commande', exact: true }).click();
  const response = await creating;
  expect(response.status(), await response.text()).toBe(201);
  const order = (await response.json()).order;
  expect(response.request().postDataJSON().items).toEqual([{ productId: product.id, quantity: 3 }]);
  expect(Number(order.totalAmount ?? order.total)).toBe(4726.5);
  expect(order.paymentStatus).toBe('unpaid'); expect(order.status).toBe('created');
  await expect(page).toHaveURL(new RegExp(`/orders/${order.id}$`));
  await page.getByRole('link', { name: 'Montants et paiements', exact: true }).click();
  const finance = page.locator('#dossier-finance');
  await finance.getByRole('button', { name: 'Ajouter un paiement ou une dépense', exact: true }).click();
  await finance.getByLabel('Montant', { exact: true }).fill('1000');
  await finance.getByLabel('Description', { exact: true }).fill('Acompte à vérifier.');
  await finance.getByLabel('Reçu ou justificatif de paiement', { exact: true }).setInputFiles({ name: 'recu-commande.png', mimeType: 'image/png', buffer: png });
  const writing = page.waitForResponse(result => result.url().endsWith('/transactions') && result.request().method() === 'POST');
  await finance.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  const saved = await writing; expect(saved.status(), await saved.text()).toBe(201);
  await expect(finance.getByText('Écriture enregistrée.', { exact: true })).toBeVisible();
  await expect(finance.getByRole('link', { name: 'Ouvrir le justificatif', exact: true })).toBeVisible();
  const after = await request.get(`${API_BASE_URL}/orders/${order.id}`, { headers: headers(client) });
  const current = (await after.json()).order;
  expect(current.paymentStatus).toBe('unpaid'); expect(current.status).toBe('created');
  const stock = await request.get(`${API_BASE_URL}/products/${product.id}`, { headers: headers(client) });
  expect(Number((await stock.json()).product.stock)).toBe(7);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('catalogue-order-payment-real.png'), fullPage: true });
  await page.getByRole('link', { name: /Retour au catalogue/ }).click();
  await expect(page.getByLabel('Rechercher', { exact: true })).toHaveValue(name);
});

test('real article order keeps its draft when server stock changes and returns to the original search', async ({ page, request }) => {
  const { client, admin, product, name } = await setup(page, request, 'fiche');
  await page.goto(`/shop?q=${encodeURIComponent(name)}&sort=price_asc`);
  await page.getByRole('article', { name, exact: true }).getByRole('link', { name, exact: true }).click();
  const form = page.getByRole('form', { name: `Commander ${name}`, exact: true });
  await form.getByLabel('Quantité', { exact: true }).fill('2');
  await form.getByLabel('Précision pour la commande (facultatif)', { exact: true }).fill('Conserver les instructions.');
  const stockChanged = await request.put(`${API_BASE_URL}/products/${product.id}`, { headers: headers(admin), multipart: { stock: '1' } });
  expect(stockChanged.status(), await stockChanged.text()).toBe(200);
  const rejected = page.waitForResponse(response => response.url().endsWith('/orders') && response.request().method() === 'POST');
  await form.getByRole('button', { name: 'Créer la commande', exact: true }).click();
  expect((await rejected).status()).toBe(400);
  await expect(form.getByRole('alert')).toContainText('Stock insuffisant');
  await expect(form.getByLabel('Quantité', { exact: true })).toHaveValue('2');
  await expect(form.getByLabel('Précision pour la commande (facultatif)', { exact: true })).toHaveValue('Conserver les instructions.');
  await form.getByLabel('Quantité', { exact: true }).fill('1');
  const creation = page.waitForResponse(response => response.url().endsWith('/orders') && response.request().method() === 'POST');
  await form.getByRole('button', { name: 'Créer la commande', exact: true }).click();
  const created = await creation; expect(created.status(), await created.text()).toBe(201);
  const order = (await created.json()).order;
  expect(Number(order.totalAmount ?? order.total)).toBe(1575.5);
  await expect(page).toHaveURL(new RegExp(`/orders/${order.id}$`));
  await page.getByRole('link', { name: 'Retour à l’article', exact: true }).click();
  await expect(page.getByText('Article indisponible à la commande.', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Catalogue', exact: true }).click();
  await expect(page.getByLabel('Rechercher', { exact: true })).toHaveValue(name);
  expect(new URL(page.url()).searchParams.get('sort')).toBe('price_asc');
  const stock = await request.get(`${API_BASE_URL}/products/${product.id}`, { headers: headers(client) });
  expect(Number((await stock.json()).product.stock)).toBe(0);
});
