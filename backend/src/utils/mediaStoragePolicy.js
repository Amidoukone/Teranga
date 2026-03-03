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

function hasCustomUploadsRoot(env = process.env) {
  return Boolean(String(env.UPLOADS_ROOT || env.UPLOADS_DIR || '').trim());
}

function evaluateLocalMediaFallback(options = {}) {
  const env = options.env || process.env;
  const moduleFallbackEnvVar = String(options.moduleFallbackEnvVar || '').trim();
  const globalFallbackEnvVar = 'MEDIA_ALLOW_LOCAL_FALLBACK';

  const moduleDecision = moduleFallbackEnvVar
    ? parseBooleanEnv(env[moduleFallbackEnvVar])
    : null;
  if (moduleDecision !== null) {
    return {
      allowLocalFallback: moduleDecision,
      reason: 'explicit_module_env',
      resolvedFrom: moduleFallbackEnvVar,
      moduleDecision,
      globalDecision: parseBooleanEnv(env[globalFallbackEnvVar]),
      isProduction: isProductionRuntime(env),
      hasCustomUploadsRoot: hasCustomUploadsRoot(env),
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
    };
  }

  const isProduction = isProductionRuntime(env);
  if (!isProduction) {
    return {
      allowLocalFallback: true,
      reason: 'non_production_default',
      resolvedFrom: 'runtime_default',
      moduleDecision: null,
      globalDecision: null,
      isProduction,
      hasCustomUploadsRoot: hasCustomUploadsRoot(env),
    };
  }

  const customUploadsRoot = hasCustomUploadsRoot(env);
  if (customUploadsRoot) {
    return {
      allowLocalFallback: true,
      reason: 'custom_uploads_root',
      resolvedFrom: 'UPLOADS_ROOT/UPLOADS_DIR',
      moduleDecision: null,
      globalDecision: null,
      isProduction,
      hasCustomUploadsRoot: customUploadsRoot,
    };
  }

  return {
    allowLocalFallback: false,
    reason: 'production_ephemeral_blocked',
    resolvedFrom: 'runtime_default',
    moduleDecision: null,
    globalDecision: null,
    isProduction,
    hasCustomUploadsRoot: customUploadsRoot,
  };
}

module.exports = {
  evaluateLocalMediaFallback,
  hasCustomUploadsRoot,
  isProductionRuntime,
  parseBooleanEnv,
};
