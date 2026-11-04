const { test, expect } = require('@playwright/test');
const { installApiMocks, seedAuthenticatedSession } = require('./support/mockApi');

for (const width of [360, 1440]) {
  test(`request filters, pagination, proof review and return navigation at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const completion = { required: true, report: { summary: 'Le travail a été remis avec son justificatif.', attachments: [{ id: 1, kind: 'document', originalName: 'rapport.pdf', filePath: '/uploads/rapport.pdf' }] } };
    const services = [
      ...Array.from({ length: 25 }, (_, index) => ({ id: index + 1, title: `Demande en cours ${index + 1}`, status: 'in_progress' })),
      { id: 9000, title: 'Course à confirmer', status: 'completed', missionStatus: 'COMPLETED', tradeCategory: { slug: 'mobilite', name: 'Mobilité' } },
      { id: 9001, title: 'Compte rendu administratif', status: 'completed', completion },
      { id: 9002, title: 'Demande archivée', status: 'validated' },
    ];
    const ctx = await installApiMocks(page, { state: { services, orders: [] } });
    await seedAuthenticatedSession(page, ctx.user, ctx.token);
    await page.addInitScript(() => { localStorage.setItem('teranga_lang', 'fr'); localStorage.setItem('i18nextLng', 'fr'); localStorage.setItem('teranga_analytics_consent', 'denied'); });
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/missions/9000/track') return route.fulfill({ json: { id: 9000, title: 'Course à confirmer', missionStatus: 'COMPLETED', viewerRole: 'client', isExecutor: false, tradeCategorySlug: 'mobilite', completion } });
      if (path === '/services/9001') return route.fulfill({ json: { service: services.find((row) => row.id === 9001) } });
      return route.fallback();
    });
    await page.goto('/demandes');
    const main = page.getByRole('main');
    await expect(main.getByRole('article')).toHaveCount(20);
    await expect(main.getByText('Demande archivée', { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath('requests-list.png') });
    await main.getByRole('button', { name: 'Page 2', exact: true }).click();
    await expect(main.getByRole('article')).toHaveCount(7);
    await main.getByRole('combobox').selectOption('taxi');
    await expect(main.getByRole('article')).toHaveCount(1);
    expect(new URL(page.url()).searchParams.has('page')).toBe(false);
    await main.getByRole('button', { name: 'À vérifier', exact: true }).click();
    await main.getByRole('link', { name: 'Vérifier le résultat', exact: true }).click();
    await expect(page).toHaveURL(/\/courses\/9000$/);
    await expect(main.getByRole('link', { name: 'rapport.pdf' })).toBeVisible();
    await expect(main.getByRole('button', { name: 'Valider la mission', exact: true })).toHaveCount(1);
    await main.getByRole('link', { name: /Retour aux demandes/ }).click();
    expect(new URL(page.url()).searchParams.get('type')).toBe('taxi');
    expect(new URL(page.url()).searchParams.get('vue')).toBe('a-verifier');
    await main.getByRole('combobox').selectOption('all');
    await main.getByRole('textbox', { name: 'Rechercher une demande', exact: true }).fill('Compte rendu');
    await main.getByRole('button', { name: 'Rechercher', exact: true }).click();
    await expect(main.getByRole('article')).toHaveCount(1);
    await main.getByRole('link', { name: 'Vérifier le résultat', exact: true }).click();
    await expect(page).toHaveURL(/\/services\/9001$/);
    const proof = main.getByRole('link', { name: 'rapport.pdf' });
    const confirm = main.getByRole('button', { name: "Je confirme que c'est terminé", exact: true });
    await expect(proof).toBeVisible(); await expect(confirm).toBeVisible(); await expect(confirm).toHaveCount(1);
    expect(await proof.evaluate((node) => Boolean(node.compareDocumentPosition(Array.from(document.querySelectorAll('button')).find((button) => button.textContent.includes("Je confirme que c'est terminé"))) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath('request-review.png'), fullPage: true });
    await main.getByRole('link', { name: /Retour aux services/ }).click();
    await expect(main.getByRole('textbox', { name: 'Rechercher une demande', exact: true })).toHaveValue('Compte rendu');
    await main.getByRole('button', { name: 'Effacer les filtres', exact: true }).click();
    await main.getByRole('button', { name: 'Terminées', exact: true }).click();
    await expect(main.getByText('Demande archivée', { exact: true })).toBeVisible();
  });
}
