'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
require('dotenv').config();

const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';

const configPath = path.resolve(__dirname, '../config/config.js');
const allConfigs = require(configPath);
const config = allConfigs[env];

if (!config) {
  console.error(`❌ Aucun config pour l'env "${env}"`);
  process.exit(1);
}

const db = {};

function normalizeDatabaseUrl(urlValue, sequelizeConfig) {
  const raw = String(urlValue || '').trim();
  if (!raw) return { url: raw, extraDialectOptions: {} };

  // mysql2 treats `ssl=<string>` as an SSL profile name.
  // Some providers/docs suggest `ssl={"rejectUnauthorized":true}` in URL query,
  // which arrives as string and breaks with:
  // "Unknown SSL profile '{\"rejectUnauthorized\":true}'".
  // We parse and lift it into dialectOptions.ssl object.
  try {
    const parsed = new URL(raw);
    const sslParam = parsed.searchParams.get('ssl');

    if (!sslParam) {
      return { url: raw, extraDialectOptions: {} };
    }

    let sslObject = null;
    try {
      sslObject = JSON.parse(sslParam);
    } catch (_err) {
      sslObject = null;
    }

    if (sslObject && typeof sslObject === 'object' && !Array.isArray(sslObject)) {
      parsed.searchParams.delete('ssl');
      return {
        url: parsed.toString(),
        extraDialectOptions: {
          ssl: {
            ...(sequelizeConfig?.dialectOptions?.ssl || {}),
            ...sslObject,
          },
        },
      };
    }
  } catch (_err) {
    // Keep original URL if parsing fails.
  }

  return { url: raw, extraDialectOptions: {} };
}

const sequelize = config.use_env_variable
  ? (() => {
      const rawUrl = process.env[config.use_env_variable];
      const normalized = normalizeDatabaseUrl(rawUrl, config);

      return new Sequelize(normalized.url, {
        ...config,
        dialectOptions: {
          ...(config.dialectOptions || {}),
          ...(normalized.extraDialectOptions || {}),
        },
        logging: isProd ? false : console.log,
      });
    })()
  : new Sequelize(config.database, config.username, config.password, {
      ...config,
      logging: isProd ? false : console.log,
    });

/**
 * ✅ IMPORTANT:
 * - Ne pas override showAllTables() en prod.
 * - PlanetScale est "safe" tant que tu n'utilises pas sequelize.sync().
 * - Tes migrations doivent pouvoir lire SequelizeMeta correctement.
 */

fs.readdirSync(__dirname)
  .filter((file) =>
    file.indexOf('.') !== 0 &&
    file !== basename &&
    file.endsWith('.js') &&
    !file.endsWith('.test.js')
  )
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

Object.keys(db).forEach((modelName) => {
  if (typeof db[modelName].associate === 'function') {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
