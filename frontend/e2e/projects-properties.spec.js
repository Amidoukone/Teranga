const { test, expect } = require('@playwright/test');
const { installApiMocks, seedAuthenticatedSession } = require('./support/mockApi');
async function setup(page, role = 'client') {
  const ctx = await installApiMocks(page, { user: { role } });
  await seedAuthenticatedSession(page, ctx.user, ctx.token);
  await page.addInitScript(() => { localStorage.setItem('teranga_lang', 'fr'); localStorage.setItem('teranga_analytics_consent', 'denied'); });
  ctx.state.projects = [{ id: 14, title: 'Projet familial', clientId: ctx.user.id, type: 'immobilier', status: 'created', currency: 'XOF', createdAt: new Date().toISOString() }];
  ctx.state.properties = [{ id: 301, ownerId: ctx.user.id, title: 'Maison familiale', address: 'Rue 1', city: 'Bamako', type: 'house', status: 'active', countryId: 1, latitude: 12.63, longitude: -8, photos: ['/uploads/titre.pdf'], createdAt: new Date().toISOString() }];
  return ctx;
}
const noOverflow = async page => expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);

for (const width of [360, 1440]) {
  test(`project list has one dossier action and creation leads to embedded payments at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 }); await setup(page);
    const reads = []; page.on('request', request => { if (/\/api\/(?:transactions|users)(?:\?|$)/.test(request.url())) reads.push(request.url()); });
    await page.goto('/projects?q=familial');
    const card = page.getByRole('article', { name: 'Projet familial', exact: true }); await expect(card).toBeVisible();
    await expect(card.getByRole('link')).toHaveCount(1); await expect(card.getByRole('button')).toHaveCount(0);
    expect(reads).toEqual([]);
    await page.getByRole('button', { name: 'Nouveau projet', exact: true }).click();
    const form = page.getByRole('form', { name: 'Nouveau projet', exact: true });
    await form.getByLabel('Titre', { exact: true }).fill('Projet de rénovation');
    await expect(form.getByLabel('Devise', { exact: true })).toBeHidden();
    await expect(page.locator('script[src*="maps.googleapis.com"]')).toHaveCount(0);
    await noOverflow(page); await page.screenshot({ path: testInfo.outputPath('project-create.png'), fullPage: true });
    const created = page.waitForRequest(request => request.url().endsWith('/projects') && request.method() === 'POST');
    await form.getByRole('button', { name: 'Créer le projet', exact: true }).click();
    expect((await created).postDataJSON()).not.toHaveProperty('status');
    await expect(page).toHaveURL(/\/projects\/1001$/);
    await page.getByRole('link', { name: 'Montants et paiements', exact: true }).click();
    await expect(page.locator('#dossier-finance').getByRole('button', { name: 'Actualiser', exact: true })).toBeVisible();
    await expect(page.locator('#dossier-finance').getByRole('button', { name: 'Ajouter un paiement ou une dépense', exact: true })).toHaveCount(0);
    await page.getByRole('link', { name: 'Retour à la liste', exact: true }).click();
    await expect(page).toHaveURL(/\/projects\?q=familial$/);
  });

  test(`property dossier starts a linked intervention with its location already filled at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 }); const ctx = await setup(page);
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/trade-categories') return route.fulfill({ json: { tradeCategories: [{ id: 8, name: 'Plomberie', slug: 'plomberie' }] } });
      if (path === '/service-catalog') return route.fulfill({ json: { configured: true, catalog: [{ definition: { legacyTradeCategoryId: 8 } }] } });
      if (path === '/saved-locations') return route.fulfill({ json: { savedLocations: [] } });
      if (path === '/missions/estimate') return route.fulfill({ json: { estimate: { pricingMode: 'quote_only', currency: 'XOF' } } });
      if (path === '/missions' && route.request().method() === 'POST') {
        const body = route.request().postDataJSON(); expect(body).toMatchObject({ propertyId: 301, address: 'Rue 1, Bamako', latitude: 12.63, longitude: -8 });
        const service = { ...body, id: 803, clientId: ctx.user.id, type: 'other', status: 'created', missionStatus: null };
        ctx.state.services.push(service); return route.fulfill({ status: 201, json: { mission: service } });
      }
      return route.fallback();
    });
    await page.goto('/properties?q=Maison');
    await page.getByRole('link', { name: 'Ouvrir le bien', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Maison familiale', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Document 1', exact: true })).toHaveAttribute('href', /titre\.pdf$/);
    await noOverflow(page); await page.screenshot({ path: testInfo.outputPath('property-dossier.png'), fullPage: true });
    await page.getByRole('link', { name: 'Demander une intervention', exact: true }).click();
    await page.getByRole('button', { name: 'Plomberie', exact: true }).click(); await page.getByRole('button', { name: 'Suivant', exact: true }).click();
    await expect(page.locator('#mission-address')).toHaveValue('Rue 1, Bamako');
    await page.getByLabel('Votre besoin en une phrase').fill('Réparer la fuite du bien');
    await page.getByRole('button', { name: 'Suivant', exact: true }).click(); await page.getByRole('button', { name: 'Envoyer ma demande', exact: true }).click();
    await page.getByRole('link', { name: 'Suivre ma demande', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Réparer la fuite du bien', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Retour au bien', exact: true }).click();
    await expect(page).toHaveURL(/\/properties\/301#property-requests$/);
    await expect(page.locator('#property-requests').getByRole('article', { name: 'Réparer la fuite du bien', exact: true })).toBeVisible();
  });
}

test('project editing lives in its dossier and preserves work and payment state', async ({ page }) => {
  const ctx = await setup(page);
  await page.goto('/projects/14');
  await page.locator('#dossier-details > summary').click();
  await page.getByRole('button', { name: 'Modifier le projet', exact: true }).click();
  const form = page.getByRole('form', { name: 'Modifier le projet', exact: true });
  await form.getByLabel('Titre', { exact: true }).fill('Projet renommé');
  const change = page.waitForRequest(request => request.url().endsWith('/projects/14') && request.method() === 'PUT');
  await form.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  expect((await change).postDataJSON()).not.toHaveProperty('status');
  await expect(page.getByRole('heading', { name: 'Projet renommé', exact: true })).toBeVisible();
  expect(ctx.state.projects[0].status).toBe('created');
});

test('a property refusal hides its documents and creation controls', async ({ page }) => {
  await setup(page);
  await page.route('**/api/properties/301', route => route.fulfill({ status: 403, json: { error: 'Bien hors périmètre' } }));
  await page.goto('/properties/301');
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(/Bien hors périmètre/);
  await expect(page.getByRole('link', { name: 'Demander une intervention', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Document 1', exact: true })).toHaveCount(0);
});

test('a manager opens a property request in its administrative workspace', async ({ page }) => {
  const ctx = await setup(page, 'admin');
  ctx.state.services = [{ id: 803, propertyId: 301, title: 'Intervention prestataire du bien', missionStatus: 'ASSIGNED', status: 'created', tradeCategory: { slug: 'plomberie' } }];
  await page.goto('/properties/301#property-requests');
  const card = page.locator('#property-requests').getByRole('article', { name: 'Intervention prestataire du bien', exact: true });
  await expect(card.getByRole('link', { name: 'Ouvrir la demande', exact: true })).toHaveAttribute('href', '/admin/services?demande=803');
  await expect(page.getByRole('link', { name: 'Demander une intervention', exact: true })).toHaveCount(0);
});
