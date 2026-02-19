// frontend/src/services/users.js
import api from './api';
import { mergeGeoPayload } from './geo';

/**
 * 🔹 Récupère les utilisateurs par rôle (client, agent, admin)
 */
export async function getUsers(role, options = {}) {
  const params = { role };
  const q = options?.q?.trim();
  if (q) params.q = q;
  if (options?.adminType) params.adminType = options.adminType;
  const { data } = await api.get('/users', { params });
  return data.users || [];
}

/**
 * 🔹 Récupère un utilisateur par ID
 */
export async function getUser(id) {
  const { data } = await api.get(`/users/${id}`);
  return data.user;
}

/**
 * 🔹 Crée un utilisateur (admin only)
 */
export async function createUser(payload) {
  const { data } = await api.post('/users', mergeGeoPayload(payload));
  return data.user;
}

/**
 * 🔹 Met à jour un utilisateur (admin only)
 */
export async function updateUser(id, payload) {
  const { data } = await api.put(`/users/${id}`, payload);
  return data.user;
}

/**
 * 🔹 Supprime un utilisateur (admin only)
 */
export async function deleteUser(id) {
  const { data } = await api.delete(`/users/${id}`);
  return data;
}

/**
 * 🔐 Reset manuel du mot de passe (admin/master)
 */
export async function manualPasswordReset(id, payload) {
  const { data } = await api.post(`/users/${id}/manual-password-reset`, payload);
  return data;
}

/**
 * 📜 Historique des resets manuels (admin/master)
 */
export async function getManualPasswordResetAudit(id, limit = 20) {
  const { data } = await api.get(`/users/${id}/manual-password-reset/audit`, {
    params: { limit },
  });
  return data?.audits || [];
}
