'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Service extends Model {
    static associate(models) {
      Service.belongsTo(models.User, { foreignKey: 'clientId', as: 'client' });
      Service.belongsTo(models.User, { foreignKey: 'agentId', as: 'agent' });
      Service.belongsTo(models.Property, { foreignKey: 'propertyId', as: 'property' });
      Service.hasMany(models.Task, {
        foreignKey: 'serviceId',
        as: 'tasks',
        onDelete: 'CASCADE',
        hooks: true
      });
    }
  }

  Service.init(
    {
      clientId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      agentId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

      // 🔥 Correction : devient facultatif
      propertyId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

      type: {
        type: DataTypes.ENUM(
          'errand',
          'administrative',
          'payment',
          'money_transfer',
          'other'
        ),
        allowNull: false
      },
      title: { type: DataTypes.STRING, allowNull: false },
      description: DataTypes.TEXT,
      contactPerson: DataTypes.STRING,
      contactPhone: DataTypes.STRING,
      address: DataTypes.TEXT,
      budget: DataTypes.DECIMAL(12, 2),

      status: {
        type: DataTypes.ENUM('created', 'in_progress', 'completed', 'validated'),
        allowNull: false,
        defaultValue: 'created'
      }
    },
    {
      sequelize,
      modelName: 'Service',
      tableName: 'services'
    }
  );

  return Service;
};
