const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3001';
const backendPort = process.env.E2E_BACKEND_PORT || '5001';
const apiBaseUrl =
  process.env.E2E_API_BASE_URL || `http://127.0.0.1:${backendPort}/api`;
const runScript = (script) =>
  process.platform === 'win32'
    ? `cmd /c npm.cmd run ${script}`
    : `npm run ${script}`;

function resolveFrontendPort(url) {
  try {
    const parsed = new URL(url);
    return parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
  } catch (_err) {
    return '3001';
  }
}

const frontendPort = resolveFrontendPort(baseURL);
const frontendCwd = path.resolve(__dirname);
const backendCwd = path.resolve(__dirname, '../backend');

module.exports = defineConfig({
  testDir: './e2e-integration',
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : [
        {
          command: runScript('e2e:integration:server'),
          cwd: backendCwd,
          url: `http://127.0.0.1:${backendPort}/api/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
          env: {
            ...process.env,
            NODE_ENV: 'test',
            PORT: String(backendPort),
            CORS_ORIGINS: [
              `http://127.0.0.1:${frontendPort}`,
              `http://localhost:${frontendPort}`,
            ].join(','),
          },
        },
        {
          command: runScript('start'),
          cwd: frontendCwd,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
          env: {
            ...process.env,
            BROWSER: 'none',
            CI: 'true',
            PORT: String(frontendPort),
            REACT_APP_API_BASE_URL: apiBaseUrl,
            REACT_APP_AUTH_STORAGE: 'localstorage',
          },
        },
      ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], locale: 'fr-FR' },
    },
  ],
});
