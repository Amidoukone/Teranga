'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const Sequelize = require('sequelize');

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

process.env.NODE_ENV = 'test';

const { sequelize } = require('../models');

const migrationsDir = path.resolve(__dirname, '..', 'migrations');

const TOLERABLE_ERROR_CODES = new Set([
  'ER_DUP_FIELDNAME',
  'ER_DUP_KEYNAME',
  'ER_TABLE_EXISTS_ERROR',
]);

const TOLERABLE_ERROR_PATTERNS = [
  /Duplicate column name/i,
  /Duplicate key name/i,
  /already exists/i,
];

function isTolerableMigrationError(error) {
  const code =
    error?.original?.code ||
    error?.parent?.code ||
    error?.code ||
    null;
  if (code && TOLERABLE_ERROR_CODES.has(code)) return true;

  const message =
    error?.original?.sqlMessage ||
    error?.parent?.sqlMessage ||
    error?.message ||
    '';

  return TOLERABLE_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

async function runMigrations() {
  await sequelize.authenticate();

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.js'))
    .sort();

  const queryInterface = sequelize.getQueryInterface();

  for (const file of files) {
    const migrationPath = path.join(migrationsDir, file);
    delete require.cache[require.resolve(migrationPath)];
    const migration = require(migrationPath);

    if (!migration || typeof migration.up !== 'function') {
      continue;
    }

    try {
      await migration.up(queryInterface, Sequelize);
      console.log(`[e2e:integration:migrate] applied ${file}`);
    } catch (error) {
      if (isTolerableMigrationError(error)) {
        console.warn(
          `[e2e:integration:migrate] tolerated ${file}: ${
            error?.message || 'duplicate-safe conflict'
          }`
        );
        continue;
      }
      throw error;
    }
  }
}

runMigrations()
  .then(() => {
    console.log('[e2e:integration:migrate] done');
  })
  .catch((error) => {
    console.error('[e2e:integration:migrate] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await sequelize.close();
    } catch (_err) {
      // ignore close errors
    }
  });
