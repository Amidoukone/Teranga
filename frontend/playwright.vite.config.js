const { defineConfig } = require('@playwright/test');
const craConfig = require('./playwright.config');

const startVite = process.platform === 'win32'
  ? 'cmd /c npm.cmd run start:vite'
  : 'npm run start:vite';

module.exports = defineConfig({
  ...craConfig,
  workers: process.env.CI ? 1 : 2,
  webServer: craConfig.webServer
    ? { ...craConfig.webServer, command: startVite }
    : undefined,
});
