'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Region extends Model {
    static associate(models) {
      Region.belongsTo(models.Country, {
        foreignKey: 'countryId',
        as: 'country',
      });

      Region.hasMany(models.Franchise, {
        foreignKey: 'regionId',
        as: 'franchises',
      });
    }
  }

  Region.init(
    {
      countryId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        field: 'country_id',
      },
      name: { type: DataTypes.STRING(120), allowNull: false },
      code: { type: DataTypes.STRING(30), allowNull: true },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active',
      },
    },
    {
      sequelize,
      modelName: 'Region',
      tableName: 'regions',
      timestamps: true, // ✅ createdAt/updatedAt
    }
  );

  return Region;
};
