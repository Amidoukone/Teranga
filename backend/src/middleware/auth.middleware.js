// backend/src/middleware/auth.middleware.js
'use strict';

const jwt = require('jsonwebtoken');
const db = require('../../models');

module.exports = async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  try {
    // 1️⃣ Vérification du token (authentification)
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // 2️⃣ Chargement de l'utilisateur depuis la DB (source de vérité)
    const user = await db.User.findByPk(payload.id);

    if (!user) {
      return res.status(401).json({ error: 'Utilisateur introuvable' });
    }

    // 3️⃣ Injection dans req.user (rétro-compatible + enrichi)
    req.user = {
      id: user.id,
      role: user.role,
      countryId: user.countryId ?? null,
      regionId: user.regionId ?? null,
    };

    next();
  } catch (err) {
    console.warn('🔒 JWT invalide ou expiré:', err.message);
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
};
