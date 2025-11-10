'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('project_documents', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      // 🔗 Relations
      projectId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'projects', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      uploaderId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true, // ✅ cohérent avec onDelete: 'SET NULL'
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },

      // 📄 Métadonnées de fichier (compatibles avec le frontend)
      originalName: { type: Sequelize.STRING(255), allowNull: true }, // ex: "devis.pdf"
      filePath: { type: Sequelize.STRING(1024), allowNull: false },     // ex: "/uploads/projects/xxx.pdf"
      mimeType: { type: Sequelize.STRING(255), allowNull: true },       // ex: "application/pdf"
      fileSize: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },  // en octets

      // 📝 Champs optionnels (utiles côté back-office)
      title: { type: Sequelize.STRING(255), allowNull: true }, // ✅ optionnel (UI ne l'envoie pas)
      kind: {
        type: Sequelize.ENUM('contract', 'plan', 'report', 'photo', 'other'),
        allowNull: false,
        defaultValue: 'other',
      },
      notes: { type: Sequelize.TEXT, allowNull: true },

      // 📅 Tracking
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

    // 🔎 Index utiles
    await queryInterface.addIndex('project_documents', ['projectId']);
    await queryInterface.addIndex('project_documents', ['uploaderId']);
    await queryInterface.addIndex('project_documents', ['kind']);
    await queryInterface.addIndex('project_documents', ['createdAt']);
  },

  async down(queryInterface, Sequelize) {
    // Supprime d’abord les index
    await queryInterface.removeIndex('project_documents', ['projectId']);
    await queryInterface.removeIndex('project_documents', ['uploaderId']);
    await queryInterface.removeIndex('project_documents', ['kind']);
    await queryInterface.removeIndex('project_documents', ['createdAt']);

    // Puis la table
    await queryInterface.dropTable('project_documents');

    // Nettoyage ENUM (PostgreSQL uniquement)
    if (queryInterface.sequelize.options.dialect === 'postgres') {
      await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_project_documents_kind";`);
    }
  },
};
