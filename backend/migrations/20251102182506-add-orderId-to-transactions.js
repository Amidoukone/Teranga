'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Idempotent : sur certaines bases, create-transactions.js a été modifié
    // ultérieurement pour inclure order_id directement (même pattern que
    // phaseId sur project_documents, voir 20251031110012).
    const table = await queryInterface.describeTable('transactions');

    if (!Object.prototype.hasOwnProperty.call(table, 'order_id')) {
      await queryInterface.addColumn('transactions', 'order_id', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        // Pas de "references", ni onUpdate / onDelete pour rester portable.
      });
    }

    const indexes = await queryInterface.showIndex('transactions');
    const hasOrderIdIndex = indexes.some((idx) => idx.name === 'idx_transactions_order_id');
    if (!hasOrderIdIndex) {
      await queryInterface.addIndex('transactions', ['order_id'], {
        name: 'idx_transactions_order_id',
      });
    }
  },

  async down(queryInterface) {
    const indexes = await queryInterface.showIndex('transactions');
    const hasOrderIdIndex = indexes.some((idx) => idx.name === 'idx_transactions_order_id');
    if (hasOrderIdIndex) {
      await queryInterface.removeIndex('transactions', 'idx_transactions_order_id');
    }

    const table = await queryInterface.describeTable('transactions');
    if (Object.prototype.hasOwnProperty.call(table, 'order_id')) {
      await queryInterface.removeColumn('transactions', 'order_id');
    }
  },
};
