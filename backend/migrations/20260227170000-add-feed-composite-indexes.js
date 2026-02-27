'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex('notifications', ['userId', 'createdAt'], {
      name: 'idx_notifications_user_created_at',
    });
    await queryInterface.addIndex(
      'notifications',
      ['userId', 'status', 'createdAt'],
      {
        name: 'idx_notifications_user_status_created_at',
      }
    );
    await queryInterface.addIndex(
      'notifications',
      ['userId', 'progress', 'createdAt'],
      {
        name: 'idx_notifications_user_progress_created_at',
      }
    );

    await queryInterface.addIndex('activities', ['userId', 'createdAt'], {
      name: 'idx_activities_user_created_at',
    });
    await queryInterface.addIndex(
      'activities',
      ['userId', 'progress', 'createdAt'],
      {
        name: 'idx_activities_user_progress_created_at',
      }
    );
    await queryInterface.addIndex(
      'activities',
      ['userId', 'entityType', 'createdAt'],
      {
        name: 'idx_activities_user_entity_created_at',
      }
    );
    await queryInterface.addIndex(
      'activities',
      ['userId', 'action', 'createdAt'],
      {
        name: 'idx_activities_user_action_created_at',
      }
    );
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex(
        'notifications',
        'idx_notifications_user_created_at'
      );
    } catch (_err) {}
    try {
      await queryInterface.removeIndex(
        'notifications',
        'idx_notifications_user_status_created_at'
      );
    } catch (_err) {}
    try {
      await queryInterface.removeIndex(
        'notifications',
        'idx_notifications_user_progress_created_at'
      );
    } catch (_err) {}

    try {
      await queryInterface.removeIndex(
        'activities',
        'idx_activities_user_created_at'
      );
    } catch (_err) {}
    try {
      await queryInterface.removeIndex(
        'activities',
        'idx_activities_user_progress_created_at'
      );
    } catch (_err) {}
    try {
      await queryInterface.removeIndex(
        'activities',
        'idx_activities_user_entity_created_at'
      );
    } catch (_err) {}
    try {
      await queryInterface.removeIndex(
        'activities',
        'idx_activities_user_action_created_at'
      );
    } catch (_err) {}
  },
};
