import api from './api';
import { mergeGeoParams } from './geo';

export async function getOperations(filters = {}) {
  const { data } = await api.get('/v1/operations', { params: mergeGeoParams(filters) });
  return data;
}
export async function updateCoordination(serviceId, payload, entityType = 'service') {
  const path = entityType === 'service' ? String(serviceId) : `work/${entityType}/${serviceId}`;
  const { data } = await api.patch(`/v1/operations/${path}`, payload);
  return data.coordination;
}
export async function getAgentCapacity() {
  const { data } = await api.get('/v1/operations/agent/capacity'); return data;
}
export async function updateAgentCapacity(payload) {
  const { data } = await api.patch('/v1/operations/agent/capacity', payload); return data;
}
export async function getAgentAssignments() {
  const { data } = await api.get('/v1/operations/agent/assignments'); return data.items || [];
}
export async function advanceAssignment(type, id, payload) {
  const { data } = await api.post(`/v1/operations/work/${type}/${id}/status`, payload); return data.resource;
}
export async function getWorkProgress(type, id) {
  const { data } = await api.get(`/v1/operations/work/${type}/${id}`); return data;
}
export async function getAssignableAgents(params = {}) {
  const { data } = await api.get('/users', { params: { ...params, role: 'agent' } }); return data.users || [];
}
export async function getFieldReadiness(params = {}) {
  const { data } = await api.get('/v1/operations/readiness', { params: mergeGeoParams(params) });
  return data;
}
export async function getOperatingCatalog(params = {}) {
  const { data } = await api.get('/v1/service-catalog/admin', { params: mergeGeoParams(params) });
  return data.catalog || [];
}
export async function updateOperatingOffer(id, payload) {
  const { data } = await api.patch(`/v1/service-catalog/availabilities/${id}`, payload);
  return data.availability;
}
