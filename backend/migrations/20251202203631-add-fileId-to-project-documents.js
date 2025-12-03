'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.addColumn('project_documents', 'fileId', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    } catch (e) {
      console.log('⚠️ fileId already exists or error:', e.message);
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.removeColumn('project_documents', 'fileId');
    } catch (e) {
      console.log('⚠️ Cannot remove fileId column:', e.message);
    }
  },
};
