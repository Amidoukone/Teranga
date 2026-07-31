// frontend/src/services/missionRequests.js
import api from './api';

/**
 * Demande de mission/service invitée depuis la homepage (Lot 2).
 * Aucune session préalable : on n'envoie jamais un Authorization d'une
 * éventuelle session résiduelle (skipAuthHeader), et un 401 (mauvais PIN sur
 * un numéro déjà connu) ne doit déclencher ni refresh ni redirection globale
 * (skipAuthRefresh/skipAuthRedirect) — c'est un cas métier normal, géré
 * localement par le formulaire.
 *
 * ⚠️ `api`'s baseURL pointe vers /api (legacy, miroir de /api/v1 pour les
 * routes historiques). Ces endpoints Teranga Pro sont v1-only par design
 * (docs/DEV_SPEC_TERANGA_v3.md section 0.5) : il faut donc préfixer
 * explicitement `/v1` ici, contrairement au reste de l'app.
 *
 * POST /api/v1/mission-requests
 * -> { message, token, csrfToken, user, isNewAccount, recoveryCodes, service }
 */
export async function submitMissionRequest(payload) {
  const { data } = await api.post('/v1/mission-requests', payload, {
    skipAuthHeader: true,
    skipAuthRefresh: true,
    skipAuthRedirect: true,
  });
  return data;
}

/**
 * Filières actives (Teranga Pro) — public, GET /api/v1/trade-categories.
 * countryId/regionId optionnels (scope du compte client s'il est connecté, cf.
 * MissionCreationWizard.jsx) : renvoie les filières globales + celles scopées à ce
 * pays/région — sans ces paramètres (visiteur anonyme), uniquement les filières globales.
 */
export async function getTradeCategories({ countryId, regionId } = {}) {
  const params = {};
  if (countryId) params.countryId = countryId;
  if (regionId) params.regionId = regionId;
  const { data } = await api.get('/v1/trade-categories', { params, skipAuthHeader: true });
  return data?.tradeCategories || [];
}
