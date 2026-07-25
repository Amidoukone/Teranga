'use strict';

// Ajoute 'provider' et 'category_manager' à la fin de l'ENUM users.role.
// MySQL 8.0.12+ traite un ajout de valeurs ENUM en fin de liste comme un
// changement de métadonnées uniquement (ALGORITHM=INSTANT) : pas de
// verrouillage ni de réécriture de table, contrairement à un retrait ou un
// réordonnancement des valeurs. Voir docs/DEV_SPEC_TERANGA_v3.md section 0.6.c.
module.exports = {
  async up(queryInterface) {
    const table = await queryInterface.describeTable('users');
    const currentType = (table.role && table.role.type) || '';

    if (currentType.includes('provider')) {
      return; // déjà appliqué, idempotent
    }

    await queryInterface.sequelize.query(`
      ALTER TABLE users
      MODIFY COLUMN role ENUM('client','agent','admin','provider','category_manager')
      NOT NULL DEFAULT 'client',
      ALGORITHM=INSTANT
    `);
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('users');
    const currentType = (table.role && table.role.type) || '';

    if (!currentType.includes('provider')) {
      return; // déjà revenu à l'état d'origine, idempotent
    }

    const [rows] = await queryInterface.sequelize.query(`
      SELECT COUNT(*) AS count FROM users WHERE role IN ('provider', 'category_manager')
    `);
    const count = Number(rows[0] && rows[0].count) || 0;

    if (count > 0) {
      throw new Error(
        `Rollback refusé : ${count} utilisateur(s) ont déjà le rôle 'provider' ou ` +
          `'category_manager'. Réassigner/supprimer ces comptes avant de retirer ces ` +
          `valeurs de l'ENUM users.role, sinon la conversion échouera ou tronquera des données.`
      );
    }

    await queryInterface.sequelize.query(`
      ALTER TABLE users
      MODIFY COLUMN role ENUM('client','agent','admin')
      NOT NULL DEFAULT 'client'
    `);
  },
};
