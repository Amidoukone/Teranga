'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Notification extends Model {
    static associate(models) {
      Notification.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'recipient',
      });
      Notification.belongsTo(models.User, {
        foreignKey: 'actorId',
        as: 'actor',
      });
    }
  }

  Notification.init(
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
        type: DataTypes.ENUM('service', 'task', 'order', 'evidence', 'project'),
        allowNull: false,
      },
      entityId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
      action: {
        type: DataTypes.ENUM('created', 'assigned', 'status_updated', 'threshold_alert'),
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

      status: {
        type: DataTypes.ENUM('unread', 'read'),
        allowNull: false,
        defaultValue: 'unread',
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

      readAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Notification',
      tableName: 'notifications',
      timestamps: true,
    }
  );

  return Notification;
};
