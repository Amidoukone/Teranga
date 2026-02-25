// frontend/src/services/evidences.js
import api from './api';
import { getAuthHeader } from './auth';
import { mergeGeoParams } from './geo';

const UPLOAD_TIMEOUT_MS =
  Number(process.env.REACT_APP_UPLOAD_TIMEOUT_MS) || 120000;

/* ============================================================
   🛡️ Auth helper — récupère le token actif (token ou teranga_token)
   ============================================================ */
function authHeader() {
  return getAuthHeader();
}

/* ============================================================
   🔧 Helpers locaux
   ============================================================ */

/** Verifie rapidement la liste de fichiers (evite un POST vide) */
function assertFiles(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('Au moins un fichier est requis pour l’upload.');
  }
}

/** Ajoute proprement les fichiers attendus par le backend */
function appendFiles(formData, files, fieldName = 'files') {
  files.forEach((file) => {
    if (file) formData.append(fieldName, file);
  });
}

/** Normalise le retour { evidences: [] } -> [] */
function asEvidenceArray(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.evidences)) return data.evidences;
  // compat rare: API qui renverrait une seule preuve
  if (data?.evidence) return [data.evidence];
  return [];
}

/* ============================================================
   📸 PREUVES LIÉES AUX TÂCHES
   ============================================================ */

/**
 * Upload de fichiers (preuves) lies a une tache
 * Alias REST attendu cote backend: POST /api/tasks/:id/evidences
 * Important: ne PAS fixer manuellement 'Content-Type' pour laisser Axios
 *     injecter le boundary multipart automatiquement.
 *
 * @param {number|string} taskId
 * @param {File[]} files
 * @param {string} [notes]
 * @returns {Promise<Array>} Liste des preuves creees
 */
export async function uploadEvidences(taskId, files = [], notes = '') {
  if (!taskId) throw new Error('taskId requis pour upload');
  assertFiles(files);

  const formData = new FormData();
  if (notes) formData.append('notes', notes);

 // Champ canonique: "files" (et backend tolerant via anyCompat())
  appendFiles(formData, files, 'files');

  const { data } = await api.post(`/tasks/${taskId}/evidences`, formData, {
 // Ne pas definir 'Content-Type' ici ! Axios le gere.
    headers: {
      ...authHeader(),
    },
    withCredentials: true,
    timeout: UPLOAD_TIMEOUT_MS,
  });

  return asEvidenceArray(data);
}

/**
 * Recuperer toutes les preuves liees a une tache
 * GET /api/tasks/:id/evidences
 *
 * @param {number|string} taskId
 * @returns {Promise<Array>}
 */
export async function getEvidences(taskId) {
  if (!taskId) throw new Error('taskId requis pour getEvidences');

  const { data } = await api.get(`/tasks/${taskId}/evidences`, {
    headers: {
      ...authHeader(),
    },
    withCredentials: true,
    params: mergeGeoParams(),
  });

  return asEvidenceArray(data);
}

/**
 * Supprimer une preuve (tache ou commande)
 * DELETE /api/evidences/:id
 *
 * @param {number|string} evidenceId
 * @returns {Promise<object>}
 */
export async function deleteEvidence(evidenceId) {
  if (!evidenceId) throw new Error('evidenceId requis pour deleteEvidence');

  const { data } = await api.delete(`/evidences/${evidenceId}`, {
    headers: {
      ...authHeader(),
    },
    withCredentials: true,
  });

  return data;
}

/* ============================================================
   🛒 PREUVES LIÉES AUX COMMANDES (module e-commerce)
   ============================================================ */

/**
 * Upload de fichiers (preuves) lies a une commande
 * Cas dusage: le client charge son recu / preuve de virement
 * POST /api/orders/:orderId/evidences
 * Meme remarque: laisser Axios gerer le header multipart.
 *
 * @param {number|string} orderId
 * @param {File[]} files
 * @param {string} [notes]
 * @returns {Promise<Array>}
 */
export async function uploadOrderEvidences(orderId, files = [], notes = '') {
  if (!orderId) throw new Error('orderId requis pour upload');
  assertFiles(files);

  const formData = new FormData();
  if (notes) formData.append('notes', notes);

 // Champ canonique: "files" (backend tolerant via anyCompat())
  appendFiles(formData, files, 'files');

  const { data } = await api.post(`/orders/${orderId}/evidences`, formData, {
    // Surtout ne pas forcer 'Content-Type'
    headers: {
      ...authHeader(),
    },
    withCredentials: true,
    timeout: UPLOAD_TIMEOUT_MS,
  });

  return asEvidenceArray(data);
}

/**
 * Recuperer toutes les preuves liees a une commande
 * GET /api/orders/:orderId/evidences
 *
 * @param {number|string} orderId
 * @returns {Promise<Array>}
 */
export async function getOrderEvidences(orderId) {
  if (!orderId) throw new Error('orderId requis pour getOrderEvidences');

  const { data } = await api.get(`/orders/${orderId}/evidences`, {
    headers: {
      ...authHeader(),
    },
    withCredentials: true,
    params: mergeGeoParams(),
  });

  return asEvidenceArray(data);
}

/**
 * Supprimer une preuve liee a une commande (admin uniquement cote backend)
 * DELETE /api/evidences/:id
 *
 * @param {number|string} evidenceId
 * @returns {Promise<object>}
 */
export async function deleteOrderEvidence(evidenceId) {
  if (!evidenceId) throw new Error('evidenceId requis pour deleteOrderEvidence');

  const { data } = await api.delete(`/evidences/${evidenceId}`, {
    headers: {
      ...authHeader(),
    },
    withCredentials: true,
  });

  return data;
}

/* ============================================================
   📦 EXPORT GLOBAL
   ============================================================ */
const EvidencesService = {
  // Tâches
  uploadEvidences,
  getEvidences,
  deleteEvidence,

  // Commandes (commerce)
  uploadOrderEvidences,
  getOrderEvidences,
  deleteOrderEvidence,
};

export default EvidencesService;
