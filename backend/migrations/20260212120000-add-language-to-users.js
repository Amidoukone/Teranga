'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'language', {
      type: Sequelize.STRING(5),
      allowNull: true,
      defaultValue: 'fr',
    });

    // Backfill existing rows
    await queryInterface.sequelize.query(
      "UPDATE users SET language = 'fr' WHERE language IS NULL"
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'language');
  },
};
