'use strict';

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

module.exports = {
  async up(queryInterface, Sequelize) {
    const providerColumns = {
      profile_photo_url: { type: Sequelize.STRING(500), allowNull: true },
      driver_license_number: { type: Sequelize.STRING(80), allowNull: true },
      driver_license_document_url: { type: Sequelize.STRING(500), allowNull: true },
      driver_license_expires_at: { type: Sequelize.DATEONLY, allowNull: true },
      driver_license_verified: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      identity_document_url: { type: Sequelize.STRING(500), allowNull: true },
      identity_document_verified: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    };
    const providerTable = await queryInterface.describeTable('providers');
    for (const [column, definition] of Object.entries(providerColumns)) {
      if (!hasOwn(providerTable, column)) {
        await queryInterface.addColumn('providers', column, definition);
      }
    }

    const tables = (await queryInterface.showAllTables()).map((table) =>
      String(typeof table === 'object' ? table.tableName || table.name : table).toLowerCase()
    );
    if (!tables.includes('vehicles')) {
      await queryInterface.createTable('vehicles', {
        id: {
          type: Sequelize.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        provider_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          references: { model: 'providers', key: 'id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        vehicle_type: {
          type: Sequelize.ENUM('motorcycle', 'car'),
          allowNull: false,
        },
        brand: { type: Sequelize.STRING(80), allowNull: false },
        model: { type: Sequelize.STRING(80), allowNull: false },
        color: { type: Sequelize.STRING(50), allowNull: false },
        plate_number: { type: Sequelize.STRING(30), allowNull: false },
        capacity: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
        has_passenger_helmet: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        has_air_conditioning: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        photo_url: { type: Sequelize.STRING(500), allowNull: true },
        registration_number: { type: Sequelize.STRING(80), allowNull: true },
        registration_document_url: { type: Sequelize.STRING(500), allowNull: true },
        registration_verified: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        insurance_policy_number: { type: Sequelize.STRING(100), allowNull: true },
        insurance_document_url: { type: Sequelize.STRING(500), allowNull: true },
        insurance_expires_at: { type: Sequelize.DATEONLY, allowNull: true },
        insurance_verified: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        inspection_certificate_number: { type: Sequelize.STRING(100), allowNull: true },
        inspection_document_url: { type: Sequelize.STRING(500), allowNull: true },
        inspection_expires_at: { type: Sequelize.DATEONLY, allowNull: true },
        inspection_verified: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        status: {
          type: Sequelize.ENUM('pending', 'active', 'suspended', 'retired'),
          allowNull: false,
          defaultValue: 'pending',
        },
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

    // Une reprise apres interruption doit aussi reparer les index deja partiellement crees.
    const vehicleIndexes = await queryInterface.showIndex('vehicles');
    const vehicleIndexDefinitions = [
      { name: 'idx_vehicles_provider_id', fields: ['provider_id'] },
      { name: 'idx_vehicles_type_status', fields: ['vehicle_type', 'status'] },
      {
        name: 'uniq_vehicles_provider_plate',
        fields: ['provider_id', 'plate_number'],
        unique: true,
      },
      { name: 'idx_vehicles_insurance_expiry', fields: ['insurance_expires_at'] },
      { name: 'idx_vehicles_inspection_expiry', fields: ['inspection_expires_at'] },
    ];
    for (const definition of vehicleIndexDefinitions) {
      if (!vehicleIndexes.some((index) => index.name === definition.name)) {
        await queryInterface.addIndex('vehicles', definition.fields, {
          name: definition.name,
          unique: Boolean(definition.unique),
        });
      }
    }

    // Reprise sans perte des anciennes plaques Phase 4. Elles restent pending :
    // l'assurance et le controle technique doivent etre verifies explicitement.
    await queryInterface.sequelize.query(`
      INSERT INTO vehicles (
        provider_id, vehicle_type, brand, model, color, plate_number, capacity,
        has_passenger_helmet, has_air_conditioning, registration_number,
        registration_verified, insurance_expires_at, insurance_verified,
        inspection_verified, status, created_at, updated_at
      )
      SELECT
        p.id, 'motorcycle', 'A renseigner', 'A renseigner', 'A renseigner',
        p.plate_number, 1, 0, 0, p.circulation_card_number,
        p.circulation_card_verified, p.insurance_expires_at, 0, 0, 'pending', NOW(), NOW()
      FROM providers p
      WHERE p.plate_number IS NOT NULL
        AND TRIM(p.plate_number) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM vehicles v
          WHERE v.provider_id = p.id AND v.plate_number = p.plate_number
        )
    `);

    const serviceTable = await queryInterface.describeTable('services');
    if (!hasOwn(serviceTable, 'vehicle_id')) {
      await queryInterface.addColumn('services', 'vehicle_id', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'vehicles', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }
    const serviceIndexes = await queryInterface.showIndex('services');
    if (!serviceIndexes.some((index) => index.name === 'idx_services_vehicle_id')) {
      await queryInterface.addIndex('services', ['vehicle_id'], {
        name: 'idx_services_vehicle_id',
      });
    }
  },

  async down(queryInterface) {
    const serviceTable = await queryInterface.describeTable('services');
    if (hasOwn(serviceTable, 'vehicle_id')) {
      await queryInterface.removeColumn('services', 'vehicle_id');
    }

    const tables = (await queryInterface.showAllTables()).map((table) =>
      String(typeof table === 'object' ? table.tableName || table.name : table).toLowerCase()
    );
    if (tables.includes('vehicles')) await queryInterface.dropTable('vehicles');

    const providerTable = await queryInterface.describeTable('providers');
    for (const column of [
      'identity_document_verified',
      'identity_document_url',
      'driver_license_verified',
      'driver_license_expires_at',
      'driver_license_document_url',
      'driver_license_number',
      'profile_photo_url',
    ]) {
      if (hasOwn(providerTable, column)) await queryInterface.removeColumn('providers', column);
    }
  },
};
