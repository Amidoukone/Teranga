// backend/src/controllers/auth.controller.js
'use strict';

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (_err) {
  nodemailer = null;
}
const {
  User,
  Country,
  Region,
  Franchise,
  RecoveryCode,
  RefreshToken,
  TokenBlacklist,
  PasswordResetToken,
  Sequelize,
} = require('../../models');

// Durée de vie du token d'accès (configurable via env)
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '1h';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '30d';
const PASSWORD_RESET_EXPIRES =
  process.env.PASSWORD_RESET_EXPIRES || '30m';
const PASSWORD_RESET_DEBUG =
  String(process.env.PASSWORD_RESET_DEBUG || '').toLowerCase() === 'true';
const RECOVERY_CODES_COUNT = Number.parseInt(
  process.env.RECOVERY_CODES_COUNT || '8',
  10
);
const RECOVERY_CODE_EXPIRES =
  process.env.RECOVERY_CODE_EXPIRES || '365d';

const COOKIE_ACCESS = 'teranga_access';
const COOKIE_REFRESH = 'teranga_refresh';
const COOKIE_CSRF = 'teranga_csrf';
const MANUAL_RESET_MESSAGE =
  "Mot de passe oublie ? Contactez l'admin ou le master de votre pays/region pour reinitialiser. Ensuite, vous pourrez le modifier dans votre compte.";

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

const SUPPORTED_LANGS = new Set(['fr', 'en']);
function normalizeLanguage(input) {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim().toLowerCase();
  if (!raw) return null;
  if (raw.startsWith('fr')) return 'fr';
  if (raw.startsWith('en')) return 'en';
  return null;
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

function normalizeRecoveryCode(input) {
  return String(input || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

function generateRecoveryCodeRaw(length = 10) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    const idx = crypto.randomInt(0, alphabet.length);
    out += alphabet[idx];
  }
  return out;
}

function formatRecoveryCode(raw) {
  const normalized = normalizeRecoveryCode(raw);
  if (normalized.length <= 5) return normalized;
  return `${normalized.slice(0, 5)}-${normalized.slice(5)}`;
}

function generateRecoveryCodes(count = RECOVERY_CODES_COUNT) {
  const finalCount = Number.isFinite(count) && count > 0 ? count : 8;
  const set = new Set();
  while (set.size < finalCount) {
    set.add(formatRecoveryCode(generateRecoveryCodeRaw(10)));
  }
  return Array.from(set);
}

async function rotateRecoveryCodes({
  userId,
  req,
  invalidateExisting = true,
}) {
  if (!userId) return [];

  const now = new Date();
  const expiresMs = parseDurationToMs(RECOVERY_CODE_EXPIRES);
  const expiresAt = expiresMs > 0 ? new Date(Date.now() + expiresMs) : null;

  if (invalidateExisting) {
    await RecoveryCode.update(
      { usedAt: now, usedByIp: req?.ip || null },
      { where: { userId, usedAt: null } }
    );
  }

  const plainCodes = generateRecoveryCodes();
  const rows = plainCodes.map((code) => ({
    userId,
    codeHash: hashToken(normalizeRecoveryCode(code)),
    expiresAt,
    usedAt: null,
    createdByIp: req?.ip || null,
    userAgent: req?.get?.('user-agent') || null,
  }));

  await RecoveryCode.bulkCreate(rows);
  return plainCodes;
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

function resolveFrontendBaseUrl(req) {
  const envBase =
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL ||
    process.env.CLIENT_ORIGIN ||
    '';
  const fromEnv = String(envBase || '').trim().replace(/\/+$/, '');
  if (fromEnv) return fromEnv;

  const originHeader = String(req?.headers?.origin || '').trim().replace(/\/+$/, '');
  if (originHeader) return originHeader;

  return '';
}

function buildResetUrl(req, token) {
  const base = resolveFrontendBaseUrl(req);
  if (!base || !token) return '';
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

async function issuePasswordResetToken(user, req) {
  const rawToken = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashToken(rawToken);
  const maxAge =
    parseDurationToMs(PASSWORD_RESET_EXPIRES) || 30 * 60 * 1000;
  const expiresAt = new Date(Date.now() + maxAge);

  await PasswordResetToken.update(
    { usedAt: new Date(), usedByIp: req.ip },
    { where: { userId: user.id, usedAt: null } }
  );

  const record = await PasswordResetToken.create({
    userId: user.id,
    tokenHash,
    expiresAt,
    createdByIp: req.ip,
    userAgent: req.get('user-agent') || null,
  });

  return { rawToken, record, expiresAt };
}

async function revokeUserRefreshTokens(userId, req) {
  if (!userId) return;
  await RefreshToken.update(
    { revokedAt: new Date(), revokedByIp: req?.ip || null },
    { where: { userId, revokedAt: null } }
  );
}

function shouldExposeResetDebug(req) {
  if (PASSWORD_RESET_DEBUG) return true;
  const isProd = (process.env.NODE_ENV || 'development') === 'production';
  return !isProd && String(req?.query?.debug || '') === 'true';
}

function isSmtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
  );
}

async function sendPasswordResetEmail({ to, resetUrl }) {
  if (!isSmtpConfigured() || !nodemailer) return false;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const from =
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    'no-reply@teranga.local';

  await transporter.sendMail({
    from,
    to,
    subject: 'Reinitialisation du mot de passe Teranga',
    text: `Bonjour,\n\nUtilisez ce lien pour reinitialiser votre mot de passe:\n${resetUrl}\n\nSi vous n'etes pas a l'origine de cette demande, ignorez cet email.\n`,
  });

  return true;
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

async function countryHasActiveMaster(countryId) {
  if (!countryId) return false;
  const franchiseCount = await Franchise.count({
    where: {
      countryId,
      type: 'MASTER',
      status: 'active',
    },
  });
  if (franchiseCount > 0) return true;

  const directScopedAdminCount = await User.count({
    where: {
      role: 'admin',
      countryId,
    },
  });
  if (directScopedAdminCount > 0) return true;

  const regions = await Region.findAll({
    where: { countryId },
    attributes: ['id'],
  });
  if (!regions.length) return false;

  const regionIds = regions
    .map((r) => toSafeInt(r?.id))
    .filter((id) => id !== null);
  if (!regionIds.length) return false;

  const regionalScopedAdminCount = await User.count({
    where: {
      role: 'admin',
      regionId: { [Sequelize.Op.in]: regionIds },
    },
  });
  return regionalScopedAdminCount > 0;
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

    const {
      firstName,
      lastName,
      phone,
      country,
      countryId,
      language: rawLanguage,
    } = req.body || {};
    const language = normalizeLanguage(rawLanguage) || 'fr';

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

    const trimmedCountry = String(country || '').trim();
    const safeCountryId = toSafeInt(countryId);

    if (!safeCountryId && !trimmedCountry) {
      return res.status(400).json({ error: 'Pays requis' });
    }

    // Option A (stricte): inscription client = pays uniquement
    const geoScope = await resolveGeoScope({
      country: trimmedCountry,
      countryId: safeCountryId,
      regionId: null,
    });
    if (geoScope?.error) {
      return res.status(400).json({ error: geoScope.error });
    }

    const hasMaster = await countryHasActiveMaster(geoScope.countryId);
    if (!hasMaster) {
      return res
        .status(400)
        .json({ error: 'Nos services ne sont pas disponibles pour le moment dans ce pays.' });
    }

    const user = await User.create({
      email,
      passwordHash,
      firstName: firstName || null,
      lastName: lastName || null,
      phone: phone || null,
      country: geoScope?.countryIso || (trimmedCountry ? trimmedCountry.toUpperCase() : null),
      countryId: geoScope?.countryId ?? null,
      regionId: null,
      language,
      role: 'client', // rôle par défaut cohérent avec ta structure
      // countryId / regionId restent null pour rétro-compatibilité,
      // et peuvent être backfill Mali/Bamako via migrations/seed si tu le fais.
    });

    let recoveryCodes = [];
    let recoveryCodesWarning = '';
    try {
      recoveryCodes = await rotateRecoveryCodes({ userId: user.id, req });
    } catch (recoveryErr) {
      recoveryCodesWarning =
        "Codes de recuperation indisponibles pour le moment. Contactez l'administrateur.";
      logger.warn(
        'Generation recovery codes impossible:',
        recoveryErr?.message || recoveryErr
      );
    }

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
        language: user.language || 'fr',
      },
      recoveryCodes,
      recoveryCodesWarning,
    });
  } catch (e) {
    // Gestion spécifique des doublons DB (au cas où la contrainte unique remonte ici)
    if (e.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Email déjà utilisé' });
    }

    logger.error('❌ Erreur register:', e);
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
      logger.warn('⚠️ Impossible de mettre à jour lastLogin:', errUpdate.message);
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
      language: user.language || 'fr',
      });
    } catch (jwtErr) {
      logger.error('❌ Erreur signature JWT:', jwtErr.message);
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
      language: user.language || 'fr',
      },
    });
  } catch (e) {
    logger.error('❌ Erreur login:', e);
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

    // Evite les 304 (ETag) qui masquent les erreurs d'auth pendant le debug
    res.set('Cache-Control', 'no-store');

    const user = await User.findByPk(userId, {
      attributes: [
        'id',
        'email',
        'firstName',
        'lastName',
        'role',
        'countryId',
        'regionId',
        'language',
        'lastLogin',
        'createdAt',
      ],
    });

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    return res.json({ user });
  } catch (e) {
    logger.error('❌ Erreur /auth/me:', e);
    return res.status(500).json({ error: 'Erreur' });
  }
};

/* ======================================================
   🌐 /auth/me — Mise a jour profil (langue)
====================================================== */
exports.updateMe = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifie' });
    }

    const nextLanguage = normalizeLanguage(req.body?.language);
    if (!nextLanguage || !SUPPORTED_LANGS.has(nextLanguage)) {
      return res.status(400).json({ error: 'Langue invalide (fr/en uniquement)' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    await user.update({ language: nextLanguage });

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        countryId: user.countryId ?? null,
        regionId: user.regionId ?? null,
      language: user.language || 'fr',
      },
    });
  } catch (e) {
    logger.error('❌ Erreur /auth/me PATCH:', e);
    return res.status(500).json({ error: 'Erreur mise a jour profil' });
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
      language: user.language || 'fr',
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
    logger.error('❌ Erreur refresh:', e);
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
    logger.error('❌ Erreur logout:', e);
    return res.status(500).json({ error: 'Erreur lors de la déconnexion' });
  }
};

/* ======================================================
   Mot de passe oublie (demande de reset)
====================================================== */
exports.forgotPassword = async (req, res) => {
  return res.status(403).json({ error: MANUAL_RESET_MESSAGE });
};

/* ======================================================
   Reset mot de passe (token)
====================================================== */
exports.resetPassword = async (req, res) => {
  return res.status(403).json({ error: MANUAL_RESET_MESSAGE });
};

/* ======================================================
   Reset mot de passe (recovery code)
====================================================== */
exports.recoverWithCode = async (req, res) => {
  return res.status(403).json({ error: MANUAL_RESET_MESSAGE });
};

/* ======================================================
   Regenerer recovery codes (auth)
====================================================== */
exports.regenerateRecoveryCodes = async (req, res) => {
  return res.status(403).json({ error: MANUAL_RESET_MESSAGE });
};

/* ======================================================
   Changer mot de passe (auth)
====================================================== */
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifie' });
    }

    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: 'Mot de passe actuel et nouveau requis' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'Mot de passe trop court (minimum 8 caracteres)',
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        error: 'Le nouveau mot de passe doit etre different',
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      return res.status(400).json({ error: 'Mot de passe actuel invalide' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    await revokeUserRefreshTokens(user.id, req);

    const payload = req.authTokenPayload;
    if (payload?.jti && payload?.exp) {
      const expiresAt = new Date(payload.exp * 1000);
      await TokenBlacklist.findOrCreate({
        where: { jti: payload.jti },
        defaults: { expiresAt },
      });
    }

    clearAuthCookies(res);

    return res.json({
      message: 'Mot de passe modifie. Veuillez vous reconnecter.',
    });
  } catch (e) {
    logger.error('Erreur changePassword:', e);
    return res
      .status(500)
      .json({ error: 'Erreur lors du changement de mot de passe' });
  }
};









