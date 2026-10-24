import api from './api';

export async function getOperationUpdates(params = {}, signal) {
  const { data } = await api.get('/v1/operations/updates', { params, signal });
  return data;
}

export async function removeOperationUpdate(item) {
  const { data } = await api.delete(`/v1/operations/updates/${item.source}/${item.id}`, { data: { version: item.version } });
  return data;
}

export async function cleanupOperationUpdates() {
  const { data } = await api.delete('/v1/operations/updates/cleanup');
  return data;
}
