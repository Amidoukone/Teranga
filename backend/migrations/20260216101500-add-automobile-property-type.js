'use strict';

const NEW_TYPES = ['house', 'apartment', 'land', 'automobile', 'commercial'];
const OLD_TYPES = ['house', 'apartment', 'land', 'commercial'];

module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(
        'ALTER TYPE "enum_properties_type" ADD VALUE IF NOT EXISTS \'automobile\';'
      );
      return;
    }

    await queryInterface.changeColumn('properties', 'type', {
      type: Sequelize.ENUM(...NEW_TYPES),
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(
        'UPDATE "properties" SET "type" = \'commercial\' WHERE "type" = \'automobile\';'
      );

      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_properties_type') THEN
            CREATE TYPE "enum_properties_type_old" AS ENUM ('house', 'apartment', 'land', 'commercial');
            ALTER TABLE "properties"
              ALTER COLUMN "type" TYPE "enum_properties_type_old"
              USING ("type"::text::"enum_properties_type_old");
            DROP TYPE "enum_properties_type";
            ALTER TYPE "enum_properties_type_old" RENAME TO "enum_properties_type";
          END IF;
        END $$;
      `);
      return;
    }

    await queryInterface.bulkUpdate(
      'properties',
      { type: 'commercial' },
      { type: 'automobile' }
    );

    await queryInterface.changeColumn('properties', 'type', {
      type: Sequelize.ENUM(...OLD_TYPES),
      allowNull: false,
    });
  },
};
