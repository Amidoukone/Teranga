'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class TradeCategory extends Model {
    static associate(models) {
      if (models.Provider && models.ProviderTradeCategory) {
        TradeCategory.belongsToMany(models.Provider, {
          through: models.ProviderTradeCategory,
          foreignKey: 'tradeCategoryId',
          otherKey: 'providerId',
          as: 'providers',
        });
      }

      if (models.Service) {
        TradeCategory.hasMany(models.Service, {
          foreignKey: 'tradeCategoryId',
          as: 'services',
        });
      }

      if (models.User && models.CategoryManagerTradeCategory) {
        TradeCategory.belongsToMany(models.User, {
          through: models.CategoryManagerTradeCategory,
          foreignKey: 'tradeCategoryId',
          otherKey: 'userId',
          as: 'categoryManagers',
        });
      }
    }
  }

  TradeCategory.init(
    {
      name: { type: DataTypes.STRING(100), allowNull: false },
      slug: { type: DataTypes.STRING(120), allowNull: false, unique: true },
      requiresCompany: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'requires_company',
      },
      defaultWarrantyDays: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
        field: 'default_warranty_days',
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
      modelName: 'TradeCategory',
      tableName: 'trade_categories',
      underscored: true,
      indexes: [{ fields: ['slug'], unique: true }, { fields: ['is_active'] }],
    }
  );

  return TradeCategory;
};
