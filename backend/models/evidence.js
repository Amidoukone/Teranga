'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Evidence extends Model {
    static associate(models) {
      // 🔗 Relations existantes (métier)
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

      // 🛒 Relation e-commerce (nouvelle)
      Evidence.belongsTo(models.Order, {
        foreignKey: 'orderId',
        as: 'order',
        onDelete: 'SET NULL',
      });
    }
  }

  Evidence.init(
    {
      // 🔗 Clés étrangères
      taskId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      uploaderId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

      // ⚠️ Spécificité : seule cette colonne est en snake_case dans ta base
      orderId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'order_id',
      },

      // 📄 Métadonnées du fichier (camelCase dans ta DB)
      kind: {
        type: DataTypes.ENUM('photo', 'document', 'receipt', 'other'),
        allowNull: false,
        defaultValue: 'document',
      },
      mimeType: { type: DataTypes.STRING, allowNull: true },
      originalName: { type: DataTypes.STRING, allowNull: true },
      filePath: { type: DataTypes.STRING, allowNull: false },
      fileSize: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      thumbnailPath: { type: DataTypes.STRING, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: 'Evidence',
      tableName: 'evidences',

      // 🚫 Pas de `underscored: true` car ta table est camelCase
      // Sequelize utilisera les noms tels quels (mimeType, filePath, etc.)
      // underscored: true, <-- retiré

      indexes: [
        { fields: ['taskId'] },
        { fields: ['uploaderId'] },
        { fields: ['order_id'] }, // vrai nom de la colonne en DB
        { fields: ['kind'] },
      ],
    }
  );

  return Evidence;
};
