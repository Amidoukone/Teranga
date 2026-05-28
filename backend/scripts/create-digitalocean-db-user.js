'use strict';

const readline = require('readline/promises');
const readlineCursor = require('readline');
const fs = require('fs');
const path = require('path');
const { stdin: input, stdout: output } = require('process');
const mysql = require('mysql2/promise');
const {
  buildMysqlSslOptions,
} = require('../src/utils/mysqlConnectionOptions');

const DEFAULTS = {
  host: 'teranga-mysql-prod-do-user-37904030-0.e.db.ondigitalocean.com',
  port: 25060,
  adminUser: 'doadmin',
  adminDatabase: 'defaultdb',
  appDatabase: 'teranga',
  appUser: 'teranga_app',
  caPath: '',
};

function parseArgs(argv) {
  const args = { ...DEFAULTS, yes: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--host') {
      args.host = argv[i + 1] || args.host;
      i += 1;
    } else if (arg === '--port') {
      args.port = Number(argv[i + 1] || args.port);
      i += 1;
    } else if (arg === '--admin-user') {
      args.adminUser = argv[i + 1] || args.adminUser;
      i += 1;
    } else if (arg === '--admin-db') {
      args.adminDatabase = argv[i + 1] || args.adminDatabase;
      i += 1;
    } else if (arg === '--database') {
      args.appDatabase = argv[i + 1] || args.appDatabase;
      i += 1;
    } else if (arg === '--app-user') {
      args.appUser = argv[i + 1] || args.appUser;
      i += 1;
    } else if (arg === '--ca-path') {
      args.caPath = argv[i + 1] || args.caPath;
      i += 1;
    } else if (arg === '--yes') {
      args.yes = true;
    }
  }

  return args;
}

function quoteIdentifier(value) {
  return `\`${String(value).replace(/`/g, '``')}\``;
}

function quoteUser(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function askHidden(rl, question) {
  const stdin = process.stdin;
  const onData = (char) => {
    const charString = char.toString();
    if (charString === '\n' || charString === '\r' || charString === '\u0004') {
      return;
    }
    readlineCursor.moveCursor(output, -charString.length, 0);
    output.write('*'.repeat(charString.length));
  };

  stdin.on('data', onData);
  try {
    return await rl.question(question);
  } finally {
    stdin.off('data', onData);
    output.write('\n');
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rl = readline.createInterface({ input, output });

  try {
    console.log('[do:init] target:', `${args.host}:${args.port}/${args.adminDatabase}`);
    console.log('[do:init] app database:', args.appDatabase);
    console.log('[do:init] app user:', args.appUser);

    if (!args.yes) {
      throw new Error('Refusing to change DigitalOcean MySQL without --yes');
    }

    if (args.caPath) {
      const resolvedCaPath = path.resolve(args.caPath);
      if (
        !fs.existsSync(resolvedCaPath) ||
        !fs.statSync(resolvedCaPath).isFile()
      ) {
        throw new Error(`CA certificate file not found: ${resolvedCaPath}`);
      }
      process.env.DB_SSL_CA_PATH = resolvedCaPath;
      console.log('[do:init] CA certificate:', resolvedCaPath);
    } else {
      console.warn(
        '[do:init] warning: no --ca-path provided; DigitalOcean usually requires the cluster CA certificate'
      );
    }

    const adminPassword = await askHidden(rl, 'DigitalOcean doadmin password: ');
    const appPassword = await askHidden(
      rl,
      `New password for ${args.appUser}: `
    );

    if (!adminPassword.trim()) {
      throw new Error('Admin password is required');
    }
    if (appPassword.length < 20) {
      throw new Error('App user password must be at least 20 characters');
    }

    let connection;
    try {
      connection = await mysql.createConnection({
      host: args.host,
      port: args.port,
      user: args.adminUser,
      password: adminPassword,
      database: args.adminDatabase,
      ssl: buildMysqlSslOptions(process.env, {
        require: true,
        rejectUnauthorized: true,
      }),
      multipleStatements: false,
      });
    } catch (err) {
      if (/self-signed certificate|certificate/i.test(err?.message || '')) {
        throw new Error(
          `${err.message}. Download the DigitalOcean CA certificate and rerun with --ca-path <path-to-ca.crt>.`
        );
      }
      throw err;
    }

    try {
      await connection.query(
        `CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(
          args.appDatabase
        )} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`
      );
      await connection.query(
        `CREATE USER IF NOT EXISTS ${quoteUser(args.appUser)}@'%' IDENTIFIED BY ?`,
        [appPassword]
      );
      await connection.query(
        `ALTER USER ${quoteUser(args.appUser)}@'%' IDENTIFIED BY ?`,
        [appPassword]
      );
      await connection.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES, CREATE TEMPORARY TABLES, LOCK TABLES ON ${quoteIdentifier(
          args.appDatabase
        )}.* TO ${quoteUser(args.appUser)}@'%'`
      );
      await connection.query('FLUSH PRIVILEGES');

      console.log('[do:init] OK');
      console.log(
        `[do:init] app DATABASE_URL: mysql://${args.appUser}:<PASSWORD>@${args.host}:${args.port}/${args.appDatabase}`
      );
    } finally {
      await connection.end();
    }
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error('[do:init] failed:', err.message);
  process.exit(1);
});
