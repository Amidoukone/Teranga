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

const CountriesService = {
  getCountries,
  createCountry,
  updateCountry,
};

export default CountriesService;
