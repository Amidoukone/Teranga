'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Ajout de paymentMethod
    await queryInterface.addColumn('transactions', 'paymentMethod', {
      type: Sequelize.STRING(50),
      allowNull: true
    });

    // Ajout de status (PlanetScale accepte les ENUM Sequelize)
    await queryInterface.addColumn('transactions', 'status', {
      type: Sequelize.ENUM('pending', 'completed', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending'
    });

    // Ajout des index pour performance
    await queryInterface.addIndex('transactions', ['status']);
    await queryInterface.addIndex('transactions', ['paymentMethod']);
  },

  async down(queryInterface, Sequelize) {
    // Supprimer les colonnes
    await queryInterface.removeColumn('transactions', 'paymentMethod');
    await queryInterface.removeColumn('transactions', 'status');

    // Aucun cleanup ENUM pour PlanetScale (MySQL/Vitess)
    // PlanetScale gère automatiquement les enums
  }
};
