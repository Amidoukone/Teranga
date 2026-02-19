'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('recovery_codes', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },

      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
      },

      code_hash: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },

      expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      used_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      created_by_ip: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      used_by_ip: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      user_agent: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('recovery_codes', ['user_id']);
    await queryInterface.addIndex('recovery_codes', ['expires_at']);
    await queryInterface.addIndex('recovery_codes', ['used_at']);
    await queryInterface.addIndex('recovery_codes', ['code_hash'], {
      unique: true,
      name: 'recovery_codes_code_hash_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('recovery_codes');
  },
};
