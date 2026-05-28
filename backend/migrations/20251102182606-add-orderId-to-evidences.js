'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('evidences', 'order_id', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      // Pas de "references" pour rester portable.
    });

    await queryInterface.addIndex('evidences', ['order_id'], {
      name: 'idx_evidences_order_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('evidences', 'idx_evidences_order_id');
    await queryInterface.removeColumn('evidences', 'order_id');
  },
};
