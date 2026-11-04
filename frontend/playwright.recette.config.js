const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e-recette', timeout: 60000, expect: { timeout: 15000 }, workers: 1, retries: 0,
  reporter: [['list']],
  use: { baseURL: 'https://127.0.0.1:5443', ignoreHTTPSErrors: true, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], locale: 'fr-FR' } }],
  webServer: {
    command: 'node ../backend/scripts/start-https-recette-test.js', url: 'https://127.0.0.1:5443/api/ready',
    ignoreHTTPSErrors: true, reuseExistingServer: false, timeout: 180000,
  },
});
