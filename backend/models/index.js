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

const sequelize = config.use_env_variable
  ? new Sequelize(process.env[config.use_env_variable], {
      ...config,
      logging: isProd ? false : console.log,
    })
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
