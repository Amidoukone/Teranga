'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PropertyListing extends Model {
    static associate(models) {
      PropertyListing.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });

      // Scope géo — associations logiques uniquement (pas de FK DB), même convention que
      // trade_categories/services.
      if (models.Country) {
        PropertyListing.belongsTo(models.Country, { foreignKey: 'countryId', as: 'country' });
      }
      if (models.Region) {
        PropertyListing.belongsTo(models.Region, { foreignKey: 'regionId', as: 'region' });
      }
    }
  }

  PropertyListing.init(
    {
      title: { type: DataTypes.STRING(150), allowNull: false },
      type: {
        type: DataTypes.ENUM('house', 'apartment', 'land'),
        allowNull: false,
      },
      transactionType: {
        type: DataTypes.ENUM('rent', 'sale'),
        allowNull: false,
        field: 'transaction_type',
      },
      neighborhood: { type: DataTypes.STRING(120), allowNull: true },
      city: { type: DataTypes.STRING(120), allowNull: false },
      countryId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'country_id' },
      regionId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'region_id' },
      price: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
      currency: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'XOF' },
      description: { type: DataTypes.TEXT, allowNull: true },
      photos: { type: DataTypes.JSON, allowNull: true },
      status: {
        type: DataTypes.ENUM('available', 'rented', 'sold'),
        allowNull: false,
        defaultValue: 'available',
      },
      createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'created_by' },
    },
    {
      sequelize,
      modelName: 'PropertyListing',
      tableName: 'property_listings',
      underscored: true,
      indexes: [{ fields: ['status'] }, { fields: ['country_id', 'region_id'] }],
    }
  );

  return PropertyListing;
};
