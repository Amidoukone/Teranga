'use strict';

const DEFAULT_AUTH_USER_CACHE_TTL_MS = 15000;
const DEFAULT_TOKEN_STATUS_CACHE_TTL_MS = 15000;

const authUserCache = new Map();
const tokenStatusCache = new Map();

function parseTtl(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

const AUTH_USER_CACHE_TTL_MS = parseTtl(
  process.env.AUTH_USER_CACHE_TTL_MS,
  DEFAULT_AUTH_USER_CACHE_TTL_MS
);
const TOKEN_STATUS_CACHE_TTL_MS = parseTtl(
  process.env.AUTH_TOKEN_STATUS_CACHE_TTL_MS,
  DEFAULT_TOKEN_STATUS_CACHE_TTL_MS
);

function nowMs() {
  return Date.now();
}

function normalizeUser(user) {
  if (!user?.id) return null;
  return {
    id: user.id,
    role: user.role ?? null,
    country: user.country ?? null,
    countryId: user.countryId ?? null,
    regionId: user.regionId ?? null,
  };
}

function toExpiryMs(value) {
  if (!value) return null;
  const ts =
    value instanceof Date
      ? value.getTime()
      : typeof value === 'number'
        ? value
        : Date.parse(String(value));
  return Number.isFinite(ts) ? ts : null;
}

function getValidEntry(store, key) {
  const entry = store.get(String(key));
  if (!entry) return null;
  if (entry.expiresAtMs <= nowMs()) {
    store.delete(String(key));
    return null;
  }
  return entry;
}

function buildTokenExpiry(expiresAt, fallbackTtlMs) {
  const fallbackExpiry = nowMs() + Math.max(0, fallbackTtlMs);
  const explicitExpiry = toExpiryMs(expiresAt);
  if (!explicitExpiry) return fallbackExpiry;
  return Math.min(explicitExpiry, fallbackExpiry);
}

function getCachedAuthUser(userId) {
  const entry = getValidEntry(authUserCache, userId);
  return entry ? normalizeUser(entry.value) : null;
}

function setCachedAuthUser(user) {
  const normalized = normalizeUser(user);
  if (!normalized) return null;

  if (AUTH_USER_CACHE_TTL_MS <= 0) return normalized;

  authUserCache.set(String(normalized.id), {
    value: normalized,
    expiresAtMs: nowMs() + AUTH_USER_CACHE_TTL_MS,
  });

  return normalized;
}

function invalidateAuthUserCache(userIds = null) {
  if (!userIds) {
    authUserCache.clear();
    return;
  }

  const ids = Array.isArray(userIds) ? userIds : [userIds];
  for (const userId of ids) {
    authUserCache.delete(String(userId));
  }
}

function getCachedTokenStatus(jti) {
  if (!jti) return null;
  const entry = getValidEntry(tokenStatusCache, jti);
  return entry ? entry.revoked === true : null;
}

function cacheAllowedToken(jti, expiresAt = null) {
  if (!jti || TOKEN_STATUS_CACHE_TTL_MS <= 0) return false;
  tokenStatusCache.set(String(jti), {
    revoked: false,
    expiresAtMs: buildTokenExpiry(expiresAt, TOKEN_STATUS_CACHE_TTL_MS),
  });
  return false;
}

function cacheRevokedToken(jti, expiresAt = null) {
  if (!jti) return true;
  tokenStatusCache.set(String(jti), {
    revoked: true,
    expiresAtMs: buildTokenExpiry(
      expiresAt,
      Math.max(TOKEN_STATUS_CACHE_TTL_MS, DEFAULT_TOKEN_STATUS_CACHE_TTL_MS)
    ),
  });
  return true;
}

function invalidateTokenStatusCache(jti) {
  if (!jti) return;
  tokenStatusCache.delete(String(jti));
}

module.exports = {
  getCachedAuthUser,
  setCachedAuthUser,
  invalidateAuthUserCache,
  getCachedTokenStatus,
  cacheAllowedToken,
  cacheRevokedToken,
  invalidateTokenStatusCache,
};
