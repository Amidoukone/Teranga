'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Ajout de la colonne order_id (relation logique vers orders)
    await queryInterface.addColumn('transactions', 'order_id', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      // ❌ PlanetScale : pas de "references", ni onUpdate / onDelete
    });

    // Index pour améliorer les recherches
    await queryInterface.addIndex('transactions', ['order_id'], {
      name: 'idx_transactions_order_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('transactions', 'idx_transactions_order_id');
    await queryInterface.removeColumn('transactions', 'order_id');
  },
};
