'use strict';

const logger = require('../utils/logger');

const MAX_RECENT_ERRORS = 20;
const MAX_SLOW_REQUESTS = 20;
const MAX_FRONTEND_ERRORS = 50;
const LATENCY_BUCKETS_MS = [100, 300, 500, 800, 1200, 2000];
const OTHER_ROUTE_KEY = '__other__';
const MAX_ROUTE_KEYS = (() => {
  const parsed = Number.parseInt(process.env.METRICS_MAX_ROUTE_KEYS || '500', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 500;
})();

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
  appDurationsMs: {
    count: 0,
    total: 0,
    max: 0,
  },
  dbDurationsMs: {
    count: 0,
    total: 0,
    max: 0,
  },
  dbQueries: {
    requests: 0,
    total: 0,
    max: 0,
  },
  latencyBuckets: {
    'lte_100': 0,
    'lte_300': 0,
    'lte_500': 0,
    'lte_800': 0,
    'lte_1200': 0,
    'lte_2000': 0,
    gt_2000: 0,
  },
  recentErrors: [],
  slowRequests: [],
  routePerf: {},
  frontendErrors: {
    total: 0,
    recent: [],
  },
  startedAt: new Date().toISOString(),
};

function toStatusBucket(statusCode) {
  if (!statusCode) return 'unknown';
  const bucket = Math.floor(statusCode / 100);
  return `${bucket}xx`;
}

function stripQueryAndHash(pathValue) {
  const raw = String(pathValue || '').trim();
  if (!raw) return '/';
  return raw.split('#')[0].split('?')[0] || '/';
}

function normalizeRoutePath(pathValue) {
  const path = stripQueryAndHash(pathValue);
  const withLeadingSlash = path.startsWith('/') ? path : `/${path}`;
  const segments = withLeadingSlash
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      if (/^\d+$/.test(segment)) return ':id';
      if (/^[0-9a-f]{24}$/i.test(segment)) return ':id';
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          segment
        )
      ) {
        return ':id';
      }
      if (/^[A-Za-z0-9_-]{20,}$/.test(segment)) return ':token';
      return segment;
    });

  return segments.length ? `/${segments.join('/')}` : '/';
}

function resolveRouteKey(req) {
  const baseUrl = String(req.baseUrl || '');
  const routePath = req.route?.path;
  if (routePath) return normalizeRoutePath(`${baseUrl}${String(routePath)}`);
  return normalizeRoutePath(req.path || req.originalUrl || '/');
}

function incrementRouteCounter(routeKey) {
  const key = String(routeKey || '/');
  if (Object.prototype.hasOwnProperty.call(metricsStore.byRoute, key)) {
    metricsStore.byRoute[key] += 1;
    return key;
  }

  const routeCount = Object.keys(metricsStore.byRoute).length;
  if (routeCount >= MAX_ROUTE_KEYS) {
    metricsStore.byRoute[OTHER_ROUTE_KEY] =
      (metricsStore.byRoute[OTHER_ROUTE_KEY] || 0) + 1;
    return OTHER_ROUTE_KEY;
  }

  metricsStore.byRoute[key] = 1;
  return key;
}

function recordDuration(durationMs) {
  if (!Number.isFinite(durationMs)) return;
  metricsStore.durationsMs.count += 1;
  metricsStore.durationsMs.total += durationMs;
  if (durationMs > metricsStore.durationsMs.max) {
    metricsStore.durationsMs.max = durationMs;
  }
}

function recordNamedDuration(bucket, durationMs) {
  if (!bucket || !Number.isFinite(durationMs)) return;
  bucket.count += 1;
  bucket.total += durationMs;
  if (durationMs > bucket.max) {
    bucket.max = durationMs;
  }
}

function recordDbQueryCount(count) {
  const normalized = Number.isFinite(count) && count >= 0 ? count : 0;
  metricsStore.dbQueries.requests += 1;
  metricsStore.dbQueries.total += normalized;
  if (normalized > metricsStore.dbQueries.max) {
    metricsStore.dbQueries.max = normalized;
  }
}

function recordRoutePerf(routeKey, perf) {
  const key = String(routeKey || '/');
  const durationMs = Number.isFinite(perf?.durationMs) ? perf.durationMs : 0;
  const appDurationMs = Number.isFinite(perf?.appDurationMs) ? perf.appDurationMs : 0;
  const dbDurationMs = Number.isFinite(perf?.dbDurationMs) ? perf.dbDurationMs : 0;
  const dbQueryCount = Number.isFinite(perf?.dbQueryCount) ? perf.dbQueryCount : 0;

  const current =
    metricsStore.routePerf[key] ||
    {
      count: 0,
      totalMs: 0,
      maxMs: 0,
      appTotalMs: 0,
      appMaxMs: 0,
      dbTotalMs: 0,
      dbMaxMs: 0,
      dbQueryCountTotal: 0,
      dbQueryCountMax: 0,
    };

  current.count += 1;
  current.totalMs += durationMs;
  current.appTotalMs += appDurationMs;
  current.dbTotalMs += dbDurationMs;
  current.dbQueryCountTotal += dbQueryCount;

  if (durationMs > current.maxMs) current.maxMs = durationMs;
  if (appDurationMs > current.appMaxMs) current.appMaxMs = appDurationMs;
  if (dbDurationMs > current.dbMaxMs) current.dbMaxMs = dbDurationMs;
  if (dbQueryCount > current.dbQueryCountMax) {
    current.dbQueryCountMax = dbQueryCount;
  }

  metricsStore.routePerf[key] = current;
}

function recordLatencyBucket(durationMs) {
  if (!Number.isFinite(durationMs)) return;

  let bucketMatched = false;
  for (const bucket of LATENCY_BUCKETS_MS) {
    if (durationMs <= bucket) {
      metricsStore.latencyBuckets[`lte_${bucket}`] += 1;
      bucketMatched = true;
      break;
    }
  }

  if (!bucketMatched) {
    metricsStore.latencyBuckets.gt_2000 += 1;
  }
}

function toSloSummary() {
  const targetLatencyMs = Number(process.env.SLO_TARGET_LATENCY_MS || 800);
  const targetCompliancePct = Number(process.env.SLO_TARGET_COMPLIANCE_PCT || 95);
  const slowThreshold = Number(process.env.SLOW_REQUEST_THRESHOLD_MS || 1500);

  const totalRequests = metricsStore.durationsMs.count;
  if (totalRequests <= 0) {
    return {
      latency: {
        targetMs: targetLatencyMs,
        targetCompliancePct,
        currentCompliancePct: 100,
        isMet: true,
      },
      slowRequests: {
        thresholdMs: slowThreshold,
        count: 0,
      },
    };
  }

  let compliantCount = 0;
  for (const bucket of LATENCY_BUCKETS_MS) {
    if (bucket <= targetLatencyMs) {
      compliantCount += metricsStore.latencyBuckets[`lte_${bucket}`] || 0;
    }
  }

  const currentCompliancePct = Number(
    ((compliantCount / totalRequests) * 100).toFixed(2)
  );

  return {
    latency: {
      targetMs: targetLatencyMs,
      targetCompliancePct,
      currentCompliancePct,
      isMet: currentCompliancePct >= targetCompliancePct,
    },
    slowRequests: {
      thresholdMs: slowThreshold,
      count: metricsStore.slowRequests.length,
    },
  };
}

function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const dbDurationMs = Number(req.requestPerf?.dbDurationMs || 0);
    const dbQueryCount = Number(req.requestPerf?.dbQueryCount || 0);
    const maxDbQueryMs = Number(req.requestPerf?.maxDbQueryMs || 0);
    const appDurationMs = Math.max(0, durationMs - dbDurationMs);
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

    const resolvedPath = resolveRouteKey(req);
    const routeMetricKey = incrementRouteCounter(resolvedPath);

    recordDuration(Number(durationMs.toFixed(2)));
    recordNamedDuration(
      metricsStore.appDurationsMs,
      Number(appDurationMs.toFixed(2))
    );
    recordNamedDuration(
      metricsStore.dbDurationsMs,
      Number(dbDurationMs.toFixed(2))
    );
    recordDbQueryCount(dbQueryCount);
    recordLatencyBucket(durationMs);
    recordRoutePerf(routeMetricKey, {
      durationMs: Number(durationMs.toFixed(2)),
      appDurationMs: Number(appDurationMs.toFixed(2)),
      dbDurationMs: Number(dbDurationMs.toFixed(2)),
      dbQueryCount,
    });

    if (statusCode >= 500) {
      const errorEntry = {
        requestId: req.requestId,
        method,
        path: routeMetricKey,
        statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        appDurationMs: Number(appDurationMs.toFixed(2)),
        dbDurationMs: Number(dbDurationMs.toFixed(2)),
        dbQueryCount,
        maxDbQueryMs: Number(maxDbQueryMs.toFixed(2)),
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
        path: routeMetricKey,
        statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        appDurationMs: Number(appDurationMs.toFixed(2)),
        dbDurationMs: Number(dbDurationMs.toFixed(2)),
        dbQueryCount,
        maxDbQueryMs: Number(maxDbQueryMs.toFixed(2)),
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
        'metrics.request.slow'
      );
    }
  });

  next();
}

function frontendErrorHandler(req, res) {
  const observabilityToken = (process.env.FRONTEND_ERROR_TOKEN || '').trim();

  if (observabilityToken) {
    const headerToken = req.headers['x-observability-token'];
    if (!headerToken || headerToken !== observabilityToken) {
      return res.status(403).json({ error: 'Accès interdit' });
    }
  }

  const body = req.body || {};
  const message = String(body.message || '').trim();
  if (!message) {
    return res.status(400).json({ error: 'message requis' });
  }

  const entry = {
    requestId: req.requestId,
    message,
    stack: String(body.stack || '').slice(0, 4000),
    name: String(body.name || '').slice(0, 120),
    componentStack: String(body.componentStack || '').slice(0, 4000),
    path: String(body.path || '').slice(0, 512),
    userAgent: String(body.userAgent || '').slice(0, 512),
    language: String(body.language || '').slice(0, 64),
    release: String(body.release || '').slice(0, 120),
    timestamp: new Date().toISOString(),
  };

  metricsStore.frontendErrors.total += 1;
  metricsStore.frontendErrors.recent.unshift(entry);
  metricsStore.frontendErrors.recent = metricsStore.frontendErrors.recent.slice(
    0,
    MAX_FRONTEND_ERRORS
  );

  logger.error({ frontendError: entry }, 'frontend.error.captured');

  return res.status(202).json({ accepted: true });
}

function toAveragedSummary(bucket) {
  const count = Number(bucket?.count || 0);
  const total = Number(bucket?.total || 0);
  const max = Number(bucket?.max || 0);

  return {
    ...(bucket || {}),
    avg: count > 0 ? Number((total / count).toFixed(2)) : 0,
    max: Number(max.toFixed(2)),
  };
}

function toDbQueriesSummary(bucket) {
  const requests = Number(bucket?.requests || 0);
  const total = Number(bucket?.total || 0);
  const max = Number(bucket?.max || 0);

  return {
    ...(bucket || {}),
    avgPerRequest: requests > 0 ? Number((total / requests).toFixed(2)) : 0,
    maxPerRequest: Number(max.toFixed(2)),
  };
}

function toTopSlowRoutes(limit = 10) {
  return Object.entries(metricsStore.routePerf || {})
    .map(([path, entry]) => {
      const count = Number(entry?.count || 0);
      const totalMs = Number(entry?.totalMs || 0);
      const appTotalMs = Number(entry?.appTotalMs || 0);
      const dbTotalMs = Number(entry?.dbTotalMs || 0);
      const dbQueryCountTotal = Number(entry?.dbQueryCountTotal || 0);

      return {
        path,
        count,
        avgDurationMs: count > 0 ? Number((totalMs / count).toFixed(2)) : 0,
        maxDurationMs: Number((entry?.maxMs || 0).toFixed(2)),
        avgAppDurationMs: count > 0 ? Number((appTotalMs / count).toFixed(2)) : 0,
        avgDbDurationMs: count > 0 ? Number((dbTotalMs / count).toFixed(2)) : 0,
        maxDbDurationMs: Number((entry?.dbMaxMs || 0).toFixed(2)),
        avgDbQueryCount: count > 0
          ? Number((dbQueryCountTotal / count).toFixed(2))
          : 0,
        maxDbQueryCount: Number(entry?.dbQueryCountMax || 0),
      };
    })
    .sort((a, b) => {
      if (b.avgDurationMs !== a.avgDurationMs) {
        return b.avgDurationMs - a.avgDurationMs;
      }
      return b.count - a.count;
    })
    .slice(0, limit);
}

function metricsHandler(req, res) {
  const token = process.env.METRICS_TOKEN;
  const isProd = (process.env.NODE_ENV || 'development') === 'production';
  const isAdminRequest = req.user?.role === 'admin';

  if (!isAdminRequest && isProd && !token) {
    return res
      .status(503)
      .json({ error: 'METRICS_TOKEN requis en production' });
  }
  if (!isAdminRequest && token) {
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
    slo: toSloSummary(),
    durationsMs: {
      ...metricsStore.durationsMs,
      avg: Number(avgDuration.toFixed(2)),
    },
    appDurationsMs: toAveragedSummary(metricsStore.appDurationsMs),
    dbDurationsMs: toAveragedSummary(metricsStore.dbDurationsMs),
    dbQueries: toDbQueriesSummary(metricsStore.dbQueries),
    topSlowRoutes: toTopSlowRoutes(),
  });
}

module.exports = {
  metricsMiddleware,
  metricsHandler,
  frontendErrorHandler,
};


