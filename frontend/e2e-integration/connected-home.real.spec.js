const { test, expect } = require('@playwright/test');
const { API_BASE_URL, blockExternalTracking, loginAsSeededAdmin, loginAsSeededAgent, seedAuthenticatedSession } = require('./support/realApi');

test('a real administrator has one home and opens management without loading figures', async ({ page, request }) => {
  const admin = await loginAsSeededAdmin(request);
  await blockExternalTracking(page);
  await seedAuthenticatedSession(page, admin.user, admin.token);
  const financialReads = [];
  page.on('request', (read) => { if (/\/(dashboard\/summary|transactions\/summary)(?:\?|$)/.test(read.url())) financialReads.push(read.url()); });
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/operations$/);
  await expect(page.getByRole('heading', { name: 'Centre des opérations', exact: true })).toBeVisible();
  await page.locator('nav:visible').getByRole('link', { name: 'Gestion', exact: true }).click();
  await expect(page).toHaveURL(/\/gestion$/);
  await page.getByRole('main').getByText('Outils de gestion', { exact: true }).click();
  await expect(page.getByRole('main').getByRole('link', { name: 'Agents', exact: true })).toBeVisible();
  expect(financialReads).toEqual([]);
});

test('a real agent declares availability from the centre without changing capacity', async ({ page, request }) => {
  const agent = await loginAsSeededAgent(request);
  const headers = { Authorization: `Bearer ${agent.token}` };
  const endpoint = `${API_BASE_URL}/v1/operations/agent/capacity`;
  const original = await request.get(endpoint, { headers });
  expect(original.ok()).toBeTruthy();
  const { capacity } = await original.json();
  try {
    expect((await request.patch(endpoint, { headers, data: { available: false } })).ok()).toBeTruthy();
    await page.setViewportSize({ width: 360, height: 900 });
    await blockExternalTracking(page);
    await seedAuthenticatedSession(page, agent.user, agent.token);
    await page.goto('/operations');
    await page.getByRole('button', { name: 'Me rendre disponible', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Me rendre indisponible', exact: true })).toBeVisible();
    const saved = await request.get(endpoint, { headers });
    expect(saved.ok()).toBeTruthy();
    const current = (await saved.json()).capacity;
    expect(current.available).toBe(true);
    expect(current.maxConcurrent).toBe(capacity.maxConcurrent);
    expect(current.availableUntil).toBeTruthy();
  } finally {
    const remainingMinutes = Math.max(15, Math.min(480, Math.ceil((new Date(capacity.availableUntil) - Date.now()) / 60000) || 60));
    expect((await request.patch(endpoint, { headers, data: { available: capacity.available, maxConcurrent: capacity.maxConcurrent, ...(capacity.available ? { availableMinutes: remainingMinutes } : {}) } })).ok()).toBeTruthy();
  }
});
