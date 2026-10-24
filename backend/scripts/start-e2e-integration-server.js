'use strict';

const path = require('path');
const { spawnSync } = require('child_process');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

const backendRoot = path.resolve(__dirname, '..');
const parentPort = process.env.E2E_BACKEND_PORT || process.env.PORT || null;

dotenv.config();
dotenv.config({ path: path.resolve(backendRoot, '.env') });

process.env.NODE_ENV = 'test';
process.env.PORT = parentPort || '5001';
// Chaque lancement travaille sur une base neuve, jamais sur la base de développement
// ou sur une base de tests existante. CREATE échoue si ce nom existe déjà.
process.env.DB_NAME_TEST = process.env.E2E_DB_NAME || `teranga_e2e_${Date.now()}_${process.pid}`;

function runNodeScript(scriptPath, args = [], extraEnv = {}) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: backendRoot,
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `[e2e:integration:server] command failed: ${path.basename(scriptPath)} ${args.join(
        ' '
      )}`
    );
  }
}

async function createIsolatedTestDatabase() {
  const config = require(path.resolve(backendRoot, 'config', 'config.js')).test;
  const database = config.database;

  if (!/^teranga_e2e_[a-zA-Z0-9_]+$/.test(database || '') || !['localhost', '127.0.0.1', '::1'].includes(config.host)) {
    throw new Error('[e2e:integration:server] requires a local, new teranga_e2e_* database');
  }

  const connection = await mysql.createConnection({
    host: config.host || '127.0.0.1',
    port: config.port || 3306,
    user: config.username,
    password: config.password || '',
  });

  try {
    await connection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } finally { await connection.end(); }
}

async function main() {
  await createIsolatedTestDatabase();
  runNodeScript(path.resolve(__dirname, 'e2e-integration-migrate.js'), [], {
    NODE_ENV: 'test',
  });

  runNodeScript(path.resolve(__dirname, 'e2e-integration-setup.js'), [], {
    NODE_ENV: 'test',
  });

  console.log(
    `[e2e:integration:server] starting backend on port ${process.env.PORT} (NODE_ENV=${process.env.NODE_ENV})`
  );

  require(path.resolve(backendRoot, 'index.js'));
}

main().catch((error) => {
  console.error('[e2e:integration:server] failed to start', error);
  process.exit(1);
});
