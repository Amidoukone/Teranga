'use strict';

const path = require('path');
const dotenv = require('dotenv');

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '.env') });
const logger = require('./src/utils/logger');
const app = require('./src/app');

// Sequelize (models/index.js)
const db = require('./models');
const { sequelize } = db;

// Ajout du bootstrap admin
const bootstrapAdmin = require('./src/utils/bootstrapAdmin');

// Activer les logs SQL si disponibles
if (sequelize?.options) {
  sequelize.options.logging = (msg) => logger.debug({ sql: msg });
}

/* ======================================================
   🛡️ Garde-fou global contre les crashs silencieux
   ====================================================== */
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, '💥 Unhandled Rejection');
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, '💥 Uncaught Exception');
});

/* ======================================================
   ⚙️ Démarrage du serveur
   ====================================================== */
const PORT = process.env.PORT || 5000;

async function start() {
  try {
    if (!sequelize) {
      throw new Error(
        "Sequelize n'est pas initialisé. Vérifie ./models/index.js et la config DB."
      );
    }

    await sequelize.authenticate();
    logger.info('✅ Connexion MySQL OK');

    // 🔥 Création automatique du compte admin si absent
    await bootstrapAdmin();

    app.listen(PORT, '0.0.0.0', () => {
      logger.info({ port: PORT }, '🚀 API Teranga lancée');
    });
  } catch (err) {
    logger.error({ err }, '❌ Erreur DB');
    process.exit(1);
  }
}

start();
