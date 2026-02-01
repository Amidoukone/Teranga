'use strict';

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const logger = require('./utils/logger');
const requestContext = require('./middleware/requestContext.middleware');
const securityHeaders = require('./middleware/securityHeaders.middleware');
const {
  metricsMiddleware,
  metricsHandler,
} = require('./middleware/metrics.middleware');

const app = express();

/* ======================================================
   🧱 Middleware généraux
   ====================================================== */
app.set('trust proxy', 1);
app.use(requestContext);
app.use(securityHeaders);
app.use(metricsMiddleware);
app.use(cookieParser());

function normalizeOrigin(value) {
  if (!value) return '';
  return value.trim().replace(/\/+$/, '');
}

const rawCorsOrigins = process.env.CORS_ORIGINS || '';
const configuredOrigins = rawCorsOrigins
  .split(',')
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);
const fallbackOrigins = [
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL,
  process.env.CLIENT_ORIGIN,
]
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);
const allowedOrigins = Array.from(
  new Set([...configuredOrigins, ...fallbackOrigins])
);
const isDev = (process.env.NODE_ENV || 'development') !== 'production';
const allowAllOrigins =
  allowedOrigins.includes('*') || (isDev && allowedOrigins.length === 0);

if (!isDev && allowedOrigins.length === 0) {
  logger.warn(
    '⚠️ Aucune origine CORS configurée. Pense à définir CORS_ORIGINS ou FRONTEND_URL.'
  );
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowAllOrigins) return callback(null, true);
      const normalizedOrigin = normalizeOrigin(origin);
      if (allowedOrigins.includes(normalizedOrigin)) return callback(null, true);
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
const uploadsRoot = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(uploadsRoot)) {
  fs.mkdirSync(uploadsRoot, { recursive: true });
  logger.info({ uploadsRoot }, '📂 Dossier uploads créé automatiquement');
}

app.use(
  '/uploads',
  express.static(uploadsRoot, {
    dotfiles: 'deny',
    fallthrough: true,
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    },
  })
);
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
loadRouter('./routes/auth.routes', '/api/auth');
loadRouter('./routes/property.routes', '/api/properties');
loadRouter('./routes/user.routes', '/api/users');
loadRouter('./routes/service.routes', '/api/services');
loadRouter('./routes/task.routes', '/api/tasks');
loadRouter('./routes/evidence.routes', '/api/evidences');
loadRouter('./routes/transaction.routes', '/api/transactions');

// ✅ Multi-pays / franchise
loadRouter('./routes/country.routes', '/api/countries');
loadRouter('./routes/region.routes', '/api/regions');
loadRouter('./routes/franchise.routes', '/api/franchises');

// Module Projets
loadRouter('./routes/project.routes', '/api/projects');
loadRouter('./routes/projectPhase.routes', '/api/project-phases');
loadRouter('./routes/projectDocument.routes', '/api/project-documents');

// Module Commerce
loadRouter('./routes/category.routes', '/api/categories');
loadRouter('./routes/product.routes', '/api/products');
loadRouter('./routes/order.routes', '/api/orders');
loadRouter('./routes/orderItem.routes', '/api/order-items');

/* ======================================================
   🔍 Healthcheck + Racine
   ====================================================== */
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));
app.get('/api/metrics', metricsHandler);

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

module.exports = app;
