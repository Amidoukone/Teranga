'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Category extends Model {
    static associate(models) {
      Category.hasMany(models.Product, {
        foreignKey: 'categoryId',
        as: 'products',
        onDelete: 'SET NULL',
      });
    }
  }

  Category.init(
    {
      name: { type: DataTypes.STRING(120), allowNull: false, unique: true },
      slug: { type: DataTypes.STRING(160), allowNull: false, unique: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    },
    {
      sequelize,
      modelName: 'Category',
      tableName: 'categories',
      underscored: true,
      indexes: [{ fields: ['slug'], unique: true }, { fields: ['is_active'] }],
    }
  );

  return Category;
};
