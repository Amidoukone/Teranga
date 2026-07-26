'use strict';

// Backfill des coordonnées manquantes sur `services` (docs/DEV_SPEC_TERANGA_v3.md
// section 0.5) : géocode les missions existantes qui ont une adresse mais pas
// de latitude/longitude, et produit un rapport des lignes orphelines
// (adresse absente, ou présente mais non géocodable) — ces dernières restent
// nullables en DB, aucune contrainte NOT NULL rétroactive n'est appliquée.
//
// Usage : node scripts/backfill-service-geocoords.js [--dry-run]

const { Op } = require('sequelize');
const db = require('../models');
const { geocodeAddress } = require('../src/services/geocoding.service');

const { Service, Country } = db;

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 100;
// Espace les appels Geocoding (coût API + quota) — pas de traitement en rafale.
const DELAY_BETWEEN_CALLS_MS = 150;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  await db.sequelize.authenticate();

  if (!process.env.GOOGLE_MAPS_SERVER_KEY) {
    console.error(
      'backfill-service-geocoords: GOOGLE_MAPS_SERVER_KEY absent — impossible de géocoder, arrêt.'
    );
    process.exit(1);
  }

  console.log(`backfill-service-geocoords: start (dry-run=${DRY_RUN})`);

  const isoCache = new Map();
  async function countryIso(countryId) {
    if (!countryId) return null;
    if (isoCache.has(countryId)) return isoCache.get(countryId);
    const country = await Country.findByPk(countryId, { attributes: ['isoCode'] });
    const iso = country?.isoCode || null;
    isoCache.set(countryId, iso);
    return iso;
  }

  let lastId = 0;
  let scanned = 0;
  let geocoded = 0;
  const orphansNoAddress = [];
  const orphansGeocodeFailed = [];

  while (true) {
    const rows = await Service.findAll({
      where: {
        id: { [Op.gt]: lastId },
        [Op.or]: [{ latitude: null }, { longitude: null }],
      },
      attributes: ['id', 'address', 'countryId', 'latitude', 'longitude'],
      order: [['id', 'ASC']],
      limit: BATCH_SIZE,
    });

    if (!rows.length) break;

    for (const service of rows) {
      scanned += 1;
      lastId = service.id;

      const address = service.address ? String(service.address).trim() : '';
      if (!address) {
        orphansNoAddress.push(service.id);
        continue;
      }

      const iso = await countryIso(service.countryId);
      const geo = await geocodeAddress(address, { countryIso: iso });
      await sleep(DELAY_BETWEEN_CALLS_MS);

      if (!geo) {
        orphansGeocodeFailed.push({ id: service.id, address });
        continue;
      }

      geocoded += 1;
      if (!DRY_RUN) {
        await service.update({ latitude: geo.latitude, longitude: geo.longitude });
      }
    }
  }

  console.log('backfill-service-geocoords: done', {
    scanned,
    geocoded,
    orphansNoAddress: orphansNoAddress.length,
    orphansGeocodeFailed: orphansGeocodeFailed.length,
  });

  if (orphansNoAddress.length) {
    console.log('orphans (no address, left null):', orphansNoAddress);
  }
  if (orphansGeocodeFailed.length) {
    console.log('orphans (address present, geocoding failed):', orphansGeocodeFailed);
  }

  process.exit(0);
}

run().catch((err) => {
  console.error('backfill-service-geocoords: error', err);
  process.exit(1);
});
