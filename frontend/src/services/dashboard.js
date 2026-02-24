import api from './api';
import { mergeGeoParams } from './geo';

export async function getDashboardSummary(params = {}) {
  const { data } = await api.get('/dashboard/summary', {
    params: mergeGeoParams(params),
  });
  return data;
}
