'use strict';
const { Model } = require('sequelize');

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
       * - Pas de FK DB (PlanetScale friendly)
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
