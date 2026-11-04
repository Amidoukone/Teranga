const { test, expect } = require('@playwright/test');
const { installApiMocks, seedAuthenticatedSession } = require('./support/mockApi');

async function setup(page) {
  const ctx = await installApiMocks(page, { user: { role: 'provider', countryId: 1 } });
  await seedAuthenticatedSession(page, ctx.user, ctx.token);
  await page.addInitScript(() => {
    localStorage.setItem('teranga_lang', 'fr'); localStorage.setItem('i18nextLng', 'fr');
    localStorage.setItem('teranga_analytics_consent', 'denied');
  });
  return ctx;
}
const jobs = [
  { id: 41, title: 'Réparer une fuite', missionStatus: 'IN_PROGRESS', tradeCategory: { slug: 'plomberie' } },
  { id: 42, title: 'Taxi vers la gare', missionStatus: 'ASSIGNED', acceptanceDeadlineAt: '2099-01-01T12:00:00Z', pickupAddress: 'Marché', address: 'Gare', tradeCategory: { slug: 'mobilite' } },
  { id: 43, title: 'Livraison remise', missionStatus: 'COMPLETED', tradeCategory: { slug: 'livraison' } },
  { id: 44, title: 'Réparation confirmée', missionStatus: 'VALIDATED', tradeCategory: { slug: 'plomberie' } },
];

for (const width of [360, 1440]) {
  test(`provider filters services, rides, deliveries and reports in one list at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 }); await setup(page);
    let availableReads = 0, offline = false;
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url()), path = url.pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/providers/me') availableReads += 1;
      if (path === '/missions/43/track') return route.fulfill({ json: { missionId: 43, missionStatus: 'COMPLETED', viewerRole: 'provider', isExecutor: true, tradeCategorySlug: 'livraison', title: 'Livraison remise', completion: { summary: 'Colis remis au destinataire.', evidence: [], ready: true }, location: { address: 'Gare' }, client: { firstName: 'Awa' } } });
      if (path !== '/missions/mine') return route.fallback();
      if (offline) return route.fulfill({ status: 503, json: { error: 'Connexion interrompue' } });
      const view = url.searchParams.get('view'), kind = url.searchParams.get('kind'), q = url.searchParams.get('q');
      const items = jobs.filter(job => view === 'history' ? job.missionStatus === 'VALIDATED' : view === 'offers' ? Boolean(job.acceptanceDeadlineAt) : job.missionStatus !== 'VALIDATED')
        .filter(job => !q || job.title.includes(q))
        .filter(job => kind === 'taxi' ? job.id === 42 : kind === 'delivery' ? job.id === 43 : kind === 'service' ? [41, 44].includes(job.id) : true);
      return route.fulfill({ json: { missions: items, pagination: { total: items.length } } });
    });
    await page.goto('/prestataire/interventions');
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'Mes interventions', exact: true })).toBeVisible();
    await expect(main.getByRole('article')).toHaveCount(3);
    await expect(main.getByText('Le travail est remis et attend la confirmation du client.', { exact: false })).toBeVisible();
    await expect(main.locator('a[href="/missions/41/track"]')).toBeVisible();
    await expect(main.locator('a[href="/courses/42"]')).toBeVisible();
    expect(availableReads).toBe(0);
    await main.getByRole('combobox', { name: 'Type de dossier', exact: true }).selectOption('delivery');
    await expect(main.getByRole('article')).toHaveCount(1);
    await main.getByRole('link', { name: 'Compte rendu et justificatifs', exact: true }).click();
    await page.getByRole('link', { name: /Retour aux interventions/ }).click();
    await expect(page).toHaveURL(/\/prestataire\/interventions\?type=delivery$/);
    await expect(main.getByRole('combobox')).toHaveValue('delivery');
    await main.getByRole('button', { name: 'Effacer les filtres', exact: true }).click();
    await expect(main.getByRole('combobox')).toHaveValue('all');
    await main.getByRole('button', { name: 'Offres à accepter', exact: true }).click();
    await expect(main.getByRole('article', { name: 'Taxi vers la gare', exact: true })).toBeVisible();
    await expect(main.getByRole('article')).toHaveCount(1);
    await expect(main.getByRole('button', { name: 'Accepter l’offre', exact: true })).toBeVisible();
    await expect(main.getByText(/Répondre avant le/)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('offres.png'), fullPage: true });
    await main.getByRole('button', { name: 'Historique', exact: true }).click();
    await main.getByRole('textbox', { name: 'Rechercher par titre, adresse ou numéro' }).fill('confirmée');
    const searched = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/missions/mine') && new URL(response.url()).searchParams.get('q') === 'confirmée' && response.status() === 200);
    await main.getByRole('button', { name: 'Rechercher', exact: true }).click();
    await searched;
    await expect(main.getByText('Réparation confirmée', { exact: true })).toBeVisible();
    offline = true;
    await main.getByRole('button', { name: 'Actualiser', exact: true }).click();
    await expect(main.getByRole('alert')).toBeVisible();
    await expect(main.getByText('Réparation confirmée', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath('historique.png'), fullPage: true });
  });
}

test('provider bookmarks open the common list with the expected type', async ({ page }) => {
  await setup(page);
  await page.route('**/api/v1/missions/mine*', route => route.fulfill({ json: { missions: [], pagination: { total: 0 } } }));
  for (const [path, type] of [['/chauffeur/courses', 'taxi'], ['/livreur/livraisons', 'delivery'], ['/prestataire/services', 'service']]) {
    await page.goto(`${path}?vue=historique&q=ancien&page=2`);
    await expect(page).toHaveURL(url => url.pathname === '/prestataire/interventions' && url.searchParams.get('vue') === 'historique' && url.searchParams.get('q') === 'ancien' && url.searchParams.get('type') === type && url.searchParams.get('page') === '1');
    await expect(page.getByRole('main').getByRole('combobox')).toHaveValue(type);
  }
});
