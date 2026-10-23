'use strict';

const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class MissionCoordination extends Model {
    static associate(models) {
      MissionCoordination.belongsTo(models.Service, { as: 'service', foreignKey: 'serviceId' });
      MissionCoordination.belongsTo(models.User, { as: 'owner', foreignKey: 'ownerUserId' });
      models.Service.hasOne(MissionCoordination, { as: 'coordination', foreignKey: 'serviceId' });
    }
  }
  MissionCoordination.init({
    serviceId: { type: DataTypes.INTEGER, allowNull: false, unique: true, field: 'service_id' },
    ownerUserId: { type: DataTypes.INTEGER, allowNull: true, field: 'owner_user_id' },
    mode: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'manual', validate: { isIn: [['manual', 'automatic']] } },
    state: { type: DataTypes.STRING(25), allowNull: false, defaultValue: 'waiting' },
    observedStatus: { type: DataTypes.STRING(40), allowNull: true, field: 'observed_status' },
    policy: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
    attempts: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    completionReport: { type: DataTypes.JSON, allowNull: true, field: 'completion_report' },
    nextActionAt: { type: DataTypes.DATE, allowNull: true, field: 'next_action_at' },
    reason: { type: DataTypes.STRING(100), allowNull: true },
  }, { sequelize, modelName: 'MissionCoordination', tableName: 'mission_coordinations', underscored: true });
  return MissionCoordination;
};
