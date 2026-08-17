'use strict';

// Phase 5 — le type de véhicule demandé appartient à la course, tandis que le type ciblé par
// une règle tarifaire permet de différencier Moto/Voiture. NULL conserve le comportement Phase 4
// et sert de repli pour les règles Mobilité existantes.
module.exports = {
  async up(queryInterface, Sequelize) {
    const servicesTable = await queryInterface.describeTable('services');
    if (!Object.prototype.hasOwnProperty.call(servicesTable, 'requested_vehicle_type')) {
      await queryInterface.addColumn('services', 'requested_vehicle_type', {
        type: Sequelize.STRING(20),
        allowNull: true,
      });
    }

    const pricingTable = await queryInterface.describeTable('mission_pricing_rules');
    if (!Object.prototype.hasOwnProperty.call(pricingTable, 'vehicle_type')) {
      await queryInterface.addColumn('mission_pricing_rules', 'vehicle_type', {
        type: Sequelize.STRING(20),
        allowNull: true,
      });
    }

    const pricingIndexes = await queryInterface.showIndex('mission_pricing_rules');
    const pricingIndexNames = new Set(pricingIndexes.map((index) => index.name));
    if (!pricingIndexNames.has('uniq_mission_pricing_scope_vehicle')) {
      await queryInterface.addIndex(
        'mission_pricing_rules',
        ['country_id', 'region_id', 'trade_category_id', 'service_type', 'vehicle_type'],
        { name: 'uniq_mission_pricing_scope_vehicle', unique: true }
      );
    }
    // Le nouvel index conserve les prefixes utilises par les FK MySQL. Il doit
    // exister avant le retrait de l'ancien index qui pouvait les supporter.
    if (pricingIndexNames.has('uniq_mission_pricing_scope')) {
      await queryInterface.removeIndex('mission_pricing_rules', 'uniq_mission_pricing_scope');
    }

    const serviceIndexes = await queryInterface.showIndex('services');
    if (!serviceIndexes.some((index) => index.name === 'idx_services_requested_vehicle_type')) {
      await queryInterface.addIndex('services', ['requested_vehicle_type'], {
        name: 'idx_services_requested_vehicle_type',
      });
    }
  },

  async down(queryInterface) {
    const serviceIndexes = await queryInterface.showIndex('services');
    if (serviceIndexes.some((index) => index.name === 'idx_services_requested_vehicle_type')) {
      await queryInterface.removeIndex('services', 'idx_services_requested_vehicle_type');
    }

    const pricingIndexes = await queryInterface.showIndex('mission_pricing_rules');
    const pricingIndexNames = new Set(pricingIndexes.map((index) => index.name));
    if (!pricingIndexNames.has('uniq_mission_pricing_scope')) {
      await queryInterface.addIndex(
        'mission_pricing_rules',
        ['country_id', 'region_id', 'trade_category_id', 'service_type'],
        { name: 'uniq_mission_pricing_scope', unique: true }
      );
    }
    if (pricingIndexNames.has('uniq_mission_pricing_scope_vehicle')) {
      await queryInterface.removeIndex(
        'mission_pricing_rules',
        'uniq_mission_pricing_scope_vehicle'
      );
    }

    const pricingTable = await queryInterface.describeTable('mission_pricing_rules');
    if (Object.prototype.hasOwnProperty.call(pricingTable, 'vehicle_type')) {
      await queryInterface.removeColumn('mission_pricing_rules', 'vehicle_type');
    }

    const servicesTable = await queryInterface.describeTable('services');
    if (Object.prototype.hasOwnProperty.call(servicesTable, 'requested_vehicle_type')) {
      await queryInterface.removeColumn('services', 'requested_vehicle_type');
    }
  },
};
