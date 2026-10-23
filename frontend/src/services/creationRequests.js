// Retry keys are scoped to a user, endpoint and payload. Only their SHA-256 digest
// and a random key enter sessionStorage; PINs and request contents stay in memory.
const pending = new Map();
const pathOf = (url) => String(url || '').replace(/^https?:\/\/[^/]+/, '').replace(/^\/api/, '').replace(/^\/v1/, '').replace(/\/$/, '');
const endpoints = ['/services', '/projects', '/orders', '/missions', '/missions/phone-order', '/mission-requests'];
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
export async function protectCreation(config) {
  if (String(config.method || '').toLowerCase() !== 'post' || !endpoints.includes(pathOf(config.url))) return config;
  if (config.headers?.['Idempotency-Key']) return config;
  let payload = config.data;
  if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch { return config; } }
  if (!payload || typeof payload !== 'object' || payload instanceof FormData) return config;
  let actor = 'guest';
  try { actor = JSON.parse(localStorage.getItem('teranga_user') || 'null')?.id || actor; } catch { /* unavailable storage */ }
  const fingerprint = JSON.stringify([actor, pathOf(config.url), canonical(payload)]);
  let storageKey = null;
  if (window.crypto?.subtle && typeof TextEncoder !== 'undefined') {
    const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprint));
    storageKey = `teranga-create-${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  }
  let key = pending.get(fingerprint);
  try { key = key || (storageKey && sessionStorage.getItem(storageKey)); } catch { /* memory fallback */ }
  key = key || window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  pending.set(fingerprint, key);
  try { if (storageKey) sessionStorage.setItem(storageKey, key); } catch { /* memory fallback */ }
  config.headers = config.headers || {};
  config.headers['Idempotency-Key'] = key;
  config.__creationFingerprint = fingerprint;
  config.__creationStorageKey = storageKey;
  return config;
}
export function settleCreation(config, status) {
  if (!config?.__creationFingerprint || !status || status >= 500 || status === 409) return;
  pending.delete(config.__creationFingerprint);
  try { if (config.__creationStorageKey) sessionStorage.removeItem(config.__creationStorageKey); } catch { /* memory fallback */ }
}
