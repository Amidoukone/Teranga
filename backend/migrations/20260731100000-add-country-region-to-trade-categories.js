'use strict';

// Filières scopées par pays/région (docs internes de ce chantier) : jusqu'ici TradeCategory
// était un référentiel 100% global (7 filières par défaut, seedées), ce qui empêchait un master
// de créer une filière propre à son périmètre — et rendait la filière "par défaut" incohérente
// avec le pays/région réellement concerné. NULL = filière globale (visible partout, comportement
// historique inchangé pour les filières existantes) ; countryId seul = filière disponible dans
// tout le pays ; countryId + regionId = filière limitée à cette région précise.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('trade_categories');

    if (!Object.prototype.hasOwnProperty.call(table, 'country_id')) {
      await queryInterface.addColumn('trade_categories', 'country_id', {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      });
    }

    if (!Object.prototype.hasOwnProperty.call(table, 'region_id')) {
      await queryInterface.addColumn('trade_categories', 'region_id', {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      });
    }

    const indexes = await queryInterface.showIndex('trade_categories');
    const existingNames = new Set(indexes.map((idx) => idx.name));

    if (!existingNames.has('idx_trade_categories_country_id')) {
      await queryInterface.addIndex('trade_categories', ['country_id'], {
        name: 'idx_trade_categories_country_id',
      });
    }

    if (!existingNames.has('idx_trade_categories_region_id')) {
      await queryInterface.addIndex('trade_categories', ['region_id'], {
        name: 'idx_trade_categories_region_id',
      });
    }
  },

  async down(queryInterface) {
    const indexes = await queryInterface.showIndex('trade_categories');
    const existingNames = new Set(indexes.map((idx) => idx.name));

    if (existingNames.has('idx_trade_categories_region_id')) {
      await queryInterface.removeIndex('trade_categories', 'idx_trade_categories_region_id');
    }
    if (existingNames.has('idx_trade_categories_country_id')) {
      await queryInterface.removeIndex('trade_categories', 'idx_trade_categories_country_id');
    }

    const table = await queryInterface.describeTable('trade_categories');
    if (Object.prototype.hasOwnProperty.call(table, 'region_id')) {
      await queryInterface.removeColumn('trade_categories', 'region_id');
    }
    if (Object.prototype.hasOwnProperty.call(table, 'country_id')) {
      await queryInterface.removeColumn('trade_categories', 'country_id');
    }
  },
};
