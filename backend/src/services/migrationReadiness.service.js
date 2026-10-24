'use strict';
const fs = require('fs');
const path = require('path');
const { QueryTypes } = require('sequelize');

async function loadMigrationReadiness(sequelize, { directory = path.resolve(__dirname, '../../migrations') } = {}) {
  const files = fs.readdirSync(directory).filter((file) => file.endsWith('.js')).sort();
  if (!files.length) throw new Error('Aucune migration disponible dans cette version');
  let applied = [];
  let metadataPresent = true;
  try {
    const rows = await sequelize.query('SELECT name FROM `SequelizeMeta` ORDER BY name', { type: QueryTypes.SELECT, logging: false });
    applied = rows.map((row) => row.name);
  } catch (error) {
    if ((error.original?.code || error.parent?.code || error.code) !== 'ER_NO_SUCH_TABLE') throw error;
    metadataPresent = false;
  }
  const pending = files.filter((file) => !applied.includes(file));
  const unknown = applied.filter((file) => !files.includes(file));
  return { ready: metadataPresent && !pending.length && !unknown.length, metadataPresent, appliedCount: applied.length, pending, unknown };
}

module.exports = { loadMigrationReadiness };
