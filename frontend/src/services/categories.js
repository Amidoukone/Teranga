// frontend/src/services/categories.js
import api from './api';
import { applyLabels } from '../utils/labels';

function normalizeCategory(raw = {}) {
  // Si un jour on ajoute des champs techniques => c'est ici
  return applyLabels(raw);
}

/* -----------------------------------------------------------
 * GET /categories — retourne un tableau (compat existante)
 * --------------------------------------------------------- */
export async function getCategories(params = {}) {
  const { data } = await api.get('/categories', { params });
  const items = data?.items || data?.categories || [];
  return items.map(normalizeCategory);
}

/* -----------------------------------------------------------
 * GET /categories/:id
 * --------------------------------------------------------- */
export async function getCategoryById(id) {
  const { data } = await api.get(`/categories/${id}`);
  const category = data?.category ?? data;
  return normalizeCategory(category);
}

/* -----------------------------------------------------------
 * POST /categories
 * --------------------------------------------------------- */
export async function createCategory(payload) {
  const { data } = await api.post('/categories', payload);
  const category = data?.category ?? data;
  return normalizeCategory(category);
}

/* -----------------------------------------------------------
 * PUT /categories/:id
 * --------------------------------------------------------- */
export async function updateCategory(id, payload) {
  const { data } = await api.put(`/categories/${id}`, payload);
  const category = data?.category ?? data;
  return normalizeCategory(category);
}

/* -----------------------------------------------------------
 * DELETE /categories/:id
 * --------------------------------------------------------- */
export async function deleteCategory(id) {
  const { data } = await api.delete(`/categories/${id}`);
  return data;
}

/* -----------------------------------------------------------
 * Export groupé
 * --------------------------------------------------------- */
const CategoriesService = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
export default CategoriesService;
