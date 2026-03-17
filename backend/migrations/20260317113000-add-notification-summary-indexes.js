'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex('notifications', ['userId', 'status'], {
      name: 'idx_notifications_user_status',
    });

    await queryInterface.addIndex('notifications', ['userId', 'progress'], {
      name: 'idx_notifications_user_progress',
    });
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex(
        'notifications',
        'idx_notifications_user_status'
      );
    } catch (_err) {}

    try {
      await queryInterface.removeIndex(
        'notifications',
        'idx_notifications_user_progress'
      );
    } catch (_err) {}
  },
};
