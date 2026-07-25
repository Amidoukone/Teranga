'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Idempotent : même pattern que 20251102182506-add-orderId-to-transactions.js
    const table = await queryInterface.describeTable('evidences');

    if (!Object.prototype.hasOwnProperty.call(table, 'order_id')) {
      await queryInterface.addColumn('evidences', 'order_id', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        // Pas de "references" pour rester portable.
      });
    }

    const indexes = await queryInterface.showIndex('evidences');
    const hasOrderIdIndex = indexes.some((idx) => idx.name === 'idx_evidences_order_id');
    if (!hasOrderIdIndex) {
      await queryInterface.addIndex('evidences', ['order_id'], {
        name: 'idx_evidences_order_id',
      });
    }
  },

  async down(queryInterface) {
    const indexes = await queryInterface.showIndex('evidences');
    const hasOrderIdIndex = indexes.some((idx) => idx.name === 'idx_evidences_order_id');
    if (hasOrderIdIndex) {
      await queryInterface.removeIndex('evidences', 'idx_evidences_order_id');
    }

    const table = await queryInterface.describeTable('evidences');
    if (Object.prototype.hasOwnProperty.call(table, 'order_id')) {
      await queryInterface.removeColumn('evidences', 'order_id');
    }
  },
};
