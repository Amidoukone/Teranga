'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Evidence extends Model {
    static associate(models) {
      Evidence.belongsTo(models.Task, {
        foreignKey: 'taskId',
        as: 'task',
        onDelete: 'CASCADE',
      });

      Evidence.belongsTo(models.User, {
        foreignKey: 'uploaderId',
        as: 'uploader',
        onDelete: 'SET NULL',
      });

      Evidence.belongsTo(models.Order, {
        foreignKey: 'orderId',
        as: 'order',
        onDelete: 'SET NULL',
      });

      // 🌍 Multi-pays (logique uniquement)
      if (models.Country) {
        Evidence.belongsTo(models.Country, {
          foreignKey: 'countryId',
          as: 'country',
        });
      }

      if (models.Region) {
        Evidence.belongsTo(models.Region, {
          foreignKey: 'regionId',
          as: 'region',
        });
      }
    }
  }

  Evidence.init(
    {
      taskId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      uploaderId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      orderId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'order_id',
      },

      kind: {
        type: DataTypes.ENUM('photo', 'document', 'receipt', 'other'),
        allowNull: false,
        defaultValue: 'document',
      },

      mimeType: { type: DataTypes.STRING, allowNull: true },
      originalName: { type: DataTypes.STRING, allowNull: true },
      filePath: { type: DataTypes.STRING, allowNull: false },
      fileId: { type: DataTypes.STRING, allowNull: true },
      fileSize: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      thumbnailPath: { type: DataTypes.STRING, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },

      // 🌍 Scope géographique
      countryId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      regionId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    },
    {
      sequelize,
      modelName: 'Evidence',
      tableName: 'evidences',
      timestamps: true, // ✅ createdAt / updatedAt camelCase (prod)
      indexes: [
        { fields: ['taskId'] },
        { fields: ['uploaderId'] },
        { fields: ['order_id'] },
        { fields: ['kind'] },
        { fields: ['countryId'] },
        { fields: ['regionId'] },
      ],
    }
  );

  return Evidence;
};
