'use strict';

// Pièces jointes de la création de mission guidée (docs/DEV_SPEC_TERANGA_v3.md section 4.1,
// étape 3 : photo + note vocale optionnelles). `evidences` n'était liée qu'à `taskId`/`orderId` —
// aucune tâche n'existe encore au moment de la création guidée (les tâches sont créées
// manuellement, indépendamment des missions). Colonne additive camelCase (cohérente avec
// taskId/uploaderId existants sur cette table, pas de underscored ici). FK réelle : c'est une
// relation neuve introduite par ce chantier, pas un rattrapage rétroactif d'une relation
// historique (cf. section 0.5 — la dette "pas de FK sur tables existantes" concerne les relations
// déjà en place, pas les nouvelles qu'on ajoute maintenant). ON DELETE SET NULL : une mission n'est
// jamais supprimée physiquement dans ce repo (cycle de statut, pas de hard delete), mais on reste
// défensif si ça change un jour.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('evidences');

    if (!Object.prototype.hasOwnProperty.call(table, 'serviceId')) {
      await queryInterface.addColumn('evidences', 'serviceId', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'services', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }

    const indexes = await queryInterface.showIndex('evidences');
    const existingIndexNames = new Set(indexes.map((idx) => idx.name));

    if (!existingIndexNames.has('idx_evidences_service_id')) {
      await queryInterface.addIndex('evidences', ['serviceId'], {
        name: 'idx_evidences_service_id',
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('evidences');

    try {
      await queryInterface.removeIndex('evidences', 'idx_evidences_service_id');
    } catch (e) {
      // index déjà absent
    }

    if (Object.prototype.hasOwnProperty.call(table, 'serviceId')) {
      await queryInterface.removeColumn('evidences', 'serviceId');
    }
  },
};
