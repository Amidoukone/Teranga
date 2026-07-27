// frontend/src/services/savedLocations.js
import api from './api';

// Lieux favoris du client (docs/DEV_SPEC_TERANGA_v3.md section 4.1, étape 2). v1-only (section
// 0.5) : préfixe explicite /v1, comme missionRequests.js/missions.js.

export async function listSavedLocations() {
  const { data } = await api.get('/v1/saved-locations');
  return data?.savedLocations || [];
}

export async function createSavedLocation(payload) {
  const { data } = await api.post('/v1/saved-locations', payload);
  return data?.savedLocation;
}

export async function deleteSavedLocation(id) {
  if (!id) throw new Error('id requis pour deleteSavedLocation');
  const { data } = await api.delete(`/v1/saved-locations/${id}`);
  return data;
}
