'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class MissionPricingRule extends Model {
    static associate(models) {
      MissionPricingRule.belongsTo(models.Country, { foreignKey: 'countryId', as: 'country' });

      if (models.Region) {
        MissionPricingRule.belongsTo(models.Region, { foreignKey: 'regionId', as: 'region' });
      }

      if (models.TradeCategory) {
        MissionPricingRule.belongsTo(models.TradeCategory, {
          foreignKey: 'tradeCategoryId',
          as: 'tradeCategory',
        });
      }

      MissionPricingRule.belongsTo(models.User, {
        foreignKey: 'updatedByUserId',
        as: 'updatedBy',
      });
    }
  }

  MissionPricingRule.init(
    {
      countryId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        field: 'country_id',
      },
      regionId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
        field: 'region_id',
      },
      tradeCategoryId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'trade_category_id',
      },
      serviceType: {
        type: DataTypes.STRING(30),
        allowNull: true,
        field: 'service_type',
      },
      vehicleType: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'vehicle_type',
        validate: { isIn: [['motorcycle', 'car']] },
      },
      pricingMode: {
        type: DataTypes.ENUM('fixed_estimate', 'quote_only'),
        allowNull: false,
        defaultValue: 'fixed_estimate',
        field: 'pricing_mode',
      },
      basePrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'base_price',
      },
      minPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'min_price',
      },
      pricePerKm: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'price_per_km',
      },
      estimatedDelayMinutes: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'estimated_delay_minutes',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active',
      },
      updatedByUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'updated_by_user_id',
      },
    },
    {
      sequelize,
      modelName: 'MissionPricingRule',
      tableName: 'mission_pricing_rules',
      underscored: true,
      indexes: [
        { fields: ['country_id'] },
        { fields: ['is_active'] },
      ],
    }
  );

  return MissionPricingRule;
};
