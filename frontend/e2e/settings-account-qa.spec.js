const { test, expect } = require('@playwright/test');
const { installApiMocks, seedAuthenticatedSession } = require('./support/mockApi');

test('QA FR compte/parametres - routes cibles', async ({ page }) => {
  const ctx = await installApiMocks(page);

  await page.addInitScript(() => {
    localStorage.setItem('teranga_lang', 'fr');
  });
  await seedAuthenticatedSession(page, ctx.user, ctx.token);

  const routes = [
    {
      path: '/settings',
      heading: 'Param\u00E8tres du compte',
      checks: ['Acc\u00E8s au compte', 'S\u00E9curit\u00E9 du compte'],
    },
    {
      path: '/account/security',
      heading: 'Modifier le mot de passe',
      checks: ["Protection de l'acc\u00E8s", 'Mettre \u00E0 jour'],
    },
    {
      path: '/help-support',
      heading: 'Aide & Support',
      checks: ["Comment l'assistance fonctionne", 'Acc\u00E8s rapide'],
    },
    {
      path: '/privacy',
      heading: 'Politique de confidentialit\u00E9 (RGPD)',
      checks: ["L'essentiel \u00E0 retenir", 'Acc\u00E8s rapides'],
    },
    {
      path: '/terms',
      heading: "Conditions g\u00E9n\u00E9rales d'utilisation",
      checks: ['Points cl\u00E9s', 'Pages associ\u00E9es'],
    },
    {
      path: '/legal',
      heading: 'Mentions l\u00E9gales',
      checks: ['Points essentiels', 'Pages associ\u00E9es'],
    },
  ];

  for (const route of routes) {
    await page.goto(route.path);
    await expect(page).toHaveURL(new RegExp(`${route.path.replace('/', '\\/')}$`));
    await expect(page.getByRole('heading', { name: route.heading }).first()).toBeVisible();

    for (const text of route.checks) {
      await expect(page.getByText(text, { exact: false }).first()).toBeVisible();
    }

    const body = await page.locator('body').innerText();
    expect(body).not.toContain('\uFFFD');
    expect(body).not.toMatch(/[A-Za-z]\?[A-Za-z]/);
  }
});
