'use strict';
const { Model } = require('sequelize');
const { MISSION_STATUS_VALUES } = require('../src/constants/missionStatus');

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
      if (models.Provider) {
        Service.belongsTo(models.Provider, {
          foreignKey: 'providerId',
          as: 'provider',
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

      // Pièces jointes de la création guidée (section 4.1, étape 3 : photo + note vocale) —
      // alias distinct de Task.evidences pour rester lisible (deux chemins d'accès différents
      // vers la même table evidences).
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

      // 🔥 Correction : devient facultatif
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
       * 🌍 Géolocalisation mission (Dev spec v3, section 0.5 / 4.3)
       * ============================================================
       * - Nullable en DB (historique sans coordonnées), mais requis par
       *   Joi sur toute NOUVELLE création de mission à partir de ce lot.
       * - Alimenté soit par Places Autocomplete (frontend), soit par un
       *   géocodage serveur de `address` (voir geocoding.service.js).
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
       * 🌍 Multi-pays / franchise (NOUVEAU – non bloquant)
       * ============================================================
       * - Ajouté par migration : services.countryId / services.regionId
       * - Nullable pour ne rien casser en prod
       * - Rempli par :
       *    • backfill (Mali/Bamako) migration
       *    • resolveGeoScope / héritage user/franchise côté backend
       */
      countryId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      regionId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },

      /**
       * ============================================================
       * 🛠️ Teranga Pro / App (Dev spec v3 — Lot 1, non bloquant)
       * ============================================================
       * - executionType/providerId/tradeCategoryId/warrantyExpiresAt ajoutés
       *   par migration 20260724103400-add-mission-fields-to-services.js
       * - missionStatus est ADDITIF : ne remplace pas `status` legacy
       *   ci-dessus. Synchronisation applicative prévue en Lot 2/3
       *   (docs/DEV_SPEC_TERANGA_v3.md section 0.6.b) — non implémentée ici.
       */
      executionType: {
        type: DataTypes.ENUM('agent', 'provider'),
        allowNull: false,
        defaultValue: 'agent',
      },
      providerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      tradeCategoryId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      missionStatus: {
        type: DataTypes.ENUM(...MISSION_STATUS_VALUES),
        allowNull: true,
      },
      warrantyExpiresAt: { type: DataTypes.DATE, allowNull: true },
      // Idempotence du job d'alerte de seuil (docs/DEV_SPEC_TERANGA_v4_PHASE0.md §1.2) —
      // réinitialisée à chaque transition de statut par missionStatus.service.js.
      thresholdAlertSentAt: { type: DataTypes.DATE, allowNull: true },

      // Sous-mission mobilité interne, Cas 1 (docs/DEV_SPEC_TERANGA_v5_PHASE2.md §4) —
      // `address`/`latitude`/`longitude` ci-dessus restent la DÉPOSE, ces colonnes portent le
      // RETRAIT. `parentServiceId` rattache la sous-mission à la mission mère (association
      // logique, invisible du client).
      parentServiceId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      pickupAddress: { type: DataTypes.STRING(255), allowNull: true },
      pickupLatitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
      pickupLongitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },

      // Fenêtre d'acceptation du dispatch mobilité (docs/DEV_SPEC_TERANGA_v5_PHASE2.md §5.2) —
      // posée uniquement pour la filière Mobilité, NULL partout ailleurs.
      acceptanceDeadlineAt: { type: DataTypes.DATE, allowNull: true },

      // Réconciliation cash à la remise, filière livraison (docs/DEV_SPEC_TERANGA_v6_PHASE3.md
      // §5) — déclaré par l'exécutant à la transition COMPLETED, NULL partout ailleurs.
      collectedAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    },
    {
      sequelize,
      modelName: 'Service',
      tableName: 'services',

      /**
       * ✅ Timestamps
       * Aligné avec ta prod : createdAt/updatedAt camelCase
       * (ta config globale timestamps:true est déjà en place)
       */
      timestamps: true,
    }
  );

  return Service;
};
