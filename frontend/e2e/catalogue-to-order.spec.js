const { test, expect } = require('@playwright/test');
const { installApiMocks, seedAuthenticatedSession } = require('./support/mockApi');

async function setup(page, role = 'client') {
  const ctx = await installApiMocks(page, { user: { role } });
  await seedAuthenticatedSession(page, ctx.user, ctx.token);
  await page.addInitScript(() => { localStorage.setItem('teranga_lang', 'fr'); localStorage.setItem('teranga_analytics_consent', 'denied'); });
  ctx.state.products[0] = { ...ctx.state.products[0], description: 'Fournitures pour la maison.', countryId: 1, regionId: null };
  await page.route('**/api/products/901', route => route.fulfill({ json: { product: ctx.state.products[0] } }));
  return ctx;
}
const overflow = async (page) => expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);

for (const width of [360, 1440]) {
  test(`catalogue creates an order in place and opens its payments at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    await page.goto('/shop?q=Produit');
    const card = page.getByRole('article', { name: 'Produit E2E', exact: true });
    await card.getByText('Commander', { exact: true }).click();
    const form = card.getByRole('form');
    await form.getByLabel('Quantité', { exact: true }).fill('2');
    await form.getByLabel('Précision pour la commande (facultatif)', { exact: true }).fill('À remettre à ma sœur.');
    await expect(form.getByText('Total des articles:', { exact: false })).toContainText('24');
    await overflow(page);
    await page.screenshot({ path: testInfo.outputPath('catalogue-order.png'), fullPage: true });
    const creation = page.waitForRequest(request => request.url().endsWith('/orders') && request.method() === 'POST');
    await form.getByRole('button', { name: 'Créer la commande', exact: true }).click();
    expect((await creation).postDataJSON()).toMatchObject({ customerNote: 'À remettre à ma sœur.', currency: 'XOF', countryId: 1, items: [{ productId: 901, quantity: 2 }] });
    await expect(page).toHaveURL(/\/orders\/802$/);
    await page.getByRole('link', { name: 'Montants et paiements', exact: true }).click();
    await expect(page.locator('#dossier-finance').getByRole('button', { name: 'Ajouter un paiement ou une dépense', exact: true })).toBeVisible();
    await page.getByRole('link', { name: /Retour au catalogue/ }).click();
    await expect(page).toHaveURL(/\/shop\?q=Produit$/);
    await expect(page.getByLabel('Rechercher', { exact: true })).toHaveValue('Produit');
  });

  test(`an article can be ordered directly with the original catalogue return preserved at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    await page.goto('/shop?q=Produit&sort=price_asc');
    await page.getByRole('article', { name: 'Produit E2E' }).getByRole('link', { name: 'Produit E2E', exact: true }).click();
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 1, name: 'Produit E2E', exact: true })).toBeVisible();
    const form = main.getByRole('form', { name: 'Commander Produit E2E', exact: true });
    await form.getByLabel('Quantité', { exact: true }).fill('3');
    await overflow(page);
    await page.screenshot({ path: testInfo.outputPath('article-order.png'), fullPage: true });
    await form.getByRole('button', { name: 'Créer la commande', exact: true }).click();
    await expect(page).toHaveURL(/\/orders\/802$/);
    await main.getByRole('link', { name: 'Retour à l’article', exact: true }).click();
    await expect(page).toHaveURL(/\/products\/901$/);
    await main.getByRole('link', { name: 'Catalogue', exact: true }).click();
    await expect(page).toHaveURL(/\/shop\?q=Produit&sort=price_asc$/);
  });
}

test('a creation failure keeps the form open and its draft, and a pending request cannot be sent twice', async ({ page }) => {
  await setup(page);
  let writes = 0;
  let release;
  await page.route('**/api/orders', async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    writes += 1;
    if (writes === 1) return route.fulfill({ status: 400, json: { error: 'Stock actualisé : 1 article disponible' } });
    await new Promise(resolve => { release = resolve; });
    return route.fallback();
  });
  await page.goto('/shop');
  const card = page.getByRole('article', { name: 'Produit E2E' });
  await card.getByText('Commander', { exact: true }).click();
  const form = card.getByRole('form');
  await form.getByLabel('Quantité', { exact: true }).fill('2');
  await form.getByLabel('Précision pour la commande (facultatif)', { exact: true }).fill('Mon brouillon');
  await form.getByRole('button', { name: 'Créer la commande', exact: true }).click();
  await expect(form.getByRole('alert')).toHaveText('Stock actualisé : 1 article disponible');
  await expect(form.getByLabel('Quantité', { exact: true })).toHaveValue('2');
  await card.getByText('Commander', { exact: true }).click();
  await card.getByText('Commander', { exact: true }).click();
  await expect(form.getByLabel('Précision pour la commande (facultatif)', { exact: true })).toHaveValue('Mon brouillon');
  await form.getByLabel('Quantité', { exact: true }).fill('1');
  await form.getByRole('button', { name: 'Créer la commande', exact: true }).click();
  await expect(form.getByRole('button')).toBeDisabled();
  await form.evaluate(element => { element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  expect(writes).toBe(2);
  release();
  await expect(page).toHaveURL(/\/orders\/802$/);
});

test('unavailable stock and agent roles do not offer an unsupported purchase action', async ({ page }) => {
  const ctx = await setup(page, 'agent');
  await page.goto('/shop');
  const card = page.getByRole('article', { name: 'Produit E2E' });
  await expect(card).toBeVisible();
  await expect(card.getByText('Commander', { exact: true })).toHaveCount(0);
  await card.getByRole('link', { name: 'Produit E2E', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Produit E2E', exact: true })).toBeVisible();
  await expect(page.getByRole('main').getByRole('form')).toHaveCount(0);
  ctx.state.products[0].stock = 0;
  await page.goto('/shop');
  await expect(card.getByText('Article indisponible à la commande.', { exact: true })).toBeVisible();
});

test('visitors reach sign in with the intended article preserved and without unauthorized catalogue reads', async ({ page }) => {
  await installApiMocks(page);
  const reads = [];
  page.on('request', request => { if (/\/api\/(?:products|categories)(?:\/|\?|$)/.test(request.url())) reads.push(request.url()); });
  await page.addInitScript(() => { localStorage.setItem('teranga_lang', 'fr'); localStorage.setItem('teranga_analytics_consent', 'denied'); });
  await page.goto('/products/901#product-order');
  await expect(page.getByText('Connectez-vous pour consulter les articles disponibles et passer commande.', { exact: true })).toBeVisible();
  expect(reads).toEqual([]);
  await page.getByRole('link', { name: 'Se connecter pour commander', exact: true }).click();
  await expect.poll(() => page.evaluate(() => history.state?.usr?.from)).toBe('/products/901#product-order');
});
