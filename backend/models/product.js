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
      // 🔗 Relation catégorie
      categoryId: { 
        type: DataTypes.INTEGER.UNSIGNED, 
        allowNull: true,
        field: 'category_id'
      },

      // 🏷️ Identité produit
      name: { type: DataTypes.STRING(180), allowNull: false },
      slug: { type: DataTypes.STRING(220), allowNull: false, unique: true },
      sku: { type: DataTypes.STRING(80), allowNull: true, unique: true },

      // 💰 Prix & devise
      price: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      currency: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'XOF',
      },

      // 📦 Stock & statut
      stock: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active'
      },

      // 📝 Descriptions
      shortDescription: { 
        type: DataTypes.STRING(500), 
        allowNull: true, 
        field: 'short_description'
      },
      description: { type: DataTypes.TEXT, allowNull: true },

      /**
       * 🖼 Image principale stockée sur ImageKit ou local
       * - URL absolue (ImageKit) ou relative (/uploads/products/*.jpg)
       */
      coverImage: { 
        type: DataTypes.STRING(1024), 
        allowNull: true,
        field: 'cover_image'
      },

      /**
       * 🖼🖼🖼 Galerie multi-images
       * - Toujours un JSON array
       * - URLs absolues ImageKit ou locales
       */
      gallery: { 
        type: DataTypes.JSON, 
        allowNull: true 
      },
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
