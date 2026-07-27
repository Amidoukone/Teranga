'use strict';

// Estimation de prix/délai pour l'étape 4 de la création de mission guidée
// (docs/DEV_SPEC_TERANGA_v3.md section 4.1). Lit `mission_pricing_rules`, une table
// éditable par les admins (global et scopés pays/région — voir missionPricingRule.controller.js
// qui réutilise backend/src/utils/geoScope.js sans nouveau code de permission). Les valeurs
// semées (backend/seeders/20260726100100-seed-mission-pricing-defaults.js) sont un point de
// départ pour le marché de Bamako, pas une grille tarifaire figée.

const { MissionPricingRule, Country } = require('../../models');
const logger = require('../utils/logger');

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

function buildFixedEstimateResponse(rule, currency) {
  return {
    pricingMode: 'fixed_estimate',
    currency,
    basePrice: rule.basePrice != null ? Number(rule.basePrice) : null,
    minPrice: rule.minPrice != null ? Number(rule.minPrice) : null,
    pricePerKm: rule.pricePerKm != null ? Number(rule.pricePerKm) : 0,
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
 * @param {object} params.user - utilisateur demandeur (client authentifié), fournit countryId/regionId
 * @param {string} params.executionType - 'agent' | 'provider'
 * @param {number|null} params.tradeCategoryId - requis si executionType === 'provider'
 * @param {string|null} params.serviceType - requis si executionType === 'agent'
 */
async function estimateMission({ user, executionType, tradeCategoryId, serviceType }) {
  const countryId = user?.countryId ?? null;
  const regionId = user?.regionId ?? null;

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

    return buildFixedEstimateResponse(rule, currency);
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
