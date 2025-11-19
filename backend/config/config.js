require('dotenv').config();

/**
 * ============================================================
 * 🔧 CONFIGURATION SEQUELIZE — TERANGA (Premium & PlanetScale Ready)
 * ============================================================
 * - Local/dev : MySQL local (DB_HOST, DB_USER…)
 * - Test : base isolée
 * - Production : Render (DATABASE_URL)
 * - PlanetScale migrations : PLANETSCALE_DATABASE_URL
 * - Support SSL pour PlanetScale
 * - Compatible Sequelize CLI & models/index.js
 * ============================================================
 */

module.exports = {
  /* ============================================================
     🔹 LOCAL DEVELOPMENT
     ============================================================ */
  development: {
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || null,
    database: process.env.DB_NAME || "teranga_db",
    host: process.env.DB_HOST || "127.0.0.1",
    dialect: "mysql",
    timezone: "+00:00",
    logging: false,
    define: {
      underscored: false,
      freezeTableName: false,
      paranoid: false,
      timestamps: true
    }
  },

  /* ============================================================
     🔹 TEST ENV (local tests / CI)
     ============================================================ */
  test: {
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || null,
    database: process.env.DB_NAME_TEST || "teranga_test",
    host: process.env.DB_HOST || "127.0.0.1",
    dialect: "mysql",
    timezone: "+00:00",
    logging: false
  },

  /* ============================================================
     🔹 PRODUCTION (Render + PlanetScale)
     ============================================================ */
  production: {
    use_env_variable: "DATABASE_URL",
    dialect: "mysql",
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: true
      }
    },
    timezone: "+00:00",
    logging: false,
    define: {
      underscored: false,
      freezeTableName: false,
      paranoid: false,
      timestamps: true
    }
  },

  /* ============================================================
     🔹 PLANETSCALE SCHEMA BRANCH (dev-schema)
        👉 Utilisé UNIQUEMENT pour exécuter Sequelize CLI localement
        👉 On utilise PLANETSCALE_DATABASE_URL, pas DATABASE_URL
     ============================================================ */
  planetscale: {
    use_env_variable: "PLANETSCALE_DATABASE_URL",
    dialect: "mysql",
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: true
      }
    },
    timezone: "+00:00",
    logging: console.log, // utile pendant les migrations
    define: {
      underscored: false,
      freezeTableName: false,
      paranoid: false,
      timestamps: true
    }
  }
};
