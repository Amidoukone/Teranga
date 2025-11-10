'use strict';

/**
 * Modèle: ProjectDocument
 * -----------------------
 * - Document rattaché à un projet (obligatoire) et optionnellement à une phase
 * - Conserve toutes les métadonnées de fichier (originalName, mimeType, fileSize, filePath)
 * - Uploader optionnel (SET NULL si supprimé)
 * - Ajout: phaseId (nullable) → ProjectPhase
 */

module.exports = (sequelize, DataTypes) => {
  const ProjectDocument = sequelize.define(
    'ProjectDocument',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      // 🔗 Relations obligatoires / optionnelles
      projectId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'projects', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        comment: 'FK → projects.id (suppression en cascade)',
      },
      uploaderId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
        comment: 'FK → users.id (uploader; null si utilisateur supprimé)',
      },

      // 🆕 Relation optionnelle vers une phase précise du projet
      phaseId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'project_phases', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
        comment: 'FK → project_phases.id (nullable; SET NULL si phase supprimée)',
      },

      // 📄 Métadonnées fichier
      originalName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Nom original du fichier (ex: devis.pdf)',
      },
      filePath: {
        type: DataTypes.STRING(1024),
        allowNull: false,
        comment: 'Chemin d’accès sur le serveur (ex: /uploads/projects/xxx.pdf)',
      },
      mimeType: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Type MIME (image/png, application/pdf, etc.)',
      },
      fileSize: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        comment: 'Taille du fichier en octets',
      },

      // 🧾 Champs métier optionnels
      title: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Titre descriptif du document (facultatif)',
      },
      kind: {
        type: DataTypes.ENUM('contract', 'plan', 'report', 'photo', 'other'),
        allowNull: false,
        defaultValue: 'other',
        comment: 'Typologie fonctionnelle du document',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Notes libres (facultatif)',
      },
    },
    {
      tableName: 'project_documents',
      timestamps: true,
      underscored: false,
      // ⚠️ Important: on ne touche pas au nom de la table ni aux colonnes
      // pour rester 100% compatible avec les migrations existantes.
    }
  );

  // 🔗 Associations ORM
  ProjectDocument.associate = (models) => {
    // Document → Projet (obligatoire)
    ProjectDocument.belongsTo(models.Project, {
      as: 'project',
      foreignKey: 'projectId',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    // Document → Uploader (optionnel)
    ProjectDocument.belongsTo(models.User, {
      as: 'uploader',
      foreignKey: 'uploaderId',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    // 🆕 Document → Phase (optionnel)
    ProjectDocument.belongsTo(models.ProjectPhase, {
      as: 'phase',
      foreignKey: 'phaseId',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
  };

  return ProjectDocument;
};
