'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE services AS service
      INNER JOIN trade_categories AS category
        ON category.id = service.tradeCategoryId
      SET service.agentId = NULL
      WHERE category.slug IN ('mobilite', 'livraison')
        AND service.agentId IS NOT NULL
    `);
  },

  async down() {
    // Les anciennes affectations d'agents ne peuvent pas être restaurées sans journal historique.
  },
};
