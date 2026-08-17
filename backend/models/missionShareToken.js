'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class MissionShareToken extends Model {
    static associate(models) {
      MissionShareToken.belongsTo(models.Service, {
        foreignKey: 'serviceId',
        as: 'service',
      });
    }
  }

  MissionShareToken.init(
    {
      serviceId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'service_id',
      },
      createdByUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'created_by_user_id',
      },
      tokenHash: { type: DataTypes.STRING(64), allowNull: false, field: 'token_hash' },
      expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
      revokedAt: { type: DataTypes.DATE, allowNull: true, field: 'revoked_at' },
      lastAccessedAt: { type: DataTypes.DATE, allowNull: true, field: 'last_accessed_at' },
    },
    {
      sequelize,
      modelName: 'MissionShareToken',
      tableName: 'mission_share_tokens',
      underscored: true,
    }
  );

  return MissionShareToken;
};
