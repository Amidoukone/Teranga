'use strict';
const path = require('path');
const { loadOperationalEnv } = require('./operational-env');
const { recordProof, verifyProof } = require('../src/services/proofPersistence.service');

async function main(argv = process.argv.slice(2)) {
  const options = {};
  for (const argument of argv) {
    const match = /^--(file|record|verify)=(.+)$/.exec(argument);
    if (!match || options[match[1]]) throw new Error('Options invalides');
    options[match[1]] = match[2];
  }
  if (options.verify ? options.file || options.record : !options.file || !options.record) throw new Error('Options invalides');
  loadOperationalEnv({ defaultEnv: 'development' });
  const result = options.verify
    ? await verifyProof(path.resolve(options.verify))
    : await recordProof(options.file, path.resolve(options.record));
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) main().catch(() => {
  console.error('Échec : fichier absent, modifié, inaccessible ou options invalides. Usage: npm run proofs:check -- --file=/uploads/... --record=reference.json ; puis --verify=reference.json après redémarrage. La référence ne doit pas déjà exister.');
  process.exitCode = 1;
});
module.exports = { main };
