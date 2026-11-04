'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const express = require('express');
const request = require('supertest');
const securityHeaders = require('../../src/middleware/securityHeaders.middleware');
const { mountFrontend } = require('../../src/utils/serveFrontend');
let directory;
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'teranga-frontend-'));
  fs.mkdirSync(path.join(directory, 'static'));
  fs.writeFileSync(path.join(directory, 'index.html'), '<html><script>window.fixture = true;</script><main>Teranga</main></html>');
  fs.writeFileSync(path.join(directory, 'static/app.01234567.js'), 'window.loaded = true;');
  fs.writeFileSync(path.join(directory, '.env'), 'PRIVATE_VALUE=must-not-be-served');
});
afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));
function server(env = {}) {
  const app = express(); app.use(securityHeaders);
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  mountFrontend(app, { env: { SERVE_FRONTEND: 'true', FRONTEND_BUILD_DIR: directory, APP_ENVIRONMENT: 'recette', ...env } });
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  return app;
}

test('a direct protected dossier URL serves the application without exposing any dossier data', async () => {
  const response = await request(server()).get('/missions/42/track').set('Accept', 'text/html').expect(200);
  expect(response.text).toContain('<main>Teranga</main>');
  expect(response.headers['permissions-policy']).toContain('geolocation=(self)');
  expect(response.headers['content-security-policy']).toContain("'sha256-");
  expect(response.headers['content-security-policy']).not.toContain("script-src 'unsafe-inline'");
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.headers['x-robots-tag']).toBe('noindex, nofollow');
});

test.each(['/api/missing', '/api/v1/missing', '/uploads/missing.jpg', '/static/missing.js', '/static/app.js.map', '/.env'])('a missing resource remains a 404 instead of becoming HTML: %s', async route => {
  const response = await request(server()).get(route).set('Accept', 'text/html').expect(404);
  expect(response.type).toBe('application/json');
  expect(response.text).not.toContain('must-not-be-served');
});

test('the API keeps its existing permissions and content security policies', async () => {
  const response = await request(server()).get('/api/health').expect(200);
  expect(response.body.ok).toBe(true);
  expect(response.headers['permissions-policy']).toBe('geolocation=(), microphone=(), camera=()');
  expect(response.headers['content-security-policy']).toContain("default-src 'none'");
});

test('hashed scripts are immutable but missing builds fail before a server is offered', async () => {
  const response = await request(server()).get('/static/app.01234567.js').expect(200);
  expect(response.headers['cache-control']).toContain('immutable');
  expect(() => server({ FRONTEND_BUILD_DIR: path.join(directory, 'absent') })).toThrow(/requires a compiled frontend/);
});

test('the single-origin option is disabled by default and does not handle POST navigation', async () => {
  expect(mountFrontend(express(), { env: {} })).toBe(false);
  await request(server()).post('/demandes').expect(404);
});
