// frontend/src/services/providers.js
import api from './api';

// v1-only (docs/DEV_SPEC_TERANGA_v3.md section 0.5) : préfixe explicite /v1.
export async function listProviders(params = {}) {
  const { data } = await api.get('/v1/providers', { params });
  return data?.providers || [];
}
