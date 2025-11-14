'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Ajout de la colonne projectId
    await queryInterface.addColumn('transactions', 'projectId', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'projects', // table cible
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'FK → projects.id (transaction liée à un projet)',
    });

    // Index pour accélérer les jointures et filtres
    await queryInterface.addIndex('transactions', ['projectId']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('transactions', ['projectId']);
    await queryInterface.removeColumn('transactions', 'projectId');
  },
};
