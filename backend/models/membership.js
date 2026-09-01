'use strict';

const { Model } = require('sequelize');
const { ASSIGNMENT_STATUSES } = require('../src/constants/territorialGovernance');

module.exports = (sequelize, DataTypes) => {
  class Membership extends Model {
    static associate(models) {
      Membership.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
      });
      Membership.belongsTo(models.Organization, {
        foreignKey: 'organizationId',
        as: 'organization',
      });
      Membership.belongsTo(models.Territory, {
        foreignKey: 'territoryId',
        as: 'territory',
      });
    }
  }

  Membership.init(
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'user_id',
      },
      organizationId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        field: 'organization_id',
      },
      territoryId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
        field: 'territory_id',
      },
      roleKey: {
        type: DataTypes.STRING(80),
        allowNull: false,
        field: 'role_key',
      },
      permissions: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM(...ASSIGNMENT_STATUSES),
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
      modelName: 'Membership',
      tableName: 'memberships',
      underscored: true,
      timestamps: true,
    }
  );

  return Membership;
};
