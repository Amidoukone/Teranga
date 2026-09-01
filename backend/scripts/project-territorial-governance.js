'use strict';

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.production'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

const db = require('../models');
const {
  loadLegacyProjection,
  applyTerritorialProjection,
} = require('../src/services/territorialProjection.service');

function parseArgs(argv) {
  return {
    apply: argv.includes('--apply'),
    json: argv.includes('--json'),
    failOnBlocking: argv.includes('--fail-on-blocking'),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await db.sequelize.authenticate();

  try {
    const projection = await loadLegacyProjection(db, {
      headquartersName: process.env.TERANGA_HEADQUARTERS_NAME || 'Teranga',
    });
    let writeStats = null;

    if (args.apply && projection.summary.readyToApply) {
      writeStats = await applyTerritorialProjection(db, projection);
    }

    if (args.json) {
      console.log(
        JSON.stringify(
          {
            mode: args.apply ? 'apply' : 'dry-run',
            summary: projection.summary,
            issues: projection.issues,
            writeStats,
          },
          null,
          2
        )
      );
    } else {
      console.log(`[territorial-projection] mode: ${args.apply ? 'apply' : 'dry-run'}`);
      console.table(projection.summary);
      if (projection.issues.length > 0) console.table(projection.issues);
      if (writeStats) console.table(writeStats);
      if (!args.apply) {
        console.log('[territorial-projection] no data written; use --apply explicitly');
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
  console.error('[territorial-projection] failed:', error.message);
  try {
    await db.sequelize.close();
  } catch (_closeError) {}
  process.exit(1);
});
