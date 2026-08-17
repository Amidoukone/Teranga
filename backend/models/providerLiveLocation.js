'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ProviderLiveLocation extends Model {
    static associate(models) {
      ProviderLiveLocation.belongsTo(models.Provider, {
        foreignKey: 'providerId',
        as: 'provider',
      });
      ProviderLiveLocation.belongsTo(models.Vehicle, {
        foreignKey: 'vehicleId',
        as: 'vehicle',
      });
    }
  }

  ProviderLiveLocation.init(
    {
      providerId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        unique: true,
        field: 'provider_id',
      },
      vehicleId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'vehicle_id',
      },
      latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
      longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
      accuracyMeters: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: true,
        field: 'accuracy_meters',
      },
      headingDegrees: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: true,
        field: 'heading_degrees',
      },
      recordedAt: { type: DataTypes.DATE, allowNull: false, field: 'recorded_at' },
    },
    {
      sequelize,
      modelName: 'ProviderLiveLocation',
      tableName: 'provider_live_locations',
      underscored: true,
      indexes: [
        { unique: true, fields: ['provider_id'] },
        { fields: ['vehicle_id'] },
        { fields: ['recorded_at'] },
      ],
    }
  );

  return ProviderLiveLocation;
};
