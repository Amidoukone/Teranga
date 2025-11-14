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

/* ============================================================
   👤 Rôles utilisateur
============================================================ */
export const ROLE_LABELS = {
  client: 'Client',
  agent: 'Agent',
  admin: 'Administrateur',
};

/* ============================================================
   🏗 Projets
   (aligné avec backend Project + PROJECT_STATUSES du controller)
============================================================ */
export const PROJECT_TYPES = {
  immobilier: 'Immobilier',
  agricole: 'Agricole',
  commerce: 'Commerce',
  autre: 'Autre',
};

export const PROJECT_STATUSES = {
  created: 'Créé',
  in_progress: 'En cours',
  completed: 'Terminé',
  validated: 'Validé',
  cancelled: 'Annulé',
};

/* ============================================================
   🏡 Biens immobiliers
============================================================ */
export const PROPERTY_TYPES = {
  house: 'Maison',
  apartment: 'Appartement',
  land: 'Terrain',
  commercial: 'Local commercial',
};

export const PROPERTY_STATUSES = {
  active: 'Actif',
  inactive: 'Inactif',
  sold: 'Vendu',
};

/* ============================================================
   🧾 Services
============================================================ */
export const SERVICE_TYPES = {
  errand: 'Course / Commission',
  administrative: 'Démarche administrative',
  payment: 'Paiement',
  money_transfer: 'Transfert d’argent',
  other: 'Autre service',
};

export const SERVICE_STATUSES = {
  created: 'Créé',
  in_progress: 'En cours',
  completed: 'Terminé',
  validated: 'Validé',
};

/* ============================================================
   🧰 Tâches
============================================================ */
export const TASK_TYPES = {
  repair: 'Réparation',
  visit: 'Visite / Inspection',
  administrative: 'Démarche administrative',
  shopping: 'Achat / Courses',
  other: 'Autre tâche',
};

export const TASK_PRIORITIES = {
  normal: 'Normale',
  urgent: 'Urgente',
  critical: 'Critique',
};

export const TASK_STATUSES = {
  created: 'Créée',
  in_progress: 'En cours',
  completed: 'Terminée',
  validated: 'Validée',
  cancelled: 'Annulée',
};

/* ============================================================
   📄 Preuves / fichiers
============================================================ */
export const EVIDENCE_KINDS = {
  photo: 'Photo',
  document: 'Document',
  receipt: 'Reçu',
  other: 'Autre',
};

/* ============================================================
   💰 Transactions
============================================================ */
export const TRANSACTION_TYPES = {
  revenue: 'Revenu',
  expense: 'Dépense',
  commission: 'Commission',
  adjustment: 'Ajustement',
};

export const TRANSACTION_STATUSES = {
  pending: 'En attente',
  completed: 'Effectuée',
  cancelled: 'Annulée',
};

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

export const CURRENCY_LABELS = {
  XOF: 'Franc CFA (XOF)',
  EUR: 'Euro (€)',
  USD: 'Dollar US ($)',
  GBP: 'Livre sterling (£)',
};

/* ============================================================
   🛒 Commerce : Catégories / Produits / Commandes
============================================================ */
// Catégories
export const CATEGORY_STATUSES = {
  active: 'Active',
  inactive: 'Inactive',
};

// Produits
export const PRODUCT_STATUSES = {
  active: 'Actif',
  inactive: 'Inactif',
  archived: 'Archivé',
};

/**
 * ⚠️ IMPORTANT : Statuts de commande canoniques = EXACTEMENT ceux de la DB
 * Backend (ENUM): 'created','paid','processing','shipped','delivered','cancelled','refunded'
 */
export const ORDER_STATUSES = {
  created: 'Créée',
  processing: 'En traitement',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  paid: 'Payée',
  cancelled: 'Annulée',
  refunded: 'Remboursée',
};

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
export const PAYMENT_STATUSES = {
  unpaid: 'Non payée',
  partial: 'Partiellement payée',
  paid: 'Payée',
  refunded: 'Remboursée',
};

/**
 * 🔁 Aliases paiement UI -> Canonique
 */
export const PAYMENT_STATUS_ALIASES = {
  chargeback: 'refunded',
};

/**
 * 🧩 Articles de commande
 */
export const ORDER_ITEM_STATUSES = {
  pending: 'En attente',
  prepared: 'Préparé',
  fulfilled: 'Expédié / Livré',
  backordered: 'En attente de stock',
  returned: 'Retourné',
  cancelled: 'Annulé',
};

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
