'use strict';
const { Model } = require('sequelize');
const { MISSION_STATUS_VALUES, MISSION_ACTOR_TYPE_VALUES } = require('../src/constants/missionStatus');

module.exports = (sequelize, DataTypes) => {
  class MissionStatusHistory extends Model {
    static associate(models) {
      MissionStatusHistory.belongsTo(models.Service, {
        foreignKey: 'serviceId',
        as: 'service',
      });

      if (models.User) {
        MissionStatusHistory.belongsTo(models.User, {
          foreignKey: 'actorId',
          as: 'actor',
        });
      }
    }
  }

  MissionStatusHistory.init(
    {
      serviceId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'service_id',
      },

      fromStatus: {
        type: DataTypes.ENUM(...MISSION_STATUS_VALUES),
        allowNull: true,
        field: 'from_status',
      },
      toStatus: {
        type: DataTypes.ENUM(...MISSION_STATUS_VALUES),
        allowNull: false,
        field: 'to_status',
      },

      actorType: {
        type: DataTypes.ENUM(...MISSION_ACTOR_TYPE_VALUES),
        allowNull: false,
        field: 'actor_type',
      },
      actorId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'actor_id',
      },
    },
    {
      sequelize,
      modelName: 'MissionStatusHistory',
      tableName: 'mission_status_history',
      underscored: true,
      timestamps: true,
      updatedAt: false, // journal immuable, pas de updated_at
      indexes: [
        { fields: ['service_id'] },
        { fields: ['service_id', 'created_at'] },
        { fields: ['to_status'] },
      ],
    }
  );

  return MissionStatusHistory;
};
