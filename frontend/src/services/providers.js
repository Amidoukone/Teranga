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

export async function getProvider(id) {
  const { data } = await api.get(`/v1/providers/${id}`);
  return data;
}

export async function updateProviderDriverCompliance(id, payload) {
  const { data } = await api.patch(`/v1/providers/${id}/driver-compliance`, payload);
  return data;
}

export async function uploadProviderMobilityMedia(id, kind, file, onProgress) {
  const formData = new FormData();
  formData.append('kind', kind);
  formData.append('file', file);
  const { data } = await api.post(`/v1/providers/${id}/mobility-media`, formData, {
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) return;
      onProgress(Math.min(100, Math.round((event.loaded * 100) / event.total)));
    },
  });
  return data?.media;
}

export async function listProviderVehicles(id) {
  const { data } = await api.get(`/v1/providers/${id}/vehicles`);
  return data?.vehicles || [];
}

export async function createProviderVehicle(id, payload) {
  const { data } = await api.post(`/v1/providers/${id}/vehicles`, payload);
  return data?.vehicle;
}

export async function updateProviderVehicle(id, vehicleId, payload) {
  const { data } = await api.patch(`/v1/providers/${id}/vehicles/${vehicleId}`, payload);
  return data?.vehicle;
}

/**
 * PATCH /api/v1/providers/:id/status — cycle de vie du compte. Pour la Mobilité, la réponse
 * expose séparément l'aptitude au dispatch afin que l'activation du compte reste non bloquante.
 */
export async function updateProviderStatus(id, status) {
  const { data } = await api.patch(`/v1/providers/${id}/status`, { status });
  return data;
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
export async function updateMyAvailability(availabilityStatus, vehicleId = null) {
  const { data } = await api.patch('/v1/providers/me/availability', {
    availabilityStatus,
    ...(vehicleId ? { vehicleId: Number(vehicleId) } : {}),
  });
  return data?.provider;
}

export async function getMyDispatchPresence() {
  const { data } = await api.get('/v1/providers/me/dispatch-presence');
  return data;
}

export async function updateMyLiveLocation(payload) {
  const { data } = await api.post('/v1/providers/me/live-location', payload);
  return data;
}

/**
 * GET /api/v1/providers/available — admin/master, chauffeurs disponibles dans le scope
 * géographique (filière Mobilité, statut active + available), docs/DEV_SPEC_TERANGA_v5_PHASE2.md §3.3.
 */
export async function listAvailableProviders(params = {}) {
  const { data } = await api.get('/v1/providers/available', { params });
  return data?.providers || [];
}
