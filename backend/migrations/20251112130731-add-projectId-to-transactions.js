'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Idempotent : create-transactions.js (20251012182219) inclut déjà
    // projectId depuis une modification ultérieure de cette migration
    // antérieure (même pattern que phaseId sur project_documents).
    const table = await queryInterface.describeTable('transactions');

    if (!Object.prototype.hasOwnProperty.call(table, 'projectId')) {
      await queryInterface.addColumn('transactions', 'projectId', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        // Pas de references / onDelete / onUpdate pour rester portable.
        comment: 'ID projet lié (relation logique vers projects.id)',
      });
    }

    const indexes = await queryInterface.showIndex('transactions');
    const hasProjectIdIndex = indexes.some((idx) => idx.name === 'idx_transactions_projectId');
    if (!hasProjectIdIndex) {
      await queryInterface.addIndex('transactions', ['projectId'], {
        name: 'idx_transactions_projectId',
      });
    }
  },

  async down(queryInterface) {
    const indexes = await queryInterface.showIndex('transactions');
    const hasProjectIdIndex = indexes.some((idx) => idx.name === 'idx_transactions_projectId');
    if (hasProjectIdIndex) {
      await queryInterface.removeIndex('transactions', 'idx_transactions_projectId');
    }

    const table = await queryInterface.describeTable('transactions');
    if (Object.prototype.hasOwnProperty.call(table, 'projectId')) {
      await queryInterface.removeColumn('transactions', 'projectId');
    }
  },
};
