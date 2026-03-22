'use strict';

const { randomUUID } = require('crypto');
const logger = require('../utils/logger');
const {
  runWithRequestPerf,
  snapshotRequestPerf,
} = require('../utils/requestPerf');

module.exports = function requestContext(req, res, next) {
  const incomingId = req.headers['x-request-id'];
  const requestId = incomingId || randomUUID();
  return runWithRequestPerf({ requestId }, (perfStore) => {
    const start = process.hrtime.bigint();

    req.requestId = requestId;
    req.requestPerf = perfStore;
    res.setHeader('X-Request-Id', requestId);

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      const perf = snapshotRequestPerf(perfStore);
      const appDurationMs = Math.max(0, durationMs - perf.dbDurationMs);

      logger.info(
        {
          requestId,
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: Number(durationMs.toFixed(2)),
          appDurationMs: Number(appDurationMs.toFixed(2)),
          dbDurationMs: perf.dbDurationMs,
          dbQueryCount: perf.dbQueryCount,
          maxDbQueryMs: perf.maxDbQueryMs,
        },
        'http.request.completed'
      );
    });

    next();
  });
};

