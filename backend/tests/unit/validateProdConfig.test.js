'use strict';

const { validateProdConfig } = require('../../src/utils/validateProdConfig');

function validProdEnv(overrides = {}) {
  const defaultPassword = 'placeholder-password';

  return {
    NODE_ENV: 'production',
    JWT_SECRET: 'a'.repeat(32),
    CORS_ORIGINS: 'https://teranga.example',
    METRICS_TOKEN: 'metrics-token',
    FRONTEND_ERROR_TOKEN: 'frontend-error-token',
    DATABASE_URL:
      `mysql://teranga_app:${defaultPassword}@teranga-mysql-prod-do-user-37904030-0.e.db.ondigitalocean.com:25060/teranga`,
    BOOTSTRAP_ADMIN_ALLOW_DEFAULTS: 'false',
    ...overrides,
  };
}

describe('validateProdConfig database provider warnings', () => {
  test('does not flag DigitalOcean URL when password contains planetscale text', () => {
    const passwordWithProviderText = ['provider', 'planetscale', 'marker'].join(
      '-'
    );
    const result = validateProdConfig(
      validProdEnv({
        DATABASE_URL:
          `mysql://teranga_app:${passwordWithProviderText}@teranga-mysql-prod-do-user-37904030-0.e.db.ondigitalocean.com:25060/teranga`,
      })
    );

    expect(result.errors).toEqual([]);
    expect(result.warnings).not.toContain(
      'DATABASE_URL still looks like a PlanetScale connection string'
    );
  });

  test('flags PlanetScale hostname', () => {
    const result = validateProdConfig(
      validProdEnv({
        DATABASE_URL: 'mysql://user:password@gcp.connect.psdb.cloud/database',
      })
    );

    expect(result.warnings).toContain(
      'DATABASE_URL still looks like a PlanetScale connection string'
    );
  });
});
