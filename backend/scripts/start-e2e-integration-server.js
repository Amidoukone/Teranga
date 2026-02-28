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

function sanitizeDbName(input) {
  return String(input || '').replace(/`/g, '').trim();
}

async function recreateTestDatabase() {
  const config = require(path.resolve(backendRoot, 'config', 'config.js')).test;
  const database = sanitizeDbName(config.database);

  if (!database) {
    throw new Error('[e2e:integration:server] missing test database name');
  }

  const connection = await mysql.createConnection({
    host: config.host || '127.0.0.1',
    port: config.port || 3306,
    user: config.username,
    password: config.password || '',
  });

  await connection.query(`DROP DATABASE IF EXISTS \`${database}\``);
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await connection.end();
}

async function main() {
  await recreateTestDatabase();
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
