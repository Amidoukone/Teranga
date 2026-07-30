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
