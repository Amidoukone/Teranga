'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Activity extends Model {
    static associate(models) {
      Activity.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'recipient',
      });
      Activity.belongsTo(models.User, {
        foreignKey: 'actorId',
        as: 'actor',
      });
    }
  }

  Activity.init(
    {
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      actorId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },

      entityType: {
        type: DataTypes.STRING(40),
        allowNull: false,
      },
      entityId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
      action: {
        type: DataTypes.STRING(60),
        allowNull: false,
        defaultValue: 'created',
      },

      title: {
        type: DataTypes.STRING(180),
        allowNull: true,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      progress: {
        type: DataTypes.ENUM('new', 'in_progress', 'done'),
        allowNull: false,
        defaultValue: 'new',
      },
      entityStatus: {
        type: DataTypes.STRING(40),
        allowNull: true,
      },

      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },

      countryId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
      regionId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Activity',
      tableName: 'activities',
      timestamps: true,
    }
  );

  return Activity;
};
