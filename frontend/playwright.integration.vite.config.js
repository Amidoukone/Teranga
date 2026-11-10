const { defineConfig } = require('@playwright/test');
const integrationConfig = require('./playwright.integration.config');

const startVite = process.platform === 'win32'
  ? 'cmd /c npm.cmd run start:vite'
  : 'npm run start:vite';

module.exports = defineConfig({
  ...integrationConfig,
  // The integration suite shares one mutable database and seeded transport providers.
  workers: 1,
  webServer: Array.isArray(integrationConfig.webServer)
    ? integrationConfig.webServer.map((server, index) => index === 1 ? { ...server, command: startVite } : server)
    : integrationConfig.webServer,
});
