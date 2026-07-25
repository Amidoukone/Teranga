'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CategoryManagerTradeCategory extends Model {
    static associate(models) {
      CategoryManagerTradeCategory.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
      });
      CategoryManagerTradeCategory.belongsTo(models.TradeCategory, {
        foreignKey: 'tradeCategoryId',
        as: 'tradeCategory',
      });
    }
  }

  CategoryManagerTradeCategory.init(
    {
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        primaryKey: true,
        field: 'user_id',
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
      modelName: 'CategoryManagerTradeCategory',
      tableName: 'category_manager_trade_categories',
      underscored: true,
      timestamps: false, // pure table de jointure, comme provider_trade_categories
    }
  );

  return CategoryManagerTradeCategory;
};
