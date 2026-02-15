'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('activities', {
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
        type: Sequelize.STRING(40),
        allowNull: false,
      },
      entityId: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      action: {
        type: Sequelize.STRING(60),
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

    await queryInterface.addIndex('activities', ['userId'], {
      name: 'idx_activities_user',
    });
    await queryInterface.addIndex('activities', ['entityType', 'entityId'], {
      name: 'idx_activities_entity',
    });
    await queryInterface.addIndex('activities', ['createdAt'], {
      name: 'idx_activities_created_at',
    });
    await queryInterface.addIndex('activities', ['countryId'], {
      name: 'idx_activities_country',
    });
    await queryInterface.addIndex('activities', ['regionId'], {
      name: 'idx_activities_region',
    });
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex('activities', 'idx_activities_user');
    } catch (e) {}
    try {
      await queryInterface.removeIndex('activities', 'idx_activities_entity');
    } catch (e) {}
    try {
      await queryInterface.removeIndex('activities', 'idx_activities_created_at');
    } catch (e) {}
    try {
      await queryInterface.removeIndex('activities', 'idx_activities_country');
    } catch (e) {}
    try {
      await queryInterface.removeIndex('activities', 'idx_activities_region');
    } catch (e) {}

    await queryInterface.dropTable('activities');

    if (queryInterface.sequelize.options.dialect === 'postgres') {
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS \"enum_activities_progress\";'
      );
    }
  },
};
