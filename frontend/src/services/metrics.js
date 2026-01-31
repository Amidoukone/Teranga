import api from './api';

const METRICS_TOKEN = (process.env.REACT_APP_METRICS_TOKEN || '').trim();

export async function getMetrics() {
  const headers = {};
  if (METRICS_TOKEN) {
    headers['x-metrics-token'] = METRICS_TOKEN;
  }
  const response = await api.get('/metrics', { headers });
  return response.data;
}
