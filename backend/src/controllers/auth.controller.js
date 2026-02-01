// backend/src/controllers/auth.controller.js
'use strict';

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { User, Country, Region, RefreshToken, TokenBlacklist, Sequelize } = require('../../models');

// Durée de vie du token d'accès (configurable via env)
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '1h';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '30d';

const COOKIE_ACCESS = 'teranga_access';
const COOKIE_REFRESH = 'teranga_refresh';
const COOKIE_CSRF = 'teranga_csrf';

/* ======================================================
   🔧 Helpers
====================================================== */

/**
 * Normalise un email pour éviter les doublons "fantômes"
 * (espaces, majuscules, etc.)
 */
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Signature du JWT d'accès.
 * Lève une erreur claire si JWT_SECRET est mal configuré.
 */
function signAccess(payload) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET manquant dans la configuration serveur');
  }
  const jti =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : crypto.randomBytes(16).toString('hex');
  return jwt.sign({ ...payload, jti }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_EXPIRES,
  });
}

function toSafeInt(value) {
  if (value === null || value === undefined) return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDurationToMs(value) {
  if (typeof value === 'number') return value;
  const raw = String(value || '').trim();
  if (!raw) return 0;
  const match = raw.match(/^(\d+)([smhd])$/);
  if (!match) return 0;
  const amount = Number.parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return amount * (multipliers[unit] || 0);
}

function buildCookieOptions({ maxAge, httpOnly = true } = {}) {
  const isProd = (process.env.NODE_ENV || 'development') === 'production';
  return {
    httpOnly,
    secure: isProd,
    sameSite: 'lax',
    maxAge,
  };
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function issueRefreshToken(user, req) {
  const rawToken = crypto.randomBytes(64).toString('hex');
  const tokenHash = hashToken(rawToken);
  const maxAge = parseDurationToMs(REFRESH_EXPIRES) || 30 * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + maxAge);

  const refreshRecord = await RefreshToken.create({
    userId: user.id,
    tokenHash,
    expiresAt,
    createdByIp: req.ip,
    userAgent: req.get('user-agent') || null,
  });

  return { rawToken, refreshRecord, maxAge, expiresAt };
}

function issueCsrfToken() {
  return crypto.randomBytes(24).toString('hex');
}

function setAuthCookies(res, { accessToken, accessMaxAge, refreshToken, refreshMaxAge, csrfToken }) {
  if (accessToken) {
    res.cookie(COOKIE_ACCESS, accessToken, buildCookieOptions({ maxAge: accessMaxAge }));
  }
  if (refreshToken) {
    res.cookie(
      COOKIE_REFRESH,
      refreshToken,
      {
        ...buildCookieOptions({ maxAge: refreshMaxAge }),
        path: '/api',
      }
    );
  }
  if (csrfToken) {
    res.cookie(COOKIE_CSRF, csrfToken, buildCookieOptions({ maxAge: refreshMaxAge, httpOnly: false }));
  }
}

function clearAuthCookies(res) {
  res.clearCookie(COOKIE_ACCESS);
  res.clearCookie(COOKIE_REFRESH, { path: '/api' });
  res.clearCookie(COOKIE_CSRF);
}

async function resolveGeoScope({ country, countryId, regionId }) {
  const resolved = {
    countryId: toSafeInt(countryId),
    regionId: toSafeInt(regionId),
    countryIso: null,
  };

  let resolvedRegion = null;
  if (resolved.regionId) {
    resolvedRegion = await Region.findByPk(resolved.regionId, {
      attributes: ['id', 'countryId'],
    });
    if (!resolvedRegion) {
      return { error: 'Région inconnue' };
    }
    if (resolved.countryId && resolvedRegion.countryId !== resolved.countryId) {
      return { error: 'Région non rattachée au pays sélectionné' };
    }
    if (!resolved.countryId) {
      resolved.countryId = resolvedRegion.countryId;
    }
  }

  const trimmedCountry = String(country || '').trim();
  if (!resolved.countryId && trimmedCountry) {
    const isoCandidate = trimmedCountry.toUpperCase();
    let countryRecord = null;
    if (/^[A-Z]{2}$/.test(isoCandidate)) {
      countryRecord = await Country.findOne({
        where: { isoCode: isoCandidate, isActive: true },
        attributes: ['id', 'isoCode'],
      });
    }

    if (!countryRecord) {
      const lowerName = trimmedCountry.toLowerCase();
      countryRecord = await Country.findOne({
        where: Sequelize.where(
          Sequelize.fn('lower', Sequelize.col('name')),
          lowerName
        ),
        attributes: ['id', 'isoCode', 'isActive'],
      });
      if (countryRecord && !countryRecord.isActive) {
        countryRecord = null;
      }
    }

    if (!countryRecord) {
      return { error: 'Pays invalide ou non supporté' };
    }

    resolved.countryId = countryRecord.id;
    resolved.countryIso = countryRecord.isoCode || isoCandidate;
  }

  if (resolved.countryId && !resolved.countryIso) {
    const record = await Country.findByPk(resolved.countryId, {
      attributes: ['id', 'isoCode', 'isActive'],
    });
    if (!record || record.isActive === false) {
      return { error: 'Pays invalide ou non supporté' };
    }
    resolved.countryIso = record.isoCode;
  }

  return resolved;
}

/* ======================================================
   🧩 Register (inscription)
====================================================== */
exports.register = async (req, res) => {
  try {
    const rawEmail = req.body?.email;
    const rawPassword = req.body?.password;

    const email = normalizeEmail(rawEmail);
    const password = typeof rawPassword === 'string' ? rawPassword.trim() : '';

    const { firstName, lastName, phone, country, countryId, regionId } = req.body || {};

    // Champs requis
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    // (Optionnel) petite règle de complexité minimale
    if (password.length < 8) {
      return res.status(400).json({ error: 'Mot de passe trop court (minimum 8 caractères)' });
    }

    // Vérifie si l'email existe déjà
    const exists = await User.findOne({ where: { email } });
    if (exists) {
      return res.status(400).json({ error: 'Email déjà utilisé' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const geoScope = await resolveGeoScope({ country, countryId, regionId });
    if (geoScope?.error) {
      return res.status(400).json({ error: geoScope.error });
    }

    const user = await User.create({
      email,
      passwordHash,
      firstName: firstName || null,
      lastName: lastName || null,
      phone: phone || null,
      country: geoScope?.countryIso || (country ? String(country).trim().toUpperCase() : null),
      countryId: geoScope?.countryId ?? null,
      regionId: geoScope?.regionId ?? null,
      role: 'client', // rôle par défaut cohérent avec ta structure
      // countryId / regionId restent null pour rétro-compatibilité,
      // et peuvent être backfill Mali/Bamako via migrations/seed si tu le fais.
    });

    return res.status(201).json({
      message: 'Utilisateur créé',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        countryId: user.countryId ?? null,
        regionId: user.regionId ?? null,
      },
    });
  } catch (e) {
    // Gestion spécifique des doublons DB (au cas où la contrainte unique remonte ici)
    if (e.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Email déjà utilisé' });
    }

    console.error('❌ Erreur register:', e);
    return res.status(500).json({ error: "Erreur lors de l'inscription" });
  }
};

/* ======================================================
   🔑 Login (connexion)
====================================================== */
exports.login = async (req, res) => {
  try {
    const rawEmail = req.body?.email;
    const rawPassword = req.body?.password;

    const email = normalizeEmail(rawEmail);
    const password = typeof rawPassword === 'string' ? rawPassword.trim() : '';

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const user = await User.findOne({ where: { email } });
    // Message unique pour éviter de "leaker" la présence de l'email
    if (!user) {
      return res.status(400).json({ error: 'Identifiants invalides' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(400).json({ error: 'Identifiants invalides' });
    }

    // Met à jour le lastLogin mais ne bloque pas la connexion si ça échoue
    try {
      await user.update({ lastLogin: new Date() });
    } catch (errUpdate) {
      console.warn('⚠️ Impossible de mettre à jour lastLogin:', errUpdate.message);
    }

    let token;
    try {
      // ✅ Ajout du scope géographique dans le token (utile côté client/front)
      // ⚠️ La source de vérité reste la DB (auth.middleware prod-safe)
      token = signAccess({
        id: user.id,
        role: user.role,
        countryId: user.countryId ?? null,
        regionId: user.regionId ?? null,
      });
    } catch (jwtErr) {
      console.error('❌ Erreur signature JWT:', jwtErr.message);
      return res.status(500).json({ error: 'Configuration serveur invalide (JWT)' });
    }

    const { rawToken, maxAge: refreshMaxAge } = await issueRefreshToken(user, req);
    const accessMaxAge =
      parseDurationToMs(ACCESS_EXPIRES) || 60 * 60 * 1000;
    const csrfToken = issueCsrfToken();

    setAuthCookies(res, {
      accessToken: token,
      accessMaxAge,
      refreshToken: rawToken,
      refreshMaxAge,
      csrfToken,
    });

    return res.json({
      message: 'Connexion réussie',
      token,
      csrfToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        countryId: user.countryId ?? null,
        regionId: user.regionId ?? null,
      },
    });
  } catch (e) {
    console.error('❌ Erreur login:', e);
    return res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
};

/* ======================================================
   👤 /auth/me — Profil utilisateur courant
====================================================== */
exports.me = async (req, res) => {
  try {
    // req.user est posé par ton auth.middleware (JWT)
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const user = await User.findByPk(userId, {
      attributes: [
        'id',
        'email',
        'firstName',
        'lastName',
        'role',
        'countryId',
        'regionId',
        'lastLogin',
        'createdAt',
      ],
    });

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    return res.json({ user });
  } catch (e) {
    console.error('❌ Erreur /auth/me:', e);
    return res.status(500).json({ error: 'Erreur' });
  }
};

/* ======================================================
   🔄 Refresh token (rotation + blacklist safe)
====================================================== */
exports.refresh = async (req, res) => {
  try {
    const cookieRefresh = req.cookies?.[COOKIE_REFRESH];
    const rawRefresh = cookieRefresh || req.body?.refreshToken || null;
    if (!rawRefresh) {
      return res.status(401).json({ error: 'Refresh token manquant' });
    }

    if (cookieRefresh) {
      const csrfHeader = req.headers['x-csrf-token'];
      const csrfCookie = req.cookies?.[COOKIE_CSRF];
      if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
        return res.status(403).json({ error: 'CSRF token invalide' });
      }
    }

    const tokenHash = hashToken(rawRefresh);
    const stored = await RefreshToken.findOne({
      where: { tokenHash },
    });

    if (!stored || stored.revokedAt) {
      return res.status(401).json({ error: 'Refresh token invalide' });
    }

    if (stored.expiresAt && new Date(stored.expiresAt) < new Date()) {
      return res.status(401).json({ error: 'Refresh token expiré' });
    }

    const user = await User.findByPk(stored.userId);
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur introuvable' });
    }

    const newAccessToken = signAccess({
      id: user.id,
      role: user.role,
      countryId: user.countryId ?? null,
      regionId: user.regionId ?? null,
    });

    const { rawToken, refreshRecord, maxAge: refreshMaxAge } =
      await issueRefreshToken(user, req);

    await stored.update({
      revokedAt: new Date(),
      revokedByIp: req.ip,
      replacedByTokenId: refreshRecord.id,
    });

    const accessMaxAge =
      parseDurationToMs(ACCESS_EXPIRES) || 60 * 60 * 1000;
    const csrfToken = issueCsrfToken();

    setAuthCookies(res, {
      accessToken: newAccessToken,
      accessMaxAge,
      refreshToken: rawToken,
      refreshMaxAge,
      csrfToken,
    });

    return res.json({
      message: 'Token rafraîchi',
      token: newAccessToken,
      csrfToken,
    });
  } catch (e) {
    console.error('❌ Erreur refresh:', e);
    return res.status(500).json({ error: 'Erreur lors du refresh' });
  }
};

/* ======================================================
   🚪 Logout (révocation + blacklist)
====================================================== */
exports.logout = async (req, res) => {
  try {
    const rawRefresh = req.cookies?.[COOKIE_REFRESH] || null;
    if (rawRefresh) {
      const tokenHash = hashToken(rawRefresh);
      const stored = await RefreshToken.findOne({ where: { tokenHash } });
      if (stored && !stored.revokedAt) {
        await stored.update({
          revokedAt: new Date(),
          revokedByIp: req.ip,
        });
      }
    }

    const accessToken =
      req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : req.cookies?.[COOKIE_ACCESS];

    if (accessToken) {
      try {
        const payload = jwt.verify(accessToken, process.env.JWT_SECRET);
        if (payload?.jti && payload?.exp) {
          const expiresAt = new Date(payload.exp * 1000);
          await TokenBlacklist.findOrCreate({
            where: { jti: payload.jti },
            defaults: { expiresAt },
          });
        }
      } catch (err) {
        // ignore invalid token
      }
    }

    clearAuthCookies(res);
    return res.json({ message: 'Déconnexion réussie' });
  } catch (e) {
    console.error('❌ Erreur logout:', e);
    return res.status(500).json({ error: 'Erreur lors de la déconnexion' });
  }
};
