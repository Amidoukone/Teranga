'use strict';

/**
 * Machine à états d'onboarding prestataire (Teranga Pro, DEV_SPEC_TERANGA_v3.md
 * section 6 Lot 3 : "Onboarding admin (statuts pending → probation → active)").
 * Source unique de vérité, réutilisée par la migration create-providers.js
 * (Lot 1) et par provider.controller.js, même pattern que
 * src/constants/missionStatus.js.
 */
const PROVIDER_STATUS_VALUES = ['pending', 'probation', 'active', 'suspended', 'revoked'];

const PROVIDER_STATUS_TRANSITIONS = {
  pending: ['probation', 'revoked'],
  probation: ['active', 'revoked'],
  active: ['suspended', 'revoked'],
  suspended: ['active', 'revoked'],
  revoked: [], // terminal
};

function isValidProviderStatusTransition(fromStatus, toStatus) {
  return Boolean(PROVIDER_STATUS_TRANSITIONS[fromStatus]?.includes(toStatus));
}

module.exports = {
  PROVIDER_STATUS_VALUES,
  PROVIDER_STATUS_TRANSITIONS,
  isValidProviderStatusTransition,
};
