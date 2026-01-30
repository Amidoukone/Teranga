'use strict';

const jwt = require('jsonwebtoken');
const db = require('../../models');

const COOKIE_ACCESS = 'teranga_access';
const COOKIE_CSRF = 'teranga_csrf';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

module.exports = async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const headerToken = header.startsWith('Bearer ') ? header.slice(7) : null;
  const cookieToken = req.cookies?.[COOKIE_ACCESS] || null;
  const token = headerToken || cookieToken;

  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  try {
    // 1️⃣ Vérification JWT
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (payload?.jti) {
      const blocked = await db.TokenBlacklist.findOne({ where: { jti: payload.jti } });
      if (blocked) {
        return res.status(401).json({ error: 'Token révoqué' });
      }
    }

    // 2️⃣ Source de vérité : DB
    const user = await db.User.findByPk(payload.id);

    if (!user) {
      return res.status(401).json({ error: 'Utilisateur introuvable' });
    }

    // 3️⃣ Injection normalisée (toujours les mêmes clés)
    req.user = {
      id: user.id,
      role: user.role, // 'client' | 'agent' | 'admin'
      countryId: user.countryId ?? null,
      regionId: user.regionId ?? null,
    };

    const usingCookie = Boolean(cookieToken && !headerToken);
    if (usingCookie && !SAFE_METHODS.has(req.method)) {
      const csrfHeader = req.headers['x-csrf-token'];
      const csrfCookie = req.cookies?.[COOKIE_CSRF];
      if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
        return res.status(403).json({ error: 'CSRF token invalide' });
      }
    }

    next();
  } catch (err) {
    console.warn('🔒 JWT invalide ou expiré:', err.message);
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
};
