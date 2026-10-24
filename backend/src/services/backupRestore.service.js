'use strict';
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const { loadMigrationReadiness } = require('./migrationReadiness.service');

const quote = (value) => `\`${String(value).replace(/`/g, '``')}\``;

function localRestoreConfig(rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol !== 'mysql:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !['', '/'].includes(url.pathname) || url.search || url.hash || !url.username) {
    throw new Error('RESTORE_DATABASE_URL doit désigner un serveur MySQL local sans nom de base ni options');
  }
  return { host: url.hostname === '[::1]' ? '::1' : url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), charset: 'utf8mb4', connectTimeout: 10000, multipleStatements: false };
}

async function listDumpFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile() && /\.sql$/i.test(entry.name)).map((entry) => entry.name);
  const isSchema = (name) => /(^|[-_.])schema\.sql$/i.test(name);
  files.sort((a, b) => Number(isSchema(b)) - Number(isSchema(a)) || a.localeCompare(b));
  if (!files.length) throw new Error('Aucun fichier SQL à restaurer');
  return files;
}

async function inspectRestoredData(connection, database) {
  const [tables] = await connection.query("SELECT TABLE_NAME AS tableName FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME");
  const counts = {};
  for (const { tableName } of tables) {
    const [[row]] = await connection.query(`SELECT CAST(COUNT(*) AS CHAR) AS rowCount FROM ${quote(tableName)}`);
    // Windows peut renvoyer les noms en minuscules ; le dépôt utilise SequelizeMeta.
    counts[tableName.toLowerCase() === 'sequelizemeta' ? 'SequelizeMeta' : tableName] = row.rowCount;
  }
  for (const required of ['SequelizeMeta', 'countries', 'users', 'services', 'evidences']) {
    if (!Object.hasOwn(counts, required)) throw Object.assign(new Error('Table métier absente'), { code: 'RESTORE_CORE_TABLE_MISSING' });
  }
  // MySQL ne revalide pas les lignes anciennes lorsque foreign_key_checks est réactivé.
  const [keys] = await connection.query(`SELECT TABLE_NAME AS childTable, CONSTRAINT_NAME AS constraintName,
    COLUMN_NAME AS childColumn, REFERENCED_TABLE_SCHEMA AS parentSchema,
    REFERENCED_TABLE_NAME AS parentTable, REFERENCED_COLUMN_NAME AS parentColumn
    FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE()
    AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION`);
  const groups = new Map();
  for (const key of keys) {
    if (key.parentSchema !== database) throw Object.assign(new Error('Référence extérieure à la copie'), { code: 'RESTORE_EXTERNAL_FOREIGN_KEY' });
    const id = `${key.childTable}:${key.constraintName}`;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(key);
  }
  for (const columns of groups.values()) {
    const key = columns[0];
    const joins = columns.map((column) => `c.${quote(column.childColumn)} = p.${quote(column.parentColumn)}`).join(' AND ');
    const nonNull = columns.map((column) => `c.${quote(column.childColumn)} IS NOT NULL`).join(' AND ');
    const [[row]] = await connection.query(`SELECT CAST(COUNT(*) AS CHAR) AS orphanCount FROM ${quote(key.childTable)} c
      LEFT JOIN ${quote(key.parentTable)} p ON ${joins} WHERE ${nonNull} AND p.${quote(key.parentColumn)} IS NULL`);
    if (row.orphanCount !== '0') throw Object.assign(new Error('Références orphelines dans la copie'), { code: 'RESTORE_ORPHAN_ROWS' });
  }
  return { counts, foreignKeysChecked: groups.size };
}

async function rehearseRestore({ directory, localUrl, expectedCounts = null }) {
  const config = localRestoreConfig(localUrl); // Validation avant toute connexion.
  const files = await listDumpFiles(directory);
  if (expectedCounts !== null && (!expectedCounts || Array.isArray(expectedCounts) || typeof expectedCounts !== 'object' || !Object.keys(expectedCounts).length || Object.values(expectedCounts).some((value) => !/^(0|[1-9][0-9]*)$/.test(String(value))))) throw new Error('Comptages attendus invalides');
  const suffix = crypto.randomBytes(10).toString('hex');
  // Sans caractères joker SQL : le GRANT ne couvre qu'une base neuve précise.
  const database = `terangarestore${suffix}`;
  const user = `tr${suffix}`;
  const password = crypto.randomBytes(32).toString('hex');
  const report = { database, databaseCreated: false, temporaryAccount: user, checkedAt: new Date().toISOString(), files: [], restored: false, dataMatchesExpected: false, temporaryAccountRemoved: false };
  let admin, importer, peerHost, userCreated = false;
  try {
    admin = await mysql.createConnection(config);
    // Une instance Docker locale voit parfois l'adresse du pont, pas localhost.
    // USER() donne l'hôte réellement vu par MySQL, contrairement à CURRENT_USER().
    const [[session]] = await admin.query("SELECT SUBSTRING_INDEX(USER(), '@', -1) AS peerHost");
    peerHost = session.peerHost;
    if (!/^[a-z0-9.:\-]+$/i.test(peerHost || '')) throw Object.assign(new Error('Hôte de session invalide'), { code: 'RESTORE_PEER_HOST_INVALID' });
    report.temporaryAccount = `${user}@${peerHost}`;
    await admin.query(`CREATE DATABASE ${quote(database)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    report.databaseCreated = true;
    await admin.query('CREATE USER ?@? IDENTIFIED BY ?', [user, peerHost, password]);
    userCreated = true;
    await admin.query(`GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, INDEX, REFERENCES, CREATE VIEW, SHOW VIEW, TRIGGER, LOCK TABLES ON ${quote(database)}.* TO ?@?`, [user, peerHost]);
    // Aucun SQL de la sauvegarde ne passe par la connexion d'administration.
    importer = await mysql.createConnection({ ...config, database, user, password, multipleStatements: true });
    await importer.query("SET SESSION time_zone = '+00:00'");
    await importer.query('SET SESSION foreign_key_checks = 0');
    for (const name of files) {
      const buffer = await fs.readFile(path.join(directory, name));
      const sql = buffer.toString('utf8').trim();
      // DELIMITER est une commande du client mysql, pas une requête serveur.
      if (/^\s*DELIMITER\b/im.test(sql)) throw Object.assign(new Error('Dump avec commandes client non supportées'), { code: 'RESTORE_DELIMITER_UNSUPPORTED' });
      if (sql) await importer.query(sql);
      report.files.push({ name, bytes: buffer.length, sha256: crypto.createHash('sha256').update(buffer).digest('hex') });
    }
    // Un dump peut finir par USE. Revenir explicitement à la copie avant les contrôles.
    await importer.query(`USE ${quote(database)}`);
    await importer.query('SET SESSION foreign_key_checks = 1');
    Object.assign(report, await inspectRestoredData(importer, database));
    report.migrations = await loadMigrationReadiness({ query: async (sql) => (await importer.query(sql))[0] });
    report.restored = true;
    if (expectedCounts) {
      report.dataMatchesExpected = Object.keys(expectedCounts).length === Object.keys(report.counts).length && Object.entries(expectedCounts).every(([table, count]) => report.counts[table] === String(count));
      if (!report.dataMatchesExpected) report.error = 'RESTORE_COUNTS_MISMATCH';
    }
  } catch (error) {
    report.error = error.code || 'RESTORE_FAILED';
  } finally {
    if (importer) await importer.end().catch(() => {});
    if (userCreated) {
      try { await admin.query('DROP USER ?@?', [user, peerHost]); report.temporaryAccountRemoved = true; }
      catch (_error) { report.error = 'RESTORE_ACCOUNT_CLEANUP_FAILED'; }
    }
    if (admin) await admin.end().catch(() => {});
  }
  report.readyForDataReview = report.restored && !report.error && report.temporaryAccountRemoved;
  report.backupApproved = false;
  return report;
}

module.exports = { localRestoreConfig, listDumpFiles, inspectRestoredData, rehearseRestore };
