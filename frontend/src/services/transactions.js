// frontend/src/services/transactions.js
import api from './api';
import { applyLabels, canonicalizeTransactionStatus } from '../utils/labels';
import { mergeGeoParams, mergeGeoPayload } from './geo';

/**
 * ============================================================
 * 💰 Service : Transactions (Frontend)
 * ============================================================
 * - JSON si pas de fichier (évite 500 sur certaines routes backend)
 * - FormData si fichier, avec compat noms Multer ('proofFile' | 'proof' | 'file' | 'attachment')
 * - Applique automatiquement les labels
 * - Gere le statut par defaut "Effectuee" pour les transactions independantes
 * - Supporte orderId pour rattacher à une commande
 * - Supporte projectId pour rattacher a un projet
 * ============================================================
 */

/* ---------------- Helpers de sérialisation ---------------- */

function cleanObj(obj = {}) {
  const out = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  });
  return out;
}

/** Serialise proprement un nombre (string autorisee pour decimales exactes) */
function asDecimalString(v) {
  if (v === '' || v === null || typeof v === 'undefined') return undefined;
  if (typeof v === 'string') {
    const normalized = v.trim().replace(',', '.');
    const n = Number(normalized);
    return Number.isFinite(n) ? normalized : undefined;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  const normalized = String(v).trim().replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? String(n) : undefined;
}

/** Cast d'ID numérique (string -> number) si plausible */
function asNumeric(v) {
  if (v === '' || v === null || typeof v === 'undefined') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function isFileLike(value) {
  if (!value) return false;
  if (typeof File !== 'undefined' && value instanceof File) return true;
  if (typeof Blob !== 'undefined' && value instanceof Blob) return true;
  return (
    typeof value === 'object' &&
    typeof value.size === 'number' &&
    typeof value.type === 'string'
  );
}

/* ---------------- Noyau upload résilient ------------------ */
/**
 * Envoie un FormData en essayant plusieurs noms de champ pour le fichier
 * afin d'éviter les erreurs Multer "Unexpected field".
 */
async function postMultipartResilient(url, payloadFields = {}, file) {
  const fieldCandidates = ['proofFile', 'proof', 'file', 'attachment'];
  let lastError;

  for (const fieldName of (file ? fieldCandidates : [''])) {
    try {
      const fd = new FormData();
      // Champs simples
      Object.entries(payloadFields).forEach(([k, v]) => {
        if (v !== undefined && v !== null) fd.append(k, v);
      });
 // Fichier eventuel sous le nom teste
      if (file) fd.append(fieldName, file);

      const { data } = await api.post(url, fd);
      return data;
    } catch (err) {
      lastError = err;
      // On retente avec le prochain nom
    }
  }
  throw lastError;
}

/* ------------------- API: Create -------------------------- */
/**
 * @param {object} data
 *  - type: 'revenue'|'expense'|'commission'|'adjustment' (obligatoire)
 *  - amount: number|string (obligatoire)
 * - currencyINFO: string
 * - paymentMethodINFO: string
 * - descriptionINFO: string
 * - serviceIdINFO: number
 * - taskIdINFO: number
 * - orderIdINFO: number
 * - projectIdINFO: number // 
 * - statusINFO: string (optionnel; si fourni, sera canonicalise)
 * - proofFileINFO: File
 */
export async function createTransaction(data) {
  const payload = mergeGeoPayload({
    type: data.type,
    amount: asDecimalString(data.amount),
    currency: data.currency,
    paymentMethod: data.paymentMethod,
    description: data.description,
    serviceId: asNumeric(data.serviceId),
    taskId: asNumeric(data.taskId),
    orderId: asNumeric(data.orderId),
    projectId: asNumeric(data.projectId), // 🆕
  });

  /**
 * Logique dharmonisation du statut (alignee avec backend) :
   * - Si un statut est explicitement fourni → on canonicalise et garde
 * - Si transaction independante (aucune commande ET aucun projet) "completed"
 * - Sinon on laisse le backend gerer (commande/projet)
   */
  if (typeof data.status !== 'undefined' && data.status !== null && data.status !== '') {
    payload.status = canonicalizeTransactionStatus(data.status);
  } else if (!payload.orderId && !payload.projectId) {
 // Transaction independante = statut "Effectuee"
    payload.status = canonicalizeTransactionStatus('completed');
  }

 // 1 Pas de fichier => JSON simple (evite 500 si backend attend JSON)
  if (!isFileLike(data.proofFile)) {
    const { data: res } = await api.post('/transactions', cleanObj(payload));
    return applyLabels(res.transaction || res);
  }

 // 2 Avec fichier => multipart resilient (essaie plusieurs noms Multer)
  const res = await postMultipartResilient('/transactions', cleanObj(payload), data.proofFile);
  return applyLabels(res.transaction || res);
}

/* ------------------- API: List ---------------------------- */
export async function getTransactions(filters = {}) {
  const params = cleanObj(mergeGeoParams(filters));
  const { data } = await api.get('/transactions', { params });
  const transactions = data?.transactions || data?.items || [];
  return transactions.map((t) => applyLabels(t));
}

export async function getTransactionsWithMeta(filters = {}) {
  const params = cleanObj(mergeGeoParams(filters));
  const { data } = await api.get('/transactions', { params });
  const transactions = (data?.transactions || data?.items || []).map((t) => applyLabels(t));
  return {
    items: transactions,
    pagination: data?.pagination || null,
  };
}

/* ------------------- API: Detail -------------------------- */
export async function getTransactionById(id) {
  const { data } = await api.get(`/transactions/${id}`);
  return applyLabels(data.transaction || data);
}

/* ------------------- API: Update -------------------------- */
/**
 * @param {number} id
 * @param {object} updates
 * - descriptionINFO, paymentMethodINFO, statusINFO, currencyINFO, serviceIdINFO, taskIdINFO, orderIdINFO, projectIdINFO, typeINFO, amountINFO, proofFileINFO
 */
export async function updateTransaction(id, updates) {
  const payload = {
    ...updates,
    amount: asDecimalString(updates?.amount),
    serviceId: asNumeric(updates?.serviceId),
    taskId: asNumeric(updates?.taskId),
    orderId: asNumeric(updates?.orderId),
    projectId: asNumeric(updates?.projectId), // 🆕
  };

  // Harmonise le statut si fourni (sinon on ne touche pas)
  if (typeof updates?.status !== 'undefined' && updates.status !== null && updates.status !== '') {
    payload.status = canonicalizeTransactionStatus(updates.status);
  }

  // Pas de fichier -> JSON
  if (!isFileLike(updates?.proofFile)) {
    const { data } = await api.put(`/transactions/${id}`, cleanObj(payload));
    return applyLabels(data.transaction || data);
  }

  // Avec fichier -> multipart résilient
  const res = await postMultipartResilient(`/transactions/${id}`, cleanObj(payload), updates.proofFile);
  return applyLabels(res.transaction || res);
}

/* ------------------- API: Delete -------------------------- */
export async function deleteTransaction(id) {
  await api.delete(`/transactions/${id}`);
  return true;
}

/* ------------------- API: Stats & Report ------------------ */
export async function getFinancialSummary() {
  const { data } = await api.get('/transactions/summary', {
    params: mergeGeoParams(),
  });
  return data;
}

export async function getTransactionReport(params = {}) {
  const { data } = await api.get('/transactions/report', {
    params: cleanObj(mergeGeoParams(params)),
  });
  return data;
}

/* ------------------- Helpers e-commerce ------------------- */
export async function createOrderTransaction(orderId, data = {}) {
 // Lien vers commande : le backend rattache au client proprietaire et gere la logique de statut.
  return createTransaction({ ...data, orderId: asNumeric(orderId) });
}

export async function getOrderTransactions(orderId, filters = {}) {
  const params = cleanObj({ ...filters, orderId: asNumeric(orderId) });
  return getTransactions(params);
}

export async function getOrderTransactionsWithMeta(orderId, filters = {}) {
  const params = cleanObj({ ...filters, orderId: asNumeric(orderId) });
  return getTransactionsWithMeta(params);
}

/* ------------------- Helpers projet 🆕 -------------------- */
/**
 * Creer une transaction liee a un projet
 */
export async function createProjectTransaction(projectId, data = {}) {
  return createTransaction({ ...data, projectId: asNumeric(projectId) });
}

/**
 * Liste les transactions dun projet (filtrage cote back via INFOprojectId=)
 */
export async function getProjectTransactions(projectId, filters = {}) {
  const params = cleanObj({ ...filters, projectId: asNumeric(projectId) });
  return getTransactions(params);
}

/**
 * Liste + pagination (meta) des transactions d’un projet
 */
export async function getProjectTransactionsWithMeta(projectId, filters = {}) {
  const params = cleanObj({ ...filters, projectId: asNumeric(projectId) });
  return getTransactionsWithMeta(params);
}

/* ------------------- Export groupé ------------------------ */
const TransactionsService = {
  createTransaction,
  getTransactions,
  getTransactionsWithMeta,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  getFinancialSummary,
  getTransactionReport,

  // e-commerce
  createOrderTransaction,
  getOrderTransactions,
  getOrderTransactionsWithMeta,

  // projet 🆕
  createProjectTransaction,
  getProjectTransactions,
  getProjectTransactionsWithMeta,
};

export default TransactionsService;
