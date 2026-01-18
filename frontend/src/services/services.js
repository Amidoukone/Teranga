// frontend/src/services/services.js
import api from './api';
import { mergeGeoParams, mergeGeoPayload } from './geo';

/**
 * 👤 Liste des services du client connecté
 * GET /api/services/me
 */
export async function getMyServices() {
  const { data } = await api.get('/services/me', { params: mergeGeoParams() });
  return data.services || [];
}

/**
 * 🧑‍🔧 Liste des services assignés à l’agent
 * GET /api/services/agent/services
 */
export async function getAgentServices() {
  const { data } = await api.get('/services/agent/services', {
    params: mergeGeoParams(),
  });
  return data.services || [];
}

/**
 * 🛡️ Liste de tous les services (admin)
 * GET /api/services
 */
export async function getAllServicesAdmin(params = {}) {
  const { data } = await api.get('/services', {
    params: mergeGeoParams(params),
  });
  return data.services || [];
}

/**
 * ➕ Créer un service (client ou admin)
 * POST /api/services
 */
export async function createService(form) {
  const payload = mergeGeoPayload({
    ...form,
    propertyId:
      form?.propertyId !== undefined && form.propertyId !== ''
        ? parseInt(form.propertyId, 10)
        : undefined,
    budget:
      form?.budget === '' || form?.budget === undefined
        ? undefined
        : Number(form.budget),
  });

  const { data } = await api.post('/services', payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  return data.service;
}

/**
 * ✏️ Mettre à jour un service
 * PUT /api/services/:id
 */
export async function updateService(id, form) {
  const { data } = await api.put(`/services/${id}`, form, {
    headers: { 'Content-Type': 'application/json' },
  });
  return data.service;
}

/**
 * ❌ Supprimer un service
 * DELETE /api/services/:id
 */
export async function deleteService(id) {
  const { data } = await api.delete(`/services/${id}`);
  return data;
}

/**
 * 🚀 Agent démarre un service
 * POST /api/services/agent/services/:id/start
 */
export async function startService(id) {
  const { data } = await api.post(`/services/agent/services/${id}/start`);
  return data.service;
}

/**
 * ✅ Agent marque un service comme terminé
 * POST /api/services/agent/services/:id/complete
 */
export async function completeService(id) {
  const { data } = await api.post(`/services/agent/services/${id}/complete`);
  return data.service;
}
