// frontend/src/services/tradeCategories.js
import api from './api';

// GET /api/v1/trade-categories — public, filières actives (docs/DEV_SPEC_TERANGA_v3.md section 3.3).
// v1-only (section 0.5) : préfixe explicite /v1.
export async function listTradeCategories() {
  const { data } = await api.get('/v1/trade-categories');
  return data?.tradeCategories || [];
}

// GET /api/v1/trade-categories/admin — admin/master, toutes les filières (actives + inactives),
// pour la page de gestion.
export async function listTradeCategoriesAdmin() {
  const { data } = await api.get('/v1/trade-categories/admin');
  return data?.tradeCategories || [];
}

// POST /api/v1/trade-categories — admin/master (pas réservé au super admin : la filière n'est
// pas scopée par pays/région, un master doit pouvoir en créer pour onboarder ses prestataires).
export async function createTradeCategory(payload) {
  const { data } = await api.post('/v1/trade-categories', payload);
  return data?.tradeCategory;
}

// PUT /api/v1/trade-categories/:id — admin/master.
export async function updateTradeCategory(id, payload) {
  const { data } = await api.put(`/v1/trade-categories/${id}`, payload);
  return data?.tradeCategory;
}

// DELETE /api/v1/trade-categories/:id — admin/master. Refusée par le backend si la filière est
// déjà utilisée (prestataires, missions, règles de tarification) : désactiver via update plutôt.
export async function deleteTradeCategory(id) {
  const { data } = await api.delete(`/v1/trade-categories/${id}`);
  return data;
}
