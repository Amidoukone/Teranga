const { test, expect } = require('@playwright/test');
const users = { client: 'Mon suivi', agent: 'Mon travail', provider: 'Mon activité', admin: 'Pilotage' };

for (const [role, title] of Object.entries(users)) {
  test(`${role}: compiled HTTPS application keeps a cookie-only session after reload`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width: role === 'admin' ? 1440 : 360, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('teranga_lang', 'fr'); localStorage.setItem('teranga_analytics_consent', 'denied');
    });
    const requests = [], failures = [];
    page.on('request', request => { if (/\/api(?:\/|$)|\/uploads\//.test(new URL(request.url()).pathname)) requests.push(request); });
    page.on('pageerror', error => failures.push(error.message));
    await page.goto('/login');
    await page.locator('#login-identifier').fill(`e2e.real.${role}@example.com`);
    await page.locator('#login-password').fill('Password123!');
    await page.locator('form button[type="submit"]').click();
    await expect(page).toHaveURL(/\/operations$/);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    const cookies = await context.cookies();
    expect(cookies.find(cookie => cookie.name === 'teranga_access')).toMatchObject({ httpOnly: true, secure: true });
    expect(cookies.find(cookie => cookie.name === 'teranga_csrf')).toMatchObject({ httpOnly: false, secure: true });
    expect(await page.evaluate(() => ['teranga_token', 'token', 'teranga_refresh_token'].map(key => localStorage.getItem(key)))).toEqual([null, null, null]);
    await page.reload();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    if (role === 'agent' || role === 'provider') {
      const available = page.getByRole('button', { name: 'Me rendre disponible', exact: true });
      const offline = page.getByRole('button', { name: 'Me rendre indisponible', exact: true });
      await expect(available.or(offline)).toBeVisible();
      if (await available.isVisible()) await available.click();
      await expect(offline).toBeVisible();
    }
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.every(request => new URL(request.url()).origin === 'https://127.0.0.1:5443')).toBe(true);
    expect(requests.some(request => request.headers().authorization)).toBe(false);
    expect(failures).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`${role}-https.png`), fullPage: true });
    if (role === 'client') {
      const mutation = await page.request.patch('/api/auth/me', { data: { firstName: 'Unsent change' } });
      expect(mutation.status()).toBe(403);
      expect((await mutation.json()).error).toContain('CSRF');
      expect((await page.request.post('/api/auth/logout')).ok()).toBe(true);
      await page.reload();
      await expect(page).toHaveURL(/\/login$/);
      expect((await context.cookies()).some(cookie => cookie.name === 'teranga_access')).toBe(false);
    }
  });
}

test('GPS permission is usable in the HTTPS page and unknown API routes remain JSON', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 12.6392, longitude: -8.0029 });
  const response = await page.goto('/login');
  expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow');
  expect(response.headers()['content-security-policy']).not.toContain("default-src 'none'");
  expect(await page.evaluate(() => window.isSecureContext)).toBe(true);
  const latitude = await page.evaluate(() => new Promise(resolve => navigator.geolocation.getCurrentPosition(position => resolve(position.coords.latitude), () => resolve(null))));
  expect(latitude).toBeCloseTo(12.6392);
  const api = await page.request.get('/api/route-that-does-not-exist');
  expect(api.status()).toBe(404); expect(api.headers()['content-type']).toContain('application/json');
  const missing = await page.request.get('/static/missing.js');
  expect(missing.status()).toBe(404);
});

test('agent and client complete a service and download its proof through the same HTTPS origin', async ({ page, browser }) => {
  test.setTimeout(90000);
  async function login(target, role) {
    await target.addInitScript(() => { localStorage.setItem('teranga_lang', 'fr'); localStorage.setItem('teranga_analytics_consent', 'denied'); });
    await target.goto('/login');
    await target.locator('#login-identifier').fill(`e2e.real.${role}@example.com`);
    await target.locator('#login-password').fill('Password123!');
    await target.locator('form button[type="submit"]').click();
    await expect(target).toHaveURL(/\/operations$/);
  }
  await page.setViewportSize({ width: 360, height: 900 }); await login(page, 'agent');
  await page.goto('/agent/services');
  const card = page.getByRole('article').filter({ hasText: 'Service E2E Reelle - Entretien Villa' });
  await card.getByRole('button', { name: 'Je commence le service', exact: true }).click();
  await card.getByRole('link', { name: 'Préparer la remise au client' }).click();
  await page.getByLabel('Travaux réalisés, résultat et points à signaler').fill('La prestation est réalisée et contrôlée. La photographie présente le résultat remis au client.');
  await page.getByLabel('Ajouter des justificatifs', { exact: true }).setInputFiles({ name: 'preuve-https.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM90AAAAASUVORK5CYII=', 'base64') });
  await page.getByRole('button', { name: 'Enregistrer le compte rendu', exact: true }).click();
  const finish = page.getByRole('button', { name: "J'ai terminé le service", exact: true });
  await expect(finish.last()).toBeVisible();
  const dossier = page.url().split('#')[0];
  await finish.last().click();
  await expect(page.getByText('Le client a été informé et peut confirmer.', { exact: true })).toBeVisible();
  const customerContext = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 360, height: 900 } });
  try {
    const customer = await customerContext.newPage(); await login(customer, 'client'); await customer.goto(dossier);
    const evidence = customer.getByRole('link', { name: 'preuve-https.png', exact: true });
    await expect(evidence).toBeVisible();
    const url = new URL(await evidence.getAttribute('href'), customer.url());
    expect(url.origin).toBe('https://127.0.0.1:5443');
    const proof = await customer.request.get(url.href);
    expect(proof.status()).toBe(200); expect(proof.headers()['content-type']).toContain('image/png');
    await customer.getByRole('button', { name: "Je confirme que c'est terminé", exact: true }).last().click();
    await expect(customer.getByText('Service confirmé et clôturé', { exact: true }).first()).toBeVisible();
  } finally { await customerContext.close(); }
});
