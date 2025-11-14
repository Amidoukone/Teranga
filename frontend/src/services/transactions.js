// frontend/src/services/transactions.js
import api from './api';
import { applyLabels, canonicalizeTransactionStatus } from '../utils/labels';

/**
 * ============================================================
 * 💰 Service : Transactions (Frontend)
 * ============================================================
 * - JSON si pas de fichier (évite 500 sur certaines routes backend)
 * - FormData si fichier, avec compat noms Multer ('proofFile' | 'proof' | 'file' | 'attachment')
 * - Applique automatiquement les labels
 * - Gère le statut par défaut "Effectuée" pour les transactions indépendantes
 * - Supporte orderId pour rattacher à une commande
 * - 🆕 Supporte projectId pour rattacher à un projet
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

/** Sérialise proprement un nombre (string autorisée pour décimales exactes) */
function asDecimalString(v) {
  if (v === '' || v === null || typeof v === 'undefined') return undefined;
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : undefined;
}

/** Cast d'ID numérique (string -> number) si plausible */
function asNumeric(v) {
  if (v === '' || v === null || typeof v === 'undefined') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
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
      // Fichier éventuel sous le nom testé
      if (file) fd.append(fieldName, file);

      const { data } = await api.post(url, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
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
 *  - currency?: string
 *  - paymentMethod?: string
 *  - description?: string
 *  - serviceId?: number
 *  - taskId?: number
 *  - orderId?: number
 *  - projectId?: number   // 🆕
 *  - status?: string (optionnel; si fourni, sera canonicalisé)
 *  - proofFile?: File
 */
export async function createTransaction(data) {
  const payload = {
    type: data.type,
    amount: asDecimalString(data.amount),
    currency: data.currency,
    paymentMethod: data.paymentMethod,
    description: data.description,
    serviceId: asNumeric(data.serviceId),
    taskId: asNumeric(data.taskId),
    orderId: asNumeric(data.orderId),
    projectId: asNumeric(data.projectId), // 🆕
  };

  /**
   * 💡 Logique d’harmonisation du statut (alignée avec backend) :
   * - Si un statut est explicitement fourni → on canonicalise et garde
   * - Si transaction indépendante (aucune commande ET aucun projet) → "completed"
   * - Sinon → on laisse le backend gérer (commande/projet)
   */
  if (typeof data.status !== 'undefined' && data.status !== null && data.status !== '') {
    payload.status = canonicalizeTransactionStatus(data.status);
  } else if (!payload.orderId && !payload.projectId) {
    // 🟢 Transaction indépendante = statut "Effectuée"
    payload.status = canonicalizeTransactionStatus('completed');
  }

  // 1️⃣ Pas de fichier => JSON simple (évite 500 si backend attend JSON)
  if (!(data.proofFile instanceof File)) {
    const { data: res } = await api.post('/transactions', cleanObj(payload));
    return applyLabels(res.transaction || res);
  }

  // 2️⃣ Avec fichier => multipart résilient (essaie plusieurs noms Multer)
  const res = await postMultipartResilient('/transactions', cleanObj(payload), data.proofFile);
  return applyLabels(res.transaction || res);
}

/* ------------------- API: List ---------------------------- */
export async function getTransactions(filters = {}) {
  const params = cleanObj(filters);
  const { data } = await api.get('/transactions', { params });
  const transactions = data?.transactions || data?.items || [];
  return transactions.map((t) => applyLabels(t));
}

export async function getTransactionsWithMeta(filters = {}) {
  const params = cleanObj(filters);
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
 *  - description?, paymentMethod?, status?, currency?, serviceId?, taskId?, orderId?, projectId?, type?, amount?, proofFile?
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
  if (!(updates?.proofFile instanceof File)) {
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
  const { data } = await api.get('/transactions/summary');
  return data;
}

export async function getTransactionReport(params = {}) {
  const { data } = await api.get('/transactions/report', { params: cleanObj(params) });
  return data;
}

/* ------------------- Helpers e-commerce ------------------- */
export async function createOrderTransaction(orderId, data = {}) {
  // Lien vers commande : le backend rattache au client propriétaire et gère la logique de statut.
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
 * Créer une transaction liée à un projet
 */
export async function createProjectTransaction(projectId, data = {}) {
  return createTransaction({ ...data, projectId: asNumeric(projectId) });
}

/**
 * Liste les transactions d’un projet (filtrage côté back via ?projectId=)
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
