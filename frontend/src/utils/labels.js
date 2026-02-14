import i18n from '../i18n';

/**
 * ============================================================
 * 🌍 Dictionnaire central des labels Teranga (Frontend)
 * ============================================================
 * - Aligné avec backend/src/utils/labels.js + modèles Sequelize.
 * - Inclut des "alias" pour convertir les anciens statuts UI
 *   vers les statuts canoniques acceptés par la base.
 * - Objectif : cohérence totale backend <-> frontend.
 * ============================================================
 */

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function translateLabel(path, fallback) {
  if (!path) return fallback || '';
  try {
    if (i18n?.t) {
      const translated = i18n.t(path, { defaultValue: fallback });
      return translated ?? fallback ?? path;
    }
  } catch {
    // noop
  }
  return fallback ?? path;
}

function createLabelMap(namespace, fallbackMap) {
  return new Proxy(fallbackMap, {
    get(target, prop) {
      if (typeof prop !== 'string') return Reflect.get(target, prop);
      if (!hasOwn(target, prop)) return Reflect.get(target, prop);
      return translateLabel(`${namespace}.${prop}`, target[prop]);
    },
  });
}

/* ============================================================
   👤 Rôles utilisateur
============================================================ */
const ROLE_LABELS_BASE = {
  client: 'Client',
  agent: 'Agent',
  admin: 'Administrateur',
};
export const ROLE_LABELS = createLabelMap('roles', ROLE_LABELS_BASE);

/* ============================================================
   🏗 Projets
   (aligné avec backend Project + PROJECT_STATUSES du controller)
============================================================ */
const PROJECT_TYPES_BASE = {
  immobilier: 'Immobilier',
  agricole: 'Agricole',
  commerce: 'Commerce',
  autre: 'Autre',
};
export const PROJECT_TYPES = createLabelMap('projects.type', PROJECT_TYPES_BASE);

const PROJECT_STATUSES_BASE = {
  created: 'Créé',
  in_progress: 'En cours',
  completed: 'Terminé',
  validated: 'Validé',
  cancelled: 'Annulé',
};
export const PROJECT_STATUSES = createLabelMap(
  'projects.status',
  PROJECT_STATUSES_BASE
);

/* ============================================================
   🏡 Biens immobiliers
============================================================ */
const PROPERTY_TYPES_BASE = {
  house: 'Maison',
  apartment: 'Appartement',
  land: 'Terrain',
  commercial: 'Local commercial',
};
export const PROPERTY_TYPES = createLabelMap(
  'labels.property.types',
  PROPERTY_TYPES_BASE
);

const PROPERTY_STATUSES_BASE = {
  active: 'Actif',
  inactive: 'Inactif',
  sold: 'Vendu',
};
export const PROPERTY_STATUSES = createLabelMap(
  'labels.property.statuses',
  PROPERTY_STATUSES_BASE
);

/* ============================================================
   🧾 Services
============================================================ */
const SERVICE_TYPES_BASE = {
  errand: 'Course / Commission',
  administrative: 'Démarche administrative',
  payment: 'Paiement',
  money_transfer: 'Transfert d’argent',
  other: 'Autre service',
};
export const SERVICE_TYPES = createLabelMap('services.type', SERVICE_TYPES_BASE);

const SERVICE_STATUSES_BASE = {
  created: 'Créé',
  in_progress: 'En cours',
  completed: 'Terminé',
  validated: 'Validé',
};
export const SERVICE_STATUSES = createLabelMap(
  'services.status',
  SERVICE_STATUSES_BASE
);

/* ============================================================
   🧰 Tâches
============================================================ */
const TASK_TYPES_BASE = {
  repair: 'Réparation',
  visit: 'Visite / Inspection',
  administrative: 'Démarche administrative',
  shopping: 'Achat / Courses',
  other: 'Autre tâche',
};
export const TASK_TYPES = createLabelMap('labels.task.types', TASK_TYPES_BASE);

const TASK_PRIORITIES_BASE = {
  normal: 'Normale',
  urgent: 'Urgente',
  critical: 'Critique',
};
export const TASK_PRIORITIES = createLabelMap(
  'labels.task.priorities',
  TASK_PRIORITIES_BASE
);

const TASK_STATUSES_BASE = {
  created: 'Créée',
  in_progress: 'En cours',
  completed: 'Terminée',
  validated: 'Validée',
  cancelled: 'Annulée',
};
export const TASK_STATUSES = createLabelMap(
  'labels.task.statuses',
  TASK_STATUSES_BASE
);

/* ============================================================
   📄 Preuves / fichiers
============================================================ */
const EVIDENCE_KINDS_BASE = {
  photo: 'Photo',
  document: 'Document',
  receipt: 'Reçu',
  other: 'Autre',
};
export const EVIDENCE_KINDS = createLabelMap(
  'labels.evidence.kinds',
  EVIDENCE_KINDS_BASE
);

/* ============================================================
   💰 Transactions
============================================================ */
const TRANSACTION_TYPES_BASE = {
  revenue: 'Revenu',
  expense: 'Dépense',
  commission: 'Commission',
  adjustment: 'Ajustement',
};
export const TRANSACTION_TYPES = createLabelMap(
  'transactions.type',
  TRANSACTION_TYPES_BASE
);

const TRANSACTION_STATUSES_BASE = {
  pending: 'En attente',
  completed: 'Effectuée',
  cancelled: 'Annulée',
};
export const TRANSACTION_STATUSES = createLabelMap(
  'transactions.status',
  TRANSACTION_STATUSES_BASE
);

/**
 * 🔁 Aliases transaction UI -> Canonique (afin d’absorber l’historique UI)
 * DB accepte seulement: pending | completed | cancelled
 */
export const TRANSACTION_STATUS_ALIASES = {
  // états “en cours”
  processing: 'pending',
  in_progress: 'pending',
  awaiting: 'pending',

  // états “terminé / payé / effectué”
  done: 'completed',
  success: 'completed',
  paid: 'completed',
  fulfilled: 'completed',

  // annulations
  void: 'cancelled',
  aborted: 'cancelled',
  failed: 'cancelled',
};

const CURRENCY_LABELS_BASE = {
  XOF: 'Franc CFA (XOF)',
  XAF: 'Franc CFA (XAF)',
  EUR: 'Euro (€)',
  USD: 'Dollar US ($)',
  GBP: 'Livre sterling (£)',
};
export const CURRENCY_LABELS = createLabelMap('currency', CURRENCY_LABELS_BASE);

/* ============================================================
   🛒 Commerce : Catégories / Produits / Commandes
============================================================ */
// Catégories
const CATEGORY_STATUSES_BASE = {
  active: 'Active',
  inactive: 'Inactive',
};
export const CATEGORY_STATUSES = createLabelMap(
  'labels.category.statuses',
  CATEGORY_STATUSES_BASE
);

// Produits
const PRODUCT_STATUSES_BASE = {
  active: 'Actif',
  inactive: 'Inactif',
  archived: 'Archivé',
};
export const PRODUCT_STATUSES = createLabelMap(
  'labels.product.statuses',
  PRODUCT_STATUSES_BASE
);

/**
 * ⚠️ IMPORTANT : Statuts de commande canoniques = EXACTEMENT ceux de la DB
 * Backend (ENUM): 'created','paid','processing','shipped','delivered','cancelled','refunded'
 */
const ORDER_STATUSES_BASE = {
  created: 'Créée',
  processing: 'En traitement',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  paid: 'Payée',
  cancelled: 'Annulée',
  refunded: 'Remboursée',
};
export const ORDER_STATUSES = createLabelMap(
  'orders.status',
  ORDER_STATUSES_BASE
);

/**
 * 🔁 Aliases UI -> Canonique (pour absorber l’historique front)
 */
export const ORDER_STATUS_ALIASES = {
  draft: 'created',
  pending: 'processing',
  confirmed: 'processing',
  fulfilled: 'delivered',
  completed: 'delivered',
  failed: 'cancelled',
};

/**
 * 💳 Statuts de paiement canoniques = EXACTEMENT ceux de la DB
 * Backend (ENUM): 'unpaid','paid','refunded','partial'
 */
const PAYMENT_STATUSES_BASE = {
  unpaid: 'Non payée',
  partial: 'Partiellement payée',
  paid: 'Payée',
  refunded: 'Remboursée',
};
export const PAYMENT_STATUSES = createLabelMap(
  'orders.payment',
  PAYMENT_STATUSES_BASE
);

/**
 * 🔁 Aliases paiement UI -> Canonique
 */
export const PAYMENT_STATUS_ALIASES = {
  chargeback: 'refunded',
};

/**
 * 🧩 Articles de commande
 */
const ORDER_ITEM_STATUSES_BASE = {
  pending: 'En attente',
  prepared: 'Préparé',
  fulfilled: 'Expédié / Livré',
  backordered: 'En attente de stock',
  returned: 'Retourné',
  cancelled: 'Annulé',
};
export const ORDER_ITEM_STATUSES = createLabelMap(
  'labels.orderItem.statuses',
  ORDER_ITEM_STATUSES_BASE
);

/* ============================================================
   🧩 Utilitaires
============================================================ */

/**
 * Retourne le label français correspondant à une clé technique.
 * @param {string} key
 * @param {object} map
 * @returns {string}
 */
export function getLabel(key, map) {
  if (!key) return '';
  return map?.[key] || key;
}

/**
 * Canonicalise un statut de commande
 */
export function canonicalizeOrderStatus(key) {
  if (!key) return 'created';
  const k = String(key).trim();
  if (ORDER_STATUSES[k]) return k;
  if (ORDER_STATUS_ALIASES[k]) return ORDER_STATUS_ALIASES[k];
  return 'created';
}

/**
 * Canonicalise un statut de paiement
 */
export function canonicalizePaymentStatus(key) {
  if (!key) return 'unpaid';
  const k = String(key).trim();
  if (PAYMENT_STATUSES[k]) return k;
  if (PAYMENT_STATUS_ALIASES[k]) return PAYMENT_STATUS_ALIASES[k];
  return 'unpaid';
}

/**
 * ✅ Canonicalise un statut de transaction
 * (absorbe anciens statuts UI)
 * DB cible: 'pending' | 'completed' | 'cancelled'
 */
export function canonicalizeTransactionStatus(key) {
  if (!key) return 'pending';
  const k = String(key).trim();
  if (TRANSACTION_STATUSES[k]) return k;
  if (TRANSACTION_STATUS_ALIASES[k]) return TRANSACTION_STATUS_ALIASES[k];
  return 'pending';
}

/**
 * Canonicalise un statut générique
 */
export function canonicalizeStatus(category, key) {
  if (category === 'order') return canonicalizeOrderStatus(key);
  if (category === 'payment') return canonicalizePaymentStatus(key);
  if (category === 'transaction') return canonicalizeTransactionStatus(key);
  return key;
}

/**
 * 🔍 Détection heuristique du type d’objet pour applyLabels
 * (pour rester rétro-compatible quand la catégorie n’est pas passée)
 */
function inferCategory(item) {
  // Transaction : montant, type de transaction, orderId / projectId lié
  if (
    item.amount !== undefined ||
    (item.type && TRANSACTION_TYPES[item.type]) ||
    item.orderId !== undefined ||
    item.projectId !== undefined
  ) {
    return 'transaction';
  }

  // Commande
  if (item.orderStatus || item.paymentStatus || item.code) {
    return 'order';
  }

  // Tâche
  if (item.priority || item.taskStatus || item.taskId !== undefined) {
    return 'task';
  }

  // Service
  if (item.serviceStatus || item.serviceType || item.serviceId !== undefined) {
    return 'service';
  }

  // Projet : budget + clientId + titre
  if (
    item.budget !== undefined &&
    item.clientId !== undefined &&
    item.title !== undefined
  ) {
    return 'project';
  }

  return null;
}

/**
 * Formate un statut générique selon sa catégorie
 * (service, tâche, transaction, commande, produit…)
 * @param {string} key - statut technique (peut être alias)
 * @param {string} category - "service" | "task" | "transaction" | "order" | "payment" | "project" | ...
 */
export function formatStatus(key, category = 'service') {
  let canonical = key;
  if (category === 'order') canonical = canonicalizeOrderStatus(key);
  if (category === 'payment') canonical = canonicalizePaymentStatus(key);
  if (category === 'transaction') canonical = canonicalizeTransactionStatus(key);

  const maps = {
    project: PROJECT_STATUSES,
    service: SERVICE_STATUSES,
    task: TASK_STATUSES,
    transaction: TRANSACTION_STATUSES,
    order: ORDER_STATUSES,
    payment: PAYMENT_STATUSES,
    product: PRODUCT_STATUSES,
    category: CATEGORY_STATUSES,
    orderItem: ORDER_ITEM_STATUSES,
  };
  return getLabel(canonical, maps[category] || {});
}

/**
 * Formate une devise avec son label lisible
 * @param {string} code - ex: "XOF", "EUR"
 * @returns {string}
 */
export function formatCurrency(code) {
  return getLabel(code, CURRENCY_LABELS);
}

/**
 * Enrichit un objet avec des labels prêts pour l’affichage
 * @param {object} item
 * @param {string|null} category - optionnel ("project","transaction",...)
 */
export function applyLabels(item, category = null) {
  if (!item || typeof item !== 'object') return item;
  const enriched = { ...item };

  const cat = category || inferCategory(item);

  /* ---------- Projets ---------- */
  if (cat === 'project') {
    if (item.type && PROJECT_TYPES[item.type]) {
      enriched.typeLabel = getLabel(item.type, PROJECT_TYPES);
    }
    if (item.status && PROJECT_STATUSES[item.status]) {
      enriched.statusLabel = getLabel(item.status, PROJECT_STATUSES);
    }
  }

  /* ---------- Services ---------- */
  if (cat === 'service') {
    if (item.type && SERVICE_TYPES[item.type]) {
      enriched.typeLabel = getLabel(item.type, SERVICE_TYPES);
    }
    if (item.status && SERVICE_STATUSES[item.status]) {
      enriched.statusLabel = getLabel(item.status, SERVICE_STATUSES);
    }
  }

  /* ---------- Tâches ---------- */
  if (cat === 'task') {
    if (item.priority && TASK_PRIORITIES[item.priority]) {
      enriched.priorityLabel = getLabel(item.priority, TASK_PRIORITIES);
    }
    if (item.status && TASK_STATUSES[item.status]) {
      enriched.statusLabel = getLabel(item.status, TASK_STATUSES);
    }
  }

  /* ---------- Transactions ---------- */
  if (cat === 'transaction') {
    if (item.type && TRANSACTION_TYPES[item.type]) {
      enriched.typeLabel = getLabel(item.type, TRANSACTION_TYPES);
    }
    if (item.status) {
      const canonicalTxn = canonicalizeTransactionStatus(item.status);
      if (TRANSACTION_STATUSES[canonicalTxn]) {
        enriched.status = canonicalTxn;
        enriched.statusLabel = getLabel(canonicalTxn, TRANSACTION_STATUSES);
      }
    }
  }

  /* ---------- Commandes / paiements ---------- */
  const rawOrderStatus =
    cat === 'order' ? item.status || item.orderStatus : item.orderStatus;
  const rawPaymentStatus = item.paymentStatus;

  if (rawOrderStatus) {
    const canonicalOrder = canonicalizeOrderStatus(rawOrderStatus);
    if (ORDER_STATUSES[canonicalOrder]) {
      enriched.orderStatus = canonicalOrder;
      enriched.orderStatusLabel = getLabel(canonicalOrder, ORDER_STATUSES);
    }
  }

  if (rawPaymentStatus) {
    const canonicalPay = canonicalizePaymentStatus(rawPaymentStatus);
    if (PAYMENT_STATUSES[canonicalPay]) {
      enriched.paymentStatus = canonicalPay;
      enriched.paymentStatusLabel = getLabel(canonicalPay, PAYMENT_STATUSES);
    }
  }

  /* ---------- Commun ---------- */
  if (item.currency && CURRENCY_LABELS[item.currency]) {
    enriched.currencyLabel = getLabel(item.currency, CURRENCY_LABELS);
  }

  // Preuves
  if (item.kind && EVIDENCE_KINDS[item.kind]) {
    enriched.kindLabel = getLabel(item.kind, EVIDENCE_KINDS);
  }

  // Catégories
  if (item.categoryStatus && CATEGORY_STATUSES[item.categoryStatus]) {
    enriched.categoryStatusLabel = getLabel(
      item.categoryStatus,
      CATEGORY_STATUSES
    );
  }

  // Produits
  if (item.productStatus && PRODUCT_STATUSES[item.productStatus]) {
    enriched.productStatusLabel = getLabel(
      item.productStatus,
      PRODUCT_STATUSES
    );
  }

  // Items de commande
  if (item.itemStatus && ORDER_ITEM_STATUSES[item.itemStatus]) {
    enriched.itemStatusLabel = getLabel(
      item.itemStatus,
      ORDER_ITEM_STATUSES
    );
  }

  return enriched;
}

/* ============================================================
   📦 Export global
============================================================ */
const Labels = {
  ROLE_LABELS,
  PROJECT_TYPES,
  PROJECT_STATUSES,
  PROPERTY_TYPES,
  PROPERTY_STATUSES,
  SERVICE_TYPES,
  SERVICE_STATUSES,
  TASK_TYPES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  EVIDENCE_KINDS,
  TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
  TRANSACTION_STATUS_ALIASES,
  CURRENCY_LABELS,
  CATEGORY_STATUSES,
  PRODUCT_STATUSES,
  ORDER_STATUSES,
  ORDER_STATUS_ALIASES,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_ALIASES,
  ORDER_ITEM_STATUSES,

  // utils
  getLabel,
  formatStatus,
  formatCurrency,
  applyLabels,
  canonicalizeOrderStatus,
  canonicalizePaymentStatus,
  canonicalizeTransactionStatus,
  canonicalizeStatus,
};

export default Labels;
