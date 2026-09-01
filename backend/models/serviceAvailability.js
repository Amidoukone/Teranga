'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ServiceAvailability extends Model {
    static associate(models) {
      ServiceAvailability.belongsTo(models.ServiceDefinition, {
        foreignKey: 'serviceDefinitionId',
        as: 'definition',
      });
      ServiceAvailability.belongsTo(models.Territory, {
        foreignKey: 'territoryId',
        as: 'territory',
      });
      ServiceAvailability.belongsTo(models.Organization, {
        foreignKey: 'organizationId',
        as: 'operatingOrganization',
      });
    }
  }

  ServiceAvailability.init(
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      serviceDefinitionId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        field: 'service_definition_id',
      },
      territoryId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        field: 'territory_id',
      },
      organizationId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        field: 'organization_id',
      },
      currency: { type: DataTypes.STRING(10), allowNull: false },
      basePrice: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: true,
        field: 'base_price',
      },
      slaMinutes: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'sla_minutes',
      },
      openingHours: {
        type: DataTypes.JSON,
        allowNull: true,
        field: 'opening_hours',
      },
      requiredFields: {
        type: DataTypes.JSON,
        allowNull: true,
        field: 'required_fields',
      },
      providerRules: {
        type: DataTypes.JSON,
        allowNull: true,
        field: 'provider_rules',
      },
      version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active',
      },
      validFrom: { type: DataTypes.DATE, allowNull: true, field: 'valid_from' },
      validUntil: { type: DataTypes.DATE, allowNull: true, field: 'valid_until' },
    },
    {
      sequelize,
      modelName: 'ServiceAvailability',
      tableName: 'service_availabilities',
      underscored: true,
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['service_definition_id', 'territory_id', 'organization_id'],
          name: 'uniq_service_availability_scope',
        },
      ],
    }
  );

  return ServiceAvailability;
};
