'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('project_documents', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      projectId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
      },

      uploaderId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
      },

      phaseId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
      },

      // Métadonnées fichier
      originalName: { type: Sequelize.STRING(255), allowNull: true },

      // ⭐ URL CDN ImageKit → très long → 2048 chars
      filePath: { type: Sequelize.STRING(2048), allowNull: false },

      // ⭐ ID ImageKit
      fileId: { type: Sequelize.STRING(255), allowNull: true },

      mimeType: { type: Sequelize.STRING(255), allowNull: true },
      fileSize: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },

      // Champs métier
      title: { type: Sequelize.STRING(255), allowNull: true },
      kind: {
        type: Sequelize.ENUM('contract', 'plan', 'report', 'photo', 'other'),
        allowNull: false,
        defaultValue: 'other',
      },
      notes: { type: Sequelize.TEXT, allowNull: true },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex('project_documents', ['projectId']);
    await queryInterface.addIndex('project_documents', ['uploaderId']);
    await queryInterface.addIndex('project_documents', ['phaseId']);
    await queryInterface.addIndex('project_documents', ['kind']);
    await queryInterface.addIndex('project_documents', ['createdAt']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('project_documents');

    if (queryInterface.sequelize.options.dialect === 'postgres') {
      await queryInterface.sequelize.query(
        `DROP TYPE IF EXISTS "enum_project_documents_kind";`
      );
    }
  },
};
