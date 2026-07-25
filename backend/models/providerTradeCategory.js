'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ProviderTradeCategory extends Model {
    static associate(models) {
      ProviderTradeCategory.belongsTo(models.Provider, {
        foreignKey: 'providerId',
        as: 'provider',
      });
      ProviderTradeCategory.belongsTo(models.TradeCategory, {
        foreignKey: 'tradeCategoryId',
        as: 'tradeCategory',
      });
    }
  }

  ProviderTradeCategory.init(
    {
      providerId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        primaryKey: true,
        field: 'provider_id',
      },
      tradeCategoryId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        primaryKey: true,
        field: 'trade_category_id',
      },
    },
    {
      sequelize,
      modelName: 'ProviderTradeCategory',
      tableName: 'provider_trade_categories',
      underscored: true,
      timestamps: false, // pure table de jointure, pas de created_at/updated_at
    }
  );

  return ProviderTradeCategory;
};
