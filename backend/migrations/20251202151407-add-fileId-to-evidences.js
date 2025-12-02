'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Ajout sécurisé de la colonne fileId
    const table = await queryInterface.describeTable('evidences');
    if (!table.fileId) {
      await queryInterface.addColumn('evidences', 'fileId', {
        type: Sequelize.STRING(255),
        allowNull: true,
        after: 'filePath'
      });
    }
  },

  async down(queryInterface) {
    // Suppression sécurisée
    const table = await queryInterface.describeTable('evidences');
    if (table.fileId) {
      await queryInterface.removeColumn('evidences', 'fileId');
    }
  }
};
