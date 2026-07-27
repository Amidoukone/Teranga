'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ExecutorLocation extends Model {
    static associate(models) {
      if (models.Service) {
        ExecutorLocation.belongsTo(models.Service, { foreignKey: 'serviceId', as: 'service' });
      }
    }
  }

  ExecutorLocation.init(
    {
      executorType: {
        type: DataTypes.ENUM('agent', 'provider'),
        allowNull: false,
        field: 'executor_type',
      },
      executorId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'executor_id',
      },
      serviceId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'service_id',
      },
      latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
      longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
      recordedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'recorded_at',
      },
    },
    {
      sequelize,
      modelName: 'ExecutorLocation',
      tableName: 'executor_locations',
      underscored: true,
      indexes: [
        { fields: ['executor_type', 'executor_id', 'recorded_at'] },
        { fields: ['service_id'] },
      ],
    }
  );

  return ExecutorLocation;
};
