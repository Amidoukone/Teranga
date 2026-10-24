const { test, expect } = require('@playwright/test');
const { API_BASE_URL, blockExternalTracking, loginAsSeededAdmin, loginAsSeededAgent, loginAsSeededClient, seedAuthenticatedSession } = require('./support/realApi');

test('real coordination: an administrator assigns an order and the agent starts its preparation', async ({ page, request, browser }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await blockExternalTracking(page);
  const admin = await loginAsSeededAdmin(request);
  const agent = await loginAsSeededAgent(request);
  const client = await loginAsSeededClient(request);
  const orders = await request.get(`${API_BASE_URL}/orders`, { headers: { Authorization: `Bearer ${client.token}` } });
  expect(orders.ok()).toBeTruthy();
  const order = (await orders.json()).orders.find((item) => item.code === 'CMD-E2E-REAL-001');
  expect(order?.id).toBeTruthy();
  const capacity = await request.patch(`${API_BASE_URL}/v1/operations/agent/capacity`, { headers: { Authorization: `Bearer ${agent.token}` }, data: { maxConcurrent: 3, available: false } });
  expect(capacity.ok()).toBeTruthy();
  await seedAuthenticatedSession(page, admin.user, admin.token);
  await page.goto(`/operations?vue=coordonner&type=order&demande=${order.id}`);
  const card = page.getByRole('article', { name: order.code });
  await expect(card).toBeVisible();
  const ownership = page.waitForResponse((response) => response.url().endsWith(`/operations/work/order/${order.id}`) && response.request().method() === 'PATCH');
  await card.getByRole('button', { name: 'Prendre en charge', exact: true }).click();
  expect((await ownership).status()).toBe(200);
  await card.getByText('Organiser la prise en charge', { exact: true }).click();
  await card.getByRole('button', { name: 'Modifier l’affectation ou le délai', exact: true }).click();
  await card.getByRole('combobox', { name: 'Agent chargé de la demande', exact: true }).selectOption(String(agent.user.id));
  const assignment = page.waitForResponse((response) => response.url().endsWith(`/operations/work/order/${order.id}`) && response.request().method() === 'PATCH');
  await card.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  expect((await assignment).status()).toBe(200);
  await expect(card.getByRole('combobox', { name: 'Agent chargé de la demande', exact: true })).toHaveValue(String(agent.user.id));
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('assigned-order.png'), fullPage: true });
  const context = await browser.newContext({ viewport: { width: 360, height: 900 } });
  try {
    const worker = await context.newPage();
    await blockExternalTracking(worker); await seedAuthenticatedSession(worker, agent.user, agent.token);
    await worker.goto('/dashboard');
    const work = worker.getByRole('article').filter({ hasText: order.code });
    const start = worker.waitForResponse((response) => response.url().endsWith(`/operations/work/order/${order.id}/status`) && response.request().method() === 'POST');
    await work.getByRole('button', { name: 'Commencer la préparation', exact: true }).click();
    expect((await start).status()).toBe(200);
    await expect(work.getByRole('button', { name: 'Confirmer l’expédition', exact: true })).toBeVisible();
    const detail = await request.get(`${API_BASE_URL}/orders/${order.id}`, { headers: { Authorization: `Bearer ${client.token}` } });
    expect(detail.ok()).toBeTruthy(); expect((await detail.json()).order.status).toBe('processing');
  } finally { await context.close(); }
});
