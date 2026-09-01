'use strict';

const path = require('path');
const dotenv = require('dotenv');

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

dotenv.config({
  path: path.resolve(__dirname, '..', '.env.production'),
  quiet: true,
});
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

const REQUIRED_TABLES = [
  'SequelizeMeta',
  'users',
  'properties',
  'services',
  'tasks',
  'evidences',
  'transactions',
  'countries',
  'regions',
  'franchises',
  'organizations',
  'territories',
  'organization_territories',
  'memberships',
  'service_definitions',
  'service_availabilities',
  'projects',
  'project_phases',
  'project_documents',
  'categories',
  'products',
  'orders',
  'order_items',
  'notifications',
  'activities',
  'refresh_tokens',
  'token_blacklist',
  'password_reset_tokens',
  'recovery_codes',
];

const COUNT_TABLES = [
  'users',
  'countries',
  'regions',
  'franchises',
  'organizations',
  'territories',
  'organization_territories',
  'memberships',
  'service_definitions',
  'service_availabilities',
  'properties',
  'services',
  'tasks',
  'evidences',
  'transactions',
  'projects',
  'project_phases',
  'project_documents',
  'categories',
  'products',
  'orders',
  'order_items',
  'notifications',
  'activities',
  'refresh_tokens',
  'password_reset_tokens',
  'recovery_codes',
  'SequelizeMeta',
];

function parseArgs(argv) {
  return {
    allowPendingPasswordReset: argv.includes('--allow-pending-password-reset'),
  };
}

function safeConnectionSummary() {
  const rawUrl = String(process.env.DATABASE_URL || '').trim();
  if (!rawUrl) {
    return {
      configured: false,
      host: null,
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

async function countRows(sequelize, table) {
  const quotedTable = `\`${String(table).replace(/`/g, '``')}\``;
  const [rows] = await sequelize.query(`SELECT COUNT(*) AS count FROM ${quotedTable}`);
  return Number(rows?.[0]?.count || 0);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const summary = safeConnectionSummary();
  console.log('[db:check] env:', process.env.NODE_ENV);
  console.log(
    '[db:check] target:',
    summary.configured
      ? `${summary.host}:${summary.port || '3306'}/${summary.database || ''}`
      : 'DATABASE_URL missing'
  );

  if (!summary.configured) {
    throw new Error('DATABASE_URL is required for production database checks');
  }

  if (summary.isPlanetScale) {
    console.warn('[db:check] warning: target still looks like PlanetScale');
  }

  const db = require('../models');
  const { sequelize } = db;

  try {
    await sequelize.authenticate();
    const [[versionRow]] = await sequelize.query(
      'SELECT VERSION() AS version, DATABASE() AS databaseName'
    );

    console.log('[db:check] mysql version:', versionRow.version);
    console.log('[db:check] selected database:', versionRow.databaseName);

    const rawTables = await sequelize.getQueryInterface().showAllTables();
    const tables = rawTables.map(normalizeTableName).filter(Boolean);
    const tableSet = new Set(tables);
    const requiredTables = args.allowPendingPasswordReset
      ? REQUIRED_TABLES.filter((table) => table !== 'password_reset_tokens')
      : REQUIRED_TABLES;
    const missingTables = requiredTables.filter((table) => !tableSet.has(table));

    console.log('[db:check] table count:', tables.length);

    if (missingTables.length > 0) {
      console.error('[db:check] missing tables:', missingTables.join(', '));
    }
    if (
      args.allowPendingPasswordReset &&
      !tableSet.has('password_reset_tokens')
    ) {
      console.warn(
        '[db:check] password_reset_tokens is intentionally pending for the next migration'
      );
    }

    console.log('[db:check] row counts:');
    for (const table of COUNT_TABLES) {
      if (!tableSet.has(table)) continue;
      const count = await countRows(sequelize, table);
      console.log(`  ${table}: ${count}`);
    }

    if (missingTables.length > 0) {
      process.exitCode = 1;
      return;
    }

    console.log('[db:check] OK');
  } finally {
    await sequelize.close();
  }
}

main().catch((err) => {
  console.error('[db:check] failed:', err.message);
  process.exit(1);
});
