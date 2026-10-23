'use strict';

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.production'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

const db = require('../models');
const { projectionArgs } = require('../src/utils/projectionCountry');
const {
  loadCatalogProjection,
  applyCatalogProjection,
} = require('../src/services/serviceCatalogProjection.service');

async function main() {
  const args = projectionArgs(process.argv.slice(2));
  await db.sequelize.authenticate();

  try {
    const projection = await loadCatalogProjection(db, { countryCode: args.countryCode });
    let writeStats = null;
    if (args.apply && projection.summary.readyToApply) {
      writeStats = await applyCatalogProjection(db, projection);
    }

    const output = {
      mode: args.apply ? 'apply' : 'dry-run',
      scope: args.countryCode || 'all',
      summary: projection.summary,
      issues: projection.issues,
      writeStats,
    };
    if (args.json) console.log(JSON.stringify(output, null, 2));
    else {
      console.log(`[service-catalog-projection] mode: ${output.mode}; scope: ${output.scope}`);
      console.table(output.summary);
      if (output.issues.length) console.table(output.issues);
      if (writeStats) console.table(writeStats);
      if (!args.apply) {
        console.log('[service-catalog-projection] no data written; use --apply explicitly');
      }
    }

    if ((args.apply || args.failOnBlocking) && !projection.summary.readyToApply) {
      process.exitCode = 2;
    }
  } finally {
    await db.sequelize.close();
  }
}

main().catch(async (error) => {
  console.error('[service-catalog-projection] failed:', error.message);
  try {
    await db.sequelize.close();
  } catch (_closeError) {}
  process.exit(1);
});
