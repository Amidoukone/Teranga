'use strict';

/**
 * ✅ Migration : Ajout de la colonne phaseId dans la table project_documents
 * -------------------------------------------------------------
 * Version portable MySQL : sans contrainte de cle etrangere
 * -------------------------------------------------------------
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Idempotent : create-project-documents.js (20251023231955) inclut déjà
    // phaseId depuis une modification ultérieure de cette migration
    // antérieure. Sur une base migrée pas-à-pas depuis le début (ex. prod),
    // phaseId n'existait pas encore à ce stade et cette migration l'ajoutait
    // réellement. Sur une base fraîche (ex. tests/CI), phaseId existe déjà
    // en sortant de create-project-documents.js — on ne doit pas ré-ajouter
    // la colonne/l'index dans ce cas.
    const table = await queryInterface.describeTable('project_documents');

    if (!Object.prototype.hasOwnProperty.call(table, 'phaseId')) {
      await queryInterface.addColumn('project_documents', 'phaseId', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        // Pas de "references", "onUpdate", "onDelete" pour rester portable.
        after: 'projectId',
      });
    }

    const indexes = await queryInterface.showIndex('project_documents');
    const hasPhaseIdIndex = indexes.some(
      (idx) => idx.name === 'idx_project_documents_phaseId'
    );
    if (!hasPhaseIdIndex) {
      await queryInterface.addIndex('project_documents', ['phaseId'], {
        name: 'idx_project_documents_phaseId',
      });
    }
  },

  async down(queryInterface) {
    const indexes = await queryInterface.showIndex('project_documents');
    const hasPhaseIdIndex = indexes.some(
      (idx) => idx.name === 'idx_project_documents_phaseId'
    );
    if (hasPhaseIdIndex) {
      await queryInterface.removeIndex('project_documents', 'idx_project_documents_phaseId');
    }

    const table = await queryInterface.describeTable('project_documents');
    if (Object.prototype.hasOwnProperty.call(table, 'phaseId')) {
      await queryInterface.removeColumn('project_documents', 'phaseId');
    }
  },
};
