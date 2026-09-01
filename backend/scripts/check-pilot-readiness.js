'use strict';
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '..', '.env.production'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });
const db = require('../models');
const { loadPilotReadiness } = require('../src/services/pilotReadiness.service');

async function main() {
  const countryCode = process.argv.slice(2).find((arg) => !arg.startsWith('--')) || process.env.PILOT_COUNTRY_CODE;
  if (!countryCode) throw new Error('Indiquer un code pays, ex. : npm run pilot:readiness -- ML');
  await db.sequelize.authenticate();
  try {
    const result = await loadPilotReadiness(db, countryCode);
    if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
    else { console.log(`[pilot-readiness] ${countryCode}: ${result.ready ? 'READY' : 'BLOCKED'}`); if (result.issues.length) console.table(result.issues); }
    if (!result.ready) process.exitCode = 2;
  } finally { await db.sequelize.close(); }
}
main().catch((error) => { console.error(`[pilot-readiness] failed: ${error.message}`); process.exit(1); });
