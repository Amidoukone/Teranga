'use strict';

module.exports = (sequelize, DataTypes) => {
  const Project = sequelize.define(
    'Project',
    {
      // 🧱 Données principales
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      type: {
        type: DataTypes.STRING,
        allowNull: false, // immobilier, agricole, administratif, etc.
      },

      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      // 💰 Budget & devise
      budget: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },

      currency: {
        type: DataTypes.STRING(5),
        allowNull: false,
        defaultValue: 'XOF',
      },

      // 🚦 Statut du projet
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'created', // created, in_progress, completed, validated
      },

      // 👤 Relations utilisateurs (logiques)
      clientId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      agentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      /**
       * ============================================================
       * 🌍 Multi-pays / franchise (NOUVEAU – non bloquant)
       * ============================================================
       * - Ajouté par migration : projects.countryId / projects.regionId
       * - Nullable pour éviter toute régression en prod
       * - Renseigné par :
       *    • migration de backfill (Mali / Bamako)
       *    • resolveGeoScope côté controller à la création
       */
      countryId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },

      regionId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Project',
      tableName: 'projects',

      /**
       * ============================================================
       * ✅ Timestamps
       * ============================================================
       * - Ta table projects utilise createdAt / updatedAt (camelCase)
       * - Ta config Sequelize globale a timestamps:true
       * - On laisse Sequelize gérer automatiquement
       */
      timestamps: true,
    }
  );

  /**
   * ============================================================
   * 🔗 Associations
   * ============================================================
   */
  Project.associate = (models) => {
    // Client du projet
    Project.belongsTo(models.User, {
      as: 'client',
      foreignKey: 'clientId',
    });

    // Agent assigné
    Project.belongsTo(models.User, {
      as: 'agent',
      foreignKey: 'agentId',
    });

    // Phases du projet
    Project.hasMany(models.ProjectPhase, {
      as: 'phases',
      foreignKey: 'projectId',
      onDelete: 'CASCADE',
    });

    // Tâches liées
    Project.hasMany(models.Task, {
      as: 'tasks',
      foreignKey: 'projectId',
      onDelete: 'SET NULL',
    });

    // Documents du projet
    Project.hasMany(models.ProjectDocument, {
      as: 'documents',
      foreignKey: 'projectId',
      onDelete: 'CASCADE',
    });

    /**
     * 🌍 Associations multi-pays (logiques uniquement)
     * ------------------------------------------------------------
     * - Pas de FK en DB pour garder les imports MySQL portables
     * - Permet include: [{ model: Country, as: 'country' }]
     */
    if (models.Country) {
      Project.belongsTo(models.Country, {
        foreignKey: 'countryId',
        as: 'country',
      });
    }

    if (models.Region) {
      Project.belongsTo(models.Region, {
        foreignKey: 'regionId',
        as: 'region',
      });
    }
  };

  return Project;
};
