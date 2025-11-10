'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('transactions', 'order_id', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'orders',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    // Index pour améliorer les recherches
    await queryInterface.addIndex('transactions', ['order_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('transactions', ['order_id']);
    await queryInterface.removeColumn('transactions', 'order_id');
  },
};
