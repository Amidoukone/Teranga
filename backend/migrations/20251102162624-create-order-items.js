'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('order_items', {
      id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      order_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false,
        references: { model: 'orders', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE'
      },
      product_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true,
        references: { model: 'products', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL'
      },

      name: { type: Sequelize.STRING(180), allowNull: false },
      sku: { type: Sequelize.STRING(80), allowNull: true },
      price: { type: Sequelize.DECIMAL(12,2), allowNull: false, defaultValue: 0 },
      quantity: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
      total: { type: Sequelize.DECIMAL(12,2), allowNull: false, defaultValue: 0 },
      meta: { type: Sequelize.JSON, allowNull: true },

      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('order_items');
  }
};
