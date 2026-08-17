'use strict';

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

async function addColumnIfMissing(queryInterface, tableName, columnName, definition) {
  const columns = await queryInterface.describeTable(tableName);
  if (!hasOwn(columns, columnName)) {
    await queryInterface.addColumn(tableName, columnName, definition);
  }
}

async function removeColumnIfPresent(queryInterface, tableName, columnName) {
  const columns = await queryInterface.describeTable(tableName);
  if (hasOwn(columns, columnName)) {
    await queryInterface.removeColumn(tableName, columnName);
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfMissing(queryInterface, 'services', 'start_authorized_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'services', 'start_authorization_method', {
      type: Sequelize.ENUM('code', 'admin_override'),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'services', 'start_authorized_by_user_id', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'services', 'start_override_reason', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });

    const tables = (await queryInterface.showAllTables()).map((table) =>
      String(typeof table === 'object' ? table.tableName || table.name : table).toLowerCase()
    );

    if (!tables.includes('mission_share_tokens')) {
      await queryInterface.createTable('mission_share_tokens', {
        id: {
          type: Sequelize.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        service_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          references: { model: 'services', key: 'id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        created_by_user_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
        },
        token_hash: { type: Sequelize.STRING(64), allowNull: false, unique: true },
        expires_at: { type: Sequelize.DATE, allowNull: false },
        revoked_at: { type: Sequelize.DATE, allowNull: true },
        last_accessed_at: { type: Sequelize.DATE, allowNull: true },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
        },
      });
    }

    if (!tables.includes('mission_ratings')) {
      await queryInterface.createTable('mission_ratings', {
        id: {
          type: Sequelize.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        service_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          references: { model: 'services', key: 'id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        client_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
        },
        provider_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          references: { model: 'providers', key: 'id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        score: { type: Sequelize.TINYINT.UNSIGNED, allowNull: false },
        comment: { type: Sequelize.STRING(500), allowNull: true },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
        },
      });
    }

    const shareIndexes = await queryInterface.showIndex('mission_share_tokens');
    const shareDefinitions = [
      { name: 'uniq_mission_share_tokens_hash', fields: ['token_hash'], unique: true },
      { name: 'idx_mission_share_tokens_service', fields: ['service_id'] },
      { name: 'idx_mission_share_tokens_expiry', fields: ['expires_at', 'revoked_at'] },
    ];
    for (const definition of shareDefinitions) {
      if (!shareIndexes.some((index) => index.name === definition.name)) {
        await queryInterface.addIndex('mission_share_tokens', definition.fields, {
          name: definition.name,
          unique: Boolean(definition.unique),
        });
      }
    }

    const ratingIndexes = await queryInterface.showIndex('mission_ratings');
    const ratingDefinitions = [
      { name: 'uniq_mission_ratings_service', fields: ['service_id'], unique: true },
      { name: 'idx_mission_ratings_provider', fields: ['provider_id'] },
    ];
    for (const definition of ratingDefinitions) {
      if (!ratingIndexes.some((index) => index.name === definition.name)) {
        await queryInterface.addIndex('mission_ratings', definition.fields, {
          name: definition.name,
          unique: Boolean(definition.unique),
        });
      }
    }
  },

  async down(queryInterface) {
    const tables = (await queryInterface.showAllTables()).map((table) =>
      String(typeof table === 'object' ? table.tableName || table.name : table).toLowerCase()
    );
    if (tables.includes('mission_ratings')) await queryInterface.dropTable('mission_ratings');
    if (tables.includes('mission_share_tokens')) {
      await queryInterface.dropTable('mission_share_tokens');
    }
    await removeColumnIfPresent(
      queryInterface,
      'services',
      'start_override_reason'
    );
    await removeColumnIfPresent(
      queryInterface,
      'services',
      'start_authorized_by_user_id'
    );
    await removeColumnIfPresent(
      queryInterface,
      'services',
      'start_authorization_method'
    );
    await removeColumnIfPresent(queryInterface, 'services', 'start_authorized_at');
  },
};
