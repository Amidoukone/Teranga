'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Vehicle extends Model {
    static associate(models) {
      Vehicle.belongsTo(models.Provider, { foreignKey: 'providerId', as: 'provider' });
      if (models.Service) {
        Vehicle.hasMany(models.Service, { foreignKey: 'vehicleId', as: 'services' });
      }
      if (models.ProviderLiveLocation) {
        Vehicle.hasMany(models.ProviderLiveLocation, {
          foreignKey: 'vehicleId',
          as: 'liveLocations',
        });
      }
    }

    toPublicDTO() {
      return {
        id: this.id,
        vehicleType: this.vehicleType,
        brand: this.brand,
        model: this.model,
        color: this.color,
        plateNumber: this.plateNumber,
        capacity: this.capacity,
        hasPassengerHelmet: this.hasPassengerHelmet,
        hasAirConditioning: this.hasAirConditioning,
        photoUrl: this.photoUrl,
      };
    }
  }

  Vehicle.init(
    {
      providerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'provider_id' },
      vehicleType: {
        type: DataTypes.ENUM('motorcycle', 'car'),
        allowNull: false,
        field: 'vehicle_type',
      },
      brand: { type: DataTypes.STRING(80), allowNull: false },
      model: { type: DataTypes.STRING(80), allowNull: false },
      color: { type: DataTypes.STRING(50), allowNull: false },
      plateNumber: { type: DataTypes.STRING(30), allowNull: false, field: 'plate_number' },
      capacity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
      hasPassengerHelmet: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'has_passenger_helmet',
      },
      hasAirConditioning: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'has_air_conditioning',
      },
      photoUrl: { type: DataTypes.STRING(500), allowNull: true, field: 'photo_url' },
      registrationNumber: {
        type: DataTypes.STRING(80),
        allowNull: true,
        field: 'registration_number',
      },
      registrationDocumentUrl: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: 'registration_document_url',
      },
      registrationVerified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'registration_verified',
      },
      insurancePolicyNumber: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'insurance_policy_number',
      },
      insuranceDocumentUrl: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: 'insurance_document_url',
      },
      insuranceExpiresAt: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'insurance_expires_at',
      },
      insuranceVerified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'insurance_verified',
      },
      inspectionCertificateNumber: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'inspection_certificate_number',
      },
      inspectionDocumentUrl: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: 'inspection_document_url',
      },
      inspectionExpiresAt: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'inspection_expires_at',
      },
      inspectionVerified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'inspection_verified',
      },
      status: {
        type: DataTypes.ENUM('pending', 'active', 'suspended', 'retired'),
        allowNull: false,
        defaultValue: 'pending',
      },
    },
    {
      sequelize,
      modelName: 'Vehicle',
      tableName: 'vehicles',
      underscored: true,
      indexes: [
        { fields: ['provider_id'] },
        { fields: ['vehicle_type', 'status'] },
      ],
    }
  );

  return Vehicle;
};
