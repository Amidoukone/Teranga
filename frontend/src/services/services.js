// frontend/src/services/services.js
import api from './api';
import { mergeGeoParams, mergeGeoPayload } from './geo';

/**
 * Liste des services du client connecte
 * GET /api/services/me
 */
export async function getMyServices(params = {}, options = {}) {
  const { data } = await api.get('/services/me', {
    params: mergeGeoParams(params),
  });
  const items = data.services || [];
  const pagination = data?.pagination || null;
  if (options.withPagination) {
    return { items, pagination };
  }
  return items;
}

/**
 * Liste des services assignes a lagent
 * GET /api/services/agent/services
 */
export async function getAgentServices() {
  const { data } = await api.get('/services/agent/services', {
    params: mergeGeoParams(),
  });
  return data.services || [];
}

/**
 * Liste de tous les services (admin)
 * GET /api/services
 */
export async function getAllServicesAdmin(params = {}) {
  const { data } = await api.get('/services', {
    params: mergeGeoParams(params),
  });
  return data.services || [];
}

/**
 * Detail d'un service (client proprietaire, agent assigne, admin)
 * GET /api/services/:id
 */
export async function getServiceById(id) {
  const { data } = await api.get(`/services/${id}`);
  return data.service;
}

/**
 * Creer un service (client ou admin)
 * POST /api/services
 */
export async function createService(form) {
  const rawPropertyId =
    form?.propertyId !== undefined && form?.propertyId !== ''
      ? parseInt(String(form.propertyId).trim(), 10)
      : undefined;
  const normalizedPropertyId = Number.isFinite(rawPropertyId)
    ? rawPropertyId
    : undefined;

  const normalizedBudgetRaw =
    form?.budget === '' || form?.budget === undefined || form?.budget === null
      ? undefined
      : String(form.budget).trim().replace(',', '.');
  const normalizedBudget =
    normalizedBudgetRaw === undefined ? undefined : Number(normalizedBudgetRaw);
  const normalizedCurrency =
    typeof form?.currency === 'string' && form.currency.trim()
      ? form.currency.trim().toUpperCase()
      : 'XOF';

  const payload = mergeGeoPayload({
    ...form,
    propertyId: normalizedPropertyId,
    currency: normalizedCurrency,
    budget:
      normalizedBudgetRaw === undefined || !Number.isFinite(normalizedBudget)
        ? undefined
        : normalizedBudget,
  });

  const { data } = await api.post('/services', payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  return data.service;
}

/**
 * Mettre a jour un service
 * PUT /api/services/:id
 */
export async function updateService(id, form) {
  const normalizedBudgetRaw =
    form?.budget === '' || form?.budget === undefined || form?.budget === null
      ? form?.budget
      : String(form.budget).trim().replace(',', '.');
  const normalizedBudget =
    normalizedBudgetRaw === '' || normalizedBudgetRaw === null || normalizedBudgetRaw === undefined
      ? normalizedBudgetRaw
      : Number(normalizedBudgetRaw);

  const payload = {
    ...form,
    currency:
      typeof form?.currency === 'string' && form.currency.trim()
        ? form.currency.trim().toUpperCase()
        : form?.currency,
    budget:
      normalizedBudgetRaw === '' || normalizedBudgetRaw === null || normalizedBudgetRaw === undefined
        ? normalizedBudgetRaw
        : Number.isFinite(normalizedBudget)
        ? normalizedBudget
        : form?.budget,
  };

  const { data } = await api.put(`/services/${id}`, payload, {
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
 * Agent demarre un service
 * POST /api/services/agent/services/:id/start
 */
export async function startService(id) {
  const { data } = await api.post(`/services/agent/services/${id}/start`);
  return data.service;
}

/**
 * Agent marque un service comme termine
 * POST /api/services/agent/services/:id/complete
 */
export async function completeService(id) {
  const { data } = await api.post(`/services/agent/services/${id}/complete`);
  return data.service;
}
