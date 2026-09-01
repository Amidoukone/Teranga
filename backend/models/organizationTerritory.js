'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class OrganizationTerritory extends Model {
    static associate(models) {
      OrganizationTerritory.belongsTo(models.Organization, {
        foreignKey: 'organizationId',
        as: 'organization',
      });
      OrganizationTerritory.belongsTo(models.Territory, {
        foreignKey: 'territoryId',
        as: 'territory',
      });
    }
  }

  OrganizationTerritory.init(
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      organizationId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        field: 'organization_id',
      },
      territoryId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        field: 'territory_id',
      },
      isPrimary: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_primary',
      },
      isExclusive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_exclusive',
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },
      validFrom: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'valid_from',
      },
      validUntil: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'valid_until',
      },
    },
    {
      sequelize,
      modelName: 'OrganizationTerritory',
      tableName: 'organization_territories',
      underscored: true,
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['organization_id', 'territory_id'],
          name: 'uniq_organization_territories_pair',
        },
      ],
    }
  );

  return OrganizationTerritory;
};
