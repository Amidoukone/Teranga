'use strict';
const path = require('path');
const { evaluateLocalMediaFallback, isImageKitConfigured, hasCustomUploadsRoot } = require('./mediaStoragePolicy');

function validateReleaseMediaConfig(env) {
  const errors = [];
  const root = String(env.UPLOADS_ROOT || env.UPLOADS_DIR || '').trim();
  if (!isImageKitConfigured(env) && !hasCustomUploadsRoot(env)) errors.push('Configurer ImageKit ou UPLOADS_ROOT sur un volume persistant avant les essais terrain.');
  if (!isImageKitConfigured(env) && !root) return errors;
  if (root && !path.isAbsolute(root)) errors.push('UPLOADS_ROOT doit être un chemin absolu en production.');
  for (const moduleFallbackEnvVar of ['EVIDENCE_ALLOW_LOCAL_FALLBACK', 'MISSION_ATTACHMENT_ALLOW_LOCAL_FALLBACK', 'PROJECT_DOCUMENT_ALLOW_LOCAL_FALLBACK', 'TRANSACTION_ALLOW_LOCAL_FALLBACK', 'MOBILITY_MEDIA_ALLOW_LOCAL_FALLBACK', 'PROPERTY_ALLOW_LOCAL_FALLBACK', 'PROPERTY_LISTING_ALLOW_LOCAL_FALLBACK']) {
    const policy = evaluateLocalMediaFallback({ env: { ...env, NODE_ENV: 'production' }, moduleFallbackEnvVar });
    if (policy.allowLocalFallback && !root) errors.push(`${moduleFallbackEnvVar} autorise un repli local sans volume persistant.`);
    if (!policy.allowLocalFallback && !isImageKitConfigured(env)) errors.push(`${moduleFallbackEnvVar} interdit le seul stockage disponible : configurer ImageKit ou autoriser le volume persistant.`);
  }
  return errors;
}

module.exports = { validateReleaseMediaConfig };
