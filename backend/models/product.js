'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Product extends Model {
    static associate(models) {
      Product.belongsTo(models.Category, {
        foreignKey: 'categoryId',
        as: 'category',
        onDelete: 'SET NULL',
      });
    }
  }

  Product.init(
    {
      categoryId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

      name: { type: DataTypes.STRING(180), allowNull: false },
      slug: { type: DataTypes.STRING(220), allowNull: false, unique: true },
      sku: { type: DataTypes.STRING(80), allowNull: true, unique: true },

      price: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      currency: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'XOF' },

      stock: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      isActive: { type: DataTypes.BOOLEAN, defaultValue: true },

      shortDescription: { type: DataTypes.STRING(500), allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      coverImage: { type: DataTypes.STRING, allowNull: true }, // /uploads/...
      gallery: { type: DataTypes.JSON, allowNull: true }, // array d’URLs
    },
    {
      sequelize,
      modelName: 'Product',
      tableName: 'products',
      underscored: true,
      indexes: [
        { fields: ['slug'], unique: true },
        { fields: ['sku'], unique: true },
        { fields: ['category_id'] },
        { fields: ['is_active'] },
      ],
    }
  );

  return Product;
};
