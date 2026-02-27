import api from './api';

export async function getMetrics() {
  const response = await api.get('/metrics');
  return response.data;
}
