'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('properties', {
      id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      ownerId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      title: { type: Sequelize.STRING(255), allowNull: false },
      description: { type: Sequelize.TEXT },
      type: { 
        type: Sequelize.ENUM('house','apartment','land','commercial'), 
        allowNull: false 
      },
      address: { type: Sequelize.TEXT, allowNull: false },
      city: { type: Sequelize.STRING(100), allowNull: false },
      postalCode: { type: Sequelize.STRING(20) },
      latitude: { type: Sequelize.DECIMAL(10,7) },
      longitude: { type: Sequelize.DECIMAL(10,7) },
      surfaceArea: { type: Sequelize.DECIMAL(10,2) },
      roomCount: { type: Sequelize.INTEGER },
      status: { 
        type: Sequelize.ENUM('active','inactive','sold'), 
        defaultValue: 'active' 
      },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('properties');
  }
};
