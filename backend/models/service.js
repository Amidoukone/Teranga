'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Service extends Model {
    static associate(models) {
      // 🔗 Un service appartient à un client
      Service.belongsTo(models.User, { foreignKey: 'clientId', as: 'client' });

      // 🔗 Un service peut être assigné à un agent
      Service.belongsTo(models.User, { foreignKey: 'agentId', as: 'agent' });

      // 🔗 Un service est lié à un bien immobilier
      Service.belongsTo(models.Property, { foreignKey: 'propertyId', as: 'property' });

      // 🔗 Un service possède plusieurs tâches
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
      propertyId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false }, // ✅ ajouté

      // Infos principales
      type: {
        type: DataTypes.ENUM('errand', 'administrative', 'payment', 'money_transfer', 'other'),
        allowNull: false
      },
      title: { type: DataTypes.STRING, allowNull: false },
      description: { type: DataTypes.TEXT },
      contactPerson: { type: DataTypes.STRING },
      contactPhone: { type: DataTypes.STRING },
      address: { type: DataTypes.TEXT },
      budget: { type: DataTypes.DECIMAL(12, 2) },

      // Workflow
      status: {
        type: DataTypes.ENUM('created', 'in_progress', 'completed', 'validated'),
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
