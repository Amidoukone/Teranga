'use strict';

const jwt = require('jsonwebtoken');
const db = require('../../models');
const logger = require('../utils/logger');
const {
  getCachedAuthUser,
  setCachedAuthUser,
  getCachedTokenStatus,
  cacheAllowedToken,
  cacheRevokedToken,
} = require('../services/authCache.service');

const COOKIE_ACCESS = 'teranga_access';
const COOKIE_CSRF = 'teranga_csrf';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_EXEMPT_PATHS = new Set(['/api/auth/logout', '/api/v1/auth/logout']);
const AUTH_USER_ATTRIBUTES = ['id', 'role', 'country', 'countryId', 'regionId'];
const USER_LOOKUP_OPTIONAL_ROUTES = new Set([
  'GET /api/auth/me',
  'GET /api/v1/auth/me',
  'PATCH /api/auth/me',
  'PATCH /api/v1/auth/me',
  'POST /api/auth/logout',
  'POST /api/v1/auth/logout',
  'POST /api/auth/change-password',
  'POST /api/v1/auth/change-password',
  'POST /api/auth/recovery-codes/regenerate',
  'POST /api/v1/auth/recovery-codes/regenerate',
]);

function toRouteKey(req) {
  const method = String(req.method || 'GET').toUpperCase();
  const path = String(req.originalUrl || req.url || '')
    .split('?')[0]
    .replace(/\/+$/, '') || '/';
  return `${method} ${path}`;
}

function toAuthUserFromPayload(payload = {}) {
  return {
    id: payload.id ?? null,
    role: payload.role ?? null,
    country: payload.country ?? null,
    countryId: payload.countryId ?? null,
    regionId: payload.regionId ?? null,
  };
}

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
      const cachedTokenStatus = getCachedTokenStatus(payload.jti);
      if (cachedTokenStatus === true) {
        return res.status(401).json({ error: 'Token revoque' });
      }
      if (cachedTokenStatus === null) {
        const blocked = await db.TokenBlacklist.findOne({
          where: { jti: payload.jti },
          attributes: ['id', 'expiresAt'],
          raw: true,
        });
        if (blocked) {
          cacheRevokedToken(
            payload.jti,
            blocked.expiresAt || (payload?.exp ? new Date(payload.exp * 1000) : null)
          );
          return res.status(401).json({ error: 'Token revoque' });
        }
        cacheAllowedToken(
          payload.jti,
          payload?.exp ? new Date(payload.exp * 1000) : null
        );
      }
    }

    let user = null;
    const routeKey = toRouteKey(req);
    if (USER_LOOKUP_OPTIONAL_ROUTES.has(routeKey)) {
      user = toAuthUserFromPayload(payload);
    } else {
      user =
        getCachedAuthUser(payload.id) ||
        setCachedAuthUser(
          await db.User.findByPk(payload.id, {
            attributes: AUTH_USER_ATTRIBUTES,
            raw: true,
          })
        );
      if (!user) return res.status(401).json({ error: 'Utilisateur introuvable' });
    }

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
