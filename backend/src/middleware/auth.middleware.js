'use strict';

const jwt = require('jsonwebtoken');
const db = require('../../models');
const logger = require('../utils/logger');

const COOKIE_ACCESS = 'teranga_access';
const COOKIE_CSRF = 'teranga_csrf';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_EXEMPT_PATHS = new Set(['/api/auth/logout', '/api/v1/auth/logout']);

module.exports = async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const headerToken = header.startsWith('Bearer ') ? header.slice(7) : null;
  const cookieToken = req.cookies?.[COOKIE_ACCESS] || null;
  const token = headerToken || cookieToken;

  if (!token) {
    logger.warn(
      {
        hasAuthHeader: Boolean(req.headers?.authorization),
        hasCookie: Boolean(cookieToken),
        path: req.originalUrl,
        method: req.method,
      },
      'auth.token.missing'
    );
    return res.status(401).json({ error: 'Token manquant' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.authTokenPayload = payload;
    req.authToken = token;

    if (payload?.jti) {
      const blocked = await db.TokenBlacklist.findOne({ where: { jti: payload.jti } });
      if (blocked) return res.status(401).json({ error: 'Token revoque' });
    }

    const user = await db.User.findByPk(payload.id);
    if (!user) return res.status(401).json({ error: 'Utilisateur introuvable' });

    req.user = {
      id: user.id,
      role: user.role,
      country: user.country ?? null,
      countryId: user.countryId ?? null,
      regionId: user.regionId ?? null,
    };

    if ((process.env.NODE_ENV || 'development') !== 'production') {
      logger.info(
        {
          userId: user.id,
          role: user.role,
          countryId: user.countryId ?? null,
          regionId: user.regionId ?? null,
          path: req.originalUrl,
          method: req.method,
        },
        'auth.token.validated'
      );
    }

    const usingCookie = Boolean(cookieToken && !headerToken);
    const csrfExempt = CSRF_EXEMPT_PATHS.has(req.originalUrl);
    if (usingCookie && !SAFE_METHODS.has(req.method) && !csrfExempt) {
      const csrfHeader = req.headers['x-csrf-token'];
      const csrfCookie = req.cookies?.[COOKIE_CSRF];
      if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
        return res.status(403).json({ error: 'CSRF token invalide' });
      }
    }

    next();
  } catch (err) {
    logger.warn(
      {
        name: err.name,
        message: err.message,
        path: req.originalUrl,
        method: req.method,
        hasSecret: Boolean(process.env.JWT_SECRET),
        tokenPrefix: typeof token === 'string' ? token.slice(0, 12) : null,
      },
      'auth.token.invalid_or_expired'
    );
    return res.status(401).json({ error: 'Token invalide ou expire' });
  }
};
