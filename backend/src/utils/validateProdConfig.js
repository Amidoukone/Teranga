'use strict';

const { parseBooleanEnv } = require('./mediaStoragePolicy');
const { resolveNodeEnvPosture } = require('./runtimeEnv');

const MIN_JWT_SECRET_LENGTH = 32;
const MIN_BOOTSTRAP_ADMIN_PASSWORD_LENGTH = 16;
const WEAK_CREDENTIAL_VALUES = new Set([
  'super_secret_key',
  'secret',
  'changeme',
  'jwt_secret',
]);

function normalizeList(raw) {
  return String(raw || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function databaseUrlHostname(rawUrl) {
  const value = String(rawUrl || '').trim();
  if (!value) return '';

  try {
    return new URL(value).hostname;
  } catch (_err) {
    return value;
  }
}

function validateProdConfig(env = process.env) {
  const errors = [];
  const warnings = [];
  const posture = resolveNodeEnvPosture(env);
  const isProd = posture.isProd;

  if (!posture.recognized) {
    // Une valeur de NODE_ENV inconnue ne doit jamais être traitée comme du
    // développement (ce qui désactiverait silencieusement tous les contrôles
    // ci-dessous) : on échoue au démarrage plutôt que d'exposer une
    // configuration permissive.
    errors.push(
      `NODE_ENV="${posture.raw}" is not recognized (expected "production", "development" or "test"); refusing to start with a permissive configuration`
    );
  }

  if (!isProd) {
    return { isProd, errors, warnings };
  }

  const jwtSecret = String(env.JWT_SECRET || '');
  if (
    !jwtSecret ||
    jwtSecret.length < MIN_JWT_SECRET_LENGTH ||
    WEAK_CREDENTIAL_VALUES.has(jwtSecret.toLowerCase())
  ) {
    errors.push(
      `JWT_SECRET must be set with at least ${MIN_JWT_SECRET_LENGTH} characters and not use weak defaults`
    );
  }

  const corsOrigins = normalizeList(env.CORS_ORIGINS);
  if (corsOrigins.length === 0) {
    errors.push('CORS_ORIGINS must be configured in production');
  }
  if (corsOrigins.includes('*')) {
    errors.push('CORS_ORIGINS cannot contain * in production');
  }

  if (!String(env.METRICS_TOKEN || '').trim()) {
    errors.push('METRICS_TOKEN must be configured in production');
  }

  if (!String(env.FRONTEND_ERROR_TOKEN || '').trim()) {
    errors.push('FRONTEND_ERROR_TOKEN must be configured in production');
  }

  if (!String(env.DATABASE_URL || '').trim()) {
    errors.push('DATABASE_URL must be configured in production');
  }
  if (String(env.PLANETSCALE_DATABASE_URL || '').trim()) {
    warnings.push(
      'PLANETSCALE_DATABASE_URL is legacy and is not used by NODE_ENV=production; remove it after migration'
    );
  }
  if (/planetscale|psdb\.cloud/i.test(databaseUrlHostname(env.DATABASE_URL))) {
    warnings.push(
      'DATABASE_URL still looks like a PlanetScale connection string'
    );
  }
  if (parseBooleanEnv(env.DB_SSL) === false) {
    warnings.push(
      'DB_SSL=false disables TLS for MySQL. Use only with a trusted private endpoint.'
    );
  }

  const allowDefaults =
    String(env.BOOTSTRAP_ADMIN_ALLOW_DEFAULTS || '')
      .toLowerCase()
      .trim() === 'true';
  if (allowDefaults) {
    errors.push('BOOTSTRAP_ADMIN_ALLOW_DEFAULTS must be false in production');
  }

  if (String(env.BOOTSTRAP_ADMIN_DEFAULT_PASSWORD || '').trim()) {
    errors.push('BOOTSTRAP_ADMIN_DEFAULT_PASSWORD must not be set in production');
  }
  if (String(env.BOOTSTRAP_ADMIN_DEFAULT_EMAIL || '').trim()) {
    warnings.push('BOOTSTRAP_ADMIN_DEFAULT_EMAIL is set; remove it in production');
  }

  // bootstrapAdmin.js crée un compte admin avec ce mot de passe sans aucun contrôle de
  // robustesse ; un dépannage ponctuel en production avec un mot de passe faible ne doit
  // jamais passer silencieusement.
  if (parseBooleanEnv(env.BOOTSTRAP_ADMIN_ENABLED)) {
    const bootstrapPassword = String(env.BOOTSTRAP_ADMIN_PASSWORD || '');
    if (bootstrapPassword.length < MIN_BOOTSTRAP_ADMIN_PASSWORD_LENGTH || WEAK_CREDENTIAL_VALUES.has(bootstrapPassword.toLowerCase())) {
      errors.push(
        `BOOTSTRAP_ADMIN_PASSWORD must be set with at least ${MIN_BOOTSTRAP_ADMIN_PASSWORD_LENGTH} characters and not use weak defaults while BOOTSTRAP_ADMIN_ENABLED=true`
      );
    }
  }

  const imageKitConfigured = Boolean(
    String(env.IMAGEKIT_PUBLIC_KEY || '').trim() &&
      String(env.IMAGEKIT_PRIVATE_KEY || '').trim() &&
      String(env.IMAGEKIT_URL_ENDPOINT || '').trim()
  );
  const hasCustomUploadsRoot = Boolean(
    String(env.UPLOADS_ROOT || env.UPLOADS_DIR || '').trim()
  );
  if (!imageKitConfigured && !hasCustomUploadsRoot) {
    warnings.push(
      'IMAGEKIT_* is not configured and UPLOADS_ROOT is not set. Uploaded files may be lost on redeploy with ephemeral storage.'
    );
  }

  const mediaAllowLocalFallback = parseBooleanEnv(env.MEDIA_ALLOW_LOCAL_FALLBACK);
  if (mediaAllowLocalFallback === true && !hasCustomUploadsRoot) {
    warnings.push(
      'MEDIA_ALLOW_LOCAL_FALLBACK=true without UPLOADS_ROOT enables ephemeral local uploads in production.'
    );
  }

  const mediaEnforceDurableUploads = parseBooleanEnv(
    env.MEDIA_ENFORCE_DURABLE_UPLOADS
  );
  if (mediaEnforceDurableUploads === false && !hasCustomUploadsRoot) {
    warnings.push(
      'MEDIA_ENFORCE_DURABLE_UPLOADS=false allows local fallback in production; files can be lost on redeploy.'
    );
  }

  if (env.APP_ENVIRONMENT === 'recette') {
    let database;
    try { const url = new URL(env.DATABASE_URL); database = url.protocol === 'mysql:' ? decodeURIComponent(url.pathname.slice(1)) : ''; } catch { database = ''; }
    if (!/^teranga_recette(?:_[a-zA-Z0-9]+)*$/.test(database) &&
        !(/^teranga_https_e2e_[a-zA-Z0-9_]+$/.test(database) && ['localhost', '127.0.0.1', '[::1]'].includes(databaseUrlHostname(env.DATABASE_URL)))) {
      errors.push('Recette requires a dedicated teranga_recette database (or a local isolated HTTPS test fixture)');
    }
    let origin = '';
    try {
      const url = new URL(env.FRONTEND_URL);
      if (url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/') origin = url.origin;
    } catch { /* A missing or malformed origin is rejected below. */ }
    if (!origin || corsOrigins.length !== 1 || corsOrigins[0] !== origin) errors.push('Recette requires one matching HTTPS FRONTEND_URL and CORS_ORIGINS origin');
    for (const key of ['CLIENT_URL', 'CLIENT_ORIGIN']) {
      if (env[key] && String(env[key]).replace(/\/$/, '') !== origin) errors.push(`Recette ${key} must use the same HTTPS origin`);
    }
    if (String(env.SERVE_FRONTEND).toLowerCase() !== 'true') errors.push('Recette requires SERVE_FRONTEND=true');
    if (String(env.COOKIE_SAME_SITE).toLowerCase() !== 'lax') errors.push('Recette requires COOKIE_SAME_SITE=lax');
  }

  return { isProd, errors, warnings };
}

module.exports = {
  validateProdConfig,
};
