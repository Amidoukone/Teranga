'use strict';

const rateLimit = require('express-rate-limit');

function buildRateLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
  });
}

const authLimiter = buildRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Trop de tentatives, réessayez plus tard.',
});

const refreshLimiter = buildRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Trop de tentatives de rafraîchissement.',
});

const writeLimiter = buildRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: 'Trop de requêtes, merci de ralentir.',
});

module.exports = {
  authLimiter,
  refreshLimiter,
  writeLimiter,
};
