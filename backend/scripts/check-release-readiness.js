'use strict';
const { loadOperationalEnv } = require('./operational-env');
const { parseFieldCheckOptions } = require('../src/utils/fieldCheckOptions');
const { validateProdConfig } = require('../src/utils/validateProdConfig');
const { loadMigrationReadiness } = require('../src/services/migrationReadiness.service');
const { validateReleaseMediaConfig } = require('../src/utils/releaseMediaConfig');

async function main(argv = process.argv.slice(2)) {
  const scope = parseFieldCheckOptions(argv);
  process.env.NODE_ENV = 'production';
  loadOperationalEnv();
  const configuration = validateProdConfig({ ...process.env, NODE_ENV: 'production' });
  configuration.errors.push(...validateReleaseMediaConfig(process.env));
  const report = { checkedAt: new Date().toISOString(), scope, configuration, migrations: null, field: null, readyForFieldTests: false, openingApproved: false };
  if (!configuration.errors.length) {
    const db = require('../models');
    db.sequelize.options.logging = false;
    try {
      await db.sequelize.authenticate();
      report.migrations = await loadMigrationReadiness(db.sequelize);
      if (report.migrations.ready) {
        const country = await db.Country.findOne({ where: { isoCode: scope.countryCode } });
        if (!country) throw new Error('COUNTRY_NOT_FOUND');
        const { loadFieldReadiness } = require('../src/services/fieldReadiness.service');
        report.field = await loadFieldReadiness(db, { countryId: country.id, regionId: scope.regionId });
        report.readyForFieldTests = report.field.ready;
      }
    } catch (error) {
      // Les erreurs SQL peuvent contenir des données ou secrets de connexion.
      report.error = error.original?.code || error.parent?.code || error.code || 'RELEASE_CHECK_FAILED';
      if (error.message === 'COUNTRY_NOT_FOUND') report.error = error.message;
    } finally { await db.sequelize.close(); }
  }
  console.log(JSON.stringify(report, null, 2));
  if (!report.readyForFieldTests) process.exitCode = 1;
  return report;
}

if (require.main === module) main().catch(() => { console.error('Contrôle impossible. Usage: npm run release:check -- --country=ML [--region=123]'); process.exitCode = 2; });
module.exports = { main };
