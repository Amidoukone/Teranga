'use strict';

const { Op } = require('sequelize');
const db = require('../models');

const {
  Project,
  Transaction,
  User,
  Region,
  Country,
  Service,
  Task,
  Order,
} = db;

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 200;

async function getCountryIdFromIso(iso) {
  if (!iso) return null;
  const record = await Country.findOne({
    where: { isoCode: String(iso).toUpperCase() },
    attributes: ['id', 'isActive'],
  });
  if (!record || record.isActive === false) return null;
  return record.id || null;
}

async function getFallbackRegionId(countryId) {
  if (!countryId) return null;
  const region = await Region.findOne({
    where: { countryId },
    order: [['id', 'ASC']],
    attributes: ['id'],
  });
  return region?.id ?? null;
}

async function backfillProjects() {
  let lastId = 0;
  let updated = 0;
  let scanned = 0;

  while (true) {
    const rows = await Project.findAll({
      where: {
        id: { [Op.gt]: lastId },
        [Op.or]: [{ countryId: null }, { regionId: null }],
      },
      include: [
        {
          model: User,
          as: 'client',
          attributes: ['id', 'countryId', 'regionId', 'country'],
        },
      ],
      order: [['id', 'ASC']],
      limit: BATCH_SIZE,
    });

    if (!rows.length) break;

    for (const project of rows) {
      scanned += 1;
      lastId = project.id;

      const client = project.client;
      const legacyCountryId = client?.country
        ? await getCountryIdFromIso(client.country)
        : null;

      const countryId =
        project.countryId ?? client?.countryId ?? legacyCountryId ?? null;
      let regionId = project.regionId ?? client?.regionId ?? null;

      if (!regionId && countryId) {
        regionId = await getFallbackRegionId(countryId);
      }

      const needsUpdate =
        (project.countryId ?? null) !== (countryId ?? null) ||
        (project.regionId ?? null) !== (regionId ?? null);

      if (!needsUpdate) continue;

      if (!DRY_RUN) {
        await project.update({
          countryId,
          regionId,
        });
      }

      updated += 1;
    }
  }

  return { scanned, updated };
}

async function backfillTransactions() {
  let lastId = 0;
  let updated = 0;
  let scanned = 0;

  while (true) {
    const rows = await Transaction.findAll({
      where: {
        id: { [Op.gt]: lastId },
        [Op.or]: [{ countryId: null }, { regionId: null }],
      },
      include: [
        {
          model: Project,
          as: 'project',
          attributes: ['id', 'countryId', 'regionId', 'clientId'],
          include: [
            {
              model: User,
              as: 'client',
              attributes: ['id', 'countryId', 'regionId', 'country'],
            },
          ],
        },
        {
          model: Service,
          as: 'service',
          attributes: ['id', 'countryId', 'regionId'],
        },
        {
          model: Task,
          as: 'task',
          attributes: ['id', 'countryId', 'regionId'],
        },
        {
          model: Order,
          as: 'order',
          attributes: ['id', 'countryId', 'regionId'],
        },
      ],
      order: [['id', 'ASC']],
      limit: BATCH_SIZE,
    });

    if (!rows.length) break;

    for (const trx of rows) {
      scanned += 1;
      lastId = trx.id;

      const legacyCountryId =
        trx.project?.client?.country
          ? await getCountryIdFromIso(trx.project.client.country)
          : null;

      const countryId =
        trx.countryId ??
        trx.service?.countryId ??
        trx.task?.countryId ??
        trx.project?.countryId ??
        trx.order?.countryId ??
        legacyCountryId ??
        null;

      let regionId =
        trx.regionId ??
        trx.service?.regionId ??
        trx.task?.regionId ??
        trx.project?.regionId ??
        trx.order?.regionId ??
        null;

      if (!regionId && countryId) {
        regionId = await getFallbackRegionId(countryId);
      }

      const needsUpdate =
        (trx.countryId ?? null) !== (countryId ?? null) ||
        (trx.regionId ?? null) !== (regionId ?? null);

      if (!needsUpdate) continue;

      if (!DRY_RUN) {
        await trx.update({
          countryId,
          regionId,
        });
      }

      updated += 1;
    }
  }

  return { scanned, updated };
}

async function main() {
  try {
    await db.sequelize.authenticate();
    console.log(`backfill-geo: start (dry-run=${DRY_RUN})`);

    const proj = await backfillProjects();
    console.log('projects:', proj);

    const trx = await backfillTransactions();
    console.log('transactions:', trx);

    console.log('backfill-geo: done');
    process.exit(0);
  } catch (err) {
    console.error('backfill-geo: error', err);
    process.exit(1);
  }
}

main();
