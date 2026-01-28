'use strict';

const { randomUUID } = require('crypto');
const logger = require('../utils/logger');

module.exports = function requestContext(req, res, next) {
  const incomingId = req.headers['x-request-id'];
  const requestId = incomingId || randomUUID();
  const start = process.hrtime.bigint();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info(
      {
        requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
      },
      '✅ Requête traitée'
    );
  });

  next();
};
