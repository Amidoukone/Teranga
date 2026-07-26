'use strict';

const logger = require('../utils/logger');

const DISTANCE_MATRIX_ENDPOINT = 'https://maps.googleapis.com/maps/api/distancematrix/json';
const REQUEST_TIMEOUT_MS = 5000;

// Cache obligatoire (docs/DEV_SPEC_TERANGA_v3.md section 3.4) : Distance
// Matrix est facturé à l'appel, ne doit jamais être interrogé à chaque ping
// de position — seulement lors d'une recherche d'exécutant/recalcul explicite.
// Cache mémoire simple (process unique Render) : suffisant pour ce lot,
// pas d'infra Redis introduite pour ce seul besoin (voir 0.5, ne pas
// sur-outiller sans validation explicite).
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

function coordKey(point) {
  return `${Number(point.lat).toFixed(5)},${Number(point.lng).toFixed(5)}`;
}

function buildCacheKey(origins, destinations, mode) {
  return [
    mode,
    origins.map(coordKey).join('|'),
    destinations.map(coordKey).join('|'),
  ].join('::');
}

function getFromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setInCache(key, value) {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * ETA/distance réels (pas à vol d'oiseau) entre chaque origine et chaque
 * destination, via Google Distance Matrix API — utilisé par le moteur de
 * matching (section 3.4, câblage complet reporté au Lot 4). Clé serveur
 * uniquement (GOOGLE_MAPS_SERVER_KEY), jamais la clé navigateur.
 *
 * `origins`/`destinations` : [{ lat, lng }]. Retourne `null` si l'appel
 * échoue ou si la clé n'est pas configurée — à l'appelant de décider du
 * repli (ex. tri par distance à vol d'oiseau en dernier recours).
 */
async function getDistanceMatrix(origins, destinations, { mode = 'driving' } = {}) {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY;

  if (!Array.isArray(origins) || !origins.length || !Array.isArray(destinations) || !destinations.length) {
    return null;
  }

  if (!apiKey) {
    logger.warn('distanceMatrix.service.missing_api_key');
    return null;
  }

  const cacheKey = buildCacheKey(origins, destinations, mode);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    origins: origins.map((o) => `${o.lat},${o.lng}`).join('|'),
    destinations: destinations.map((d) => `${d.lat},${d.lng}`).join('|'),
    mode,
    key: apiKey,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${DISTANCE_MATRIX_ENDPOINT}?${params.toString()}`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.warn('distanceMatrix.service.http_error', { status: response.status });
      return null;
    }

    const data = await response.json();

    if (data.status !== 'OK') {
      logger.warn('distanceMatrix.service.api_error', { status: data.status });
      return null;
    }

    const result = {
      rows: data.rows.map((row) =>
        row.elements.map((el) => ({
          status: el.status,
          distanceMeters: el.status === 'OK' ? el.distance.value : null,
          durationSeconds: el.status === 'OK' ? el.duration.value : null,
        }))
      ),
    };

    setInCache(cacheKey, result);
    return result;
  } catch (err) {
    logger.warn({ err }, 'distanceMatrix.service.request_failed');
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { getDistanceMatrix };
