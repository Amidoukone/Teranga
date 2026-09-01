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

      Country.hasMany(models.Organization, {
        foreignKey: 'countryId',
        as: 'organizations',
      });

      Country.hasMany(models.Territory, {
        foreignKey: 'countryId',
        as: 'territories',
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
      // Numéro de contact affiché sur les annonces immobilières sans région précise
      // (docs/BRAINSTORM_ECOSYSTEME_TERANGA.md §7) — fallback si la région n'en a pas.
      contactPhone: {
        type: DataTypes.STRING(30),
        allowNull: true,
        field: 'contact_phone',
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
