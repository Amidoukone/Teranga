'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class OperationSchedulerState extends Model {}
  OperationSchedulerState.init({
    key: { type: DataTypes.STRING(60), primaryKey: true },
    startedAt: { type: DataTypes.DATE, allowNull: false, field: 'started_at' },
    lastSuccessAt: { type: DataTypes.DATE, allowNull: true, field: 'last_success_at' },
    lastError: { type: DataTypes.STRING(200), allowNull: true, field: 'last_error' },
  }, { sequelize, modelName: 'OperationSchedulerState', tableName: 'operation_scheduler_states', timestamps: false });
  return OperationSchedulerState;
};
