'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Country extends Model {
    static associate(models) {
      Country.hasMany(models.Region, {
        foreignKey: 'countryId',
        as: 'regions',
      });

      Country.hasMany(models.Franchise, {
        foreignKey: 'countryId',
        as: 'franchises',
      });
    }
  }

  Country.init(
    {
      name: { type: DataTypes.STRING(100), allowNull: false },
      isoCode: { type: DataTypes.STRING(2), allowNull: false, field: 'iso_code' },
      currency: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'XOF' },
      defaultLanguage: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'fr',
        field: 'default_language',
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
      modelName: 'Country',
      tableName: 'countries',
      timestamps: true, // ✅ utilisera createdAt/updatedAt
      // pas de underscored:true ici (sinon createdAt -> created_at)
    }
  );

  return Country;
};
