'use strict';

module.exports = (sequelize, DataTypes) => {
  const ProjectDocument = sequelize.define(
    'ProjectDocument',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      // Relations (logique seulement – NO FK constraints for PlanetScale)
      projectId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      uploaderId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      phaseId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },

      // Métadonnées fichier
      originalName: { type: DataTypes.STRING(255), allowNull: true },

      // ⭐ URL complète ImageKit (ou fallback /uploads legacy)
      filePath: { type: DataTypes.STRING(2048), allowNull: false },

      // ⭐ fileId ImageKit pour suppression
      fileId: { type: DataTypes.STRING(255), allowNull: true },

      mimeType: { type: DataTypes.STRING(255), allowNull: true },
      fileSize: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

      // Champs métier
      title: { type: DataTypes.STRING(255), allowNull: true },
      kind: {
        type: DataTypes.ENUM('contract', 'plan', 'report', 'photo', 'other'),
        allowNull: false,
        defaultValue: 'other',
      },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: 'project_documents',
      timestamps: true,
      underscored: false,
    }
  );

  ProjectDocument.associate = (models) => {
    ProjectDocument.belongsTo(models.Project, {
      as: 'project',
      foreignKey: 'projectId',
    });
    ProjectDocument.belongsTo(models.User, {
      as: 'uploader',
      foreignKey: 'uploaderId',
    });
    ProjectDocument.belongsTo(models.ProjectPhase, {
      as: 'phase',
      foreignKey: 'phaseId',
    });
  };

  return ProjectDocument;
};
