'use strict';

// Automated local fixture only: fresh database, loopback listener, ephemeral certificate.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');
const { randomBytes } = require('crypto');
const mysql = require('mysql2/promise');
const backend = path.resolve(__dirname, '..');
const origin = 'https://127.0.0.1:5443';

async function main() {
  const host = process.env.DB_HOST || '127.0.0.1';
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('HTTPS recette tests require local MySQL');
  const database = `teranga_https_e2e_${Date.now()}_${process.pid}`;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const uploads = fs.mkdtempSync(path.join(os.tmpdir(), 'teranga-https-uploads-'));
  const env = { ...process.env, NODE_ENV: 'test', DB_HOST: host, DB_USER: user, DB_PASSWORD: password,
    DATABASE_URL: '', DB_NAME_TEST: database, UPLOADS_ROOT: uploads, IMAGEKIT_PUBLIC_KEY: '', IMAGEKIT_PRIVATE_KEY: '',
    IMAGEKIT_URL_ENDPOINT: '', GOOGLE_MAPS_SERVER_KEY: '', SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '',
    BOOTSTRAP_ADMIN_ENABLED: 'false', BOOTSTRAP_ADMIN_ALLOW_DEFAULTS: 'false',
    BOOTSTRAP_ADMIN_DEFAULT_PASSWORD: '', BOOTSTRAP_ADMIN_DEFAULT_EMAIL: '',
  };
  const connection = await mysql.createConnection({ host, user, password });
  try { await connection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); }
  finally { await connection.end(); }
  for (const script of ['e2e-integration-migrate.js', 'e2e-integration-setup.js']) {
    const result = spawnSync(process.execPath, [path.join(__dirname, script)], { cwd: backend, env, stdio: 'inherit' });
    if (result.error || result.status !== 0) throw new Error('HTTPS recette fixture initialization failed');
  }
  const url = new URL('mysql://127.0.0.1');
  url.username = user; url.password = password; url.hostname = host; url.pathname = `/${database}`;
  Object.assign(process.env, env, { NODE_ENV: 'production', DATABASE_URL: url.href, DB_SSL: 'false',
    JWT_SECRET: randomBytes(48).toString('hex'), METRICS_TOKEN: randomBytes(32).toString('hex'),
    FRONTEND_ERROR_TOKEN: randomBytes(32).toString('hex'),
    FRONTEND_URL: origin, CLIENT_URL: origin, CLIENT_ORIGIN: origin, CORS_ORIGINS: origin,
    SERVE_FRONTEND: 'true', APP_ENVIRONMENT: 'recette', COOKIE_SAME_SITE: 'lax',
    FRONTEND_BUILD_DIR: path.resolve(backend, '../frontend/build-recette'),
    MEDIA_ENFORCE_DURABLE_UPLOADS: 'true', MEDIA_ALLOW_LOCAL_FALLBACK: 'true',
  });
  const validation = require('../src/utils/validateProdConfig').validateProdConfig(process.env);
  if (validation.errors.length) throw new Error('HTTPS recette fixture production configuration is invalid');
  const app = require('../src/app');
  const db = require('../models');
  await db.sequelize.authenticate();
  app.locals.runtimeStatus.db = { ready: true, checkedAt: Date.now(), attempt: 1 };
  // Dépendance propre au backend (devDependencies) : auparavant lue dans le node_modules du
  // frontend (dépendance transitive de react-scripts), ce qui cassait tout `npm ci` limité au
  // backend ou toute montée de version de react-scripts qui abandonnerait selfsigned.
  const selfsigned = require('selfsigned');
  const certificate = selfsigned.generate([{ name: 'commonName', value: 'localhost' }], {
    days: 1, keySize: 2048, algorithm: 'sha256',
    extensions: [{ name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }, { type: 7, ip: '127.0.0.1' }] }],
  });
  const server = require('https').createServer({ key: certificate.private, cert: certificate.cert }, app);
  server.listen(5443, '127.0.0.1', () => console.log(`[recette:https:test] ${origin} — isolated fixture ready`));
  const shutdown = () => server.close(() => db.sequelize.close().finally(() => process.exit(0)));
  process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
}
main().catch(() => { console.error('[recette:https:test] local fixture failed; check MySQL and the compiled recette build'); process.exitCode = 1; });
