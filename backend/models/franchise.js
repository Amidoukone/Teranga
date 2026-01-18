'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Franchise extends Model {
    static associate(models) {
      Franchise.belongsTo(models.Country, {
        foreignKey: 'countryId',
        as: 'country',
      });

      Franchise.belongsTo(models.Region, {
        foreignKey: 'regionId',
        as: 'region',
      });
    }
  }

  Franchise.init(
    {
      type: { type: DataTypes.ENUM('MASTER', 'REGIONAL'), allowNull: false },

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

      legalName: {
        type: DataTypes.STRING(180),
        allowNull: false,
        field: 'legal_name',
      },

      status: {
        type: DataTypes.ENUM('active', 'inactive', 'pending'),
        allowNull: false,
        defaultValue: 'active',
      },
    },
    {
      sequelize,
      modelName: 'Franchise',
      tableName: 'franchises',
      timestamps: true, // ✅ createdAt/updatedAt
    }
  );

  return Franchise;
};
