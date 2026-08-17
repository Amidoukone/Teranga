'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class MissionRating extends Model {
    static associate(models) {
      MissionRating.belongsTo(models.Service, { foreignKey: 'serviceId', as: 'service' });
      MissionRating.belongsTo(models.Provider, { foreignKey: 'providerId', as: 'provider' });
    }
  }

  MissionRating.init(
    {
      serviceId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        unique: true,
        field: 'service_id',
      },
      clientId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'client_id',
      },
      providerId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'provider_id',
      },
      score: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
      comment: { type: DataTypes.STRING(500), allowNull: true },
    },
    {
      sequelize,
      modelName: 'MissionRating',
      tableName: 'mission_ratings',
      underscored: true,
    }
  );

  return MissionRating;
};
