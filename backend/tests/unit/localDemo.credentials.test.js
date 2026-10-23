'use strict';
const { spawnSync } = require('child_process');
const { randomBytes } = require('crypto');
const path = require('path');

const backendRoot = path.resolve(__dirname, '../..');
function run(env) {
  return spawnSync(process.execPath, ['scripts/local-demo.js'], {
    cwd: backendRoot, encoding: 'utf8', timeout: 15000,
    env: { ...process.env, TERANGA_DEMO_PASSWORD: '', TERANGA_DEMO_JWT_SECRET: '', ...env },
  });
}
test('demo bootstrap refuses to run without an explicitly supplied password', () => {
  const result = run({});
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Define TERANGA_DEMO_PASSWORD');
  expect(result.stdout).not.toContain('"accounts"');
});
test('demo bootstrap rejects a short password without logging its value', () => {
  const value = randomBytes(4).toString('hex');
  const result = run({ TERANGA_DEMO_PASSWORD: value });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Define TERANGA_DEMO_PASSWORD');
  expect(result.stdout + result.stderr).not.toContain(value);
});
test('demo bootstrap remains restricted to a local test database and never logs the credential', () => {
  const value = randomBytes(24).toString('base64url');
  const result = run({ TERANGA_DEMO_PASSWORD: value, DB_HOST: 'demo.invalid' });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('A local test database is required');
  expect(result.stdout + result.stderr).not.toContain(value);
});
