'use strict';
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const config = require('../../config/config').test;
const { rehearseRestore } = require('../../src/services/backupRestore.service');
const { collectBackupCounts } = require('../../scripts/collect-backup-counts');
const { Sequelize } = require('sequelize');
let admin, root, localUrl, ready = false;
const databases = [];
const guardDatabase = `terangaguard${crypto.randomBytes(8).toString('hex')}`;
const quote = (value) => `\`${value}\``;
let expected, migrationNames;

beforeAll(async () => {
  if (!['localhost', '127.0.0.1', '::1'].includes(config.host)) throw new Error('Les essais de restauration exigent MySQL local');
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'teranga-restore-'));
  try {
    admin = await mysql.createConnection({ host: config.host, port: config.port || 3306, user: config.username, password: config.password || '' });
    ready = true;
  } catch (error) { if (process.env.REQUIRE_INTEGRATION_DB === 'true') throw error; return; }
  const url = new URL('mysql://127.0.0.1/'); url.hostname = config.host; url.port = String(config.port || 3306); url.username = config.username; url.password = config.password || '';
  localUrl = url.toString();
  migrationNames = (await fs.readdir(path.resolve(__dirname, '../../migrations'))).filter((file) => file.endsWith('.js'));
  expected = { SequelizeMeta: String(migrationNames.length), countries: '1', users: '1', services: '1', evidences: '1' };
  await admin.query(`CREATE DATABASE ${quote(guardDatabase)}`); databases.push(guardDatabase);
  await admin.query(`CREATE TABLE ${quote(guardDatabase)}.sentinel (id INT PRIMARY KEY)`);
  await admin.query(`INSERT INTO ${quote(guardDatabase)}.sentinel VALUES (42)`);
});

afterAll(async () => {
  if (admin) {
    for (const database of databases) {
      if (!/^(terangarestore|terangaguard)[a-f0-9]+$/.test(database)) throw new Error('Nettoyage hors périmètre refusé');
      await admin.query(`DROP DATABASE IF EXISTS ${quote(database)}`);
    }
    await admin.end();
  }
  if (root) await fs.rm(root, { recursive: true, force: true });
});

async function run(extraSql = '', expectedCounts = expected, orphan = false) {
  const directory = await fs.mkdtemp(path.join(root, 'dump-'));
  await fs.writeFile(path.join(directory, '000-schema.sql'), `
    CREATE TABLE SequelizeMeta (name VARCHAR(255) PRIMARY KEY);
    CREATE TABLE countries (id INT PRIMARY KEY);
    CREATE TABLE users (id INT PRIMARY KEY, countryId INT, name VARCHAR(255), FOREIGN KEY (countryId) REFERENCES countries(id));
    CREATE TABLE services (id INT PRIMARY KEY, clientId INT, FOREIGN KEY (clientId) REFERENCES users(id));
    CREATE TABLE evidences (id INT PRIMARY KEY, serviceId INT, FOREIGN KEY (serviceId) REFERENCES services(id));
  `);
  await fs.writeFile(path.join(directory, '001-data.sql'), `
    INSERT INTO SequelizeMeta (name) VALUES ${migrationNames.map((name) => `('${name}')`).join(',')};
    INSERT INTO countries VALUES (1);
    INSERT INTO users VALUES (1, ${orphan ? 999 : 1}, 'Café terrain');
    INSERT INTO services VALUES (1, 1);
    INSERT INTO evidences VALUES (1, 1);
    ${extraSql}
  `);
  const report = await rehearseRestore({ directory, localUrl, expectedCounts });
  if (report.databaseCreated) databases.push(report.database);
  return report;
}

test('a real dump is restored and counted in a new database with migration and FK checks', async () => {
  if (!ready) return;
  const report = await run();
  expect(report).toMatchObject({ restored: true, dataMatchesExpected: true, readyForDataReview: true, temporaryAccountRemoved: true, backupApproved: false, foreignKeysChecked: 3, migrations: { ready: true } });
  expect(report.files).toHaveLength(2);
  const [[user]] = await admin.query(`SELECT name FROM ${quote(report.database)}.users`);
  expect(user.name).toBe('Café terrain');
  const source = new Sequelize(report.database, config.username, config.password || '', { host: config.host, port: config.port || 3306, dialect: 'mysql', logging: false });
  try { expect(await collectBackupCounts(source)).toEqual(expected); }
  finally { await source.close(); }
});

test('matching row counts are required; no source counts never means a verified backup', async () => {
  if (!ready) return;
  expect(await run('', { ...expected, users: '2' })).toMatchObject({ error: 'RESTORE_COUNTS_MISMATCH', dataMatchesExpected: false });
  expect(await run('', null)).toMatchObject({ restored: true, dataMatchesExpected: false, backupApproved: false });
});

test('SQL cannot alter a preexisting database and temporary privileges are removed on failure', async () => {
  if (!ready) return;
  const report = await run(`DROP TABLE ${quote(guardDatabase)}.sentinel;`);
  expect(report.restored).toBe(false);
  expect(report.error).toMatch(/DENIED/);
  expect(report.temporaryAccountRemoved).toBe(true);
  const [[row]] = await admin.query(`SELECT id FROM ${quote(guardDatabase)}.sentinel`);
  expect(row.id).toBe(42);
});

test('orphan rows inserted with foreign_key_checks disabled prevent validation', async () => {
  if (!ready) return;
  expect(await run('', expected, true)).toMatchObject({ restored: false, error: 'RESTORE_ORPHAN_ROWS', temporaryAccountRemoved: true });
});
