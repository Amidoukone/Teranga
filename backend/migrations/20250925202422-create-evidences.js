'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('evidences', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      /* ============================================================
         🔗 Relations logiques
         - PAS DE FOREIGN KEY car PlanetScale ne supporte pas les FK
      ============================================================ */
      taskId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
      },
      uploaderId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
      },

      // ⭐ CORRECTIF : Ajout order_id
      order_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
      },

      /* ============================================================
         📄 Métadonnées du fichier
      ============================================================ */
      kind: {
        type: Sequelize.ENUM('photo', 'document', 'receipt', 'other'),
        allowNull: false,
        defaultValue: 'document',
      },

      mimeType: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      originalName: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },

      // ⭐ URL CDN ImageKit
      filePath: {
        type: Sequelize.STRING(1024),
        allowNull: false,
      },

      // ⭐ ID ImageKit pour deleteFile()
      fileId: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },

      fileSize: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
      },

      thumbnailPath: {
        type: Sequelize.STRING(1024),
        allowNull: true,
      },

      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      /* ============================================================
         ⏱️ Timestamps
      ============================================================ */
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

    /* ============================================================
       📌 Index optimisés
    ============================================================ */
    await queryInterface.addIndex('evidences', ['taskId']);
    await queryInterface.addIndex('evidences', ['uploaderId']);
    await queryInterface.addIndex('evidences', ['order_id']);
    await queryInterface.addIndex('evidences', ['kind']);
    await queryInterface.addIndex('evidences', ['createdAt']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('evidences');
  }
};
