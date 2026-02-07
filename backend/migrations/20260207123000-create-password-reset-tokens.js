'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('password_reset_tokens', {
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

      token_hash: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },

      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
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

    await queryInterface.addIndex('password_reset_tokens', ['user_id']);
    await queryInterface.addIndex('password_reset_tokens', ['expires_at']);
    await queryInterface.addIndex('password_reset_tokens', ['used_at']);
    await queryInterface.addIndex('password_reset_tokens', ['token_hash'], {
      unique: true,
      name: 'password_reset_tokens_token_hash_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('password_reset_tokens');
  },
};
