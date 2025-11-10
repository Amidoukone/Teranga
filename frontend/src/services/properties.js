// frontend/src/services/properties.js
import api from './api';
import { applyLabels } from '../utils/labels';

/**
 * ============================================================
 * 🌍 Service Frontend : Gestion des Biens Immobiliers (robuste)
 * ============================================================
 * - Aligne les labels FR via applyLabels
 * - Tolérant au routing backend : essaie plusieurs endpoints
 * - Compatible Admin : création d’un bien pour un client (ownerId|clientId|ownerEmail)
 * - Ne casse pas l'existant et reste évolutif
 * ============================================================
 */

async function tryEndpoints(method, candidates, options = {}) {
  let lastErr;
  for (const candidate of candidates) {
    try {
      const { data } = await api.request({
        method,
        url: candidate.url,
        ...(candidate.data ? { data: candidate.data } : {}),
        ...(candidate.params ? { params: candidate.params } : {}),
        ...(options || {}),
      });
      return data;
    } catch (err) {
      lastErr = err;
      const status = err?.response?.status;
      // On continue si "endpoint inexistant" / "méthode non supportée"
      if (status === 404 || status === 405) continue;
      // Sinon, inutile d’essayer d’autres chemins
      break;
    }
  }
  console.error('❌ API properties fallback épuisé:', lastErr || 'Unknown error');
  throw lastErr || new Error('Properties service: all endpoints failed');
}

/** 🔧 Helper : construit un FormData à partir d’un objet + fichiers */
function buildFormData(form = {}, files = [], extra = {}) {
  const formData = new FormData();

  // Champs de base (form)
  Object.entries(form).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      formData.append(key, value);
    }
  });

  // Champs supplémentaires (adminTarget, flags, etc.)
  Object.entries(extra).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      formData.append(key, value);
    }
  });

  // Fichiers
  (files || []).forEach((file) => formData.append('files', file));
  return formData;
}

/**
 * 🔹 Liste des biens du client connecté
 * Essaie plusieurs chemins possibles côté backend.
 */
export async function getProperties() {
  try {
    const data = await tryEndpoints('get', [
      { url: '/properties' },
      { url: '/properties/me' },
      { url: '/properties/mine' },
      { url: '/admin/properties?scope=me' },
      { url: '/properties', params: { owner: 'me' } },
    ]);

    const list = data.properties || data.rows || data.list || [];
    return list.map((p) => applyLabels(p));
  } catch (err) {
    console.error('❌ Erreur chargement propriétés:', err);
    return []; // On garde l’UI fonctionnelle
  }
}

/**
 * 🔹 Liste des biens d’un client spécifique (admin)
 */
export async function getClientProperties(clientId) {
  if (!clientId) return [];
  try {
    const data = await tryEndpoints('get', [
      { url: '/properties', params: { clientId } },
      { url: `/properties/client/${clientId}` },
      { url: '/admin/properties', params: { clientId } },
      { url: '/properties', params: { ownerId: clientId } },
      { url: `/properties/by-owner/${clientId}` }, // alias backend ajouté
    ]);

    const list = data.properties || data.rows || data.list || [];
    return list.map((p) => applyLabels(p));
  } catch (err) {
    console.error('❌ Erreur chargement biens client:', err);
    return [];
  }
}

/**
 * 🔹 Liste de tous les biens (admin uniquement)
 */
export async function getAllProperties() {
  try {
    const data = await tryEndpoints('get', [
      { url: '/properties', params: { all: 'true' } },
      { url: '/admin/properties' },
      { url: '/properties/all' },
    ]);

    const list = data.properties || data.rows || data.list || [];
    return list.map((p) => applyLabels(p));
  } catch (err) {
    console.error('❌ Erreur chargement biens (admin):', err);
    return [];
  }
}

/**
 * ➕ Créer un bien immobilier
 * - Client : pour lui-même (comme avant)
 * - Admin  : peut indiquer une cible (ownerId | clientId | ownerEmail) pour créer au nom d’un client
 *
 * @param {Object} form - champs du bien (title, type, address, city, etc.)
 * @param {File[]} files - fichiers image/pdf
 * @param {Object} adminTarget - (optionnel) { ownerId?, clientId?, ownerEmail? }
 *    - ownerId : id du client cible
 *    - clientId : alias accepté (sera mappé vers ownerId si besoin)
 *    - ownerEmail : email d’un client existant (géré côté backend)
 *
 * Le service va essayer, dans cet ordre, pour l’admin ciblé :
 *   1) POST /properties/client/:clientId (meilleur endpoint dédié)
 *   2) POST /properties/admin (alias admin)
 *   3) POST /properties (classique, avec ownerId/clientId/ownerEmail dans le body)
 */
export async function createProperty(form, files = [], adminTarget = null) {
  // Cas simple (client standard OU admin sans cible) => comportement historique
  if (!adminTarget || (!adminTarget.ownerId && !adminTarget.clientId && !adminTarget.ownerEmail)) {
    const formData = buildFormData(form, files);
    try {
      const data = await tryEndpoints(
        'post',
        [
          { url: '/properties', data: formData },
          { url: '/admin/properties', data: formData },
          { url: '/properties/create', data: formData },
        ],
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const created = data.property || data.item || data.result;
      return applyLabels(created);
    } catch (err) {
      console.error('❌ Erreur création bien (standard):', err);
      throw err;
    }
  }

  // Cas Admin ciblé
  const { ownerId, clientId, ownerEmail } = adminTarget;
  const targetId = clientId || ownerId || null;

  // 1) Tente la route dédiée : /properties/client/:id
  if (targetId) {
    const formDataClientParam = buildFormData(form, files);
    try {
      const data = await tryEndpoints(
        'post',
        [{ url: `/properties/client/${targetId}`, data: formDataClientParam }],
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const created = data.property || data.item || data.result;
      return applyLabels(created);
    } catch (e) {
      // On log puis on continue sur les fallbacks
      console.warn('⚠️ Fallback Admin create: /properties/client/:id non dispo, on tente alias/body…', e?.response?.status);
    }
  }

  // 2) Alias admin générique : /properties/admin (body peut contenir ownerId|clientId|ownerEmail)
  const formDataAdminAlias = buildFormData(form, files, {
    ...(ownerId ? { ownerId } : {}),
    ...(clientId ? { clientId } : {}),
    ...(ownerEmail ? { ownerEmail } : {}),
  });

  try {
    const data = await tryEndpoints(
      'post',
      [{ url: '/properties/admin', data: formDataAdminAlias }],
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    const created = data.property || data.item || data.result;
    return applyLabels(created);
  } catch (e) {
    console.warn('⚠️ Fallback Admin create: /properties/admin non dispo, on tente /properties avec body…', e?.response?.status);
  }

  // 3) Fallback ultime : /properties (classique) + ownerId|clientId|ownerEmail dans le body
  const formDataWithTarget = buildFormData(form, files, {
    ...(ownerId ? { ownerId } : {}),
    ...(clientId ? { clientId } : {}),
    ...(ownerEmail ? { ownerEmail } : {}),
  });

  try {
    const data = await tryEndpoints(
      'post',
      [
        { url: '/properties', data: formDataWithTarget },
        { url: '/admin/properties', data: formDataWithTarget },
        { url: '/properties/create', data: formDataWithTarget },
      ],
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    const created = data.property || data.item || data.result;
    return applyLabels(created);
  } catch (err) {
    console.error('❌ Erreur création bien (admin ciblé, tous fallbacks):', err);
    throw err;
  }
}

/**
 * 🆕 Convenance : créer un bien pour un client (admin)
 * - Utilise d’abord POST /properties/client/:id, puis retombe sur les autres chemins
 */
export async function createPropertyForClient(clientId, form, files = []) {
  if (!clientId) throw new Error('clientId requis pour createPropertyForClient');
  return createProperty(form, files, { clientId });
}

/**
 * ✏️ Mettre à jour un bien
 * - Vous pouvez passer replacePhotos = true dans `form` si vous voulez remplacer complètement
 *   les photos au lieu de les merger (le backend gère déjà ce flag).
 */
export async function updateProperty(id, form, files = []) {
  // On laisse la liberté de passer replacePhotos dans form (optionnel)
  const formData = buildFormData(form, files);

  try {
    const data = await tryEndpoints(
      'put',
      [
        { url: `/properties/${id}`, data: formData },
        { url: `/admin/properties/${id}`, data: formData },
        { url: `/properties/update/${id}`, data: formData },
      ],
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );

    const updated = data.property || data.item || data.result;
    return applyLabels(updated);
  } catch (err) {
    console.error('❌ Erreur mise à jour bien:', err);
    throw err;
  }
}

/**
 * ❌ Supprimer un bien
 */
export async function deleteProperty(id) {
  try {
    const data = await tryEndpoints('delete', [
      { url: `/properties/${id}` },
      { url: `/admin/properties/${id}` },
      { url: `/properties/delete/${id}` },
    ]);
    return data;
  } catch (err) {
    console.error('❌ Erreur suppression bien:', err);
    throw err;
  }
}

/**
 * 🔍 Recherche filtrée (optionnel / back-office)
 */
export async function searchProperties(params = {}) {
  try {
    const data = await tryEndpoints('get', [
      { url: '/properties', params },
      { url: '/admin/properties', params },
    ]);

    const list = data.properties || data.rows || data.list || [];
    return list.map((p) => applyLabels(p));
  } catch (err) {
    console.error('❌ Erreur recherche propriétés:', err);
    return [];
  }
}

/**
 * 📄 Détail d’un bien par ID
 */
export async function getPropertyById(id) {
  try {
    const data = await tryEndpoints('get', [
      { url: `/properties/${id}` },
      { url: `/admin/properties/${id}` },
      { url: `/properties/detail/${id}` },
    ]);

    const item = data.property || data.item || data.result;
    return item ? applyLabels(item) : null;
  } catch (err) {
    console.error('❌ Erreur récupération bien:', err);
    return null;
  }
}
