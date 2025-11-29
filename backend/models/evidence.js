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
    }
  }

  Evidence.init(
    {
      // FK
      taskId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      uploaderId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

      orderId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'order_id', // correspond exactement à ta colonne
      },

      // Type & métadonnées
      kind: {
        type: DataTypes.ENUM('photo', 'document', 'receipt', 'other'),
        allowNull: false,
        defaultValue: 'document',
      },

      mimeType: { type: DataTypes.STRING, allowNull: true },
      originalName: { type: DataTypes.STRING, allowNull: true },

      // ⭐ URL CDN ImageKit
      filePath: { type: DataTypes.STRING, allowNull: false },

      // ⭐ Identifiant ImageKit (manquant dans ton ancien modèle)
      fileId: { type: DataTypes.STRING, allowNull: true },

      fileSize: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

      // Peut stocker un future thumbnail généré automatiquement
      thumbnailPath: { type: DataTypes.STRING, allowNull: true },

      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: 'Evidence',
      tableName: 'evidences',

      indexes: [
        { fields: ['taskId'] },
        { fields: ['uploaderId'] },
        { fields: ['order_id'] },
        { fields: ['kind'] },
      ],
    }
  );

  return Evidence;
};
