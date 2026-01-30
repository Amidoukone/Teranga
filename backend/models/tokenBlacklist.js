'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class TokenBlacklist extends Model {
    static associate(models) {
      // Pas d’association obligatoire ici.
      // Si un jour tu veux rattacher à User, tu pourras ajouter userId + association.
    }
  }

  TokenBlacklist.init(
    {
      jti: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },

      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'expires_at',
      },
    },
    {
      sequelize,
      modelName: 'TokenBlacklist',
      tableName: 'token_blacklist',

      /**
       * ✅ IMPORTANT
       * Table créée avec created_at / updated_at
       */
      timestamps: true,
      underscored: true,

      indexes: [
        { unique: true, fields: ['jti'] },
        { fields: ['expires_at'] },
      ],
    }
  );

  return TokenBlacklist;
};
