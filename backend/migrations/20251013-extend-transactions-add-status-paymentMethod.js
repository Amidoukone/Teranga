'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Ajout de la colonne paymentMethod
    await queryInterface.addColumn('transactions', 'paymentMethod', {
      type: Sequelize.STRING(50),
      allowNull: true
    });

    // Ajout de la colonne status
    await queryInterface.addColumn('transactions', 'status', {
      type: Sequelize.ENUM('pending', 'completed', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending'
    });

    // Index utiles
    await queryInterface.addIndex('transactions', ['status']);
    await queryInterface.addIndex('transactions', ['paymentMethod']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('transactions', 'paymentMethod');
    await queryInterface.removeColumn('transactions', 'status');

    // Nettoyer l'ENUM si PostgreSQL
    if (queryInterface.sequelize.options.dialect === 'postgres') {
      await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_transactions_status";`);
    }
  }
};
