const { test, expect } = require('@playwright/test');
const { installApiMocks, seedAuthenticatedSession } = require('./support/mockApi');

for (const width of [360, 1440]) {
  test(`service case keeps optional steps and their evidence in one screen at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const service = { id: 501, title: 'Inspection de la maison', type: 'other', status: 'in_progress', clientId: 101, countryId: 1, regionId: 1, currency: 'GHS' };
    const task = { id: 601, serviceId: 501, title: 'Contrôler le compteur', status: 'completed', type: 'visit', priority: 'normal', assignedTo: 7, assignee: { firstName: 'Awa' } };
    const ctx = await installApiMocks(page, { state: { services: [service], tasks: [task], evidences: [{ id: 801, taskId: 601, originalName: 'compteur.pdf', filePath: 'https://example.com/compteur.pdf', notes: 'Relevé effectué pendant la visite.' }] } });
    await seedAuthenticatedSession(page, ctx.user, ctx.token);
    await page.addInitScript(() => { localStorage.setItem('teranga_lang', 'fr'); localStorage.setItem('i18nextLng', 'fr'); localStorage.setItem('teranga_analytics_consent', 'denied'); });
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/services/501') return route.fulfill({ json: { service } });
      return route.fallback();
    });
    await page.goto('/services/501');
    await page.getByText('Étapes de réalisation', { exact: false }).filter({ hasText: '(1)' }).click();
    const step = page.getByRole('article', { name: 'Contrôler le compteur' });
    await expect(step).toBeVisible();
    await expect(step.getByRole('button', { name: 'Contrôler l’étape' })).toHaveCount(0);
    await step.getByRole('button', { name: 'Justificatifs de cette étape' }).click();
    await expect(step.getByRole('link', { name: 'Ouvrir compteur.pdf' })).toBeVisible();
    await expect(page).toHaveURL(/\/services\/501$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath('service-steps.png'), fullPage: true });
    await page.getByRole('button', { name: 'Ajouter une étape', exact: true }).click();
    await page.getByLabel('Que faut-il réaliser ?', { exact: true }).fill('Vérifier la porte');
    await page.getByRole('button', { name: 'Créer l’étape', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Vérifier la porte' })).toBeVisible();
    expect(ctx.state.tasks.find((item) => item.title === 'Vérifier la porte').assignedTo).toBeNull();
    expect(ctx.state.tasks.find((item) => item.title === 'Vérifier la porte').currency).toBe('GHS');
    await page.goto('/services/501/tasks');
    await expect(page.getByRole('heading', { name: 'Vérifier la porte' })).toBeVisible();
    await page.goto('/services/501/tasks?etape=601&pieces=1#steps');
    await expect(page).toHaveURL(/\/services\/501\?etape=601&pieces=1#steps$/);
    await expect(page.getByRole('link', { name: 'Ouvrir compteur.pdf' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Vérifier la porte' })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('service-steps-focused.png'), fullPage: true });
    await page.getByRole('link', { name: 'Voir toutes les étapes', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Vérifier la porte' })).toBeVisible();
  });
}
