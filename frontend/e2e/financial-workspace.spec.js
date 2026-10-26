const { test, expect } = require('@playwright/test');
const { installApiMocks, seedAuthenticatedSession } = require('./support/mockApi');

async function setup(page, role = 'admin') {
  const ctx = await installApiMocks(page, { user: { role } });
  await seedAuthenticatedSession(page, ctx.user, ctx.token);
  await page.addInitScript(() => { localStorage.setItem('teranga_lang', 'fr'); localStorage.setItem('teranga_analytics_consent', 'denied'); });
  return ctx;
}
const entry = (id, extra = {}) => ({ id, amount: 1, currency: 'GHS', type: 'revenue', status: 'completed', description: `Reçu ${id}`, createdAt: new Date(2026, 0, 1, 0, id).toISOString(), ...extra });
const noOverflow = async (page) => expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);

for (const width of [360, 1440]) {
  test(`the common journal searches all pages and returns to its case at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const ctx = await setup(page, 'client');
    ctx.state.transactions = Array.from({ length: 43 }, (_, index) => entry(index + 1, { serviceId: 501 }));
    const reads = [];
    page.on('request', (request) => { if (request.url().includes('/transactions?')) reads.push(new URL(request.url()).searchParams); });
    await page.goto('/transactions');
    const main = page.getByRole('main');
    await expect(main.getByRole('article')).toHaveCount(20);
    await main.getByRole('button', { name: 'Suivant', exact: true }).click();
    await expect(page).toHaveURL(/page=2/);
    await main.getByLabel('Description ou moyen de paiement', { exact: true }).fill('Reçu 1');
    await main.getByRole('button', { name: 'Rechercher', exact: true }).click();
    await expect(main.getByRole('article')).toHaveCount(11);
    expect(reads.at(-1).get('page')).toBe('1');
    await main.getByRole('article').first().getByRole('link', { name: 'Service #501', exact: true }).click();
    await expect(page).toHaveURL(/\/services\/501$/);
    await expect(main.getByRole('link', { name: 'Retour aux paiements et dépenses', exact: true })).toHaveAttribute('href', /\/transactions\?q=/);
    await page.goto('/services/501/transactions');
    await expect(main.getByRole('button', { name: 'Enregistrer une opération', exact: true })).toHaveCount(0);
    await expect(main.getByRole('article')).toHaveCount(20);
    await main.getByRole('link', { name: 'Retour au dossier', exact: true }).click();
    await expect(page).toHaveURL(/\/services\/501$/);
    await noOverflow(page);
    await page.screenshot({ path: testInfo.outputPath('service-payment-entry.png'), fullPage: true });
  });

  test(`the statement reads beyond 200 entries without mixing currency or status at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const ctx = await setup(page);
    ctx.state.transactions = [...Array.from({ length: 205 }, (_, index) => entry(index + 1)), entry(206, { amount: 10, status: 'pending' }), entry(207, { amount: 90000, currency: 'GNF' })];
    await page.goto('/finance');
    await expect(page).toHaveURL(/\/transactions\?vue=bilan$/);
    const main = page.getByRole('main');
    await expect(main.getByText('215 GHS', { exact: true })).toHaveCount(2);
    await main.getByLabel('Statut de l’écriture', { exact: true }).selectOption('completed');
    await expect(main.getByText('205 GHS', { exact: true })).toHaveCount(2);
    await main.getByLabel('Devise', { exact: true }).selectOption('GNF');
    await expect(main.getByText(/90[\s\u202f\u00a0]?000 GNF/)).toHaveCount(2);
    const download = page.waitForEvent('download');
    await main.getByRole('button', { name: 'Exporter le bilan CSV', exact: true }).click();
    expect((await download).suggestedFilename()).toContain('GNF');
    await main.getByRole('heading').first().click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await noOverflow(page);
    await page.screenshot({ path: testInfo.outputPath('financial-statement.png'), fullPage: true });
  });
}

test('service, project and order share a form while keeping their business states unchanged', async ({ page }) => {
  const ctx = await setup(page);
  ctx.state.projects = [{ id: 14, title: 'Projet de famille', currency: 'GHS', status: 'in_progress', agentId: ctx.user.id }];
  ctx.state.services[0].currency = 'GHS';
  const saved = [];
  await page.route('**/api/transactions', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    let body;
    if (route.request().headers()['content-type']?.includes('multipart')) {
      body = {};
      const raw = route.request().postDataBuffer().toString('utf8');
      for (const part of raw.split(/\r\n--/)) {
        const name = part.match(/name="([^"]+)"/)?.[1];
        if (name) body[name] = part.split('\r\n\r\n')[1]?.replace(/\r\n$/, '');
      }
    } else body = route.request().postDataJSON();
    saved.push(body);
    const row = entry(1000 + saved.length, { ...body, currency: body.currency || 'GHS', proofFile: body.proofFile ? { url: '/uploads/receipt.pdf' } : null });
    ctx.state.transactions.push(row);
    return route.fulfill({ status: 201, json: { transaction: row } });
  });
  for (const [path, field, id] of [['/services/501/transactions', 'serviceId', 501], ['/projects/14/transactions', 'projectId', 14], ['/orders/801/transactions', 'orderId', 801]]) {
    await page.goto(path);
    const main = page.getByRole('main');
    await main.getByRole('button', { name: 'Enregistrer une opération', exact: true }).click();
    await main.getByLabel('Montant', { exact: true }).fill('25,50');
    if (field === 'serviceId') await main.getByLabel('Reçu ou justificatif de paiement', { exact: true }).setInputFiles({ name: 'receipt.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 Receipt') });
    if (field === 'orderId') await expect(main.getByText(/ne crée pas un acompte supplémentaire/)).toBeVisible();
    await main.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(main.getByText('Écriture enregistrée.', { exact: true })).toBeVisible();
    expect(Number(saved.at(-1)[field])).toBe(id);
    expect(saved.at(-1).amount).toBe('25.50');
    await expect(main.getByRole('article')).toHaveCount(1);
  }
  expect(ctx.state.services[0].status).toBe('pending');
  expect(ctx.state.projects[0].status).toBe('in_progress');
  expect(ctx.state.orders[0].paymentStatus).toBe('unpaid');
});

test('a journal outage retains a draft and access revocation removes the entries', async ({ page }) => {
  const ctx = await setup(page);
  ctx.state.transactions = [entry(1)];
  let status = 200;
  await page.route('**/api/transactions?**', (route) => status === 200 ? route.fallback() : route.fulfill({ status, json: { error: 'Unavailable' } }));
  await page.goto('/transactions');
  const main = page.getByRole('main');
  await expect(main.getByRole('article')).toHaveCount(1);
  await main.getByRole('button', { name: 'Enregistrer une opération', exact: true }).click();
  await main.getByLabel('Montant', { exact: true }).fill('75');
  status = 503;
  await main.getByRole('button', { name: 'Actualiser', exact: true }).click();
  await expect(main.getByRole('alert')).toBeVisible();
  await expect(main.getByLabel('Montant', { exact: true })).toHaveValue('75');
  await expect(main.getByRole('article')).toHaveCount(1);
  status = 403;
  await main.getByRole('button', { name: 'Actualiser', exact: true }).click();
  await expect(main.getByRole('article')).toHaveCount(0);
  await expect(main.getByLabel('Montant', { exact: true })).toHaveCount(0);
});

test('an agent authorized only on a step retains its financial workspace', async ({ page }) => {
  const ctx = await setup(page, 'agent');
  ctx.state.tasks = [{ id: 29, serviceId: 501, title: 'Relevé confié seul', assignedTo: ctx.user.id, status: 'created' }];
  ctx.state.transactions = [entry(1, { taskId: 29 })];
  await page.route('**/api/services/501', (route) => route.fulfill({ status: 403, json: { error: 'Forbidden' } }));
  await page.goto('/services/501/transactions?taskId=29');
  await expect(page).toHaveURL(/\/transactions\?taskId=29$/);
  await expect(page.getByRole('main').getByRole('article')).toHaveCount(1);
  await expect(page.getByText('Relevé confié seul', { exact: false })).toBeVisible();
  await page.getByRole('main').getByRole('link', { name: 'Retour au dossier', exact: true }).click();
  await expect(page).toHaveURL(/\/tasks\/29$/);
});
