'use strict';

const logger = require('../utils/logger');

const MAX_RECENT_ERRORS = 20;
const MAX_SLOW_REQUESTS = 20;

const metricsStore = {
  totals: {
    requests: 0,
    errors: 0,
  },
  byStatus: {},
  byMethod: {},
  byRoute: {},
  durationsMs: {
    count: 0,
    total: 0,
    max: 0,
  },
  recentErrors: [],
  slowRequests: [],
  startedAt: new Date().toISOString(),
};

function toStatusBucket(statusCode) {
  if (!statusCode) return 'unknown';
  const bucket = Math.floor(statusCode / 100);
  return `${bucket}xx`;
}

function recordDuration(durationMs) {
  if (!Number.isFinite(durationMs)) return;
  metricsStore.durationsMs.count += 1;
  metricsStore.durationsMs.total += durationMs;
  if (durationMs > metricsStore.durationsMs.max) {
    metricsStore.durationsMs.max = durationMs;
  }
}

function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    metricsStore.totals.requests += 1;

    const statusCode = res.statusCode;
    if (statusCode >= 500) {
      metricsStore.totals.errors += 1;
    }

    const statusBucket = toStatusBucket(statusCode);
    metricsStore.byStatus[statusBucket] =
      (metricsStore.byStatus[statusBucket] || 0) + 1;

    const method = (req.method || 'UNKNOWN').toUpperCase();
    metricsStore.byMethod[method] = (metricsStore.byMethod[method] || 0) + 1;

    const baseUrl = req.baseUrl || '';
    const routePath = req.route?.path;
    const resolvedPath = routePath ? `${baseUrl}${routePath}` : req.originalUrl;
    metricsStore.byRoute[resolvedPath] =
      (metricsStore.byRoute[resolvedPath] || 0) + 1;

    recordDuration(Number(durationMs.toFixed(2)));

    if (statusCode >= 500) {
      const errorEntry = {
        requestId: req.requestId,
        method,
        path: resolvedPath,
        statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        timestamp: new Date().toISOString(),
      };
      metricsStore.recentErrors.unshift(errorEntry);
      metricsStore.recentErrors = metricsStore.recentErrors.slice(
        0,
        MAX_RECENT_ERRORS
      );
    }

    const slowThreshold = Number(process.env.SLOW_REQUEST_THRESHOLD_MS || 1500);
    if (slowThreshold > 0 && durationMs >= slowThreshold) {
      const slowEntry = {
        requestId: req.requestId,
        method,
        path: resolvedPath,
        statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        thresholdMs: slowThreshold,
        timestamp: new Date().toISOString(),
      };
      metricsStore.slowRequests.unshift(slowEntry);
      metricsStore.slowRequests = metricsStore.slowRequests.slice(
        0,
        MAX_SLOW_REQUESTS
      );
      logger.warn(
        slowEntry,
        '🐢 Requête lente détectée'
      );
    }
  });

  next();
}

function metricsHandler(req, res) {
  const token = process.env.METRICS_TOKEN;
  if (token) {
    const headerToken = req.headers['x-metrics-token'];
    if (!headerToken || headerToken !== token) {
      return res.status(403).json({ error: 'Accès interdit' });
    }
  }

  const avgDuration =
    metricsStore.durationsMs.count > 0
      ? metricsStore.durationsMs.total / metricsStore.durationsMs.count
      : 0;

  return res.json({
    ...metricsStore,
    durationsMs: {
      ...metricsStore.durationsMs,
      avg: Number(avgDuration.toFixed(2)),
    },
  });
}

module.exports = {
  metricsMiddleware,
  metricsHandler,
};
