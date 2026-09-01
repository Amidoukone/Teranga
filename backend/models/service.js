'use strict';
const { Model } = require('sequelize');
const { MISSION_STATUS_VALUES } = require('../src/constants/missionStatus');
const { DELIVERY_PACKAGE_TYPE_VALUES } = require('../src/constants/deliveryPackage');
const { DELIVERY_HANDLING_VALUES } = require('../src/constants/deliveryHandling');
<<<<<<< HEAD

module.exports = (sequelize, DataTypes) => {
  class Service extends Model {
    static associate(models) {
      // Relations utilisateurs
      Service.belongsTo(models.User, { foreignKey: 'clientId', as: 'client' });
      Service.belongsTo(models.User, { foreignKey: 'agentId', as: 'agent' });
      Service.belongsTo(models.User, { foreignKey: 'createdById', as: 'creator' });

      // Lien vers une propriÃ©tÃ© (optionnel)
      Service.belongsTo(models.Property, { foreignKey: 'propertyId', as: 'property' });

      // TÃ¢ches liÃ©es au service
      Service.hasMany(models.Task, {
        foreignKey: 'serviceId',
        as: 'tasks',
        onDelete: 'CASCADE',
        hooks: true,
      });

      /**
       * ðŸŒ Multi-pays (associations logiques uniquement)
       * - Pas de FK DB pour garder les imports MySQL portables
       * - Permet include: [{ model: Country, as: 'country' }]
       */
      if (models.Country) {
        Service.belongsTo(models.Country, {
          foreignKey: 'countryId',
          as: 'country',
        });
      }

      if (models.Region) {
        Service.belongsTo(models.Region, {
          foreignKey: 'regionId',
          as: 'region',
        });
      }

      /**
       * ðŸ› ï¸ Teranga Pro (Dev spec v3, associations logiques uniquement â€”
       * providerId/tradeCategoryId ne portent pas de FK physique sur cette
       * table historique, voir docs/DEV_SPEC_TERANGA_v3.md section 0.6.a)
       */
=======

module.exports = (sequelize, DataTypes) => {
  class Service extends Model {
    static associate(models) {
      // Relations utilisateurs
      Service.belongsTo(models.User, { foreignKey: 'clientId', as: 'client' });
      Service.belongsTo(models.User, { foreignKey: 'agentId', as: 'agent' });
      Service.belongsTo(models.User, { foreignKey: 'createdById', as: 'creator' });

      // Lien vers une propriété (optionnel)
      Service.belongsTo(models.Property, { foreignKey: 'propertyId', as: 'property' });

      // Tâches liées au service
      Service.hasMany(models.Task, {
        foreignKey: 'serviceId',
        as: 'tasks',
        onDelete: 'CASCADE',
        hooks: true,
      });

      /**
       * 🌍 Multi-pays (associations logiques uniquement)
       * - Pas de FK DB pour garder les imports MySQL portables
       * - Permet include: [{ model: Country, as: 'country' }]
       */
      if (models.Country) {
        Service.belongsTo(models.Country, {
          foreignKey: 'countryId',
          as: 'country',
        });
      }

      if (models.Region) {
        Service.belongsTo(models.Region, {
          foreignKey: 'regionId',
          as: 'region',
        });
      }

      /**
       * 🛠️ Teranga Pro (Dev spec v3, associations logiques uniquement —
       * providerId/tradeCategoryId ne portent pas de FK physique sur cette
       * table historique, voir docs/DEV_SPEC_TERANGA_v3.md section 0.6.a)
       */
>>>>>>> feat/mobility-delivery-pricing
      if (models.Provider) {
        Service.belongsTo(models.Provider, {
          foreignKey: 'providerId',
          as: 'provider',
        });
      }

      if (models.Vehicle) {
        Service.belongsTo(models.Vehicle, {
          foreignKey: 'vehicleId',
          as: 'vehicle',
        });
      }

      if (models.TradeCategory) {
        Service.belongsTo(models.TradeCategory, {
          foreignKey: 'tradeCategoryId',
          as: 'tradeCategory',
        });
      }

      if (models.MissionStatusHistory) {
        Service.hasMany(models.MissionStatusHistory, {
          foreignKey: 'serviceId',
          as: 'missionStatusHistory',
        });
      }

      if (models.MissionShareToken) {
        Service.hasMany(models.MissionShareToken, {
          foreignKey: 'serviceId',
          as: 'shareTokens',
        });
      }

      if (models.MissionRating) {
        Service.hasOne(models.MissionRating, {
          foreignKey: 'serviceId',
          as: 'rating',
        });
      }

      // PiÃ¨ces jointes de la crÃ©ation guidÃ©e (section 4.1, Ã©tape 3 : photo + note vocale) â€”
      // alias distinct de Task.evidences pour rester lisible (deux chemins d'accÃ¨s diffÃ©rents
      // vers la mÃªme table evidences).
      if (models.Evidence) {
        Service.hasMany(models.Evidence, {
          foreignKey: 'serviceId',
          as: 'attachments',
        });
      }
    }
  }

  Service.init(
    {
      clientId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      agentId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      createdById: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

      // ðŸ”¥ Correction : devient facultatif
      propertyId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

      type: {
        type: DataTypes.ENUM(
          'errand',
          'administrative',
          'payment',
          'money_transfer',
          'other'
        ),
        allowNull: false,
      },

      title: { type: DataTypes.STRING, allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      contactPerson: { type: DataTypes.STRING, allowNull: true },
      contactPhone: { type: DataTypes.STRING, allowNull: true },
      address: { type: DataTypes.TEXT, allowNull: true },

      /**
       * ============================================================
       * ðŸŒ GÃ©olocalisation mission (Dev spec v3, section 0.5 / 4.3)
       * ============================================================
       * - Nullable en DB (historique sans coordonnÃ©es), mais requis par
       *   Joi sur toute NOUVELLE crÃ©ation de mission Ã  partir de ce lot.
       * - AlimentÃ© soit par Places Autocomplete (frontend), soit par un
       *   gÃ©ocodage serveur de `address` (voir geocoding.service.js).
       */
      latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
      longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },

      budget: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      currency: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'XOF',
      },

      status: {
        type: DataTypes.ENUM('created', 'in_progress', 'completed', 'validated'),
        allowNull: false,
        defaultValue: 'created',
      },

      /**
       * ============================================================
       * ðŸŒ Multi-pays / franchise (NOUVEAU â€“ non bloquant)
       * ============================================================
       * - AjoutÃ© par migration : services.countryId / services.regionId
       * - Nullable pour ne rien casser en prod
       * - Rempli par :
       *    â€¢ backfill (Mali/Bamako) migration
       *    â€¢ resolveGeoScope / hÃ©ritage user/franchise cÃ´tÃ© backend
       */
      countryId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      regionId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },

      /**
       * ============================================================
       * ðŸ› ï¸ Teranga Pro / App (Dev spec v3 â€” Lot 1, non bloquant)
       * ============================================================
       * - executionType/providerId/tradeCategoryId/warrantyExpiresAt ajoutÃ©s
       *   par migration 20260724103400-add-mission-fields-to-services.js
       * - missionStatus est ADDITIF : ne remplace pas `status` legacy
       *   ci-dessus. Synchronisation applicative prÃ©vue en Lot 2/3
       *   (docs/DEV_SPEC_TERANGA_v3.md section 0.6.b) â€” non implÃ©mentÃ©e ici.
       */
      executionType: {
        type: DataTypes.ENUM('agent', 'provider'),
        allowNull: false,
        defaultValue: 'agent',
      },
      providerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      vehicleId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'vehicle_id',
      },
      tradeCategoryId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      missionStatus: {
        type: DataTypes.ENUM(...MISSION_STATUS_VALUES),
        allowNull: true,
      },
      warrantyExpiresAt: { type: DataTypes.DATE, allowNull: true },
      // Idempotence du job d'alerte de seuil (docs/DEV_SPEC_TERANGA_v4_PHASE0.md Â§1.2) â€”
      // rÃ©initialisÃ©e Ã  chaque transition de statut par missionStatus.service.js.
      thresholdAlertSentAt: { type: DataTypes.DATE, allowNull: true },

      // Sous-mission mobilitÃ© interne, Cas 1 (docs/DEV_SPEC_TERANGA_v5_PHASE2.md Â§4) â€”
      // `address`/`latitude`/`longitude` ci-dessus restent la DÃ‰POSE, ces colonnes portent le
      // RETRAIT. `parentServiceId` rattache la sous-mission Ã  la mission mÃ¨re (association
      // logique, invisible du client).
      parentServiceId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      pickupAddress: { type: DataTypes.STRING(255), allowNull: true },
      pickupLatitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
      pickupLongitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
      requestedVehicleType: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'requested_vehicle_type',
        validate: { isIn: [['motorcycle', 'car']] },
      },
      packageType: {
        type: DataTypes.STRING(30),
        allowNull: true,
        field: 'package_type',
        validate: { isIn: [DELIVERY_PACKAGE_TYPE_VALUES] },
      },
      recipientName: {
        type: DataTypes.STRING(120),
        allowNull: true,
        field: 'recipient_name',
      },
      recipientPhone: {
        type: DataTypes.STRING(40),
        allowNull: true,
        field: 'recipient_phone',
      },
      packageHandling: {
        type: DataTypes.JSON,
        allowNull: true,
        field: 'package_handling',
        validate: {
          isValidHandling(value) {
            if (value == null) return;
            if (
              !Array.isArray(value) ||
              value.some((item) => !DELIVERY_HANDLING_VALUES.includes(item))
            ) {
<<<<<<< HEAD
              throw new Error('PrÃ©cautions de colis invalides');
=======
              throw new Error('Précautions de colis invalides');
>>>>>>> feat/mobility-delivery-pricing
            }
          },
        },
      },
<<<<<<< HEAD

      // FenÃªtre d'acceptation du dispatch mobilitÃ© (docs/DEV_SPEC_TERANGA_v5_PHASE2.md Â§5.2) â€”
      // posÃ©e uniquement pour la filiÃ¨re MobilitÃ©, NULL partout ailleurs.
=======

      // Fenêtre d'acceptation du dispatch mobilité (docs/DEV_SPEC_TERANGA_v5_PHASE2.md §5.2) —
      // posée uniquement pour la filière Mobilité, NULL partout ailleurs.
>>>>>>> feat/mobility-delivery-pricing
      acceptanceDeadlineAt: { type: DataTypes.DATE, allowNull: true },

      startAuthorizedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'start_authorized_at',
      },
      startAuthorizationMethod: {
        type: DataTypes.ENUM('code', 'admin_override'),
        allowNull: true,
        field: 'start_authorization_method',
      },
      startAuthorizedByUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'start_authorized_by_user_id',
      },
      startOverrideReason: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: 'start_override_reason',
      },

      // RÃ©conciliation cash Ã  la remise, filiÃ¨re livraison (docs/DEV_SPEC_TERANGA_v6_PHASE3.md
      // Â§5) â€” dÃ©clarÃ© par l'exÃ©cutant Ã  la transition COMPLETED, NULL partout ailleurs.
      collectedAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    },
    {
      sequelize,
      modelName: 'Service',
      tableName: 'services',

      /**
       * âœ… Timestamps
       * AlignÃ© avec ta prod : createdAt/updatedAt camelCase
       * (ta config globale timestamps:true est dÃ©jÃ  en place)
       */
      timestamps: true,
    }
  );

  return Service;
};

