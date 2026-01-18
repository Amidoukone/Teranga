'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      INSERT IGNORE INTO countries (name, iso_code, currency, default_language, is_active, createdAt, updatedAt)
      VALUES ('Mali', 'ML', 'XOF', 'fr', 1, NOW(), NOW());
    `);

    await queryInterface.sequelize.query(`
      INSERT IGNORE INTO regions (country_id, name, code, is_active, createdAt, updatedAt)
      VALUES (
        (SELECT id FROM countries WHERE iso_code = 'ML' LIMIT 1),
        'Bamako',
        'BKO',
        1,
        NOW(),
        NOW()
      );
    `);

    // ✅ Résolution sûre: Bamako du Mali uniquement
    await queryInterface.sequelize.query(`
      SET @ml_country_id = (SELECT id FROM countries WHERE iso_code = 'ML' LIMIT 1);
      SET @bko_region_id = (SELECT id FROM regions WHERE country_id = @ml_country_id AND code = 'BKO' LIMIT 1);
    `);

    await queryInterface.sequelize.query(`
      UPDATE properties
      SET countryId = @ml_country_id,
          regionId  = @bko_region_id
      WHERE countryId IS NULL;
    `);

    await queryInterface.sequelize.query(`
      UPDATE services
      SET countryId = @ml_country_id,
          regionId  = @bko_region_id
      WHERE countryId IS NULL;
    `);

    await queryInterface.sequelize.query(`
      UPDATE tasks
      SET countryId = @ml_country_id,
          regionId  = @bko_region_id
      WHERE countryId IS NULL;
    `);

    await queryInterface.sequelize.query(`
      UPDATE evidences
      SET countryId = @ml_country_id,
          regionId  = @bko_region_id
      WHERE countryId IS NULL;
    `);

    await queryInterface.sequelize.query(`
      UPDATE transactions
      SET countryId = @ml_country_id,
          regionId  = @bko_region_id
      WHERE countryId IS NULL;
    `);

    await queryInterface.sequelize.query(`
      UPDATE projects
      SET countryId = @ml_country_id,
          regionId  = @bko_region_id
      WHERE countryId IS NULL;
    `);

    await queryInterface.sequelize.query(`
      UPDATE products
      SET country_id = @ml_country_id,
          region_id  = @bko_region_id
      WHERE country_id IS NULL;
    `);

    await queryInterface.sequelize.query(`
      UPDATE orders
      SET country_id = @ml_country_id,
          region_id  = @bko_region_id
      WHERE country_id IS NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      SET @ml_country_id = (SELECT id FROM countries WHERE iso_code = 'ML' LIMIT 1);
      SET @bko_region_id = (SELECT id FROM regions WHERE country_id = @ml_country_id AND code = 'BKO' LIMIT 1);
    `);

    await queryInterface.sequelize.query(`
      UPDATE properties
      SET countryId = NULL, regionId = NULL
      WHERE countryId = @ml_country_id;
    `);

    await queryInterface.sequelize.query(`
      UPDATE services
      SET countryId = NULL, regionId = NULL
      WHERE countryId = @ml_country_id;
    `);

    await queryInterface.sequelize.query(`
      UPDATE tasks
      SET countryId = NULL, regionId = NULL
      WHERE countryId = @ml_country_id;
    `);

    await queryInterface.sequelize.query(`
      UPDATE evidences
      SET countryId = NULL, regionId = NULL
      WHERE countryId = @ml_country_id;
    `);

    await queryInterface.sequelize.query(`
      UPDATE transactions
      SET countryId = NULL, regionId = NULL
      WHERE countryId = @ml_country_id;
    `);

    await queryInterface.sequelize.query(`
      UPDATE projects
      SET countryId = NULL, regionId = NULL
      WHERE countryId = @ml_country_id;
    `);

    await queryInterface.sequelize.query(`
      UPDATE products
      SET country_id = NULL, region_id = NULL
      WHERE country_id = @ml_country_id;
    `);

    await queryInterface.sequelize.query(`
      UPDATE orders
      SET country_id = NULL, region_id = NULL
      WHERE country_id = @ml_country_id;
    `);

    await queryInterface.sequelize.query(`
      DELETE FROM regions WHERE id = @bko_region_id;
    `);

    await queryInterface.sequelize.query(`
      DELETE FROM countries WHERE id = @ml_country_id;
    `);
  },
};
