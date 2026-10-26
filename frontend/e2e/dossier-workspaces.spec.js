const { test, expect } = require('@playwright/test');
const { installApiMocks, seedAuthenticatedSession } = require('./support/mockApi');

async function fixture(page, role, kind) {
  const ctx = await installApiMocks(page, { user: { role } });
  ctx.state.projects = [{ id: 14, title: 'Travaux de la maison familiale', status: role === 'client' ? 'completed' : 'in_progress', clientId: ctx.user.id, agentId: ctx.user.id, currency: 'XOF', budget: 45000, countryId: 1, coordination: { executorUserId: ctx.user.id, policy: { completionReport: role === 'client' ? { summary: 'La maison a été inspectée et les travaux vérifiés.', reporterId: 9 } : null } } }];
  ctx.state.projectPhases = [{ id: 21, projectId: 14, title: 'Inspection du chantier', status: role === 'client' ? 'completed' : 'active' }];
  ctx.state.projectDocuments = [{ id: 31, projectId: 14, title: 'Rapport de visite', kind: 'report', mimeType: 'application/pdf', filePath: '/uploads/report.pdf', uploaderId: 9 }];
  ctx.state.tasks = [];
  ctx.state.orders = [{ id: 14, code: 'CMD-FAMILLE', userId: ctx.user.id, status: 'shipped', orderStatus: 'shipped', paymentStatus: 'unpaid', currency: 'XOF', totalAmount: 45000, items: [{ id: 41, quantity: 1, unitPrice: 45000, product: { name: 'Documents à remettre' } }], coordination: { executorUserId: ctx.user.id, policy: {} } }];
  await seedAuthenticatedSession(page, ctx.user, ctx.token);
  await page.goto(`/${kind === 'project' ? 'projects' : 'orders'}/14`);
  const consent = page.getByRole('button', { name: 'Refuser', exact: true }); if (await consent.isVisible()) await consent.click();
  return ctx;
}

for (const width of [360, 1440]) {
  test(`project: result precedes customer confirmation at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const ctx = await fixture(page, 'client', 'project');
    await expect(page.getByRole('heading', { name: 'Travaux de la maison familiale' })).toBeVisible();
    const confirm = page.getByRole('button', { name: 'Confirmer la réalisation du projet', exact: true });
    await expect(confirm).toBeVisible();
    expect(await page.getByText('Rapport de visite', { exact: true }).evaluate((node) => Boolean(node.compareDocumentPosition(document.querySelector('#work-progress button[type="submit"]')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
    await expect(page.locator('#dossier-finance')).not.toHaveAttribute('open');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath('project-case.png'), fullPage: true });
    await confirm.click(); await expect.poll(() => ctx.state.projects[0].status).toBe('validated');
  });

  test(`order: delivery and payment remain separate at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const ctx = await fixture(page, 'agent', 'order');
    await expect(page.getByRole('heading', { name: 'CMD-FAMILLE' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirmer la livraison', exact: true })).toBeVisible();
    await expect(page.getByText('Ajoutez un justificatif de préparation ou de remise avec votre propre compte.', { exact: true }).first()).toBeVisible();
    await page.getByRole('link', { name: 'Montants et paiements', exact: true }).click();
    await expect(page.locator('#dossier-finance')).toHaveAttribute('open');
    await expect(page.getByText('Le paiement et la réalisation sont suivis séparément. Un justificatif ajouté ne constitue pas un paiement enregistré.', { exact: true })).toBeVisible();
    expect(ctx.state.orders[0].paymentStatus).toBe('unpaid');
    await expect(page.getByRole('button', { name: 'Confirmer la réalisation du projet', exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath('order-case.png'), fullPage: true });
  });
}

test('the manager completes a phase without losing the handover draft', async ({ page }) => {
  await fixture(page, 'admin', 'project');
  const summary = page.getByLabel('Travaux réalisés, résultat et points à signaler', { exact: true });
  await summary.fill('Compte rendu en préparation, à conserver pendant le suivi.');
  await page.getByRole('combobox', { name: 'Avancement de la phase : Inspection du chantier', exact: true }).selectOption('completed');
  await expect(page.getByText('Les phases et étapes sont terminées.', { exact: true })).toBeVisible();
  await expect(summary).toHaveValue('Compte rendu en préparation, à conserver pendant le suivi.');
});

test('an existing project step opens its limited workspace and returns to its project', async ({ page }) => {
  const ctx = await fixture(page, 'agent', 'project');
  ctx.state.tasks = [{ id: 29, projectId: 14, title: 'Relever le compteur', status: 'created', assignedTo: ctx.user.id }];
  await page.reload();
  await page.getByText('Étapes complémentaires (1)', { exact: true }).click();
  await page.getByRole('link', { name: 'Ouvrir l’étape', exact: true }).click();
  await expect(page).toHaveURL(/\/tasks\/29$/);
  await page.getByRole('link', { name: 'Retour au projet', exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/14#project-tasks$/);
});
