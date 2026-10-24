'use strict';
const { loadOperationalEnv } = require('./operational-env');
const { loadMigrationReadiness } = require('../src/services/migrationReadiness.service');

async function main() {
  if (process.argv.length > 2) throw new Error('Aucune option attendue');
  loadOperationalEnv();
  const db = require('../models');
  db.sequelize.options.logging = false;
  try {
    const report = await loadMigrationReadiness(db.sequelize);
    console.log(JSON.stringify(report, null, 2));
    if (!report.ready) process.exitCode = 1;
  } finally { await db.sequelize.close(); }
}

if (require.main === module) main().catch(() => { console.error('Contrôle des migrations impossible : vérifier la configuration et la connexion. Aucune migration appliquée.'); process.exitCode = 1; });
module.exports = { main };
