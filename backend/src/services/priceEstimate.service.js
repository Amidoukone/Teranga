'use strict';

// Estimation de prix/délai pour l'étape 4 de la création de mission guidée
// (docs/DEV_SPEC_TERANGA_v3.md section 4.1). Lit `mission_pricing_rules`, une table
// éditable par les admins (global et scopés pays/région — voir missionPricingRule.controller.js
// qui réutilise backend/src/utils/geoScope.js sans nouveau code de permission). Les valeurs
// semées (backend/seeders/20260726100100-seed-mission-pricing-defaults.js) sont un point de
// départ pour le marché de Bamako, pas une grille tarifaire figée.

const { MissionPricingRule, Country } = require('../../models');
const logger = require('../utils/logger');
const { haversineDistanceMeters } = require('../utils/evidenceProximity');

const FALLBACK_CURRENCY = 'XOF';
const FALLBACK_DELAY_MINUTES = 120;
const FALLBACK_NOTE =
  "Aucune tarification n'est encore configurée pour ce pays. Un conseiller Teranga vous recontactera pour établir un devis.";

function buildQuoteOnlyResponse({ currency, estimatedDelayMinutes, note }) {
  return {
    pricingMode: 'quote_only',
    currency,
    basePrice: null,
    minPrice: null,
    estimatedDelayMinutes,
    note: note || 'Cette prestation est établie sur devis. Un conseiller Teranga vous recontactera avant intervention.',
  };
}

// Surcharge distance (docs/DEV_SPEC_TERANGA_v6_PHASE3.md §2) : n'ajoute rien si retrait/dépose
// ou pricePerKm manquent — comportement forfait fixe inchangé pour toutes les autres filières.
function computeDistanceSurcharge(rule, { pickupLatitude, pickupLongitude, destinationLatitude, destinationLongitude }) {
  const pricePerKm = rule.pricePerKm != null ? Number(rule.pricePerKm) : 0;
  if (!pricePerKm) return { distanceKm: null, surcharge: 0 };

  const hasPickup = Number.isFinite(pickupLatitude) && Number.isFinite(pickupLongitude);
  const hasDestination = Number.isFinite(destinationLatitude) && Number.isFinite(destinationLongitude);
  if (!hasPickup || !hasDestination) return { distanceKm: null, surcharge: 0 };

  const distanceKm = haversineDistanceMeters(pickupLatitude, pickupLongitude, destinationLatitude, destinationLongitude) / 1000;
  return { distanceKm, surcharge: pricePerKm * distanceKm };
}

function buildFixedEstimateResponse(rule, currency, distanceParams = {}) {
  const { distanceKm, surcharge } = computeDistanceSurcharge(rule, distanceParams);
  const basePrice = rule.basePrice != null ? Number(rule.basePrice) : null;

  return {
    pricingMode: 'fixed_estimate',
    currency,
    basePrice: basePrice != null ? basePrice + surcharge : null,
    minPrice: rule.minPrice != null ? Number(rule.minPrice) : null,
    pricePerKm: rule.pricePerKm != null ? Number(rule.pricePerKm) : 0,
    distanceKm: distanceKm != null ? Number(distanceKm.toFixed(2)) : null,
    estimatedDelayMinutes: rule.estimatedDelayMinutes,
    note:
      rule.minPrice != null && Number(rule.minPrice) === Number(rule.basePrice)
        ? "Prix indicatif à partir de ce montant — confirmé sur place selon l'intervention."
        : 'Prix indicatif — confirmé sur place, le règlement reste hors application.',
  };
}

async function findBestRule({ countryId, regionId, tradeCategoryId, serviceType }) {
  const categoryWhere = tradeCategoryId
    ? { tradeCategoryId, serviceType: null }
    : { serviceType, tradeCategoryId: null };

  if (regionId) {
    const regional = await MissionPricingRule.findOne({
      where: { countryId, regionId, isActive: true, ...categoryWhere },
    });
    if (regional) return regional;
  }

  const countryWide = await MissionPricingRule.findOne({
    where: { countryId, regionId: null, isActive: true, ...categoryWhere },
  });
  if (countryWide) return countryWide;

  return MissionPricingRule.findOne({
    where: {
      countryId,
      regionId: null,
      tradeCategoryId: null,
      serviceType: null,
      isActive: true,
    },
  });
}

/**
 * @param {object} params
 * @param {object} params.user - utilisateur demandeur (client authentifié), sert de repli si
 *   countryId/regionId ne sont pas fournis explicitement
 * @param {string} params.executionType - 'agent' | 'provider'
 * @param {number|null} params.tradeCategoryId - requis si executionType === 'provider'
 * @param {string|null} params.serviceType - requis si executionType === 'agent'
 * @param {number|null} [params.countryId] - pays de DESTINATION de la mission (géocodé), prime sur
 *   celui du compte — correction transfrontalière : le tarif suit où la mission a lieu, pas le
 *   compte du demandeur (docs/DEV_SPEC_TERANGA_v3.md).
 * @param {number|null} [params.regionId] - région de destination, même règle
 * @param {number|null} [params.destinationLatitude] - dépose, pour la surcharge distance (§2)
 * @param {number|null} [params.destinationLongitude]
 * @param {number|null} [params.pickupLatitude] - retrait, pour la surcharge distance (§2)
 * @param {number|null} [params.pickupLongitude]
 */
async function estimateMission({
  user,
  executionType,
  tradeCategoryId,
  serviceType,
  countryId: explicitCountryId,
  regionId: explicitRegionId,
  destinationLatitude,
  destinationLongitude,
  pickupLatitude,
  pickupLongitude,
}) {
  const countryId = explicitCountryId ?? user?.countryId ?? null;
  const regionId = explicitRegionId ?? user?.regionId ?? null;

  if (!countryId) {
    return buildQuoteOnlyResponse({
      currency: FALLBACK_CURRENCY,
      estimatedDelayMinutes: FALLBACK_DELAY_MINUTES,
      note: FALLBACK_NOTE,
    });
  }

  try {
    const country = await Country.findByPk(countryId, { attributes: ['currency'] });
    const currency = country?.currency || FALLBACK_CURRENCY;

    const rule = await findBestRule({
      countryId,
      regionId,
      tradeCategoryId: executionType === 'provider' ? tradeCategoryId : null,
      serviceType: executionType === 'agent' ? serviceType : null,
    });

    if (!rule) {
      return buildQuoteOnlyResponse({
        currency,
        estimatedDelayMinutes: FALLBACK_DELAY_MINUTES,
        note: FALLBACK_NOTE,
      });
    }

    if (rule.pricingMode === 'quote_only') {
      return buildQuoteOnlyResponse({ currency, estimatedDelayMinutes: rule.estimatedDelayMinutes });
    }

    return buildFixedEstimateResponse(rule, currency, {
      pickupLatitude,
      pickupLongitude,
      destinationLatitude,
      destinationLongitude,
    });
  } catch (err) {
    logger.warn({ err }, 'priceEstimate.service.failed');
    return buildQuoteOnlyResponse({
      currency: FALLBACK_CURRENCY,
      estimatedDelayMinutes: FALLBACK_DELAY_MINUTES,
      note: FALLBACK_NOTE,
    });
  }
}

module.exports = { estimateMission };
