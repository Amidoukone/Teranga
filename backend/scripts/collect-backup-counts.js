'use strict';
const fs = require('fs').promises;
const path = require('path');
const { QueryTypes, Transaction } = require('sequelize');
const { loadOperationalEnv } = require('./operational-env');

async function collectBackupCounts(sequelize) {
  return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ, readOnly: true }, async (transaction) => {
    const tables = await sequelize.query("SELECT TABLE_NAME AS tableName FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME", { type: QueryTypes.SELECT, transaction, logging: false });
    if (!tables.length) throw new Error('Base vide');
    const counts = {};
    for (const { tableName } of tables) {
      const quoted = `\`${tableName.replace(/`/g, '``')}\``;
      const [row] = await sequelize.query(`SELECT CAST(COUNT(*) AS CHAR) AS rowCount FROM ${quoted}`, { type: QueryTypes.SELECT, transaction, logging: false });
      counts[tableName.toLowerCase() === 'sequelizemeta' ? 'SequelizeMeta' : tableName] = row.rowCount;
    }
    return counts;
  });
}

async function main(argv = process.argv.slice(2)) {
  if (argv.length !== 1 || !/^--output=.+$/.test(argv[0])) throw new Error('Usage: --output=../backups/counts.json');
  const output = path.resolve(argv[0].slice('--output='.length));
  loadOperationalEnv();
  const db = require('../models');
  db.sequelize.options.logging = false;
  try {
    const counts = await collectBackupCounts(db.sequelize);
    await fs.writeFile(output, `${JSON.stringify(counts, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ written: true, tables: Object.keys(counts).length }));
  } finally { await db.sequelize.close(); }
}

if (require.main === module) main().catch(() => { console.error('Comptages impossibles : vérifier la connexion et un chemin de sortie inexistant. Usage: npm run backup:counts -- --output=../backups/counts.json'); process.exitCode = 1; });
module.exports = { collectBackupCounts, main };
