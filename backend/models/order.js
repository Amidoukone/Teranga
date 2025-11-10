// backend/src/models/order.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  /**
   * ============================================================
   * 🧾 MODEL : Order
   * ============================================================
   * - Gère les commandes de la boutique Teranga (module commercial)
   * - Relations :
   *    • User (client / créateur) → alias : 'customer' (frontend)
   *    • OrderItem (articles)
   *    • Transaction (paiements liés)
   *    • Evidence (preuves / justificatifs)
   * - Cohérence totale avec :
   *    • backend/controllers/order.controller.js
   *    • frontend/pages/OrderDetailPage.js
   * ============================================================
   */
  class Order extends Model {
    static associate(models) {
      /**
       * 👤 Lien vers l’utilisateur (client)
       * ------------------------------------------------------------
       * 🔹 alias = 'customer' pour cohérence avec le frontend
       * 🔹 permet : order.customer.firstName / .lastName / .email
       * 🔹 l’ancien alias 'user' reste supporté en fallback
       */
      Order.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'customer',
        onDelete: 'CASCADE',
      });

      // 🔁 Compatibilité ascendante (anciennes requêtes as: 'user')
      Order.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
        onDelete: 'CASCADE',
      });

      /**
       * 🧩 Articles de commande
       * ------------------------------------------------------------
       * - Chaque commande peut contenir plusieurs OrderItem
       */
      Order.hasMany(models.OrderItem, {
        foreignKey: 'orderId',
        as: 'items',
        onDelete: 'CASCADE',
      });

      /**
       * 💰 Transactions liées
       * ------------------------------------------------------------
       * - Une commande peut avoir plusieurs transactions (paiements)
       * - Les transactions sont conservées même si la commande est supprimée
       */
      Order.hasMany(models.Transaction, {
        foreignKey: 'orderId',
        as: 'transactions',
        onDelete: 'SET NULL',
      });

      /**
       * 📎 Preuves / Justificatifs (fichiers uploadés)
       * ------------------------------------------------------------
       * - Utilisés pour les preuves de commande (photos, reçus, etc.)
       * - Les fichiers restent même si la commande est supprimée
       */
      Order.hasMany(models.Evidence, {
        foreignKey: 'orderId',
        as: 'evidences',
        onDelete: 'SET NULL',
      });
    }
  }

  Order.init(
    {
      // 🔗 Clé étrangère utilisateur (client)
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        comment: 'Référence du client ayant passé la commande',
      },

      // 🧾 Code unique lisible (auto-généré)
      code: {
        type: DataTypes.STRING(40),
        allowNull: false,
        unique: true,
        comment: 'Code de commande lisible (ex: CMD-20251108-1234)',
      },

      // 💰 Montants financiers
      subtotal: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      shipping: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      tax: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      total: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      currency: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'XOF',
      },

      /**
       * ============================================================
       * 📦 STATUTS — Compatibilité complète avec le frontend
       * ============================================================
       * - 'created'     : Commande créée mais non traitée
       * - 'processing'  : En cours de traitement
       * - 'paid'        : Paiement confirmé
       * - 'shipped'     : Expédiée
       * - 'fulfilled'   : Livrée / confirmée par le client
       * - 'delivered'   : Livraison finale validée
       * - 'cancelled'   : Annulée
       * - 'refunded'    : Remboursée
       * ------------------------------------------------------------
       * ⚠️ Synchronisé avec utils/labels.js et frontend/statusLabels
       * ============================================================
       */
      status: {
        type: DataTypes.ENUM(
          'created',
          'processing',
          'paid',
          'shipped',
          'fulfilled',
          'delivered',
          'cancelled',
          'refunded'
        ),
        allowNull: false,
        defaultValue: 'created',
      },

      /**
       * ============================================================
       * 💳 STATUTS DE PAIEMENT
       * ============================================================
       * - 'unpaid'   : Non payée
       * - 'paid'     : Payée totalement
       * - 'partial'  : Paiement partiel
       * - 'refunded' : Remboursée
       * ============================================================
       */
      paymentStatus: {
        type: DataTypes.ENUM('unpaid', 'paid', 'partial', 'refunded'),
        allowNull: false,
        defaultValue: 'unpaid',
      },

      // 💳 Informations de paiement
      paymentMethod: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'Méthode de paiement (Mobile Money, carte, etc.)',
      },
      paymentRef: {
        type: DataTypes.STRING(120),
        allowNull: true,
        comment: 'Référence transactionnelle ou numéro de reçu',
      },

      // 🏠 Adresses (JSON flexible)
      shippingAddress: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Adresse de livraison',
      },
      billingAddress: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Adresse de facturation',
      },

      // 📝 Notes client / interne
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Notes saisies par le client ou l’agent',
      },
    },
    {
      sequelize,
      modelName: 'Order',
      tableName: 'orders',
      underscored: true,

      /**
       * ============================================================
       * 📈 INDEXES pour performance
       * ============================================================
       */
      indexes: [
        { fields: ['user_id'] },
        { fields: ['code'], unique: true },
        { fields: ['status'] },
        { fields: ['payment_status'] },
      ],

      /**
       * ============================================================
       * ⚙️ HOOKS Sequelize
       * ============================================================
       * - Génération de code unique CMD-YYYYMMDD-XXXX
       * - Calcul automatique du total (subtotal + tax + shipping)
       * ============================================================
       */
      hooks: {
        /**
         * 🧾 Génère un code unique de commande avant validation
         * Format : CMD-YYYYMMDD-XXXX
         */
        beforeValidate: async (order) => {
          if (!order.code) {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const random = Math.floor(Math.random() * 10000)
              .toString()
              .padStart(4, '0');
            order.code = `CMD-${year}${month}${day}-${random}`;
          }
        },

        /**
         * 💰 Recalcule automatiquement le total avant sauvegarde
         * total = subtotal + tax + shipping
         */
        beforeSave: (order) => {
          const subtotal = parseFloat(order.subtotal || 0);
          const tax = parseFloat(order.tax || 0);
          const shipping = parseFloat(order.shipping || 0);
          const total = subtotal + tax + shipping;
          order.total = Number(total.toFixed(2));
        },
      },
    }
  );

  return Order;
};
