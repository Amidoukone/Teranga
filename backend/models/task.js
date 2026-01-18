'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Task extends Model {
    static associate(models) {
      // 🔗 Tâche liée à un service (optionnelle)
      Task.belongsTo(models.Service, { foreignKey: 'serviceId', as: 'service' });

      // 🔗 Tâche liée à un bien immobilier (optionnelle)
      Task.belongsTo(models.Property, { foreignKey: 'propertyId', as: 'property' });

      // 🔗 Créateur de la tâche (client, agent ou admin)
      Task.belongsTo(models.User, { foreignKey: 'creatorId', as: 'creator' });

      // 🔗 Utilisateur assigné à la tâche (agent)
      Task.belongsTo(models.User, { foreignKey: 'assignedTo', as: 'assignee' });

      // ✅ Nouvelles pièces justificatives / preuves
      Task.hasMany(models.Evidence, {
        foreignKey: 'taskId',
        as: 'evidences',
        onDelete: 'CASCADE',
        hooks: true,
      });

      /**
       * 🌍 Multi-pays (associations logiques uniquement)
       * - Pas de FK DB (PlanetScale friendly)
       * - Permet include: [{ model: Country, as: 'country' }]
       */
      if (models.Country) {
        Task.belongsTo(models.Country, {
          foreignKey: 'countryId',
          as: 'country',
        });
      }

      if (models.Region) {
        Task.belongsTo(models.Region, {
          foreignKey: 'regionId',
          as: 'region',
        });
      }
    }
  }

  Task.init(
    {
      // Relations
      serviceId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, // ✅ optionnel
      propertyId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      creatorId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      assignedTo: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

      // Métadonnées
      type: {
        type: DataTypes.ENUM('repair', 'visit', 'administrative', 'shopping', 'other'),
        allowNull: false,
      },
      title: { type: DataTypes.STRING, allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },

      priority: {
        type: DataTypes.ENUM('normal', 'urgent', 'critical'),
        allowNull: false,
        defaultValue: 'normal',
      },
      status: {
        type: DataTypes.ENUM('created', 'in_progress', 'completed', 'validated', 'cancelled'),
        allowNull: false,
        defaultValue: 'created',
      },

      // Coûts / dates
      estimatedCost: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      actualCost: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      dueDate: { type: DataTypes.DATE, allowNull: true },
      completedAt: { type: DataTypes.DATE, allowNull: true },

      /**
       * ============================================================
       * 🌍 Multi-pays / franchise (NOUVEAU – non bloquant)
       * ============================================================
       * - Ajouté par migration : tasks.countryId / tasks.regionId
       * - Nullable pour ne rien casser en prod
       * - Rempli par :
       *    • backfill (Mali/Bamako) migration
       *    • resolveGeoScope / héritage depuis Service/Property/Project
       */
      countryId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      regionId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    },
    {
      sequelize,
      modelName: 'Task',
      tableName: 'tasks',

      /**
       * ✅ Timestamps
       * Aligné avec ta prod : createdAt/updatedAt camelCase
       * (ta config globale define.timestamps=true est déjà en place)
       */
      timestamps: true,
    }
  );

  return Task;
};
