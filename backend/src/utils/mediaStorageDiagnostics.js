'use strict';

const { resolveUploadsRoot } = require('./uploadsRoot');
const { parseBooleanEnv } = require('./mediaStoragePolicy');

function isImageKitConfigured(env = process.env) {
  return Boolean(
    String(env.IMAGEKIT_PUBLIC_KEY || '').trim() &&
      String(env.IMAGEKIT_PRIVATE_KEY || '').trim() &&
      String(env.IMAGEKIT_URL_ENDPOINT || '').trim()
  );
}

function buildMediaStorageDiagnostics(extra = {}, env = process.env) {
  const nodeEnv = String(env.NODE_ENV || 'development').trim().toLowerCase();
  const hasCustomUploadsRoot = Boolean(
    String(env.UPLOADS_ROOT || env.UPLOADS_DIR || '').trim()
  );
  const propertyAllowLocalFallback = parseBooleanEnv(
    env.PROPERTY_ALLOW_LOCAL_FALLBACK
  );
  const mediaAllowLocalFallback = parseBooleanEnv(
    env.MEDIA_ALLOW_LOCAL_FALLBACK
  );
  const mediaEnforceDurableUploads = parseBooleanEnv(
    env.MEDIA_ENFORCE_DURABLE_UPLOADS
  );

  const moduleFallbackEnvVar = String(
    extra.moduleFallbackEnvVar || ''
  ).trim();
  const moduleAllowLocalFallback = moduleFallbackEnvVar
    ? parseBooleanEnv(env[moduleFallbackEnvVar])
    : null;

  const diagnostics = {
    nodeEnv: nodeEnv || 'development',
    uploadsRoot: resolveUploadsRoot(),
    hasCustomUploadsRoot,
    imageKit: {
      configured: isImageKitConfigured(env),
      hasPublicKey: Boolean(String(env.IMAGEKIT_PUBLIC_KEY || '').trim()),
      hasPrivateKey: Boolean(String(env.IMAGEKIT_PRIVATE_KEY || '').trim()),
      hasUrlEndpoint: Boolean(String(env.IMAGEKIT_URL_ENDPOINT || '').trim()),
    },
    propertyAllowLocalFallback:
      propertyAllowLocalFallback === null ? 'auto' : propertyAllowLocalFallback,
    mediaAllowLocalFallback:
      mediaAllowLocalFallback === null ? 'auto' : mediaAllowLocalFallback,
    mediaEnforceDurableUploads:
      mediaEnforceDurableUploads === null ? 'auto' : mediaEnforceDurableUploads,
    ...extra,
  };

  if (moduleFallbackEnvVar) {
    diagnostics.moduleAllowLocalFallback = {
      envVar: moduleFallbackEnvVar,
      value:
        moduleAllowLocalFallback === null ? 'auto' : moduleAllowLocalFallback,
    };
  }

  return diagnostics;
}

module.exports = {
  buildMediaStorageDiagnostics,
  isImageKitConfigured,
};
