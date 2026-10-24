const PREFIX = 'teranga-request-draft:v1:';
const MAX_AGE = 24 * 60 * 60 * 1000;
const TEXT = { countryId: 20, regionId: 20, title: 150, description: 2000, address: 255, pickupAddress: 255 };
const keyFor = (scope, actor) => `${PREFIX}${scope}:${actor || 'guest'}`;

function cleanDraft(value = {}) {
  const data = {};
  for (const [key, max] of Object.entries(TEXT)) if (typeof value[key] === 'string') data[key] = value[key].slice(0, max);
  for (const key of ['coordinates', 'pickupCoordinates']) {
    const point = value[key];
    if (point && Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90 && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180) data[key] = { latitude: point.latitude, longitude: point.longitude };
  }
  if (value.submission && typeof value.submission.fingerprint === 'string' && /^[a-zA-Z0-9-]{8,80}$/.test(value.submission.requestKey || '')) data.submission = { fingerprint: value.submission.fingerprint.slice(0, 6000), requestKey: value.submission.requestKey };
  return data;
}

export function readRequestDraft(scope, actor) {
  try {
    const record = JSON.parse(sessionStorage.getItem(keyFor(scope, actor)) || 'null');
    if (!record || !Number.isFinite(record.savedAt) || Date.now() - record.savedAt > MAX_AGE) { sessionStorage.removeItem(keyFor(scope, actor)); return {}; }
    return cleanDraft(record.data);
  } catch (_error) { return {}; }
}

export function saveRequestDraft(scope, actor, value) {
  const data = cleanDraft(value);
  try {
    if (![data.title, data.description, data.address, data.pickupAddress, data.coordinates, data.pickupCoordinates].some(Boolean)) return clearRequestDraft(scope, actor);
    sessionStorage.setItem(keyFor(scope, actor), JSON.stringify({ savedAt: Date.now(), data }));
  } catch (_error) { /* La saisie reste possible si le stockage est indisponible. */ }
}

export function clearRequestDraft(scope, actor) {
  try { sessionStorage.removeItem(keyFor(scope, actor)); } catch (_error) { /* Stockage indisponible. */ }
}
