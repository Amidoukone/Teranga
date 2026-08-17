'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Provider extends Model {
    static associate(models) {
      Provider.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });

      if (models.Country) {
        Provider.belongsTo(models.Country, {
          foreignKey: 'countryCode',
          targetKey: 'isoCode',
          as: 'country',
        });
      }

      if (models.TradeCategory && models.ProviderTradeCategory) {
        Provider.belongsToMany(models.TradeCategory, {
          through: models.ProviderTradeCategory,
          foreignKey: 'providerId',
          otherKey: 'tradeCategoryId',
          as: 'tradeCategories',
        });
      }

      if (models.Service) {
        Provider.hasMany(models.Service, {
          foreignKey: 'providerId',
          as: 'services',
        });
      }

      if (models.ProviderContract) {
        Provider.hasMany(models.ProviderContract, {
          foreignKey: 'providerId',
          as: 'contracts',
        });
      }

      if (models.Vehicle) {
        Provider.hasMany(models.Vehicle, {
          foreignKey: 'providerId',
          as: 'vehicles',
        });
      }

      if (models.ProviderLiveLocation) {
        Provider.hasOne(models.ProviderLiveLocation, {
          foreignKey: 'providerId',
          as: 'liveLocation',
        });
      }

      if (models.MissionRating) {
        Provider.hasMany(models.MissionRating, {
          foreignKey: 'providerId',
          as: 'missionRatings',
        });
      }
    }

    /**
     * DTO public (13.6.1/13.7 de la spec) : ne jamais renvoyer phone_number,
     * email ou legal_name à un client. À utiliser explicitement dans les
     * serializers/contrôleurs qui exposent un provider à un rôle 'client'.
     * `includePlate` (docs/DEV_SPEC_TERANGA_v7_PHASE4.md §2) : réservé aux missions filière
     * Mobilité, où le client attend physiquement un véhicule identifiable — jamais activé
     * ailleurs (anonymisation stricte inchangée pour les autres filières).
     */
    toPublicDTO({ includePlate = false } = {}) {
      return {
        id: this.id,
        displayFirstName: this.displayFirstName,
        averageRating: this.averageRating,
        completedMissionsCount: this.completedMissionsCount,
        badgeCertified: this.badgeCertified,
        profilePhotoUrl: this.profilePhotoUrl,
        ...(includePlate ? { plateNumber: this.plateNumber } : {}),
      };
    }
  }

  Provider.init(
    {
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        unique: true,
        field: 'user_id',
      },

      type: {
        type: DataTypes.ENUM('independent', 'company'),
        allowNull: false,
      },

      legalName: { type: DataTypes.STRING(150), allowNull: true, field: 'legal_name' },
      displayFirstName: {
        type: DataTypes.STRING(80),
        allowNull: false,
        field: 'display_first_name',
      },
      rccmNumber: { type: DataTypes.STRING(50), allowNull: true, field: 'rccm_number' },

      phoneNumber: {
        type: DataTypes.STRING(30),
        allowNull: false,
        field: 'phone_number',
      },
      email: { type: DataTypes.STRING(150), allowNull: true },

      countryCode: {
        type: DataTypes.STRING(2),
        allowNull: false,
        field: 'country_code',
      },

      status: {
        type: DataTypes.ENUM('pending', 'probation', 'active', 'suspended', 'revoked'),
        allowNull: false,
        defaultValue: 'pending',
      },

      averageRating: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: true,
        field: 'average_rating',
      },
      completedMissionsCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
        field: 'completed_missions_count',
      },
      // docs/DEV_SPEC_TERANGA_v4_PHASE0.md §2.3 — incrémenté seulement pour resolution
      // 'refund'/'redo', jamais pour 'closed' (litige non fondé).
      disputesAgainstCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
        field: 'disputes_against_count',
      },

      hasLiabilityInsurance: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'has_liability_insurance',
      },
      insuranceExpiresAt: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'insurance_expires_at',
      },

      badgeCertified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'badge_certified',
      },

      profilePhotoUrl: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: 'profile_photo_url',
      },
      driverLicenseNumber: {
        type: DataTypes.STRING(80),
        allowNull: true,
        field: 'driver_license_number',
      },
      driverLicenseDocumentUrl: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: 'driver_license_document_url',
      },
      driverLicenseExpiresAt: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'driver_license_expires_at',
      },
      driverLicenseVerified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'driver_license_verified',
      },
      identityDocumentUrl: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: 'identity_document_url',
      },
      identityDocumentVerified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'identity_document_verified',
      },

      // Checklist onboarding chauffeur (docs/DEV_SPEC_TERANGA_v5_PHASE2.md §2) — conformité
      // arrêté municipal Bamako n°067/M-DB. Concerne uniquement les prestataires couvrant la
      // filière Mobilité, mais posé génériquement (inoffensif pour les autres filières).
      plateNumber: { type: DataTypes.STRING(20), allowNull: true, field: 'plate_number' },
      circulationCardNumber: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'circulation_card_number',
      },
      circulationCardVerified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'circulation_card_verified',
      },

      // Disponibilité déclarative (docs/DEV_SPEC_TERANGA_v5_PHASE2.md §3) — pas de GPS continu,
      // juste une présence déclarée par le prestataire lui-même.
      availabilityStatus: {
        type: DataTypes.ENUM('available', 'busy', 'offline'),
        allowNull: false,
        defaultValue: 'offline',
        field: 'availability_status',
      },
    },
    {
      sequelize,
      modelName: 'Provider',
      tableName: 'providers',
      underscored: true,
      indexes: [
        { fields: ['country_code'] },
        { fields: ['status'] },
        { fields: ['type'] },
      ],
    }
  );

  return Provider;
};
