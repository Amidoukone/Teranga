'use strict';
const fs = require('fs').promises;
const path = require('path');
const { rehearseRestore } = require('../src/services/backupRestore.service');

async function main(argv = process.argv.slice(2)) {
  const options = {};
  for (const argument of argv) {
    const match = /^--(dir|expected|report)=(.+)$/.exec(argument);
    if (!match || options[match[1]]) throw new Error('Options invalides');
    options[match[1]] = match[2];
  }
  if (!options.dir) throw new Error('Dossier SQL requis');
  require('dotenv').config({ path: path.resolve(__dirname, '../.env.restore.local'), quiet: true });
  const expectedCounts = options.expected ? JSON.parse(await fs.readFile(path.resolve(options.expected), 'utf8')) : null;
  // Réserver le rapport avant de créer la copie ; un fichier existant provoque
  // un échec avant toute opération MySQL. Le handle exclusif évite une course.
  const handle = options.report ? await fs.open(path.resolve(options.report), 'wx', 0o600) : null;
  let report;
  try {
    report = await rehearseRestore({ directory: path.resolve(options.dir), localUrl: process.env.RESTORE_DATABASE_URL, expectedCounts });
    if (handle) await handle.writeFile(`${JSON.stringify(report, null, 2)}\n`);
  } finally { if (handle) await handle.close(); }
  console.log(JSON.stringify(report, null, 2));
  if (!report.readyForDataReview || !report.dataMatchesExpected) process.exitCode = 1;
  return report;
}

if (require.main === module) main().catch(() => {
  console.error('Restauration impossible : vérifier les options et RESTORE_DATABASE_URL (serveur MySQL local, sans base). Usage: npm run backup:rehearse -- --dir=../backups/export --expected=../backups/counts.json [--report=../backups/restore-report.json]. Le rapport ne doit pas déjà exister.');
  process.exitCode = 1;
});
module.exports = { main };
