'use strict';

// users.phone n'avait qu'un index non-unique : deux inscriptions concurrentes
// avec le même nouveau numéro passaient toutes les deux le contrôle
// applicatif (SELECT puis INSERT) et créaient deux comptes distincts avec le
// même téléphone. La contrainte UNIQUE ferme la fenêtre de la course ; les
// comptes existants n'ont aucun doublon de téléphone (vérifié avant d'écrire
// cette migration), et NULL reste autorisé plusieurs fois (comptes email-only).
module.exports = {
  async up(queryInterface) {
    await queryInterface.removeIndex('users', 'users_phone_auth_lookup_idx');
    await queryInterface.addIndex('users', ['phone'], {
      name: 'users_phone_unique_idx',
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('users', 'users_phone_unique_idx');
    await queryInterface.addIndex('users', ['phone'], {
      name: 'users_phone_auth_lookup_idx',
    });
  },
};
