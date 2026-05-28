'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Ajout de la colonne projectId (relation logique vers projects)
    await queryInterface.addColumn('transactions', 'projectId', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      // Pas de references / onDelete / onUpdate pour rester portable.
      comment: 'ID projet lié (relation logique vers projects.id)',
    });

    // Index pour accélérer les jointures et filtres
    await queryInterface.addIndex('transactions', ['projectId'], {
      name: 'idx_transactions_projectId',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('transactions', 'idx_transactions_projectId');
    await queryInterface.removeColumn('transactions', 'projectId');
  },
};
