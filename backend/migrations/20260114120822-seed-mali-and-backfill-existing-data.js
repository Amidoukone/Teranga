'use strict';

async function resolveMaliGeo(queryInterface) {
  const [rows] = await queryInterface.sequelize.query(`
    SELECT c.id AS countryId, r.id AS regionId
    FROM countries c
    LEFT JOIN regions r ON r.country_id = c.id AND r.code = 'BKO'
    WHERE c.iso_code = 'ML'
    LIMIT 1;
  `);

  const geo = rows?.[0] || null;
  if (!geo?.countryId || !geo?.regionId) return null;
  return geo;
}

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

    const geo = await resolveMaliGeo(queryInterface);
    if (!geo) return;

    await queryInterface.sequelize.query(
      `
      UPDATE properties
      SET countryId = :countryId,
          regionId  = :regionId
      WHERE countryId IS NULL;
      `,
      { replacements: geo }
    );

    await queryInterface.sequelize.query(
      `
      UPDATE services
      SET countryId = :countryId,
          regionId  = :regionId
      WHERE countryId IS NULL;
      `,
      { replacements: geo }
    );

    await queryInterface.sequelize.query(
      `
      UPDATE tasks
      SET countryId = :countryId,
          regionId  = :regionId
      WHERE countryId IS NULL;
      `,
      { replacements: geo }
    );

    await queryInterface.sequelize.query(
      `
      UPDATE evidences
      SET countryId = :countryId,
          regionId  = :regionId
      WHERE countryId IS NULL;
      `,
      { replacements: geo }
    );

    await queryInterface.sequelize.query(
      `
      UPDATE transactions
      SET countryId = :countryId,
          regionId  = :regionId
      WHERE countryId IS NULL;
      `,
      { replacements: geo }
    );

    await queryInterface.sequelize.query(
      `
      UPDATE projects
      SET countryId = :countryId,
          regionId  = :regionId
      WHERE countryId IS NULL;
      `,
      { replacements: geo }
    );

    await queryInterface.sequelize.query(
      `
      UPDATE products
      SET country_id = :countryId,
          region_id  = :regionId
      WHERE country_id IS NULL;
      `,
      { replacements: geo }
    );

    await queryInterface.sequelize.query(
      `
      UPDATE orders
      SET country_id = :countryId,
          region_id  = :regionId
      WHERE country_id IS NULL;
      `,
      { replacements: geo }
    );
  },

  async down(queryInterface) {
    const geo = await resolveMaliGeo(queryInterface);
    if (!geo) return;

    await queryInterface.sequelize.query(
      `
      UPDATE properties
      SET countryId = NULL, regionId = NULL
      WHERE countryId = :countryId;
      `,
      { replacements: geo }
    );

    await queryInterface.sequelize.query(
      `
      UPDATE services
      SET countryId = NULL, regionId = NULL
      WHERE countryId = :countryId;
      `,
      { replacements: geo }
    );

    await queryInterface.sequelize.query(
      `
      UPDATE tasks
      SET countryId = NULL, regionId = NULL
      WHERE countryId = :countryId;
      `,
      { replacements: geo }
    );

    await queryInterface.sequelize.query(
      `
      UPDATE evidences
      SET countryId = NULL, regionId = NULL
      WHERE countryId = :countryId;
      `,
      { replacements: geo }
    );

    await queryInterface.sequelize.query(
      `
      UPDATE transactions
      SET countryId = NULL, regionId = NULL
      WHERE countryId = :countryId;
      `,
      { replacements: geo }
    );

    await queryInterface.sequelize.query(
      `
      UPDATE projects
      SET countryId = NULL, regionId = NULL
      WHERE countryId = :countryId;
      `,
      { replacements: geo }
    );

    await queryInterface.sequelize.query(
      `
      UPDATE products
      SET country_id = NULL, region_id = NULL
      WHERE country_id = :countryId;
      `,
      { replacements: geo }
    );

    await queryInterface.sequelize.query(
      `
      UPDATE orders
      SET country_id = NULL, region_id = NULL
      WHERE country_id = :countryId;
      `,
      { replacements: geo }
    );

    await queryInterface.sequelize.query(
      `
      DELETE FROM regions
      WHERE id = :regionId;
      `,
      { replacements: geo }
    );

    await queryInterface.sequelize.query(
      `
      DELETE FROM countries
      WHERE id = :countryId;
      `,
      { replacements: geo }
    );
  },
};
