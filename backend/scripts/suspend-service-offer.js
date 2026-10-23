'use strict';

function parseArgs(argv) {
  const args = {};
  for (const arg of argv) {
    if (arg === '--apply' && args.apply === undefined) { args.apply = true; continue; }
    const match = /^--(country|availability)=(.+)$/.exec(arg);
    if (!match || args[match[1]] !== undefined) throw new Error(`Invalid or duplicate suspension option: ${arg}`);
    args[match[1]] = match[2];
  }
  const countryCode = String(args.country || '').toUpperCase();
  const availabilityId = Number(args.availability);
  if (!/^[A-Z]{2}$/.test(countryCode) || !/^[1-9]\d*$/.test(args.availability || '') || !Number.isSafeInteger(availabilityId)) {
    throw new Error('Usage: npm run data:suspend-offer -- --country=ML --availability=1 [--apply]');
  }
  return { countryCode, availabilityId, apply: args.apply === true };
}

async function suspendOffer(db, { countryCode, availabilityId, apply = false }) {
  async function run(transaction) {
    const query = transaction ? { transaction, lock: transaction.LOCK.UPDATE } : {};
    const country = await db.Country.findOne({ where: { isoCode: countryCode }, ...query });
    if (!country) throw new Error(`Country not found: ${countryCode}`);
    const offering = await db.ServiceAvailability.findByPk(availabilityId, {
      include: [
        { model: db.Territory, as: 'territory', required: true, where: { countryId: country.id } },
        { model: db.ServiceDefinition, as: 'definition', attributes: ['code', 'name'] },
      ], ...query,
    });
    if (!offering || String(offering.territory?.countryId) !== String(country.id)) throw new Error('Offering not found within the selected country');
    const wasActive = offering.isActive;
    if (apply && wasActive) await offering.update({ isActive: false }, { transaction });
    return {
      mode: apply ? 'apply' : 'dry-run', scope: countryCode,
      country: { id: country.id, name: country.name },
      offering: { id: offering.id, code: offering.definition?.code, name: offering.definition?.name, wasActive, isActive: apply ? false : wasActive },
      applied: apply, changed: apply && wasActive,
    };
  }
  return apply ? db.sequelize.transaction(run) : run();
}

async function main(argv) {
  const args = parseArgs(argv);
  const path = require('path');
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.production'), quiet: true });
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });
  const db = require('../models');
  try { console.log(JSON.stringify(await suspendOffer(db, args), null, 2)); }
  finally { await db.sequelize.close(); }
}

if (require.main === module) main(process.argv.slice(2)).catch((error) => {
  console.error('[suspend-service-offer] failed:', error.message);
  process.exitCode = 1;
});

module.exports = { parseArgs, suspendOffer };
