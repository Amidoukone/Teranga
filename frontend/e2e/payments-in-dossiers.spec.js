const { test, expect } = require('@playwright/test');
const { installApiMocks, seedAuthenticatedSession } = require('./support/mockApi');

async function setup(page, role = 'client') {
  const ctx = await installApiMocks(page, { user: { role } });
  await seedAuthenticatedSession(page, ctx.user, ctx.token);
  await page.addInitScript(() => { localStorage.setItem('teranga_lang','fr'); localStorage.setItem('teranga_analytics_consent','denied'); });
  return ctx;
}
const entry = (id, fields = {}) => ({ id, orderId: 801, type: 'revenue', amount: 2500, currency: 'XOF', status: 'pending', description: `Reçu ${id}`, createdAt: '2026-10-01T12:00:00Z', ...fields });
const noOverflow = async (page) => expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);

for (const width of [360,1440]) {
  test(`orders open their payments in place with one main dossier action at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const ctx = await setup(page);
    ctx.state.transactions = [entry(1, { proofFile: { url: '/uploads/receipt.pdf' } })];
    const reads = [];
    page.on('request', request => { if (/\/(products|transactions)(?:\?|$)/.test(request.url())) reads.push(request.url()); });
    await page.goto('/orders');
    const main = page.getByRole('main');
    const order = main.getByRole('article', { name: ctx.state.orders[0].code });
    await expect(order).toBeVisible();
    await expect(order.getByRole('link')).toHaveCount(1);
    await expect(main.getByRole('form', { name: 'Nouvelle commande', exact: true })).toHaveCount(0);
    expect(reads).toEqual([]);
    await order.getByRole('link', { name: 'Ouvrir la commande', exact: true }).click();
    await expect(page).toHaveURL(/\/orders\/801$/);
    await expect(main.getByRole('heading', { name: 'Justificatifs de réalisation', exact: true })).toBeVisible();
    await expect(main.getByRole('heading', { name: 'Preuves du paiement', exact: true })).toHaveCount(0);
    expect(reads.some(url => url.includes('/transactions'))).toBe(false);
    await main.getByRole('link', { name: 'Montants et paiements', exact: true }).click();
    const finance = page.locator('#dossier-finance');
    await expect(finance.getByRole('link', { name: 'Ouvrir le justificatif', exact: true })).toBeVisible();
    await expect(finance.getByRole('heading', { name: 'Paiement #1', exact: true })).toBeVisible();
    await expect(finance.getByRole('link', { name: 'Retour au dossier', exact: true })).toHaveCount(0);
    await expect(finance.getByRole('link', { name: 'Commande #801', exact: true })).toHaveCount(0);
    await expect(page).toHaveURL(/\/orders\/801#dossier-finance$/);
    await noOverflow(page);
    await page.screenshot({ path: testInfo.outputPath('order-payments-inline.png'), fullPage: true });
  });

  test(`an inline payment keeps the order and draft without opening a second page at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const ctx = await setup(page);
    await page.route('**/api/transactions', async route => {
      if (route.request().method() !== 'POST') return route.fallback();
      const body = route.request().postDataJSON();
      ctx.state.transactions.push(entry(25, { ...body, description: 'Règlement de la commande' }));
      return route.fulfill({ status: 201, json: { transaction: ctx.state.transactions.at(-1) } });
    });
    await page.goto('/orders/801#dossier-finance');
    const finance = page.locator('#dossier-finance');
    await finance.getByRole('button', { name: 'Ajouter un paiement ou une dépense', exact: true }).click();
    await finance.getByLabel('Montant', { exact: true }).fill('2500,50');
    await expect(finance.getByRole('form', { name: 'Enregistrer une opération', exact: true }).getByLabel('Devise', { exact: true })).toBeHidden();
    await finance.locator(':scope > summary').click();
    await finance.locator(':scope > summary').click();
    await expect(finance.getByLabel('Montant', { exact: true })).toHaveValue('2500,50');
    await finance.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(finance.getByText('Écriture enregistrée.', { exact: true })).toBeVisible();
    expect(ctx.state.transactions[0].amount).toBe('2500.50');
    expect(Number(ctx.state.transactions[0].orderId)).toBe(801);
    expect(ctx.state.orders[0].paymentStatus).toBe('unpaid');
    await expect(page).toHaveURL(/\/orders\/801#dossier-finance$/);
    await noOverflow(page);
  });
}

test('embedded payment filters preserve dossier filters and survive reload', async ({ page }) => {
  const ctx = await setup(page);
  ctx.state.transactions = Array.from({ length: 25 }, (_, index) => entry(index + 1));
  const reads = [];
  page.on('request', request => { if (/\/transactions\?/.test(request.url())) reads.push(new URL(request.url()).searchParams); });
  await page.goto('/orders/801?q=parent&page=4#dossier-finance');
  const finance = page.locator('#dossier-finance');
  await expect(finance.getByRole('article')).toHaveCount(20);
  expect(reads.at(-1).get('q')).toBe(null);
  expect(reads.at(-1).get('page')).toBe('1');
  await finance.getByText('Rechercher ou filtrer les paiements', { exact: true }).click();
  await finance.getByLabel('Description ou moyen de paiement', { exact: true }).fill('Reçu 24');
  await finance.getByRole('button', { name: 'Rechercher', exact: true }).click();
  await expect(finance.getByRole('article')).toHaveCount(1);
  const url = new URL(page.url());
  expect(url.searchParams.get('q')).toBe('parent'); expect(url.searchParams.get('page')).toBe('4');
  expect(url.searchParams.get('paiements_q')).toBe('Reçu 24');
  await page.reload();
  await expect(finance).toHaveAttribute('open');
  await expect(finance.getByRole('article')).toHaveCount(1);
});

test('the same order form creates a described order and a catalogue order without price entry for the client', async ({ page }) => {
  await setup(page);
  await page.goto('/orders');
  await page.getByRole('button', { name: 'Nouvelle commande', exact: true }).click();
  const form = page.getByRole('form', { name: 'Nouvelle commande', exact: true });
  await form.getByLabel('Article (facultatif)', { exact: true }).selectOption('901');
  await form.getByLabel('Quantité', { exact: true }).fill('2');
  await expect(form.getByLabel('Prix unitaire (facultatif)', { exact: true })).toHaveCount(0);
  const creation = page.waitForRequest(request => request.url().endsWith('/orders') && request.method() === 'POST');
  await form.getByRole('button', { name: 'Créer la commande', exact: true }).click();
  expect((await creation).postDataJSON().items).toEqual([{ productId: 901, quantity: 2 }]);
  await expect(page).toHaveURL(/\/orders\/802$/);
});

test('revoked embedded finance removes its entries and form while leaving an authorized dossier readable', async ({ page }) => {
  const ctx = await setup(page);
  ctx.state.transactions = [entry(1)];
  let denied = false;
  await page.route('**/api/transactions?**', route => denied ? route.fulfill({ status: 403, json: { error: 'Forbidden' } }) : route.fallback());
  await page.goto('/orders/801#dossier-finance');
  const finance = page.locator('#dossier-finance');
  await expect(finance.getByRole('article')).toHaveCount(1);
  await finance.getByRole('button', { name: 'Ajouter un paiement ou une dépense', exact: true }).click();
  await finance.getByLabel('Montant', { exact: true }).fill('75');
  denied = true;
  await finance.getByRole('button', { name: 'Actualiser', exact: true }).click();
  await expect(finance.getByRole('alert')).toBeVisible();
  await expect(finance.getByRole('article')).toHaveCount(0);
  await expect(finance.getByLabel('Montant', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: ctx.state.orders[0].code })).toBeVisible();
});
