'use strict';

const { Region } = require('../../models');
const { resolveGeoScope, countryHasActiveMaster } = require('../controllers/auth.controller');
const logger = require('./logger');

// Mots administratifs génériques à ignorer lors du rapprochement nom Google <-> nom Region
// interne (ex. Google renvoie "Région de Kayes" ou "Cercle de Kayes" alors que la région a été
// créée en base sous le simple nom "Kayes" par un admin). Best-effort uniquement : ne remplace
// pas une vraie table de correspondance, mais évite l'essentiel des faux négatifs francophones.
const ADMIN_AREA_NOISE_WORDS = [
  'region', 'région', 'regione', 'cercle', 'district', 'province', 'prefecture', 'préfecture',
  'department', 'département', 'state', 'county', 'gouvernorat', 'governorate', 'de', 'du', 'des', 'of',
];

function normalizeRegionName(value) {
  if (!value) return '';
  const stripped = String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // accents
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();

  const words = stripped.split(/\s+/).filter((w) => w && !ADMIN_AREA_NOISE_WORDS.includes(w));
  return (words.length ? words : stripped.split(/\s+/)).join(' ').trim();
}

/**
 * Rapproche le nom de région renvoyé par le géocodage (Google, best-effort, format libre) avec
 * une région déjà créée en base pour ce pays (nom saisi librement par un admin, cf.
 * region.controller.js — pas de référentiel administratif officiel). Egalité stricte d'abord,
 * puis normalisation (accents/casse/mots génériques), puis inclusion mutuelle en dernier
 * recours — mieux vaut une résolution approximative qu'une région NULL qui rend la mission
 * invisible pour les masters régionaux (cf. geoScope.js canAccessGeoResource).
 */
async function matchRegionByName(countryId, adminAreaName) {
  if (!countryId || !adminAreaName) return null;

  const candidates = await Region.findAll({
    where: { countryId },
    attributes: ['id', 'name'],
  });
  if (!candidates.length) return null;

  const rawTarget = String(adminAreaName).trim().toLowerCase();
  const exact = candidates.find((r) => String(r.name).trim().toLowerCase() === rawTarget);
  if (exact) return exact.id;

  const normalizedTarget = normalizeRegionName(adminAreaName);
  if (!normalizedTarget) return null;

  const normalizedMatch = candidates.find((r) => normalizeRegionName(r.name) === normalizedTarget);
  if (normalizedMatch) return normalizedMatch.id;

  const fuzzyMatch = candidates.find((r) => {
    const normalizedName = normalizeRegionName(r.name);
    if (!normalizedName) return false;
    return normalizedTarget.includes(normalizedName) || normalizedName.includes(normalizedTarget);
  });
  if (fuzzyMatch) return fuzzyMatch.id;

  logger.warn(
    { countryId, adminAreaName },
    'resolveMissionGeoScope.region_no_match'
  );
  return null;
}

/**
 * Résout le géo-scope RÉEL d'une mission — le pays/région où elle est exécutée,
 * PAS celui du compte du demandeur (docs/DEV_SPEC_TERANGA_v3.md, correction
 * transfrontalière : un client basé à Bamako doit pouvoir demander une mission
 * à exécuter à Abidjan, routée/tarifée selon Abidjan, pas selon son compte).
 *
 * @param {object} params
 * @param {string|null} params.countryIso - ISO alpha-2 résolu par geocodeAddress
 * @param {string|null} params.adminAreaName - nom de région résolu par geocodeAddress (best-effort, nullable)
 * @param {number|null} params.fallbackCountryId - pays du compte, utilisé si aucune adresse (types de
 *   mission sans lieu, ex. paiement/transfert d'argent — voir décision 0.9.e)
 * @param {number|null} params.fallbackRegionId - région du compte, même fallback
 * @returns {Promise<{countryId: number|null, regionId: number|null}|{error: string}>}
 */
async function resolveMissionGeoScope({
  countryIso,
  adminAreaName,
  fallbackCountryId = null,
  fallbackRegionId = null,
}) {
  if (!countryIso) {
    return { countryId: fallbackCountryId, regionId: fallbackRegionId };
  }

  const geoScope = await resolveGeoScope({ country: countryIso });
  if (geoScope?.error) {
    return { error: geoScope.error };
  }

  const regionId = await matchRegionByName(geoScope.countryId, adminAreaName);

  const hasMaster = await countryHasActiveMaster(geoScope.countryId);
  if (!hasMaster) {
    return { error: 'Nos services ne sont pas disponibles pour le moment dans ce pays.' };
  }

  return { countryId: geoScope.countryId, regionId };
}

module.exports = { resolveMissionGeoScope };
