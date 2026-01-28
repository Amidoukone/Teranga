'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const logger = require('./src/utils/logger');
const requestContext = require('./src/middleware/requestContext.middleware');

// Sequelize (models/index.js)
const db = require('./models');
const { sequelize } = db;

// Ajout du bootstrap admin
const bootstrapAdmin = require('./src/utils/bootstrapAdmin');

// Activer les logs SQL si disponibles
if (sequelize?.options) {
  sequelize.options.logging = (msg) => logger.debug({ sql: msg });
}

const app = express();

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
   🧱 Middleware généraux
   ====================================================== */
app.set('trust proxy', 1);
app.use(requestContext);

const rawCorsOrigins = process.env.CORS_ORIGINS || '';
const configuredOrigins = rawCorsOrigins
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const isDev = (process.env.NODE_ENV || 'development') !== 'production';
const allowAllOrigins =
  configuredOrigins.includes('*') || (isDev && configuredOrigins.length === 0);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowAllOrigins) return callback(null, true);
      if (configuredOrigins.includes(origin)) return callback(null, true);
      logger.warn({ origin }, '🚫 CORS origin refusée');
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/* ======================================================
   📂 Fichiers uploadés (uploads/)
   ====================================================== */
const fs = require('fs');
const uploadsRoot = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadsRoot)) {
  fs.mkdirSync(uploadsRoot, { recursive: true });
  logger.info({ uploadsRoot }, '📂 Dossier uploads créé automatiquement');
}

app.use('/uploads', express.static(uploadsRoot));
logger.info('✅ Fichiers statiques disponibles sur /uploads');

/* ======================================================
   🔧 Chargement des routeurs Express
   ====================================================== */
function pickExpressRouter(mod) {
  const candidates = [mod, mod?.default, mod?.router];
  for (const c of candidates) {
    if (!c) continue;
    if (typeof c === 'function' || typeof c?.use === 'function') return c;
  }
  return null;
}

function loadRouter(routeFsPath, mountPath) {
  try {
    // ✅ IMPORTANT: require RELATIF (pas de path.resolve) pour éviter
    // des chemins inattendus sur Windows/circular require
    const mod = require(routeFsPath);
    const router = pickExpressRouter(mod);

    if (!router) {
      const keys =
        mod && typeof mod === 'object' ? Object.keys(mod) : '(aucune clé)';
      logger.error(
        { mountPath, routeFsPath, keys },
        '❌ Routeur invalide'
      );
      return;
    }

    app.use(mountPath, router);
    logger.info({ mountPath }, '✅ Routeur chargé');
  } catch (err) {
    logger.error(
      { err, routeFsPath, mountPath },
      '❌ Échec du chargement du routeur'
    );
  }
}

/* ======================================================
   🚀 Chargement des routes API
   ====================================================== */
// Auth & core
loadRouter('./src/routes/auth.routes', '/api/auth');
loadRouter('./src/routes/property.routes', '/api/properties');
loadRouter('./src/routes/user.routes', '/api/users');
loadRouter('./src/routes/service.routes', '/api/services');
loadRouter('./src/routes/task.routes', '/api/tasks');
loadRouter('./src/routes/evidence.routes', '/api/evidences');
loadRouter('./src/routes/transaction.routes', '/api/transactions');

// ✅ Multi-pays / franchise
loadRouter('./src/routes/country.routes', '/api/countries');
loadRouter('./src/routes/region.routes', '/api/regions');
loadRouter('./src/routes/franchise.routes', '/api/franchises');

// Module Projets
loadRouter('./src/routes/project.routes', '/api/projects');
loadRouter('./src/routes/projectPhase.routes', '/api/project-phases');
loadRouter('./src/routes/projectDocument.routes', '/api/project-documents');

// Module Commerce
loadRouter('./src/routes/category.routes', '/api/categories');
loadRouter('./src/routes/product.routes', '/api/products');
loadRouter('./src/routes/order.routes', '/api/orders');
loadRouter('./src/routes/orderItem.routes', '/api/order-items');

/* ======================================================
   🔍 Healthcheck + Racine
   ====================================================== */
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    name: 'Teranga API',
    version: '1.0.0',
    env: process.env.NODE_ENV || 'development',
  });
});

/* ======================================================
   ⚠️ Gestion des erreurs et 404
   ====================================================== */
app.use((req, res, next) => {
  if (res.headersSent) return next();
  res.status(404).json({ error: 'Route introuvable', requestId: req.requestId });
});

app.use((err, req, res, _next) => {
  logger.error({ err, requestId: req.requestId }, '❌ Erreur backend');
  if (res.headersSent) return;
  res.status(500).json({ error: 'Erreur interne du serveur', requestId: req.requestId });
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
