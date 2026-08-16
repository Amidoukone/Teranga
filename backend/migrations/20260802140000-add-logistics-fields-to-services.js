'use strict';

// Sous-mission mobilité interne, Cas 1 (docs/DEV_SPEC_TERANGA_v5_PHASE2.md §4). `address`/
// `latitude`/`longitude` existants restent la DÉPOSE — cohérent avec la décision déjà actée pour
// la livraison. Colonnes additives camelCase, cohérentes avec le reste de cette table historique
// (thresholdAlertSentAt, executionType...). `parentServiceId` : association logique (pas de FK
// physique), même convention que providerId/tradeCategoryId déjà sur cette table.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('services');

    if (!Object.prototype.hasOwnProperty.call(table, 'parentServiceId')) {
      await queryInterface.addColumn('services', 'parentServiceId', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
      });
    }
    if (!Object.prototype.hasOwnProperty.call(table, 'pickupAddress')) {
      await queryInterface.addColumn('services', 'pickupAddress', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
    if (!Object.prototype.hasOwnProperty.call(table, 'pickupLatitude')) {
      await queryInterface.addColumn('services', 'pickupLatitude', {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
      });
    }
    if (!Object.prototype.hasOwnProperty.call(table, 'pickupLongitude')) {
      await queryInterface.addColumn('services', 'pickupLongitude', {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
      });
    }

    const indexes = await queryInterface.showIndex('services');
    const existingIndexNames = new Set(indexes.map((idx) => idx.name));
    if (!existingIndexNames.has('idx_services_parentServiceId')) {
      await queryInterface.addIndex('services', ['parentServiceId'], {
        name: 'idx_services_parentServiceId',
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('services');

    try {
      await queryInterface.removeIndex('services', 'idx_services_parentServiceId');
    } catch (e) {
      // index déjà absent
    }

    if (Object.prototype.hasOwnProperty.call(table, 'pickupLongitude')) {
      await queryInterface.removeColumn('services', 'pickupLongitude');
    }
    if (Object.prototype.hasOwnProperty.call(table, 'pickupLatitude')) {
      await queryInterface.removeColumn('services', 'pickupLatitude');
    }
    if (Object.prototype.hasOwnProperty.call(table, 'pickupAddress')) {
      await queryInterface.removeColumn('services', 'pickupAddress');
    }
    if (Object.prototype.hasOwnProperty.call(table, 'parentServiceId')) {
      await queryInterface.removeColumn('services', 'parentServiceId');
    }
  },
};
