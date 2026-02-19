'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class RecoveryCode extends Model {
    static associate(models) {
      RecoveryCode.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
      });
    }
  }

  RecoveryCode.init(
    {
      userId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        field: 'user_id',
      },

      codeHash: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: 'code_hash',
      },

      expiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'expires_at',
      },

      usedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'used_at',
      },

      createdByIp: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'created_by_ip',
      },

      usedByIp: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'used_by_ip',
      },

      userAgent: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'user_agent',
      },
    },
    {
      sequelize,
      modelName: 'RecoveryCode',
      tableName: 'recovery_codes',
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ['user_id'] },
        { fields: ['expires_at'] },
        { fields: ['used_at'] },
        { unique: true, fields: ['code_hash'] },
      ],
    }
  );

  return RecoveryCode;
};
