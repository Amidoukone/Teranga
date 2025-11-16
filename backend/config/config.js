require('dotenv').config();

/**
 * ============================================================
 * 🔧 CONFIGURATION SEQUELIZE PREMIUM — TERANGA
 * ============================================================
 * - Local/dev : variables classiques (DB_HOST, DB_USER, …)
 * - Test : isolé
 * - Production : Render + PlanetScale via DATABASE_URL
 * - Supporte Vitess/PlanetScale + SSL obligatoire
 * - Compatible migrations + models/index.js
 * ============================================================
 */

module.exports = {
  /* ============================================================
     🔹 ENVIRONNEMENT LOCAL (development)
     ============================================================ */
  development: {
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || null,
    database: process.env.DB_NAME || "teranga_db",
    host: process.env.DB_HOST || "127.0.0.1",
    dialect: process.env.DB_DIALECT || "mysql",
    timezone: process.env.DB_TIMEZONE || "+00:00",
    logging: false,
    define: {
      underscored: false,
      freezeTableName: false,
      paranoid: false,
      timestamps: true
    }
  },

  /* ============================================================
     🔹 ENVIRONNEMENT TEST (CI/Local tests)
     ============================================================ */
  test: {
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || null,
    database: process.env.DB_NAME_TEST || "teranga_test",
    host: process.env.DB_HOST || "127.0.0.1",
    dialect: process.env.DB_DIALECT || "mysql",
    timezone: "+00:00",
    logging: false
  },

  /* ============================================================
     🔹 ENVIRONNEMENT PRODUCTION (Render + PlanetScale)
     ============================================================ */
  production: {
    // 🔥 C’EST LA LIGNE LA PLUS IMPORTANTE :
    use_env_variable: "DATABASE_URL",

    dialect: "mysql",

    // Obligatoire pour PlanetScale (SSL strict)
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: true
      }
    },

    timezone: "+00:00",

    logging: false,

    // IMPORTANT : conserve les options identiques au dev pour éviter les différences
    define: {
      underscored: false,
      freezeTableName: false,
      paranoid: false,
      timestamps: true
    }
  }
};
