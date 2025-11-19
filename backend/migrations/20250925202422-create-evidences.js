'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('evidences', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
      },

      // 🔗 Relations logiques (sans contraintes FK)
      taskId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false
      },
      uploaderId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true
      },

      // 📄 Métadonnées fichier
      kind: {
        type: Sequelize.ENUM('photo', 'document', 'receipt', 'other'),
        allowNull: false,
        defaultValue: 'document'
      },
      mimeType: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      originalName: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      filePath: {
        type: Sequelize.STRING(1024),
        allowNull: false // ex: /uploads/evidences/xxxx.jpg
      },
      fileSize: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true // bytes
      },
      thumbnailPath: {
        type: Sequelize.STRING(1024),
        allowNull: true // miniature optionnelle
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    await queryInterface.addIndex('evidences', ['taskId']);
    await queryInterface.addIndex('evidences', ['uploaderId']);
    await queryInterface.addIndex('evidences', ['createdAt']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('evidences');
  }
};
