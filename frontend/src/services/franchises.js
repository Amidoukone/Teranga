// frontend/src/services/franchises.js
import api from './api';
import { mergeGeoParams, mergeGeoPayload } from './geo';

export async function getFranchises(params = {}) {
  const { data } = await api.get('/franchises', { params: mergeGeoParams(params) });
  return data?.franchises || [];
}

export async function createFranchise(payload) {
  const { data } = await api.post('/franchises', mergeGeoPayload(payload));
  return data?.franchise || data;
}

export async function updateFranchise(id, payload) {
  const { data } = await api.put(`/franchises/${id}`, mergeGeoPayload(payload));
  return data?.franchise || data;
}

const FranchisesService = {
  getFranchises,
  createFranchise,
  updateFranchise,
};

export default FranchisesService;
