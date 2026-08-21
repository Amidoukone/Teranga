'use strict';

const VEHICLE_IDENTITY_COLUMNS = {
  brand: { length: 80 },
  model: { length: 80 },
  color: { length: 50 },
  plate_number: { length: 30 },
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('vehicles');
    for (const [column, { length }] of Object.entries(VEHICLE_IDENTITY_COLUMNS)) {
      if (table[column] && table[column].allowNull === false) {
        await queryInterface.changeColumn('vehicles', column, {
          type: Sequelize.STRING(length),
          allowNull: true,
        });
      }
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE vehicles
      SET
        brand = COALESCE(NULLIF(TRIM(brand), ''), 'A renseigner'),
        model = COALESCE(NULLIF(TRIM(model), ''), 'A renseigner'),
        color = COALESCE(NULLIF(TRIM(color), ''), 'A renseigner'),
        plate_number = COALESCE(NULLIF(TRIM(plate_number), ''), CONCAT('BROUILLON-', id))
    `);

    for (const [column, { length }] of Object.entries(VEHICLE_IDENTITY_COLUMNS)) {
      await queryInterface.changeColumn('vehicles', column, {
        type: Sequelize.STRING(length),
        allowNull: false,
      });
    }
  },
};
