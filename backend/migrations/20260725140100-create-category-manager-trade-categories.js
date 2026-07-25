'use strict';

// Scope "filière" du rôle category_manager (docs/DEV_SPEC_TERANGA_v3.md
// section 0.6.c, décision différée au Lot 3 : "le scope géo/filière du rôle
// category_manager reste à concevoir au Lot 3"). Décision prise ici :
// - Le scope GÉOGRAPHIQUE réutilise users.countryId/regionId, déjà en place
//   pour le rôle admin scoped — pas de nouveau mécanisme (règle section 8).
// - Le scope FILIÈRE n'a pas d'équivalent existant : cette table de jointure
//   M:N (un category_manager peut auditer plusieurs filières) suit exactement
//   le pattern déjà posé par provider_trade_categories au Lot 1.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('category_manager_trade_categories', {
      user_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        primaryKey: true,
        references: { model: 'users', key: 'id' },
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

    await queryInterface.addIndex(
      'category_manager_trade_categories',
      ['trade_category_id'],
      { name: 'idx_cm_trade_categories_trade_category_id' }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('category_manager_trade_categories');
  },
};
