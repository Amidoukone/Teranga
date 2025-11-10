'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('products', {
      id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      category_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true,
        references: { model: 'categories', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL'
      },

      name: { type: Sequelize.STRING(180), allowNull: false },
      slug: { type: Sequelize.STRING(220), allowNull: false, unique: true },
      sku: { type: Sequelize.STRING(80), allowNull: true, unique: true },

      price: { type: Sequelize.DECIMAL(12,2), allowNull: false, defaultValue: 0 },
      currency: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'XOF' },

      stock: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },

      short_description: { type: Sequelize.STRING(500), allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      cover_image: { type: Sequelize.STRING, allowNull: true },
      gallery: { type: Sequelize.JSON, allowNull: true },

      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('products');
  }
};
