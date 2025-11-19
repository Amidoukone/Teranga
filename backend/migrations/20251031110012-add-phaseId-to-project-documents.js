'use strict';

/**
 * ✅ Migration : Ajout de la colonne phaseId dans la table project_documents
 * -------------------------------------------------------------
 * Version PlanetScale : SANS contrainte de clé étrangère
 * -------------------------------------------------------------
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1️⃣ Ajout de la colonne phaseId (sans FK)
    await queryInterface.addColumn('project_documents', 'phaseId', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      // ❌ PAS de "references", "onUpdate", "onDelete" sur PlanetScale
      // optionnel : conservé, uniquement pour l'ordre des colonnes (MySQL)
      after: 'projectId',
    });

    // 2️⃣ Index pour les filtres/jointures logiques
    await queryInterface.addIndex('project_documents', ['phaseId'], {
      name: 'idx_project_documents_phaseId',
    });

    console.log('✅ Colonne phaseId ajoutée à project_documents (sans FK)');
  },

  async down(queryInterface) {
    // 1️⃣ Suppression de l’index
    await queryInterface.removeIndex('project_documents', 'idx_project_documents_phaseId');

    // 2️⃣ Suppression de la colonne
    await queryInterface.removeColumn('project_documents', 'phaseId');

    console.log('🧹 Colonne phaseId retirée de project_documents');
  },
};
