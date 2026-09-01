'use strict';

const {
  ORGANIZATION_TYPES,
  ORGANIZATION_STATUSES,
  TERRITORY_TYPES,
  ASSIGNMENT_STATUSES,
} = require('../src/constants/territorialGovernance');

const timestamps = (Sequelize) => ({
  created_at: {
    allowNull: false,
    type: Sequelize.DATE,
    defaultValue: Sequelize.fn('NOW'),
  },
  updated_at: {
    allowNull: false,
    type: Sequelize.DATE,
    defaultValue: Sequelize.fn('NOW'),
  },
});

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('organizations', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      type: {
        type: Sequelize.ENUM(...ORGANIZATION_TYPES),
        allowNull: false,
      },
      parent_organization_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      country_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      region_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      code: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },
      legal_name: {
        type: Sequelize.STRING(180),
        allowNull: false,
      },
      display_name: {
        type: Sequelize.STRING(180),
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM(...ORGANIZATION_STATUSES),
        allowNull: false,
        defaultValue: 'pending',
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      ...timestamps(Sequelize),
    });

    await queryInterface.addIndex('organizations', ['code'], {
      unique: true,
      name: 'uniq_organizations_code',
    });
    await queryInterface.addIndex('organizations', ['parent_organization_id'], {
      name: 'idx_organizations_parent',
    });
    await queryInterface.addIndex('organizations', ['country_id', 'region_id'], {
      name: 'idx_organizations_geo',
    });
    await queryInterface.addIndex('organizations', ['status', 'type'], {
      name: 'idx_organizations_status_type',
    });

    await queryInterface.createTable('territories', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      type: {
        type: Sequelize.ENUM(...TERRITORY_TYPES),
        allowNull: false,
      },
      parent_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      country_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
      },
      region_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      code: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(180),
        allowNull: false,
      },
      timezone: {
        type: Sequelize.STRING(80),
        allowNull: true,
      },
      aliases: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      ...timestamps(Sequelize),
    });

    await queryInterface.addIndex('territories', ['code'], {
      unique: true,
      name: 'uniq_territories_code',
    });
    await queryInterface.addIndex('territories', ['parent_id'], {
      name: 'idx_territories_parent',
    });
    await queryInterface.addIndex('territories', ['country_id', 'region_id'], {
      name: 'idx_territories_geo',
    });
    await queryInterface.addIndex('territories', ['type', 'is_active'], {
      name: 'idx_territories_type_active',
    });

    await queryInterface.createTable('organization_territories', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      organization_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
      },
      territory_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
      },
      is_primary: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      is_exclusive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },
      valid_from: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      valid_until: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      ...timestamps(Sequelize),
    });

    await queryInterface.addIndex(
      'organization_territories',
      ['organization_id', 'territory_id'],
      {
        unique: true,
        name: 'uniq_organization_territories_pair',
      }
    );
    await queryInterface.addIndex(
      'organization_territories',
      ['territory_id', 'status'],
      { name: 'idx_organization_territories_territory_status' }
    );

    await queryInterface.createTable('memberships', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
      },
      organization_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
      },
      territory_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      role_key: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },
      permissions: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM(...ASSIGNMENT_STATUSES),
        allowNull: false,
        defaultValue: 'active',
      },
      valid_from: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      valid_until: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      ...timestamps(Sequelize),
    });

    await queryInterface.addIndex('memberships', ['user_id', 'status'], {
      name: 'idx_memberships_user_status',
    });
    await queryInterface.addIndex(
      'memberships',
      ['organization_id', 'territory_id', 'status'],
      { name: 'idx_memberships_scope_status' }
    );
    await queryInterface.addIndex('memberships', ['role_key', 'status'], {
      name: 'idx_memberships_role_status',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('memberships');
    await queryInterface.dropTable('organization_territories');
    await queryInterface.dropTable('territories');
    await queryInterface.dropTable('organizations');
  },
};
