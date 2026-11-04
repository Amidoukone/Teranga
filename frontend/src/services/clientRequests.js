import api from './api';

export async function getClientRequests(filters = {}, { signal } = {}) {
  const { data } = await api.get('/v1/requests', { params: filters, signal });
  return data;
}
