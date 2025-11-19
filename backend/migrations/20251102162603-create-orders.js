'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('orders', {
      id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },

      // 🔗 Utilisateur (relation logique uniquement)
      user_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false
        // ❌ pas de references / onDelete / onUpdate
      },

      // Code lisible unique (ex: CMD-YYYYMMDD-XXXX)
      code: { type: Sequelize.STRING(40), allowNull: false, unique: true },

      // Montants
      subtotal: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      shipping: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      tax: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      total: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      currency: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'XOF' },

      // Statut de commande
      status: {
        type: Sequelize.ENUM(
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

      // Statut de paiement
      payment_status: {
        type: Sequelize.ENUM('unpaid', 'paid', 'partial', 'refunded'),
        allowNull: false,
        defaultValue: 'unpaid',
      },

      // Paiement
      payment_method: { type: Sequelize.STRING(50), allowNull: true },
      payment_ref: { type: Sequelize.STRING(120), allowNull: true },

      // Adresses & notes
      shipping_address: { type: Sequelize.JSON, allowNull: true },
      billing_address: { type: Sequelize.JSON, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },

      // Timestamps (underscored)
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    // Index utiles
    await queryInterface.addIndex('orders', ['user_id']);
    await queryInterface.addIndex('orders', ['code'], { unique: true });
    await queryInterface.addIndex('orders', ['status']);
    await queryInterface.addIndex('orders', ['payment_status']);
  },

  async down(queryInterface /*, Sequelize */) {
    // Supprimer d'abord les index explicites
    try { await queryInterface.removeIndex('orders', ['user_id']); } catch (e) {}
    try { await queryInterface.removeIndex('orders', ['code']); } catch (e) {}
    try { await queryInterface.removeIndex('orders', ['status']); } catch (e) {}
    try { await queryInterface.removeIndex('orders', ['payment_status']); } catch (e) {}

    // Puis la table
    await queryInterface.dropTable('orders');

    // Nettoyage ENUM (surtout Postgres ; MySQL ignore)
    try {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_orders_status";');
    } catch (e) {}
    try {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_orders_payment_status";');
    } catch (e) {}
  },
};
