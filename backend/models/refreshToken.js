'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class RefreshToken extends Model {
    static associate(models) {
      RefreshToken.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
      });
    }
  }

  RefreshToken.init(
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
      revokedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'revoked_at',
      },
      replacedByTokenId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
        field: 'replaced_by_token_id',
      },
      createdByIp: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'created_by_ip',
      },
      revokedByIp: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'revoked_by_ip',
      },
      userAgent: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'user_agent',
      },
    },
    {
      sequelize,
      modelName: 'RefreshToken',
      tableName: 'refresh_tokens',
    }
  );

  return RefreshToken;
};
