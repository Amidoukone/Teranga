'use strict';

const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

function buildRateLimiter({ windowMs, max, message, limiterName }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(
        {
          limiter: limiterName,
          method: req.method,
          path: req.originalUrl,
          ip: req.ip,
          max,
          windowMs,
        },
        'rate_limit.request.blocked'
      );
      return res.status(429).json({ error: message });
    },
  });
}

const authLimiter = buildRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Trop de tentatives, reessayez plus tard.',
  limiterName: 'auth',
});

const refreshLimiter = buildRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Trop de tentatives de rafraichissement.',
  limiterName: 'refresh',
});

const passwordResetLimiter = buildRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Trop de tentatives de reinitialisation. Reessayez plus tard.',
  limiterName: 'password_reset',
});

const changePasswordLimiter = buildRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: 'Trop de tentatives de changement de mot de passe. Reessayez plus tard.',
  limiterName: 'change_password',
});

const writeLimiter = buildRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: 'Trop de requetes, merci de ralentir.',
  limiterName: 'write',
});

module.exports = {
  authLimiter,
  refreshLimiter,
  passwordResetLimiter,
  changePasswordLimiter,
  writeLimiter,
};
