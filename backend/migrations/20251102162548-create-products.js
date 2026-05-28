'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('products', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      // Relation categorie logique uniquement, sans contrainte FK en base.
      category_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
      },

      // 🏷️ Identité
      name: { type: Sequelize.STRING(180), allowNull: false },
      slug: { type: Sequelize.STRING(220), allowNull: false, unique: true },
      sku: { type: Sequelize.STRING(80), allowNull: true, unique: true },

      // 💰 Prix
      price: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      currency: {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: 'XOF',
      },

      // 📦 Stock & statut
      stock: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      // 📝 Descriptions
      short_description: { type: Sequelize.STRING(500), allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },

      // 🖼 Image principale (ImageKit URL possible)
      cover_image: { type: Sequelize.STRING(1024), allowNull: true },

      // 🖼🖼🖼 Galerie multi-images (JSON)
      gallery: { type: Sequelize.JSON, allowNull: true },

      // 🕒 Timestamps
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    // 📌 Index recommandés
    await queryInterface.addIndex('products', ['slug']);
    await queryInterface.addIndex('products', ['sku']);
    await queryInterface.addIndex('products', ['category_id']);
    await queryInterface.addIndex('products', ['is_active']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('products');
  },
};
