'use strict';

/**
 * ============================================================
 * 🌍 Dictionnaire central des labels Teranga
 * ============================================================
 * - Les clés techniques (en anglais) sont celles stockées en DB.
 * - Les valeurs (en français) sont celles affichées à l’utilisateur.
 * - Objectif : cohérence totale entre backend et frontend.
 * ============================================================
 */

// -----------------------------
// 👤 Rôles utilisateur
// -----------------------------
const ROLE_LABELS = {
  client: 'Client',
  agent: 'Agent',
  admin: 'Administrateur',
};

// -----------------------------
// 🏡 Types de biens immobiliers
// -----------------------------
const PROPERTY_TYPES = {
  house: 'Maison',
  apartment: 'Appartement',
  land: 'Terrain',
  automobile: 'Automobile',
  commercial: 'Local commercial',
};

const PROPERTY_STATUSES = {
  active: 'Actif',
  inactive: 'Inactif',
  sold: 'Vendu',
};

// -----------------------------
// 🧾 Types et statuts de services
// -----------------------------
const SERVICE_TYPES = {
  errand: 'Course / Commission',
  administrative: 'Démarche administrative',
  payment: 'Paiement',
  money_transfer: 'Transfert d’argent',
  other: 'Autre service',
};

const SERVICE_TYPE_ALIASES = {
  errand: ['errand', 'errand / commission', 'course / commission'],
  administrative: ['administrative', 'administrative request', 'demarche administrative'],
  payment: ['payment', 'paiement'],
  money_transfer: ['money_transfer', 'money transfer', "transfert d'argent", 'transfert argent'],
  other: ['other', 'autre', 'autre service'],
};

const SERVICE_STATUSES = {
  created: 'Créé',
  in_progress: 'En cours',
  completed: 'Terminé',
  validated: 'Validé',
};

// -----------------------------
// 🧰 Tâches : types, priorités, statuts
// -----------------------------
const TASK_TYPES = {
  repair: 'Réparation',
  visit: 'Visite / Inspection',
  administrative: 'Démarche administrative',
  shopping: 'Achat / Courses',
  other: 'Autre tâche',
};

const TASK_PRIORITIES = {
  normal: 'Normale',
  urgent: 'Urgente',
  critical: 'Critique',
};

const TASK_STATUSES = {
  created: 'Créée',
  in_progress: 'En cours',
  completed: 'Terminée',
  validated: 'Validée',
  cancelled: 'Annulée',
};

// -----------------------------
// 📄 Preuves / fichiers
// -----------------------------
const EVIDENCE_KINDS = {
  photo: 'Photo',
  document: 'Document',
  receipt: 'Reçu',
  other: 'Autre',
};

// -----------------------------
// 💰 Transactions & devises
// -----------------------------
const TRANSACTION_TYPES = {
  revenue: 'Revenu',
  expense: 'Dépense',
  commission: 'Commission',
  adjustment: 'Ajustement',
};

const TRANSACTION_STATUSES = {
  pending: 'En attente',
  completed: 'Effectuée',
  cancelled: 'Annulée',
};

const CURRENCY_LABELS = {
  XOF: 'Franc CFA (XOF)',
  EUR: 'Euro (€)',
  USD: 'Dollar US ($)',
  GBP: 'Livre sterling (£)',
};

// 💵 Symboles utilisés par formatCurrency()
const CURRENCY_SYMBOLS = {
  XOF: 'CFA',
  EUR: '€',
  USD: '$',
  GBP: '£',
};

// -----------------------------
// 🗂️ Catégories (commerce)
// -----------------------------
const CATEGORY_STATUSES = {
  active: 'Active',
  inactive: 'Inactive',
};

function normalizeAliasKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const SERVICE_TYPE_ALIAS_LOOKUP = Object.entries(SERVICE_TYPE_ALIASES).reduce(
  (acc, [canonical, aliases]) => {
    acc[normalizeAliasKey(canonical)] = canonical;
    for (const alias of aliases) {
      acc[normalizeAliasKey(alias)] = canonical;
    }
    return acc;
  },
  {}
);

function canonicalizeServiceType(value, fallback = null) {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  if (SERVICE_TYPES[raw]) return raw;
  const normalized = normalizeAliasKey(raw);
  return SERVICE_TYPE_ALIAS_LOOKUP[normalized] || fallback;
}

/**
 * Retourne le label français correspondant à une clé technique.
 * @param {string} key
 * @param {object} map
 * @returns {string}
 */
function getLabel(key, map) {
  return map?.[key] || key || '';
}

/**
 * Retourne un symbole lisible pour une devise.
 * ex: "XOF" -> "CFA", "EUR" -> "€"
 * @param {string} code
 * @returns {string}
 */
function formatCurrency(code = 'XOF') {
  const c = String(code || '').toUpperCase().trim();
  return CURRENCY_SYMBOLS[c] || c || 'XOF';
}

// ============================================================
// 📦 Exports globaux
// ============================================================
module.exports = {
  // Maps individuels
  ROLE_LABELS,
  PROPERTY_TYPES,
  PROPERTY_STATUSES,
  SERVICE_TYPES,
  SERVICE_STATUSES,
  TASK_TYPES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  EVIDENCE_KINDS,
  CATEGORY_STATUSES,
  TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
  CURRENCY_LABELS,

  // Fonctions utilitaires
  canonicalizeServiceType,
  getLabel,
  formatCurrency,
};
