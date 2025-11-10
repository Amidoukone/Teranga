'use strict';

/**
 * ✅ Migration : Ajout de la colonne phaseId dans la table project_documents
 * -------------------------------------------------------------
 * - Permet de rattacher un document à une phase précise du projet
 * - Relation optionnelle : (phaseId) → project_phases(id)
 * - Compatible MySQL et PostgreSQL
 * -------------------------------------------------------------
 * Pour exécuter :
 *   npx sequelize-cli db:migrate
 * -------------------------------------------------------------
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1️⃣ Ajout de la colonne phaseId
    await queryInterface.addColumn('project_documents', 'phaseId', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'project_phases', // table cible
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      after: 'projectId', // position (pour MySQL, ignoré par PostgreSQL)
    });

    // 2️⃣ Index pour accélérer les jointures et filtres
    await queryInterface.addIndex('project_documents', ['phaseId'], {
      name: 'idx_project_documents_phaseId',
    });

    console.log('✅ Colonne phaseId ajoutée à project_documents');
  },

  async down(queryInterface, Sequelize) {
    // 1️⃣ Suppression de l’index
    await queryInterface.removeIndex('project_documents', 'idx_project_documents_phaseId');

    // 2️⃣ Suppression de la colonne
    await queryInterface.removeColumn('project_documents', 'phaseId');

    console.log('🧹 Colonne phaseId retirée de project_documents');
  },
};
