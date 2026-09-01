'use strict';

const { Model } = require('sequelize');
const {
  ORGANIZATION_TYPES,
  ORGANIZATION_STATUSES,
} = require('../src/constants/territorialGovernance');

module.exports = (sequelize, DataTypes) => {
  class Organization extends Model {
    static associate(models) {
      Organization.belongsTo(models.Organization, {
        foreignKey: 'parentOrganizationId',
        as: 'parentOrganization',
      });
      Organization.hasMany(models.Organization, {
        foreignKey: 'parentOrganizationId',
        as: 'childOrganizations',
      });
      Organization.belongsTo(models.Country, {
        foreignKey: 'countryId',
        as: 'country',
      });
      Organization.belongsTo(models.Region, {
        foreignKey: 'regionId',
        as: 'region',
      });
      Organization.hasMany(models.Membership, {
        foreignKey: 'organizationId',
        as: 'memberships',
      });
      Organization.hasMany(models.OrganizationTerritory, {
        foreignKey: 'organizationId',
        as: 'territoryAssignments',
      });
      Organization.belongsToMany(models.Territory, {
        through: models.OrganizationTerritory,
        foreignKey: 'organizationId',
        otherKey: 'territoryId',
        as: 'territories',
      });
      Organization.hasMany(models.ServiceAvailability, {
        foreignKey: 'organizationId',
        as: 'serviceAvailabilities',
      });
    }
  }

  Organization.init(
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      type: {
        type: DataTypes.ENUM(...ORGANIZATION_TYPES),
        allowNull: false,
      },
      parentOrganizationId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
        field: 'parent_organization_id',
      },
      countryId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
        field: 'country_id',
      },
      regionId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
        field: 'region_id',
      },
      code: {
        type: DataTypes.STRING(80),
        allowNull: false,
        unique: true,
      },
      legalName: {
        type: DataTypes.STRING(180),
        allowNull: false,
        field: 'legal_name',
      },
      displayName: {
        type: DataTypes.STRING(180),
        allowNull: true,
        field: 'display_name',
      },
      status: {
        type: DataTypes.ENUM(...ORGANIZATION_STATUSES),
        allowNull: false,
        defaultValue: 'pending',
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Organization',
      tableName: 'organizations',
      underscored: true,
      timestamps: true,
    }
  );

  return Organization;
};
