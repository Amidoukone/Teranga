// frontend/src/services/regions.js
import api from './api';

export async function getRegions(params = {}) {
  const { data } = await api.get('/regions', { params });
  return data?.regions || [];
}

export async function createRegion(payload) {
  const { data } = await api.post('/regions', payload);
  return data?.region || data;
}

export async function updateRegion(id, payload) {
  const { data } = await api.put(`/regions/${id}`, payload);
  return data?.region || data;
}

const RegionsService = {
  getRegions,
  createRegion,
  updateRegion,
};

export default RegionsService;
