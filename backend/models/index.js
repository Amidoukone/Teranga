'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
require('dotenv').config();
const { recordSqlQuery } = require('../src/utils/requestPerf');
const {
  buildMysqlDialectOptions,
  normalizeMysqlDatabaseUrl,
} = require('../src/utils/mysqlConnectionOptions');

const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';

const configPath = path.resolve(__dirname, '../config/config.js');
const allConfigs = require(configPath);
const config = allConfigs[env];

if (!config) {
  console.error(`Aucun config pour l'env "${env}"`);
  process.exit(1);
}

const db = {};

function sequelizeLogging(sql, timingMs) {
  const roundedMs = Number.isFinite(Number(timingMs))
    ? Number(Number(timingMs).toFixed(2))
    : null;

  if (roundedMs !== null) {
    recordSqlQuery(sql, roundedMs);
  }

  if (!isProd) {
    if (roundedMs !== null) {
      console.log(`[sql ${roundedMs}ms] ${sql}`);
      return;
    }
    console.log(sql);
  }
}

const sequelize = config.use_env_variable
  ? (() => {
      const rawUrl = process.env[config.use_env_variable];
      const normalized = normalizeMysqlDatabaseUrl(rawUrl, config);
      const dialectOptions = buildMysqlDialectOptions({
        env: process.env,
        baseDialectOptions: {
          ...(config.dialectOptions || {}),
          ...(normalized.extraDialectOptions || {}),
        },
      });

      return new Sequelize(normalized.url, {
        ...config,
        dialectOptions,
        benchmark: true,
        logging: sequelizeLogging,
      });
    })()
  : new Sequelize(config.database, config.username, config.password, {
      ...config,
      benchmark: true,
      logging: sequelizeLogging,
    });

/**
 * IMPORTANT:
 * - Ne pas override showAllTables() en prod.
 * - En prod, ne pas utiliser sequelize.sync(); passer par les migrations.
 * - Les migrations doivent pouvoir lire SequelizeMeta correctement.
 */
fs.readdirSync(__dirname)
  .filter(
    (file) =>
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.endsWith('.js') &&
      !file.endsWith('.test.js')
  )
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(
      sequelize,
      Sequelize.DataTypes
    );
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
