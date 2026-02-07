'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PasswordResetToken extends Model {
    static associate(models) {
      PasswordResetToken.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
      });
    }
  }

  PasswordResetToken.init(
    {
      userId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        field: 'user_id',
      },

      tokenHash: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: 'token_hash',
      },

      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
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
      modelName: 'PasswordResetToken',
      tableName: 'password_reset_tokens',
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ['user_id'] },
        { fields: ['expires_at'] },
        { fields: ['used_at'] },
        { unique: true, fields: ['token_hash'] },
      ],
    }
  );

  return PasswordResetToken;
};
