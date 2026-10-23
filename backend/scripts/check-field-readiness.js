'use strict';
const option = process.argv.slice(2).find((value) => value.startsWith('--country='));
const countryCode = option?.split('=')[1]?.toUpperCase();
const regionOption = process.argv.slice(2).find((value) => value.startsWith('--region='));
const regionId = regionOption ? Number(regionOption.split('=')[1]) : null;
if (!/^[A-Z]{2}$/.test(countryCode || '') || (regionOption && (!Number.isSafeInteger(regionId) || regionId <= 0))) {
  console.error('Usage: npm run field:check -- --country=ML [--region=123]');
  process.exitCode = 2;
} else {
  const db = require('../models');
  const { loadFieldReadiness } = require('../src/services/fieldReadiness.service');
  db.sequelize.options.logging = false;
  (async () => {
    try {
      const country = await db.Country.findOne({ where: { isoCode: countryCode } });
      if (!country) throw new Error(`Pays ${countryCode} introuvable`);
      const result = await loadFieldReadiness(db, { countryId: country.id, regionId });
      console.log(JSON.stringify(result, null, 2));
      if (!result.ready) process.exitCode = 1;
    } catch (error) { console.error(error.message); process.exitCode = 1; }
    finally { await db.sequelize.close(); }
  })();
}
