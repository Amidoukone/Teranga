'use strict';

const MALI_TAXI_RULES = [
  { vehicleType: 'motorcycle', basePrice: 1000, pricePerKm: 200, delay: 30 },
  { vehicleType: 'car', basePrice: 1500, pricePerKm: 350, delay: 35 },
];

const MALI_DELIVERY_RULES = [
  { packageType: 'document', basePrice: 1000, pricePerKm: 200 },
  { packageType: 'small', basePrice: 1500, pricePerKm: 250 },
  { packageType: 'standard', basePrice: 2000, pricePerKm: 300 },
  { packageType: 'bulky', basePrice: 3000, pricePerKm: 400 },
];

async function findCategoryId(queryInterface, slug) {
  const [rows] = await queryInterface.sequelize.query(
    'SELECT id FROM trade_categories WHERE slug = :slug LIMIT 1',
    { replacements: { slug } }
  );
  return rows[0]?.id || null;
}

async function ruleExists(queryInterface, { countryId, tradeCategoryId, vehicleType, packageType }) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT id FROM mission_pricing_rules
     WHERE country_id = :countryId
       AND region_id IS NULL
       AND trade_category_id = :tradeCategoryId
       AND service_type IS NULL
       AND ${vehicleType ? 'vehicle_type = :vehicleType' : 'vehicle_type IS NULL'}
       AND ${packageType ? 'package_type = :packageType' : 'package_type IS NULL'}
     LIMIT 1`,
    { replacements: { countryId, tradeCategoryId, vehicleType, packageType } }
  );
  return rows.length > 0;
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const servicesTable = await queryInterface.describeTable('services');
    if (!Object.prototype.hasOwnProperty.call(servicesTable, 'package_type')) {
      await queryInterface.addColumn('services', 'package_type', {
        type: Sequelize.STRING(30),
        allowNull: true,
      });
    }

    const pricingTable = await queryInterface.describeTable('mission_pricing_rules');
    if (!Object.prototype.hasOwnProperty.call(pricingTable, 'package_type')) {
      await queryInterface.addColumn('mission_pricing_rules', 'package_type', {
        type: Sequelize.STRING(30),
        allowNull: true,
      });
    }
    if (!Object.prototype.hasOwnProperty.call(pricingTable, 'price_increment')) {
      await queryInterface.addColumn('mission_pricing_rules', 'price_increment', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      });
    }

    const pricingIndexes = await queryInterface.showIndex('mission_pricing_rules');
    const pricingIndexNames = new Set(pricingIndexes.map((index) => index.name));
    if (!pricingIndexNames.has('uniq_mission_pricing_scope_variant')) {
      await queryInterface.addIndex(
        'mission_pricing_rules',
        [
          'country_id',
          'region_id',
          'trade_category_id',
          'service_type',
          'vehicle_type',
          'package_type',
        ],
        { name: 'uniq_mission_pricing_scope_variant', unique: true }
      );
    }
    if (pricingIndexNames.has('uniq_mission_pricing_scope_vehicle')) {
      await queryInterface.removeIndex(
        'mission_pricing_rules',
        'uniq_mission_pricing_scope_vehicle'
      );
    }

    const serviceIndexes = await queryInterface.showIndex('services');
    if (!serviceIndexes.some((index) => index.name === 'idx_services_package_type')) {
      await queryInterface.addIndex('services', ['package_type'], {
        name: 'idx_services_package_type',
      });
    }

    const [maliRows] = await queryInterface.sequelize.query(
      "SELECT id FROM countries WHERE iso_code = 'ML' AND is_active = 1 LIMIT 1"
    );
    if (maliRows.length === 0) return;

    const countryId = maliRows[0].id;
    const mobilityCategoryId = await findCategoryId(queryInterface, 'mobilite');
    const deliveryCategoryId = await findCategoryId(queryInterface, 'livraison');
    const now = new Date();
    const rowsToInsert = [];

    if (mobilityCategoryId) {
      await queryInterface.sequelize.query(
        `UPDATE mission_pricing_rules
         SET price_increment = 500, updated_at = updated_at
         WHERE trade_category_id = :tradeCategoryId
           AND country_id = :countryId
           AND price_increment = 0`,
        { replacements: { tradeCategoryId: mobilityCategoryId, countryId } }
      );
      for (const rule of MALI_TAXI_RULES) {
        const exists = await ruleExists(queryInterface, {
          countryId,
          tradeCategoryId: mobilityCategoryId,
          vehicleType: rule.vehicleType,
          packageType: null,
        });
        if (exists) continue;
        rowsToInsert.push({
          country_id: countryId,
          region_id: null,
          trade_category_id: mobilityCategoryId,
          service_type: null,
          vehicle_type: rule.vehicleType,
          package_type: null,
          pricing_mode: 'fixed_estimate',
          base_price: rule.basePrice,
          min_price: rule.basePrice,
          price_per_km: rule.pricePerKm,
          price_increment: 500,
          estimated_delay_minutes: rule.delay,
          is_active: true,
          updated_by_user_id: null,
          created_at: now,
          updated_at: now,
        });
      }
    }

    if (deliveryCategoryId) {
      await queryInterface.sequelize.query(
        `UPDATE mission_pricing_rules
         SET price_increment = 500, updated_at = updated_at
         WHERE trade_category_id = :tradeCategoryId
           AND country_id = :countryId
           AND price_increment = 0`,
        { replacements: { tradeCategoryId: deliveryCategoryId, countryId } }
      );
      for (const rule of MALI_DELIVERY_RULES) {
        const exists = await ruleExists(queryInterface, {
          countryId,
          tradeCategoryId: deliveryCategoryId,
          vehicleType: null,
          packageType: rule.packageType,
        });
        if (exists) continue;
        rowsToInsert.push({
          country_id: countryId,
          region_id: null,
          trade_category_id: deliveryCategoryId,
          service_type: null,
          vehicle_type: null,
          package_type: rule.packageType,
          pricing_mode: 'fixed_estimate',
          base_price: rule.basePrice,
          min_price: rule.basePrice,
          price_per_km: rule.pricePerKm,
          price_increment: 500,
          estimated_delay_minutes: 60,
          is_active: true,
          updated_by_user_id: null,
          created_at: now,
          updated_at: now,
        });
      }
    }

    if (rowsToInsert.length > 0) {
      await queryInterface.bulkInsert('mission_pricing_rules', rowsToInsert);
    }
  },

  async down(queryInterface) {
    const serviceIndexes = await queryInterface.showIndex('services');
    if (serviceIndexes.some((index) => index.name === 'idx_services_package_type')) {
      await queryInterface.removeIndex('services', 'idx_services_package_type');
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
    if (pricingIndexNames.has('uniq_mission_pricing_scope_variant')) {
      await queryInterface.removeIndex('mission_pricing_rules', 'uniq_mission_pricing_scope_variant');
    }

    const pricingTable = await queryInterface.describeTable('mission_pricing_rules');
    if (Object.prototype.hasOwnProperty.call(pricingTable, 'price_increment')) {
      await queryInterface.removeColumn('mission_pricing_rules', 'price_increment');
    }
    if (Object.prototype.hasOwnProperty.call(pricingTable, 'package_type')) {
      await queryInterface.removeColumn('mission_pricing_rules', 'package_type');
    }

    const servicesTable = await queryInterface.describeTable('services');
    if (Object.prototype.hasOwnProperty.call(servicesTable, 'package_type')) {
      await queryInterface.removeColumn('services', 'package_type');
    }
  },
};
