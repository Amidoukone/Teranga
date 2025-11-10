require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || null,
    database: process.env.DB_NAME || "teranga_db",
    host: process.env.DB_HOST || "127.0.0.1",
    dialect: process.env.DB_DIALECT || "mysql",
    timezone: process.env.DB_TIMEZONE || "+00:00",  // ✅ UTC par défaut
    define: {
      underscored: false,       // noms de colonnes camelCase
      freezeTableName: false,   // Sequelize plurialise les tables (Users, Properties…)
      paranoid: false,          // pas de soft delete par défaut
      timestamps: true          // createdAt & updatedAt auto
    },
    logging: false
  },
  test: {
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || null,
    database: process.env.DB_NAME || "teranga_test",
    host: process.env.DB_HOST || "127.0.0.1",
    dialect: process.env.DB_DIALECT || "mysql",
    timezone: "+00:00",
    logging: false
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: process.env.DB_DIALECT || "mysql",
    timezone: "+00:00",   // ✅ UTC en prod aussi
    logging: false
  }
};
