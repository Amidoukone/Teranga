// frontend/src/services/countries.js
import api from './api';

export async function getCountries(params = {}) {
  const { data } = await api.get('/countries', { params });
  return data?.countries || [];
}

export async function createCountry(payload) {
  const { data } = await api.post('/countries', payload);
  return data?.country || data;
}

export async function updateCountry(id, payload) {
  const { data } = await api.put(`/countries/${id}`, payload);
  return data?.country || data;
}

export async function deleteCountry(id, options = {}) {
  const force = Boolean(options?.force);
  const { data } = await api.delete(`/countries/${id}`, {
    params: force ? { force: true } : undefined,
  });
  return data;
}

const CountriesService = {
  getCountries,
  createCountry,
  updateCountry,
  deleteCountry,
};

export default CountriesService;
