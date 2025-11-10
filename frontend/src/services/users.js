// frontend/src/services/users.js
import api from './api';

/**
 * 🔹 Récupère les utilisateurs par rôle (client, agent, admin)
 */
export async function getUsers(role, q = '') {
  const { data } = await api.get('/users', { params: { role, q } });
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
  const { data } = await api.post('/users', payload);
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
