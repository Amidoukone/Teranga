'use strict';

const logger = require('../utils/logger');

const GEOCODE_ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';
const REQUEST_TIMEOUT_MS = 5000;

/**
 * Convertit une adresse texte libre en coordonnées via Google Geocoding API
 * (docs/DEV_SPEC_TERANGA_v3.md section 4.3). Utilise la clé serveur
 * GOOGLE_MAPS_SERVER_KEY, restreinte par IP côté Google Cloud Console —
 * jamais la clé navigateur.
 *
 * Retourne `null` si l'adresse est introuvable/ambiguë ou si la clé n'est
 * pas configurée (dev local sans clé) : à l'appelant de décider s'il rejette
 * la requête (création de mission) ou tolère l'absence de coordonnées.
 */
async function geocodeAddress(address, { countryIso } = {}) {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY;
  const query = String(address || '').trim();

  if (!query) return null;

  if (!apiKey) {
    logger.warn('geocoding.service.missing_api_key');
    return null;
  }

  const params = new URLSearchParams({ address: query, key: apiKey });
  if (countryIso) {
    params.set('region', String(countryIso).toLowerCase());
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${GEOCODE_ENDPOINT}?${params.toString()}`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.warn('geocoding.service.http_error', { status: response.status });
      return null;
    }

    const data = await response.json();

    if (data.status !== 'OK' || !data.results?.length) {
      if (data.status !== 'ZERO_RESULTS') {
        logger.warn('geocoding.service.api_error', { status: data.status });
      }
      return null;
    }

    const [result] = data.results;
    const location = result.geometry?.location;

    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
      return null;
    }

    const components = Array.isArray(result.address_components) ? result.address_components : [];
    const countryComponent = components.find((c) => c.types?.includes('country'));
    const adminAreaComponent = components.find((c) =>
      c.types?.includes('administrative_area_level_1')
    );

    return {
      latitude: location.lat,
      longitude: location.lng,
      formattedAddress: result.formatted_address || query,
      // Résolus depuis address_components Google — utilisés pour router une mission
      // vers le pays/région où elle a réellement lieu (docs/DEV_SPEC_TERANGA_v3.md,
      // extension transfrontalière), pas vers le pays du compte du demandeur.
      countryIso: countryComponent?.short_name || null,
      adminAreaName: adminAreaComponent?.long_name || null,
    };
  } catch (err) {
    logger.warn({ err }, 'geocoding.service.request_failed');
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { geocodeAddress };
