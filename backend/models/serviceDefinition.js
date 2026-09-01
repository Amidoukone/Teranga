'use strict';

const { Model } = require('sequelize');
const {
  SERVICE_FAMILIES,
  EXECUTION_PROFILES,
} = require('../src/constants/serviceCatalog');

module.exports = (sequelize, DataTypes) => {
  class ServiceDefinition extends Model {
    static associate(models) {
      ServiceDefinition.belongsTo(models.TradeCategory, {
        foreignKey: 'legacyTradeCategoryId',
        as: 'legacyTradeCategory',
      });
      ServiceDefinition.hasMany(models.ServiceAvailability, {
        foreignKey: 'serviceDefinitionId',
        as: 'availabilities',
      });
    }
  }

  ServiceDefinition.init(
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      code: { type: DataTypes.STRING(120), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(180), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      family: {
        type: DataTypes.ENUM(...SERVICE_FAMILIES),
        allowNull: false,
        defaultValue: 'core',
      },
      executionProfile: {
        type: DataTypes.ENUM(...EXECUTION_PROFILES),
        allowNull: false,
        field: 'execution_profile',
      },
      legacyTradeCategoryId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
        field: 'legacy_trade_category_id',
      },
      legacyServiceType: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'legacy_service_type',
      },
      requiredEvidenceTypes: {
        type: DataTypes.JSON,
        allowNull: true,
        field: 'required_evidence_types',
      },
      intakeSchema: {
        type: DataTypes.JSON,
        allowNull: true,
        field: 'intake_schema',
      },
      version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active',
      },
    },
    {
      sequelize,
      modelName: 'ServiceDefinition',
      tableName: 'service_definitions',
      underscored: true,
      timestamps: true,
    }
  );

  return ServiceDefinition;
};
