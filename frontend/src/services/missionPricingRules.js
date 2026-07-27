// frontend/src/services/missionPricingRules.js
import api from './api';

// Tarification configurable de mission (docs/DEV_SPEC_TERANGA_v3.md section 4.1). v1-only
// (section 0.5) : préfixe explicite /v1, comme missionRequests.js/missions.js.

export async function listMissionPricingRules() {
  const { data } = await api.get('/v1/mission-pricing-rules');
  return data?.pricingRules || [];
}

export async function createMissionPricingRule(payload) {
  const { data } = await api.post('/v1/mission-pricing-rules', payload);
  return data?.pricingRule;
}

export async function updateMissionPricingRule(id, payload) {
  const { data } = await api.patch(`/v1/mission-pricing-rules/${id}`, payload);
  return data?.pricingRule;
}

export async function deleteMissionPricingRule(id) {
  const { data } = await api.delete(`/v1/mission-pricing-rules/${id}`);
  return data;
}
