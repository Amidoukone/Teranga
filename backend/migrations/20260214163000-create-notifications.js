'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notifications', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      userId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
      },
      actorId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
      },

      entityType: {
        type: Sequelize.ENUM('service', 'task', 'order', 'evidence', 'project'),
        allowNull: false,
      },
      entityId: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      action: {
        type: Sequelize.ENUM('created', 'assigned', 'status_updated'),
        allowNull: false,
        defaultValue: 'created',
      },

      title: {
        type: Sequelize.STRING(180),
        allowNull: true,
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      status: {
        type: Sequelize.ENUM('unread', 'read'),
        allowNull: false,
        defaultValue: 'unread',
      },
      progress: {
        type: Sequelize.ENUM('new', 'in_progress', 'done'),
        allowNull: false,
        defaultValue: 'new',
      },
      entityStatus: {
        type: Sequelize.STRING(40),
        allowNull: true,
      },

      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
      },

      countryId: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      regionId: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },

      readAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex('notifications', ['userId'], {
      name: 'idx_notifications_user',
    });
    await queryInterface.addIndex('notifications', ['status'], {
      name: 'idx_notifications_status',
    });
    await queryInterface.addIndex('notifications', ['progress'], {
      name: 'idx_notifications_progress',
    });
    await queryInterface.addIndex('notifications', ['entityType', 'entityId'], {
      name: 'idx_notifications_entity',
    });
    await queryInterface.addIndex('notifications', ['createdAt'], {
      name: 'idx_notifications_created_at',
    });
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex('notifications', 'idx_notifications_user');
    } catch (e) {}
    try {
      await queryInterface.removeIndex('notifications', 'idx_notifications_status');
    } catch (e) {}
    try {
      await queryInterface.removeIndex(
        'notifications',
        'idx_notifications_progress'
      );
    } catch (e) {}
    try {
      await queryInterface.removeIndex('notifications', 'idx_notifications_entity');
    } catch (e) {}
    try {
      await queryInterface.removeIndex(
        'notifications',
        'idx_notifications_created_at'
      );
    } catch (e) {}

    await queryInterface.dropTable('notifications');

    if (queryInterface.sequelize.options.dialect === 'postgres') {
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_notifications_entityType";'
      );
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_notifications_action";'
      );
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_notifications_status";'
      );
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_notifications_progress";'
      );
    }
  },
};
