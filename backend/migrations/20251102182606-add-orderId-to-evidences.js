'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('evidences', 'order_id', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'orders',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addIndex('evidences', ['order_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('evidences', ['order_id']);
    await queryInterface.removeColumn('evidences', 'order_id');
  },
};
