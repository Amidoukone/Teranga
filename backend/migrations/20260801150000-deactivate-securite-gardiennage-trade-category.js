'use strict';

// docs/DEV_SPEC_TERANGA_v4_PHASE0.md §5 — retrait de la filière "Sécurité/gardiennage", hors
// compétence de Teranga (décision actée dans docs/BRAINSTORM_ECOSYSTEME_TERANGA.md §8.1).
// Désactivation, pas suppression physique : préserve l'historique des missions déjà passées sur
// cette filière et les prestataires déjà onboardés dessus. Vérifié avant ce lot : le sélecteur
// public (tradeCategory.controller.js exports.list), le formulaire d'onboarding prestataire
// (AdminProvidersPage.jsx) et la page de gestion admin filtrent déjà correctement sur
// isActive — aucun changement de code nécessaire, uniquement la donnée.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "UPDATE trade_categories SET is_active = false WHERE slug = 'securite-gardiennage'"
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "UPDATE trade_categories SET is_active = true WHERE slug = 'securite-gardiennage'"
    );
  },
};
