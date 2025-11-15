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
      // 🔗 Relation catégorie (nullable)
      categoryId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

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
      },

      // 📝 Descriptions
      shortDescription: { type: DataTypes.STRING(500), allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true },

      /**
       * 🖼 Image principale (historique)
       * - chemin relatif ex: "/uploads/products/xxx.jpg"
       * - front: normalisé via getFileUrl(...)
       */
      coverImage: { type: DataTypes.STRING, allowNull: true },

      /**
       * 🖼🖼🖼 Galerie d'images (multi-images)
       * - JSON ARRAY de chemins relatifs ex: ["/uploads/products/1.jpg", ...]
       * - on recommandera côté backend/front de limiter à 3 images max
       * - coverImage = image principale (généralement gallery[0])
       */
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
