'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // On inspecte la table pour éviter les doublons de colonnes
    const table = await queryInterface.describeTable('products');
    const tasks = [];

    // Ajoute cover_image si elle n'existe pas encore
    if (!table.cover_image) {
      tasks.push(
        queryInterface.addColumn('products', 'cover_image', {
          type: Sequelize.STRING,
          allowNull: true,
        })
      );
    }

    // Ajoute gallery si elle n'existe pas encore
    if (!table.gallery) {
      tasks.push(
        queryInterface.addColumn('products', 'gallery', {
          type: Sequelize.JSON,
          allowNull: true, // on laisse null, la limite 3 images sera gérée au niveau applicatif
        })
      );
    }

    if (tasks.length > 0) {
      await Promise.all(tasks);
    }
  },

  async down(queryInterface /*, Sequelize */) {
    // ⚠️ On fait un down "prudent" :
    // - On supprime uniquement gallery
    // - On laisse cover_image (évite de perdre l'image principale historique)
    const table = await queryInterface.describeTable('products');
    const tasks = [];

    if (table.gallery) {
      tasks.push(queryInterface.removeColumn('products', 'gallery'));
    }

    // Si tu veux aussi retirer cover_image dans le down, dé-commente :
    // if (table.cover_image) {
    //   tasks.push(queryInterface.removeColumn('products', 'cover_image'));
    // }

    if (tasks.length > 0) {
      await Promise.all(tasks);
    }
  },
};
