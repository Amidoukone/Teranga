'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      email: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      passwordHash: { type: Sequelize.STRING(255), allowNull: false },
      firstName: { type: Sequelize.STRING(100) },
      lastName: { type: Sequelize.STRING(100) },
      phone: { type: Sequelize.STRING(50) },
      country: { type: Sequelize.STRING(2) },
      role: { 
        type: Sequelize.ENUM('client', 'agent', 'admin'), 
        allowNull: false, 
        defaultValue: 'client' 
      },
      emailVerified: { type: Sequelize.BOOLEAN, defaultValue: false },
      phoneVerified: { type: Sequelize.BOOLEAN, defaultValue: false },
      lastLogin: { type: Sequelize.DATE },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('users');
  }
};
