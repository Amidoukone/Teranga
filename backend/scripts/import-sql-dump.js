'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');
const {
  buildMysqlDialectOptions,
  normalizeMysqlDatabaseUrl,
} = require('../src/utils/mysqlConnectionOptions');

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

dotenv.config({
  path: path.resolve(__dirname, '..', '.env.production'),
  quiet: true,
});
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

function parseArgs(argv) {
  const args = {
    dir: '',
    yes: false,
    dryRun: false,
    allowNonEmpty: false,
    allowPlanetScaleTarget: false,
    reset: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dir') {
      args.dir = argv[i + 1] || '';
      i += 1;
    } else if (arg === '--yes') {
      args.yes = true;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--allow-nonempty') {
      args.allowNonEmpty = true;
    } else if (arg === '--allow-planetscale-target') {
      args.allowPlanetScaleTarget = true;
    } else if (arg === '--reset') {
      args.reset = true;
    }
  }

  return args;
}

function normalizeTableName(table) {
  if (typeof table === 'string') return table;
  if (table && typeof table === 'object') {
    return table.tableName || table.name || Object.values(table)[0];
  }
  return String(table || '');
}

function safeConnectionSummary(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return {
      host: parsed.hostname,
      port: parsed.port || '3306',
      database: parsed.pathname.replace(/^\/+/, '') || null,
      isPlanetScale: /planetscale|psdb\.cloud/i.test(parsed.hostname),
    };
  } catch (_err) {
    return {
      host: '(invalid DATABASE_URL)',
      port: null,
      database: null,
      isPlanetScale: false,
    };
  }
}

function buildConnectionConfig(rawUrl) {
  const normalized = normalizeMysqlDatabaseUrl(rawUrl, {
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: true,
      },
    },
  });

  const parsed = new URL(normalized.url);
  const dialectOptions = buildMysqlDialectOptions({
    env: process.env,
    baseDialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: true,
      },
      ...(normalized.extraDialectOptions || {}),
    },
  });

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username || ''),
    password: decodeURIComponent(parsed.password || ''),
    database: parsed.pathname.replace(/^\/+/, ''),
    ssl: dialectOptions.ssl,
    charset: 'utf8mb4',
    multipleStatements: true,
    namedPlaceholders: false,
  };
}

function listSqlFiles(dir) {
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.sql'))
    .map((entry) => path.join(dir, entry.name));

  const schemaFiles = entries
    .filter((file) => /(^|[-_.])schema\.sql$/i.test(path.basename(file)))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
  const dataFiles = entries
    .filter((file) => !schemaFiles.includes(file))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));

  return [...schemaFiles, ...dataFiles];
}

async function showTables(connection) {
  const [rows] = await connection.query('SHOW TABLES');
  return rows.map(normalizeTableName).filter(Boolean);
}

function quoteIdentifier(value) {
  return `\`${String(value).replace(/`/g, '``')}\``;
}

async function setImportSessionMode(connection) {
  const [[before]] = await connection.query(
    'SELECT @@SESSION.sql_mode AS sqlMode'
  );
  await connection.query("SET SESSION sql_mode = ''");
  await connection.query('SET SESSION time_zone = "+00:00"');
  await connection.query('SET SESSION foreign_key_checks = 0');
  const [[after]] = await connection.query(
    'SELECT @@SESSION.sql_mode AS sqlMode'
  );

  console.log(
    '[db:import-dump] sql_mode:',
    `${before?.sqlMode || '(empty)'} -> ${after?.sqlMode || '(empty)'}`
  );
}

async function dropExistingTables(connection, tables) {
  if (tables.length === 0) return;

  console.log(`[db:import-dump] resetting target: dropping ${tables.length} tables`);
  await connection.query('SET SESSION foreign_key_checks = 0');
  for (const table of tables) {
    await connection.query(`DROP TABLE IF EXISTS ${quoteIdentifier(table)}`);
  }
}

async function runFile(connection, file) {
  const sql = fs.readFileSync(file, 'utf8').trim();
  if (!sql) {
    console.log(`[db:import-dump] skipped empty file: ${path.basename(file)}`);
    return;
  }

  console.log(`[db:import-dump] importing: ${path.basename(file)}`);
  await connection.query(sql);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dumpDir = path.resolve(args.dir || '');
  const rawUrl = String(process.env.DATABASE_URL || '').trim();

  if (!rawUrl) {
    throw new Error('DATABASE_URL is required');
  }

  if (!args.dir) {
    throw new Error('Usage: npm run db:import-dump -- --dir <dump-dir> --yes');
  }

  if (!fs.existsSync(dumpDir) || !fs.statSync(dumpDir).isDirectory()) {
    throw new Error(`Dump directory not found: ${dumpDir}`);
  }

  const files = listSqlFiles(dumpDir);
  if (files.length === 0) {
    throw new Error(`No .sql files found in dump directory: ${dumpDir}`);
  }

  const summary = safeConnectionSummary(rawUrl);
  console.log(
    '[db:import-dump] target:',
    `${summary.host}:${summary.port}/${summary.database || ''}`
  );
  console.log('[db:import-dump] files:');
  files.forEach((file) => console.log(`  ${path.basename(file)}`));

  if (summary.isPlanetScale && !args.allowPlanetScaleTarget) {
    throw new Error(
      'Target looks like PlanetScale. Refusing import unless --allow-planetscale-target is set.'
    );
  }

  if (args.dryRun) {
    console.log('[db:import-dump] dry run only; no SQL executed');
    return;
  }

  if (!args.yes) {
    throw new Error('Refusing to import without --yes');
  }

  const connection = await mysql.createConnection(buildConnectionConfig(rawUrl));
  try {
    await setImportSessionMode(connection);

    const existingTables = await showTables(connection);
    if (existingTables.length > 0 && args.reset) {
      await dropExistingTables(connection, existingTables);
    } else if (existingTables.length > 0 && !args.allowNonEmpty) {
      throw new Error(
        `Target database is not empty (${existingTables.length} tables). Use --reset to drop and reimport, or --allow-nonempty only if this is intentional.`
      );
    }

    for (const file of files) {
      await runFile(connection, file);
    }

    const importedTables = await showTables(connection);
    console.log(`[db:import-dump] imported table count: ${importedTables.length}`);
    console.log('[db:import-dump] OK');
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('[db:import-dump] failed:', err.message);
  process.exit(1);
});
