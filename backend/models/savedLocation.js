'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SavedLocation extends Model {
    static associate(models) {
      SavedLocation.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    }
  }

  SavedLocation.init(
    {
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'user_id',
      },
      label: { type: DataTypes.STRING(80), allowNull: true },
      address: { type: DataTypes.STRING(255), allowNull: false },
      latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
      longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
    },
    {
      sequelize,
      modelName: 'SavedLocation',
      tableName: 'saved_locations',
      underscored: true,
      indexes: [{ fields: ['user_id'] }],
    }
  );

  return SavedLocation;
};
