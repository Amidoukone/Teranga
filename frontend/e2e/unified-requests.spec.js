const { test, expect } = require('@playwright/test');
const { installApiMocks, seedAuthenticatedSession } = require('./support/mockApi');

for (const width of [360, 1440]) {
  test(`all request families share search, history and filtered returns at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const ctx = await installApiMocks(page);
    ctx.state.services = [{ id: 1, title: 'Service familial', status: 'created', createdAt: '2026-01-03T12:00:00Z' }];
    ctx.state.projects = [{ id: 1, title: 'Projet familial', type: 'autre', status: 'created', currency: 'XOF', clientId: ctx.user.id, createdAt: '2026-01-02T12:00:00Z' }];
    ctx.state.orders = [{ id: 1, code: 'CMD-FAMILIAL', userId: ctx.user.id, orderStatus: 'shipped', paymentStatus: 'paid', currency: 'XOF', totalAmount: 1000, createdAt: '2026-01-01T12:00:00Z', items: [] }, { id: 2, code: 'CMD-ARCHIVE', userId: ctx.user.id, orderStatus: 'delivered', paymentStatus: 'paid', createdAt: '2025-01-01T12:00:00Z', items: [] }];
    await seedAuthenticatedSession(page, ctx.user, ctx.token);
    await page.addInitScript(() => { localStorage.setItem('teranga_lang', 'fr'); localStorage.setItem('teranga_analytics_consent', 'denied'); });
    await page.goto('/demandes');
    const main = page.getByRole('main');
    await expect(main.getByRole('article')).toHaveCount(3);
    await expect(main.getByRole('link', { name: 'Vérifier le résultat', exact: true })).toHaveCount(0);
    const order = main.getByRole('article', { name: 'CMD-FAMILIAL', exact: true });
    await expect(order.getByText('Expédiée', { exact: true })).toBeVisible();
    await expect(order.getByText('Paiement : Payée', { exact: true })).toBeVisible();
    await main.getByRole('combobox').selectOption('project');
    await main.getByRole('textbox', { name: 'Rechercher une demande', exact: true }).fill('familial');
    await main.getByRole('button', { name: 'Rechercher', exact: true }).click();
    await expect(main.getByRole('article')).toHaveCount(1);
    await main.getByRole('link', { name: 'Suivre ma demande', exact: true }).click();
    await expect(page).toHaveURL(/\/projects\/1$/);
    await main.getByRole('link', { name: 'Montants et paiements', exact: true }).click();
    await main.getByRole('link', { name: 'Retour aux demandes', exact: true }).click();
    expect(new URL(page.url()).searchParams.get('type')).toBe('project');
    await expect(main.getByRole('textbox', { name: 'Rechercher une demande', exact: true })).toHaveValue('familial');
    await main.getByRole('combobox').selectOption('order');
    await main.getByRole('link', { name: 'Suivre ma demande', exact: true }).click();
    await expect(page).toHaveURL(/\/orders\/1$/);
    await main.getByRole('link', { name: 'Retour aux demandes', exact: true }).click();
    expect(new URL(page.url()).searchParams.get('type')).toBe('order');
    await main.getByRole('button', { name: 'À vérifier', exact: true }).click();
    await expect(main.getByRole('article')).toHaveCount(0);
    await main.getByRole('button', { name: 'Effacer les filtres', exact: true }).click();
    await main.getByRole('button', { name: 'Terminées', exact: true }).click();
    await expect(main.getByRole('article', { name: 'CMD-ARCHIVE', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath('unified-requests.png'), fullPage: true });
    await main.getByRole('link', { name: 'Nouveau projet', exact: true }).click();
    await expect(main.getByRole('form', { name: 'Nouveau projet', exact: true })).toBeVisible();
    await page.goBack();
    await main.getByRole('link', { name: 'Nouvelle commande', exact: true }).click();
    await expect(main.getByRole('form', { name: 'Nouvelle commande', exact: true })).toBeVisible();
  });
}
