"use strict";

// docs/DEV_SPEC_TERANGA_v4_PHASE0.md §4.3 — comparaison de proximité entre la position
// d'une preuve et la position connue de la ressource liée (mission/bien). Volontairement
// tolérant (voir DEFAULT_TOLERANCE_METERS) : la précision GPS varie fortement sur ce terrain,
// mieux vaut un seuil large qui évite les faux positifs qu'un seuil strict qui accuse à tort.
// Ce module ne bloque jamais rien — il ne fait que qualifier une donnée (`locationFlag`)
// consultée ensuite par un humain (litige, vérification ponctuelle).

const EARTH_RADIUS_METERS = 6371000;
const DEFAULT_TOLERANCE_METERS = 200;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Retourne 'ok' | 'distant' | 'unknown' selon l'écart entre la position de la preuve et la
 * position connue de la ressource liée. 'unknown' dès qu'une des deux positions manque —
 * ce n'est pas une anomalie, c'est le cas normal (permission navigateur refusée, bien pas
 * encore géocodé, etc.).
 */
function resolveLocationFlag({
  evidenceLatitude,
  evidenceLongitude,
  targetLatitude,
  targetLongitude,
  toleranceMeters = DEFAULT_TOLERANCE_METERS,
}) {
  const evLat = Number(evidenceLatitude);
  const evLng = Number(evidenceLongitude);
  const tgLat = Number(targetLatitude);
  const tgLng = Number(targetLongitude);

  const hasEvidencePosition = Number.isFinite(evLat) && Number.isFinite(evLng);
  const hasTargetPosition = Number.isFinite(tgLat) && Number.isFinite(tgLng);

  if (!hasEvidencePosition || !hasTargetPosition) return "unknown";

  const distanceMeters = haversineDistanceMeters(evLat, evLng, tgLat, tgLng);
  return distanceMeters <= toleranceMeters ? "ok" : "distant";
}

module.exports = {
  haversineDistanceMeters,
  resolveLocationFlag,
  DEFAULT_TOLERANCE_METERS,
};
