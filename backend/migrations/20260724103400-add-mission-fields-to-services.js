'use strict';

const { MISSION_STATUS_VALUES } = require('../src/constants/missionStatus');

// Colonnes additives sur services (camelCase, cohérent avec le reste de cette
// table historique). N'écrase pas services.status : missionStatus vit à côté,
// synchronisé par la logique applicative du Lot 2/3 (voir
// docs/DEV_SPEC_TERANGA_v3.md section 0.6.b). providerId/tradeCategoryId
// restent des associations logiques (pas de FK physique), comme
// clientId/agentId/propertyId déjà sur cette même table.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('services');

    if (!Object.prototype.hasOwnProperty.call(table, 'executionType')) {
      await queryInterface.addColumn('services', 'executionType', {
        type: Sequelize.ENUM('agent', 'provider'),
        allowNull: false,
        defaultValue: 'agent',
      });
    }

    if (!Object.prototype.hasOwnProperty.call(table, 'providerId')) {
      await queryInterface.addColumn('services', 'providerId', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
      });
    }

    if (!Object.prototype.hasOwnProperty.call(table, 'tradeCategoryId')) {
      await queryInterface.addColumn('services', 'tradeCategoryId', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
      });
    }

    if (!Object.prototype.hasOwnProperty.call(table, 'missionStatus')) {
      await queryInterface.addColumn('services', 'missionStatus', {
        type: Sequelize.ENUM(...MISSION_STATUS_VALUES),
        allowNull: true,
      });
    }

    if (!Object.prototype.hasOwnProperty.call(table, 'warrantyExpiresAt')) {
      await queryInterface.addColumn('services', 'warrantyExpiresAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    const indexes = await queryInterface.showIndex('services');
    const existingIndexNames = new Set(indexes.map((idx) => idx.name));

    const addIndexIfMissing = async (name, fields) => {
      if (!existingIndexNames.has(name)) {
        await queryInterface.addIndex('services', fields, { name });
      }
    };

    await addIndexIfMissing('idx_services_executionType', ['executionType']);
    await addIndexIfMissing('idx_services_providerId', ['providerId']);
    await addIndexIfMissing('idx_services_tradeCategoryId', ['tradeCategoryId']);
    await addIndexIfMissing('idx_services_missionStatus', ['missionStatus']);
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('services');

    const removeIndexIfExists = async (name) => {
      try {
        await queryInterface.removeIndex('services', name);
      } catch (e) {
        // index déjà absent, rien à faire
      }
    };

    await removeIndexIfExists('idx_services_missionStatus');
    await removeIndexIfExists('idx_services_tradeCategoryId');
    await removeIndexIfExists('idx_services_providerId');
    await removeIndexIfExists('idx_services_executionType');

    if (Object.prototype.hasOwnProperty.call(table, 'warrantyExpiresAt')) {
      await queryInterface.removeColumn('services', 'warrantyExpiresAt');
    }
    if (Object.prototype.hasOwnProperty.call(table, 'missionStatus')) {
      await queryInterface.removeColumn('services', 'missionStatus');
    }
    if (Object.prototype.hasOwnProperty.call(table, 'tradeCategoryId')) {
      await queryInterface.removeColumn('services', 'tradeCategoryId');
    }
    if (Object.prototype.hasOwnProperty.call(table, 'providerId')) {
      await queryInterface.removeColumn('services', 'providerId');
    }
    if (Object.prototype.hasOwnProperty.call(table, 'executionType')) {
      await queryInterface.removeColumn('services', 'executionType');
    }
  },
};
