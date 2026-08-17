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

// Endpoint public (aucune auth) qui crée un compte + une mission par requête
// réussie : surface d'abus plus sensible qu'un writeLimiter classique.
const guestLimiter = buildRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Trop de demandes depuis cette connexion. Reessayez plus tard.',
  limiterName: 'guest_mission_request',
});

// Les interactions avec la carte peuvent produire plusieurs estimations ou
// geocodages avant une seule commande. Elles gardent donc un quota distinct de
// l'endpoint public qui cree reellement le compte et la mission.
const publicQuoteLimiter = buildRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: 'Trop de consultations depuis cette connexion. Reessayez plus tard.',
  limiterName: 'public_mission_quote',
});

module.exports = {
  authLimiter,
  refreshLimiter,
  passwordResetLimiter,
  changePasswordLimiter,
  writeLimiter,
  guestLimiter,
  publicQuoteLimiter,
};
