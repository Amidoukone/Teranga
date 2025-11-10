'use strict';
const bcrypt = require('bcrypt');

module.exports = {
  async up (queryInterface, Sequelize) {
    const passwordHash = await bcrypt.hash('Admin123!', 10);
    return queryInterface.bulkInsert('users', [{
      email: 'admin@teranga.com',
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'admin',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});
  },

  async down (queryInterface, Sequelize) {
    return queryInterface.bulkDelete('users', { email: 'admin@teranga.com' }, {});
  }
};
