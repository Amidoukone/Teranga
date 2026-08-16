'use strict';

// docs/DEV_SPEC_TERANGA_v4_PHASE0.md §3.2 — badge "Certifié Teranga" calculé, pas déclaratif.
// Recalcul synchrone à deux points d'entrée (clôture de mission, résolution de litige) — pas de
// job séparé, ces deux événements sont déjà les seuls moments où l'éligibilité peut changer.
// Le badge doit pouvoir repasser à false : ce n'est jamais un acquis définitif.

const { Op } = require('sequelize');
const { Provider, MissionDispute, Service } = require('../../models');
const logger = require('../utils/logger');

const BADGE_MIN_COMPLETED_MISSIONS = 15;

async function hasOpenDisputeForProvider(providerId) {
  const count = await MissionDispute.count({
    where: { status: { [Op.in]: ['open', 'investigating'] } },
    include: [{ model: Service, as: 'service', where: { providerId }, attributes: [] }],
  });
  return count > 0;
}

/**
 * Recalcule et applique l'éligibilité au badge pour un prestataire. Ne lève jamais — appelée en
 * best-effort depuis des flux critiques (clôture mission, résolution litige) qui ne doivent
 * jamais échouer à cause d'un recalcul de badge.
 */
async function recalcProviderBadge(providerId) {
  if (!providerId) return null;

  try {
    const provider = await Provider.findByPk(providerId);
    if (!provider) return null;

    const hasOpenDispute = await hasOpenDisputeForProvider(providerId);

    const eligible =
      provider.completedMissionsCount >= BADGE_MIN_COMPLETED_MISSIONS &&
      provider.disputesAgainstCount === 0 &&
      !hasOpenDispute;

    if (provider.badgeCertified !== eligible) {
      await provider.update({ badgeCertified: eligible });
    }

    return eligible;
  } catch (err) {
    logger.warn('Recalcul badge Certifié Teranga échoué:', err?.message || err);
    return null;
  }
}

module.exports = {
  BADGE_MIN_COMPLETED_MISSIONS,
  recalcProviderBadge,
};
