'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('products', 'cover_image', {
      type: Sequelize.STRING,
      allowNull: true,
    }).catch(() => { /* ignore si déjà là */ });

    await queryInterface.addColumn('products', 'gallery', {
      type: Sequelize.JSON,
      allowNull: true,
    }).catch(() => { /* ignore si déjà là */ });
  },

  async down(queryInterface /*, Sequelize */) {
    // down prudent : on ne touche qu'à gallery
    const table = await queryInterface.describeTable('products');
    const tasks = [];

    if (table.gallery) {
      tasks.push(queryInterface.removeColumn('products', 'gallery'));
    }

    if (tasks.length > 0) {
      await Promise.all(tasks);
    }
  },
};
