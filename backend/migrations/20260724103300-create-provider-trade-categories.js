'use strict';

// Table de jointure M:N (un prestataire peut couvrir plusieurs filières).
// Pas de colonne id ni de timestamps : clé primaire composite, pure table de
// jointure comme spécifiée dans docs/DEV_SPEC_TERANGA_v3.md section 3.1.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('provider_trade_categories', {
      provider_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        primaryKey: true,
        references: { model: 'providers', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      trade_category_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        primaryKey: true,
        references: { model: 'trade_categories', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
    });

    // Index inverse pour les requêtes "quels providers couvrent cette filière ?"
    // (la PK composite couvre déjà efficacement le sens provider -> filières).
    await queryInterface.addIndex('provider_trade_categories', ['trade_category_id'], {
      name: 'idx_provider_trade_categories_trade_category_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('provider_trade_categories');
  },
};
