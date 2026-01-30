'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class RefreshToken extends Model {
    static associate(models) {
      // Association logique (pas besoin de FK DB côté PlanetScale)
      RefreshToken.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
      });

      // Optionnel (utile si tu veux accéder au token remplacé)
      // RefreshToken.belongsTo(models.RefreshToken, {
      //   foreignKey: 'replacedByTokenId',
      //   as: 'replacedBy',
      // });
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

      /**
       * ✅ IMPORTANT (PlanetScale + tables en snake_case)
       * La DB a created_at / updated_at (pas createdAt / updatedAt).
       * Donc on active timestamps + underscored.
       */
      timestamps: true,
      underscored: true,

      indexes: [
        { fields: ['user_id'] },
        { fields: ['expires_at'] },
        { unique: true, fields: ['token_hash'] },
      ],
    }
  );

  return RefreshToken;
};
