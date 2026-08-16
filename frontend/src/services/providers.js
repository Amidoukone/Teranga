// frontend/src/services/providers.js
import api from './api';

// v1-only (docs/DEV_SPEC_TERANGA_v3.md section 0.5) : préfixe explicite /v1.
export async function listProviders(params = {}) {
  const { data } = await api.get('/v1/providers', { params });
  return data?.providers || [];
}

/**
 * POST /api/v1/providers — candidature (self-service) ou onboarding par un
 * admin au nom d'un compte déjà 'provider' (payload.userId requis dans ce cas).
 */
export async function createProvider(payload) {
  const { data } = await api.post('/v1/providers', payload);
  return data?.provider;
}

/**
 * PATCH /api/v1/providers/:id/status — onboarding pending→probation→active,
 * ou suspension/révocation.
 */
export async function updateProviderStatus(id, status) {
  const { data } = await api.patch(`/v1/providers/${id}/status`, { status });
  return data?.provider;
}

/**
 * GET /api/v1/providers/me — fiche du prestataire authentifié (docs/DEV_SPEC_TERANGA_v5_PHASE2.md
 * §3). Renvoie null si aucun profil prestataire n'existe pour ce compte (jamais une erreur bloquante).
 */
export async function getMyProvider() {
  try {
    const { data } = await api.get('/v1/providers/me');
    return data?.provider || null;
  } catch (_err) {
    return null;
  }
}

/**
 * PATCH /api/v1/providers/me/availability — le prestataire déclare son propre statut
 * ('available'|'busy'|'offline'), docs/DEV_SPEC_TERANGA_v5_PHASE2.md §3.2.
 */
export async function updateMyAvailability(availabilityStatus) {
  const { data } = await api.patch('/v1/providers/me/availability', { availabilityStatus });
  return data?.provider;
}

/**
 * GET /api/v1/providers/available — admin/master, chauffeurs disponibles dans le scope
 * géographique (filière Mobilité, statut active + available), docs/DEV_SPEC_TERANGA_v5_PHASE2.md §3.3.
 */
export async function listAvailableProviders() {
  const { data } = await api.get('/v1/providers/available');
  return data?.providers || [];
}
