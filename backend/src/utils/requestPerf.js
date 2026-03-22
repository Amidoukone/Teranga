'use strict';

const { AsyncLocalStorage } = require('async_hooks');

const perfStorage = new AsyncLocalStorage();
const MAX_SLOW_QUERIES = 5;
const SLOW_SQL_THRESHOLD_MS = (() => {
  const parsed = Number.parseInt(process.env.SLOW_SQL_QUERY_THRESHOLD_MS || '300', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 300;
})();

function toRoundedMs(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Number(numeric.toFixed(2));
}

function summarizeSql(sql) {
  const raw = String(sql || '')
    .replace(/^Executing\s+\([^)]+\):\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!raw) return '';
  if (raw.length <= 180) return raw;
  return `${raw.slice(0, 177)}...`;
}

function createRequestPerfStore(seed = {}) {
  return {
    requestId: seed.requestId || null,
    dbQueryCount: 0,
    dbDurationMs: 0,
    maxDbQueryMs: 0,
    slowQueries: [],
  };
}

function runWithRequestPerf(seed, fn) {
  const store = createRequestPerfStore(seed);
  return perfStorage.run(store, () => fn(store));
}

function getRequestPerfStore() {
  return perfStorage.getStore() || null;
}

function recordSqlQuery(sql, durationMs) {
  const store = getRequestPerfStore();
  const roundedMs = toRoundedMs(durationMs);

  if (!store || roundedMs <= 0) return;

  store.dbQueryCount += 1;
  store.dbDurationMs = toRoundedMs(store.dbDurationMs + roundedMs);
  if (roundedMs > store.maxDbQueryMs) {
    store.maxDbQueryMs = roundedMs;
  }

  if (roundedMs >= SLOW_SQL_THRESHOLD_MS) {
    store.slowQueries.unshift({
      durationMs: roundedMs,
      sql: summarizeSql(sql),
    });
    store.slowQueries = store.slowQueries.slice(0, MAX_SLOW_QUERIES);
  }
}

function snapshotRequestPerf(store = getRequestPerfStore()) {
  if (!store) {
    return {
      dbQueryCount: 0,
      dbDurationMs: 0,
      maxDbQueryMs: 0,
      slowQueries: [],
    };
  }

  return {
    dbQueryCount: Number(store.dbQueryCount || 0),
    dbDurationMs: toRoundedMs(store.dbDurationMs),
    maxDbQueryMs: toRoundedMs(store.maxDbQueryMs),
    slowQueries: Array.isArray(store.slowQueries)
      ? store.slowQueries.map((entry) => ({
          durationMs: toRoundedMs(entry?.durationMs),
          sql: String(entry?.sql || ''),
        }))
      : [],
  };
}

module.exports = {
  runWithRequestPerf,
  recordSqlQuery,
  snapshotRequestPerf,
  summarizeSql,
};
