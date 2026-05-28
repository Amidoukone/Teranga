'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

dotenv.config({
  path: path.resolve(__dirname, '..', '.env.production'),
  quiet: true,
});
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

function parseArgs(argv) {
  const args = {
    apply: false,
    allowPlanetScaleTarget: false,
    createMissingTables: false,
  };

  for (const arg of argv) {
    if (arg === '--apply') args.apply = true;
    if (arg === '--allow-planetscale-target') args.allowPlanetScaleTarget = true;
    if (arg === '--create-missing-tables') args.createMissingTables = true;
  }

  return args;
}

function safeConnectionSummary() {
  const rawUrl = String(process.env.DATABASE_URL || '').trim();
  if (!rawUrl) {
    return {
      configured: false,
      host: null,
      port: null,
      database: null,
      isPlanetScale: false,
    };
  }

  try {
    const parsed = new URL(rawUrl);
    return {
      configured: true,
      host: parsed.hostname,
      port: parsed.port || '3306',
      database: parsed.pathname.replace(/^\/+/, '') || null,
      isPlanetScale: /planetscale|psdb\.cloud/i.test(parsed.hostname),
    };
  } catch (_err) {
    return {
      configured: true,
      host: '(invalid DATABASE_URL)',
      port: null,
      database: null,
      isPlanetScale: false,
    };
  }
}

function normalizeTableName(table) {
  if (typeof table === 'string') return table;
  if (table && typeof table === 'object') {
    return table.tableName || table.name || Object.values(table)[0];
  }
  return String(table || '');
}

function migrationFiles() {
  const migrationsDir = path.resolve(__dirname, '..', 'migrations');
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.js'))
    .sort((a, b) => a.localeCompare(b));
}

async function ensureSequelizeMeta(queryInterface, Sequelize, tables, apply) {
  if (tables.has('SequelizeMeta')) return false;

  console.log('[db:reconcile] SequelizeMeta table is missing');
  if (!apply) return true;

  await queryInterface.createTable('SequelizeMeta', {
    name: {
      type: Sequelize.STRING,
      allowNull: false,
      primaryKey: true,
      unique: true,
    },
  });
  console.log('[db:reconcile] created SequelizeMeta');
  return true;
}

async function ensurePasswordResetTokens(
  queryInterface,
  Sequelize,
  tables,
  { apply, createMissingTables }
) {
  if (tables.has('password_reset_tokens')) {
    return { missing: false, created: false };
  }

  console.log('[db:reconcile] password_reset_tokens table is missing');
  if (!apply || !createMissingTables) {
    if (!createMissingTables) {
      console.log(
        '[db:reconcile] will leave 20260207123000-create-password-reset-tokens.js pending'
      );
    }
    return { missing: true, created: false };
  }

  const migrationPath = path.resolve(
    __dirname,
    '..',
    'migrations',
    '20260207123000-create-password-reset-tokens.js'
  );
  const migration = require(migrationPath);
  await migration.up(queryInterface, Sequelize);
  console.log('[db:reconcile] created password_reset_tokens');
  return { missing: true, created: true };
}

async function readMetaNames(sequelize, tables) {
  if (!tables.has('SequelizeMeta')) return new Set();

  const [rows] = await sequelize.query(
    'SELECT name FROM `SequelizeMeta` ORDER BY name'
  );
  return new Set(rows.map((row) => row.name));
}

async function insertMetaNames(sequelize, names) {
  for (const name of names) {
    await sequelize.query('INSERT IGNORE INTO `SequelizeMeta` (`name`) VALUES (?)', {
      replacements: [name],
    });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const summary = safeConnectionSummary();

  if (!summary.configured) {
    throw new Error('DATABASE_URL is required');
  }

  console.log(
    '[db:reconcile] target:',
    `${summary.host}:${summary.port || '3306'}/${summary.database || ''}`
  );
  console.log('[db:reconcile] mode:', args.apply ? 'apply' : 'dry-run');

  if (summary.isPlanetScale && !args.allowPlanetScaleTarget) {
    throw new Error(
      'Target looks like PlanetScale. Add --allow-planetscale-target when this is intentional.'
    );
  }

  const db = require('../models');
  const { sequelize, Sequelize } = db;
  const queryInterface = sequelize.getQueryInterface();

  try {
    await sequelize.authenticate();
    const rawTables = await queryInterface.showAllTables();
    const tables = new Set(rawTables.map(normalizeTableName).filter(Boolean));

    await ensureSequelizeMeta(queryInterface, Sequelize, tables, args.apply);
    if (args.apply) tables.add('SequelizeMeta');

    const passwordResetState = await ensurePasswordResetTokens(
      queryInterface,
      Sequelize,
      tables,
      {
        apply: args.apply,
        createMissingTables: args.createMissingTables,
      }
    );
    if (passwordResetState.created) tables.add('password_reset_tokens');

    const files = migrationFiles();
    const currentMeta = await readMetaNames(sequelize, tables);
    const pendingBecauseSchemaMissing = new Set();
    if (passwordResetState.missing && !passwordResetState.created) {
      pendingBecauseSchemaMissing.add('20260207123000-create-password-reset-tokens.js');
    }
    const missingMeta = files.filter(
      (file) => !currentMeta.has(file) && !pendingBecauseSchemaMissing.has(file)
    );

    console.log('[db:reconcile] migration files:', files.length);
    console.log('[db:reconcile] SequelizeMeta rows:', currentMeta.size);
    console.log('[db:reconcile] missing SequelizeMeta rows:', missingMeta.length);
    if (missingMeta.length > 0) {
      console.log('[db:reconcile] rows to insert in SequelizeMeta:');
      missingMeta.forEach((file) => console.log(`  ${file}`));
    }
    if (pendingBecauseSchemaMissing.size > 0) {
      console.log('[db:reconcile] left pending because schema is missing:');
      pendingBecauseSchemaMissing.forEach((file) => console.log(`  ${file}`));
    }

    if (args.apply && missingMeta.length > 0) {
      await insertMetaNames(sequelize, missingMeta);
      console.log('[db:reconcile] inserted missing SequelizeMeta rows');
    }

    if (!args.apply) {
      console.log(
        '[db:reconcile] dry run only; rerun with --apply to change the target'
      );
      return;
    }

    console.log('[db:reconcile] OK');
  } finally {
    await sequelize.close();
  }
}

main().catch((err) => {
  console.error('[db:reconcile] failed:', err.message);
  process.exit(1);
});
