'use strict';

const path = require('path');
const { validatePreparation, prepareCountry } = require('../src/services/countryPreparation.service');

function parseArgs(argv) {
  const flags = new Set(['country', 'operator', 'phone', 'currency', 'language', 'timezone']);
  const options = {};
  for (const arg of argv) {
    if (arg === '--apply' && options.apply === undefined) { options.apply = true; continue; }
    const match = /^--([^=]+)=(.+)$/.exec(arg);
    if (!match || !flags.has(match[1]) || options[match[1]] !== undefined) throw new Error(`Invalid or duplicate preparation option: ${arg}`);
    options[match[1]] = match[2];
  }
  return { input: { ...options, countryCode: options.country }, apply: options.apply === true };
}

async function main(argv) {
  const { input, apply } = parseArgs(argv);
  validatePreparation(input);
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.production'), quiet: true });
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });
  const db = require('../models');
  try {
    const result = await prepareCountry(db, input, { apply });
    console.log(JSON.stringify(result, null, 2));
    if (!result.readyToApply) process.exitCode = 2;
  } finally {
    await db.sequelize.close();
  }
}

if (require.main === module) main(process.argv.slice(2)).catch((error) => {
  console.error('[country-preparation] failed:', error.message);
  process.exitCode = 1;
});

module.exports = { parseArgs };
