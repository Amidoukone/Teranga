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

      Region.hasMany(models.Organization, {
        foreignKey: 'regionId',
        as: 'organizations',
      });

      Region.hasMany(models.Territory, {
        foreignKey: 'regionId',
        as: 'territories',
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
      // Numéro de contact affiché sur les annonces immobilières de cette région
      // (docs/BRAINSTORM_ECOSYSTEME_TERANGA.md §7) — prioritaire sur celui du pays.
      contactPhone: {
        type: DataTypes.STRING(30),
        allowNull: true,
        field: 'contact_phone',
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
