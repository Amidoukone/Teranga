'use strict';

const path = require('path');
const dotenv = require('dotenv');
const { auditGeoIntegrity } = require('../src/services/geoIntegrity.service');

dotenv.config({
  path: path.resolve(__dirname, '..', '.env.production'),
  quiet: true,
});
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

function parseArgs(argv) {
  return {
    json: argv.includes('--json'),
    failOnBlocking: argv.includes('--fail-on-blocking'),
    failOnStrictNotReady: argv.includes('--fail-on-strict-not-ready'),
  };
}

function printHumanReport(report) {
  console.log('[data:audit-geo] mode: read-only');
  console.log('[data:audit-geo] generated at:', report.generatedAt);
  console.log('');
  console.log(
    'table | total | country NULL | region NULL | region sans pays | pays inconnu | region inconnue | region/pays incoherents'
  );

  for (const table of report.tables) {
    const s = table.stats;
    console.log(
      [
        table.tableName,
        s.total,
        s.missingCountry,
        s.missingRegion,
        s.regionWithoutCountry,
        s.unknownCountry,
        s.unknownRegion,
        s.regionCountryMismatch,
      ].join(' | ')
    );
  }

  console.log('');
  console.log('[data:audit-geo] summary:', report.summary);
  console.log(
    report.summary.readyForStrictRegionScope
      ? '[data:audit-geo] STRICT MODE READY'
      : '[data:audit-geo] STRICT MODE NOT READY'
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = require('../models');

  try {
    await db.sequelize.authenticate();
    const report = await auditGeoIntegrity(db);

    if (args.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printHumanReport(report);
    }

    if (args.failOnBlocking && report.summary.blockingAnomalies > 0) {
      process.exitCode = 2;
    }
    if (
      args.failOnStrictNotReady &&
      !report.summary.readyForStrictRegionScope
    ) {
      process.exitCode = 3;
    }
  } finally {
    await db.sequelize.close();
  }
}

main().catch((err) => {
  console.error('[data:audit-geo] failed:', err.message);
  process.exit(1);
});

