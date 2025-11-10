'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
require('dotenv').config();

const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';

// ✅ On lit bien config.js (pas config.json)
const configPath = path.resolve(__dirname, '../config/config.js');
const allConfigs = require(configPath);
const config = allConfigs[env];

if (!config) {
  console.error(`❌ Aucun config pour l'env "${env}" dans ${configPath}`);
  process.exit(1);
}

const db = {};
let sequelize;

// Connexion Sequelize
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

// Charge dynamiquement tous les modèles de ce dossier (sauf index.js)
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

// Applique les associations si présentes
Object.keys(db).forEach((modelName) => {
  if (typeof db[modelName].associate === 'function') {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
