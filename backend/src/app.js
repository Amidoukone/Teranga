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
  frontendErrorHandler,
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
const isDev = (process.env.NODE_ENV || 'development') !== 'production';
const defaultProdOrigins = [
  'https://teranga-diaspora.com',
  'https://www.teranga-diaspora.com',
];
let allowedOrigins = Array.from(
  new Set([...configuredOrigins, ...fallbackOrigins])
);
if (!isDev && allowedOrigins.length === 0) {
  allowedOrigins = defaultProdOrigins.map((o) => normalizeOrigin(o));
}
const allowAllOrigins =
  allowedOrigins.includes('*') || (isDev && allowedOrigins.length === 0);

if (!isDev && allowedOrigins.length === 0) {
  logger.warn('app.cors.origins.missing_configuration');
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowAllOrigins) return callback(null, true);
      const normalizedOrigin = normalizeOrigin(origin);
      if (allowedOrigins.includes(normalizedOrigin)) return callback(null, true);
      logger.warn({ origin }, 'app.cors.origin.rejected');
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
      'X-Metrics-Token',
      'X-Observability-Token',
      'X-Request-Id',
    ],
    exposedHeaders: ['X-Request-Id'],
    optionsSuccessStatus: 200,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/* ======================================================
   📂 Fichiers uploadés (uploads/)
   ====================================================== */
const uploadsRoot = path.join(__dirname, '..', 'uploads');
const openapiContractPath = path.join(__dirname, '..', 'openapi', 'openapi.json');

if (!fs.existsSync(uploadsRoot)) {
  fs.mkdirSync(uploadsRoot, { recursive: true });
  logger.info({ uploadsRoot }, 'app.uploads.directory.created');
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
logger.info('app.uploads.static_serving.enabled');

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

function loadRouter(routeFsPath, mountPath, target = app) {
  try {
    const mod = require(routeFsPath);
    const router = pickExpressRouter(mod);

    if (!router) {
      const keys =
        mod && typeof mod === 'object' ? Object.keys(mod) : '(aucune clé)';
      logger.error({ mountPath, routeFsPath, keys }, 'app.router.invalid');
      return;
    }

    target.use(mountPath, router);
    logger.info({ mountPath }, 'app.router.loaded');
  } catch (err) {
    logger.error({ err, routeFsPath, mountPath }, 'app.router.load.failed');
  }
}

/* ======================================================
   🚀 Chargement des routes API
   ====================================================== */
const apiRouter = express.Router();

loadRouter('./routes/auth.routes', '/auth', apiRouter);
loadRouter('./routes/property.routes', '/properties', apiRouter);
loadRouter('./routes/user.routes', '/users', apiRouter);
loadRouter('./routes/service.routes', '/services', apiRouter);
loadRouter('./routes/task.routes', '/tasks', apiRouter);
loadRouter('./routes/evidence.routes', '/evidences', apiRouter);
loadRouter('./routes/transaction.routes', '/transactions', apiRouter);
loadRouter('./routes/notification.routes', '/notifications', apiRouter);
loadRouter('./routes/activity.routes', '/activities', apiRouter);
loadRouter('./routes/dashboard.routes', '/dashboard', apiRouter);

// ✅ Multi-pays / franchise
loadRouter('./routes/country.routes', '/countries', apiRouter);
loadRouter('./routes/region.routes', '/regions', apiRouter);
loadRouter('./routes/franchise.routes', '/franchises', apiRouter);

// Module Projets
loadRouter('./routes/project.routes', '/projects', apiRouter);
loadRouter('./routes/projectPhase.routes', '/project-phases', apiRouter);
loadRouter('./routes/projectDocument.routes', '/project-documents', apiRouter);

// Module Commerce
loadRouter('./routes/category.routes', '/categories', apiRouter);
loadRouter('./routes/product.routes', '/products', apiRouter);
loadRouter('./routes/order.routes', '/orders', apiRouter);
loadRouter('./routes/orderItem.routes', '/order-items', apiRouter);

app.use('/api', apiRouter);
app.use('/api/v1', apiRouter);

/* ======================================================
   🔍 Healthcheck + Racine
   ====================================================== */
apiRouter.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));
apiRouter.get('/metrics', metricsHandler);
apiRouter.post('/observability/frontend-errors', frontendErrorHandler);
apiRouter.get('/openapi.json', (_req, res) => {
  if (!fs.existsSync(openapiContractPath)) {
    return res.status(404).json({ error: 'OpenAPI contract introuvable' });
  }
  return res.sendFile(openapiContractPath);
});

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
  logger.error({ err, requestId: req.requestId }, 'app.request.unhandled_error');
  if (res.headersSent) return;
  if (err?.name === 'MulterError') {
    let message = 'Erreur upload fichier';
    let status = 400;

    if (err.code === 'LIMIT_FILE_SIZE') {
      status = 413;
      message = 'Fichier trop volumineux';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Trop de fichiers envoyés';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Champ de fichier inattendu';
    }

    return res.status(status).json({ error: message, requestId: req.requestId });
  }

  if (typeof err?.message === 'string' && err.message.includes('Type de fichier non support')) {
    return res.status(400).json({ error: err.message, requestId: req.requestId });
  }

  res.status(500).json({ error: 'Erreur interne du serveur', requestId: req.requestId });
});

module.exports = app;


