'use strict';

const { configureOperatingOffers } = require('../src/services/operatingOfferConfiguration.service');
const profile = require('../config/operating-offers/mali.json');

function parseArgs(argv) {
  if (argv.length && (argv.length !== 1 || argv[0] !== '--apply')) throw new Error('Usage: npm run data:configure-mali-offers [-- --apply]');
  return { apply: argv[0] === '--apply' };
}

async function main(argv) {
  const options = parseArgs(argv);
  const path = require('path');
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.production'), quiet: true });
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });
  const db = require('../models');
  try {
    const result = await configureOperatingOffers(db, profile, options);
    console.log(JSON.stringify(result, null, 2));
    if (!result.summary.readyToApply) process.exitCode = 2;
  } finally { await db.sequelize.close(); }
}

if (require.main === module) main(process.argv.slice(2)).catch((error) => {
  console.error('[configure-mali-offers] failed:', error.message);
  process.exitCode = 1;
});

module.exports = { parseArgs };
