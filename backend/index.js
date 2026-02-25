'use strict';

const path = require('path');
const dotenv = require('dotenv');

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '.env') });
const logger = require('./src/utils/logger');
const app = require('./src/app');
const { validateProdConfig } = require('./src/utils/validateProdConfig');

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
   Garde-fou global contre les crashs silencieux
   ====================================================== */
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'process.unhandled_rejection');
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'process.uncaught_exception');
});

/* ======================================================
   Demarrage du serveur
   ====================================================== */
const PORT = process.env.PORT || 5000;
const isProd = (process.env.NODE_ENV || 'development') === 'production';

const getIntEnv = (key, fallback) => {
  const raw = process.env[key];
  if (raw === undefined || raw === null || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const retryBaseMs = getIntEnv('DB_RETRY_BASE_MS', 2000);
const retryMaxMs = getIntEnv('DB_RETRY_MAX_MS', 30000);
const retryMaxAttempts = getIntEnv('DB_RETRY_MAX_ATTEMPTS', isProd ? 0 : 5);
const retryTimeoutMs = getIntEnv('DB_RETRY_TIMEOUT_MS', isProd ? 0 : 60000);

let serverStarted = false;

app.locals.runtimeStatus = app.locals.runtimeStatus || {};
app.locals.runtimeStatus.db = app.locals.runtimeStatus.db || {
  ready: false,
  checkedAt: null,
  attempt: 0,
  error: 'db_not_started',
};

function updateDbRuntimeStatus({ ready, attempt, error }) {
  const prev = app.locals.runtimeStatus?.db || {};
  const nextReady = ready === true;
  const nextAttempt = Number.isFinite(attempt) ? attempt : prev.attempt || 0;

  app.locals.runtimeStatus = app.locals.runtimeStatus || {};
  app.locals.runtimeStatus.db = {
    ...prev,
    ready: nextReady,
    checkedAt: Date.now(),
    attempt: nextAttempt,
    error: nextReady
      ? null
      : error?.message ||
        (typeof error === 'string' && error) ||
        prev.error ||
        'db_unavailable',
  };
}

const startServer = () => {
  if (serverStarted) return;
  serverStarted = true;
  app.listen(PORT, '0.0.0.0', () => {
    logger.info({ port: PORT }, 'server.start.listening');
  });
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connectAndBootstrap({ exitOnFail }) {
  if (!sequelize) {
    updateDbRuntimeStatus({
      ready: false,
      error: "Sequelize n'est pas initialise",
    });
    throw new Error(
      "Sequelize n'est pas initialise. Verifie ./models/index.js et la config DB."
    );
  }

  updateDbRuntimeStatus({ ready: false, attempt: 0, error: 'db_connecting' });

  const startedAt = Date.now();
  let attempt = 0;

  // Boucle de retry avec backoff pour eviter les crashs en production
  while (true) {
    attempt += 1;
    try {
      await sequelize.authenticate();
      logger.info('db.connection.authenticated');
      await bootstrapAdmin();
      updateDbRuntimeStatus({ ready: true, attempt });
      return;
    } catch (err) {
      updateDbRuntimeStatus({ ready: false, attempt, error: err });
      logger.warn({ err, attempt }, 'db.connection.retrying');

      const elapsed = Date.now() - startedAt;
      const hitMaxAttempts =
        retryMaxAttempts > 0 && attempt >= retryMaxAttempts;
      const hitTimeout = retryTimeoutMs > 0 && elapsed >= retryTimeoutMs;

      if (hitMaxAttempts || hitTimeout) {
        if (exitOnFail) {
          throw err;
        }
        logger.error(
          { err, attempt, elapsedMs: elapsed },
          'db.connection.unavailable.service_continues'
        );
        return;
      }

      const expBackoff = retryBaseMs * Math.pow(2, Math.min(attempt - 1, 8));
      const backoff = Math.min(retryMaxMs, expBackoff);
      const jitter = Math.floor(Math.random() * Math.min(1000, backoff * 0.2));
      await sleep(backoff + jitter);
    }
  }
}

async function start() {
  try {
    const configValidation = validateProdConfig(process.env);
    if (configValidation.errors.length > 0) {
      configValidation.errors.forEach((msg) => {
        logger.error({ msg }, 'config.production.invalid');
      });
      throw new Error('Configuration production invalide');
    }
    configValidation.warnings.forEach((msg) => {
      logger.warn({ msg }, 'config.production.warning');
    });

    if (isProd) {
      // En production (ex: Render), demarrer le serveur sans bloquer sur la DB.
      // La DB peut etre en sleep (PlanetScale); on tente en boucle en background.
      startServer();
      connectAndBootstrap({ exitOnFail: false }).catch((err) => {
        logger.error({ err }, 'db.connection.failed');
      });
      return;
    }

    await connectAndBootstrap({ exitOnFail: true });
    startServer();
  } catch (err) {
    logger.error({ err }, 'db.connection.failed');
    process.exit(1);
  }
}

start();

