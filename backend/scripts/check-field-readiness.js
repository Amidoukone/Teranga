'use strict';
const { parseFieldCheckOptions } = require('../src/utils/fieldCheckOptions');
const { loadOperationalEnv } = require('./operational-env');
let options;
try { options = parseFieldCheckOptions(process.argv.slice(2)); }
catch (error) { console.error(error.message); process.exitCode = 2; }
if (options) {
  const { countryCode, regionId } = options;
  loadOperationalEnv({ defaultEnv: 'development' });
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
