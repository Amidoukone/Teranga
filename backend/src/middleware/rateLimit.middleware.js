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
  message: 'Trop de tentatives, rÃ©essayez plus tard.',
});

const refreshLimiter = buildRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Trop de tentatives de rafraÃ®chissement.',
});

const passwordResetLimiter = buildRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Trop de tentatives de rÃ©initialisation. RÃ©essayez plus tard.',
});

const writeLimiter = buildRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: 'Trop de requÃªtes, merci de ralentir.',
});

module.exports = {
  authLimiter,
  refreshLimiter,
  passwordResetLimiter,
  writeLimiter,
};
