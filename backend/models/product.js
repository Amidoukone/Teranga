'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Product extends Model {
    static associate(models) {
      Product.belongsTo(models.Category, {
        foreignKey: 'categoryId',
        as: 'category',
      });

      if (models.Country) {
        Product.belongsTo(models.Country, {
          foreignKey: 'countryId',
          as: 'country',
        });
      }

      if (models.Region) {
        Product.belongsTo(models.Region, {
          foreignKey: 'regionId',
          as: 'region',
        });
      }
    }
  }

  Product.init(
    {
      categoryId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'category_id',
      },

      name: { type: DataTypes.STRING(180), allowNull: false },
      slug: { type: DataTypes.STRING(220), allowNull: false, unique: true },
      sku: { type: DataTypes.STRING(80), allowNull: true, unique: true },

      price: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
      currency: { type: DataTypes.STRING(10), defaultValue: 'XOF' },

      stock: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_active',
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

      shortDescription: {
        type: DataTypes.STRING(500),
        field: 'short_description',
      },
      description: { type: DataTypes.TEXT },

      coverImage: { type: DataTypes.STRING(1024), field: 'cover_image' },
      gallery: { type: DataTypes.JSON, defaultValue: [] },
    },
    {
      sequelize,
      modelName: 'Product',
      tableName: 'products',

      /**
       * ✅ IMPORTANT
       * Ta DB utilise snake_case : created_at / updated_at
       * Sans ça, Sequelize va chercher createdAt/updatedAt => ER_BAD_FIELD_ERROR
       */
      timestamps: true,
      underscored: true, // ✅ mappe automatiquement createdAt -> created_at, updatedAt -> updated_at

      // ✅ Double sécurité explicite (même si underscored est changé un jour)
      createdAt: 'created_at',
      updatedAt: 'updated_at',

      indexes: [
        { fields: ['slug'], unique: true },
        { fields: ['sku'], unique: true },
        { fields: ['category_id'] },
        { fields: ['is_active'] },
        { fields: ['country_id'] },
        { fields: ['region_id'] },
      ],
    }
  );

  return Product;
};
