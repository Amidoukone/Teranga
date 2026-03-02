'use strict';

const MIN_JWT_SECRET_LENGTH = 32;
const WEAK_JWT_SECRETS = new Set([
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

function validateProdConfig(env = process.env) {
  const errors = [];
  const warnings = [];
  const isProd = (env.NODE_ENV || 'development') === 'production';

  if (!isProd) {
    return { isProd, errors, warnings };
  }

  const jwtSecret = String(env.JWT_SECRET || '');
  if (
    !jwtSecret ||
    jwtSecret.length < MIN_JWT_SECRET_LENGTH ||
    WEAK_JWT_SECRETS.has(jwtSecret.toLowerCase())
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

  return { isProd, errors, warnings };
}

module.exports = {
  validateProdConfig,
};
