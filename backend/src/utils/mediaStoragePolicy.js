'use strict';

function parseBooleanEnv(raw) {
  const normalized = String(raw || '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return null;
}

function isProductionRuntime(env = process.env) {
  return String(env.NODE_ENV || '').trim().toLowerCase() === 'production';
}

function isImageKitConfigured(env = process.env) {
  return Boolean(
    String(env.IMAGEKIT_PUBLIC_KEY || '').trim() &&
      String(env.IMAGEKIT_PRIVATE_KEY || '').trim() &&
      String(env.IMAGEKIT_URL_ENDPOINT || '').trim()
  );
}

function hasCustomUploadsRoot(env = process.env) {
  return Boolean(String(env.UPLOADS_ROOT || env.UPLOADS_DIR || '').trim());
}

function evaluateLocalMediaFallback(options = {}) {
  const env = options.env || process.env;
  const moduleFallbackEnvVar = String(options.moduleFallbackEnvVar || '').trim();
  const globalFallbackEnvVar = 'MEDIA_ALLOW_LOCAL_FALLBACK';
  const enforceDurableUploadsEnvVar = 'MEDIA_ENFORCE_DURABLE_UPLOADS';

  const moduleDecision = moduleFallbackEnvVar
    ? parseBooleanEnv(env[moduleFallbackEnvVar])
    : null;
  const imageKitConfigured = isImageKitConfigured(env);
  if (moduleDecision !== null) {
    return {
      allowLocalFallback: moduleDecision,
      reason: 'explicit_module_env',
      resolvedFrom: moduleFallbackEnvVar,
      moduleDecision,
      globalDecision: parseBooleanEnv(env[globalFallbackEnvVar]),
      isProduction: isProductionRuntime(env),
      hasCustomUploadsRoot: hasCustomUploadsRoot(env),
      imageKitConfigured,
    };
  }

  const globalDecision = parseBooleanEnv(env[globalFallbackEnvVar]);
  if (globalDecision !== null) {
    return {
      allowLocalFallback: globalDecision,
      reason: 'explicit_global_env',
      resolvedFrom: globalFallbackEnvVar,
      moduleDecision: null,
      globalDecision,
      isProduction: isProductionRuntime(env),
      hasCustomUploadsRoot: hasCustomUploadsRoot(env),
      imageKitConfigured,
    };
  }

  const enforceDurableUploads = parseBooleanEnv(
    env[enforceDurableUploadsEnvVar]
  );
  const isProduction = isProductionRuntime(env);
  const customUploadsRoot = hasCustomUploadsRoot(env);

  if (!isProduction) {
    return {
      allowLocalFallback: true,
      reason: 'non_production_default',
      resolvedFrom: 'runtime_default',
      moduleDecision: null,
      globalDecision: null,
      enforceDurableUploads:
        enforceDurableUploads === null ? 'auto' : enforceDurableUploads,
      isProduction,
      hasCustomUploadsRoot: customUploadsRoot,
      imageKitConfigured,
    };
  }

  if (customUploadsRoot) {
    return {
      allowLocalFallback: true,
      reason: 'custom_uploads_root',
      resolvedFrom: 'UPLOADS_ROOT/UPLOADS_DIR',
      moduleDecision: null,
      globalDecision: null,
      enforceDurableUploads:
        enforceDurableUploads === null ? 'auto' : enforceDurableUploads,
      isProduction,
      hasCustomUploadsRoot: customUploadsRoot,
      imageKitConfigured,
    };
  }

  if (enforceDurableUploads === false) {
    return {
      allowLocalFallback: true,
      reason: 'explicit_durable_enforcement_disabled',
      resolvedFrom: enforceDurableUploadsEnvVar,
      moduleDecision: null,
      globalDecision: null,
      enforceDurableUploads: false,
      isProduction,
      hasCustomUploadsRoot: customUploadsRoot,
      imageKitConfigured,
    };
  }

  if (imageKitConfigured) {
    return {
      allowLocalFallback: false,
      reason: 'production_imagekit_default',
      resolvedFrom: 'runtime_default',
      moduleDecision: null,
      globalDecision: null,
      enforceDurableUploads:
        enforceDurableUploads === null ? 'auto' : enforceDurableUploads,
      isProduction,
      hasCustomUploadsRoot: customUploadsRoot,
      imageKitConfigured,
    };
  }

  const reason =
    enforceDurableUploads === true
      ? 'production_ephemeral_blocked'
      : 'production_default_durable';

  return {
    allowLocalFallback: false,
    reason,
    resolvedFrom: 'runtime_default',
    moduleDecision: null,
    globalDecision: null,
    enforceDurableUploads:
      enforceDurableUploads === null ? 'auto' : enforceDurableUploads,
    isProduction,
    hasCustomUploadsRoot: customUploadsRoot,
    imageKitConfigured,
  };
}

module.exports = {
  evaluateLocalMediaFallback,
  hasCustomUploadsRoot,
  isImageKitConfigured,
  isProductionRuntime,
  parseBooleanEnv,
};
