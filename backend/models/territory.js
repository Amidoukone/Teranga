'use strict';

const { Model } = require('sequelize');
const { TERRITORY_TYPES } = require('../src/constants/territorialGovernance');

module.exports = (sequelize, DataTypes) => {
  class Territory extends Model {
    static associate(models) {
      Territory.belongsTo(models.Territory, {
        foreignKey: 'parentId',
        as: 'parent',
      });
      Territory.hasMany(models.Territory, {
        foreignKey: 'parentId',
        as: 'children',
      });
      Territory.belongsTo(models.Country, {
        foreignKey: 'countryId',
        as: 'country',
      });
      Territory.belongsTo(models.Region, {
        foreignKey: 'regionId',
        as: 'region',
      });
      Territory.hasMany(models.Membership, {
        foreignKey: 'territoryId',
        as: 'memberships',
      });
      Territory.hasMany(models.OrganizationTerritory, {
        foreignKey: 'territoryId',
        as: 'organizationAssignments',
      });
      Territory.belongsToMany(models.Organization, {
        through: models.OrganizationTerritory,
        foreignKey: 'territoryId',
        otherKey: 'organizationId',
        as: 'organizations',
      });
      Territory.hasMany(models.ServiceAvailability, {
        foreignKey: 'territoryId',
        as: 'serviceAvailabilities',
      });
    }
  }

  Territory.init(
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      type: {
        type: DataTypes.ENUM(...TERRITORY_TYPES),
        allowNull: false,
      },
      parentId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
        field: 'parent_id',
      },
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
      code: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      name: {
        type: DataTypes.STRING(180),
        allowNull: false,
      },
      timezone: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      aliases: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active',
      },
    },
    {
      sequelize,
      modelName: 'Territory',
      tableName: 'territories',
      underscored: true,
      timestamps: true,
    }
  );

  return Territory;
};
