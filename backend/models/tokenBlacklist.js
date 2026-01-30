'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class TokenBlacklist extends Model {}

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
    }
  );

  return TokenBlacklist;
};
