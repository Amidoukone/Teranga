require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || null,
    database: process.env.DB_NAME || "teranga_db",
    host: process.env.DB_HOST || "127.0.0.1",
    dialect: "mysql",
    timezone: "+00:00",
    logging: false,
    define: {
      freezeTableName: false,
      timestamps: true,
      paranoid: false
    }
  },

  test: {
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || null,
    database: process.env.DB_NAME_TEST || "teranga_test",
    host: process.env.DB_HOST || "127.0.0.1",
    dialect: "mysql",
    timezone: "+00:00",
    logging: false
  },

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
    sync: false, // 🔐 sécurité
    define: {
      freezeTableName: true, // 🔥 PLANETSCALE SAFE
      timestamps: true,
      paranoid: false
    }
  },

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
    logging: console.log,
    define: {
      freezeTableName: false,
      timestamps: true,
      paranoid: false
    }
  }
};
