'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('users', 'email', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    await queryInterface.sequelize.query(
      "UPDATE users SET phone = NULL WHERE phone IS NOT NULL AND TRIM(phone) = ''"
    );
    await queryInterface.sequelize.query(
      "UPDATE users SET phone = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(phone), ' ', ''), '-', ''), '.', ''), '(', ''), ')', '') WHERE phone IS NOT NULL"
    );
    await queryInterface.sequelize.query(
      "UPDATE users SET phone = CONCAT('+', SUBSTRING(phone, 3)) WHERE phone LIKE '00%' AND LENGTH(phone) > 2"
    );

    await queryInterface.addIndex('users', ['phone'], {
      name: 'users_phone_auth_lookup_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('users', 'users_phone_auth_lookup_idx');

    await queryInterface.sequelize.query(
      "UPDATE users SET email = CONCAT('phone-only-', id, '@rollback.teranga.local') WHERE email IS NULL"
    );

    await queryInterface.changeColumn('users', 'email', {
      type: Sequelize.STRING(255),
      allowNull: false,
    });
  },
};
