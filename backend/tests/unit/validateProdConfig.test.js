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

describe('validateProdConfig NODE_ENV posture', () => {
  test('an unset NODE_ENV is treated as development (no errors)', () => {
    const { NODE_ENV, ...rest } = validProdEnv();
    expect(validateProdConfig(rest).errors).toEqual([]);
  });

  test('a mistyped or unrecognized NODE_ENV never falls back to the permissive development posture', () => {
    const result = validateProdConfig({ NODE_ENV: 'Production' });
    expect(result.isProd).toBe(true);
    expect(result.errors.some((msg) => msg.includes('NODE_ENV'))).toBe(true);
    // La posture stricte s'applique aussi : les autres contrôles prod s'exécutent.
    expect(result.errors.some((msg) => msg.includes('JWT_SECRET'))).toBe(true);
  });

  test('a recognized development NODE_ENV skips production checks', () => {
    expect(validateProdConfig({ NODE_ENV: 'development' }).errors).toEqual([]);
  });
});

describe('validateProdConfig bootstrap admin password strength', () => {
  test('a weak bootstrap password is rejected when BOOTSTRAP_ADMIN_ENABLED=true', () => {
    const result = validateProdConfig(validProdEnv({ BOOTSTRAP_ADMIN_ENABLED: 'true', BOOTSTRAP_ADMIN_PASSWORD: 'changeme' }));
    expect(result.errors.some((msg) => msg.includes('BOOTSTRAP_ADMIN_PASSWORD'))).toBe(true);
  });

  test('a short bootstrap password is rejected', () => {
    const result = validateProdConfig(validProdEnv({ BOOTSTRAP_ADMIN_ENABLED: 'true', BOOTSTRAP_ADMIN_PASSWORD: 'short123' }));
    expect(result.errors.some((msg) => msg.includes('BOOTSTRAP_ADMIN_PASSWORD'))).toBe(true);
  });

  test('a strong bootstrap password passes', () => {
    const testPassword = ['Test', 'Only', 'Bootstrap', 'A9!'].join('-');
    const result = validateProdConfig(validProdEnv({ BOOTSTRAP_ADMIN_ENABLED: 'true', BOOTSTRAP_ADMIN_PASSWORD: testPassword }));
    expect(result.errors.some((msg) => msg.includes('BOOTSTRAP_ADMIN_PASSWORD'))).toBe(false);
  });

  test('bootstrap password is not checked when BOOTSTRAP_ADMIN_ENABLED is not true', () => {
    const result = validateProdConfig(validProdEnv({ BOOTSTRAP_ADMIN_PASSWORD: 'x' }));
    expect(result.errors.some((msg) => msg.includes('BOOTSTRAP_ADMIN_PASSWORD'))).toBe(false);
  });
});

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

describe('dedicated single-origin recette configuration', () => {
  const recipe = extra => validProdEnv({ APP_ENVIRONMENT: 'recette', SERVE_FRONTEND: 'true',
    COOKIE_SAME_SITE: 'lax', FRONTEND_URL: 'https://recette.example', CORS_ORIGINS: 'https://recette.example',
    DATABASE_URL: 'mysql://recipe_user:fixture@mysql.example/teranga_recette', ...extra });
  test('a dedicated database and a single HTTPS origin are accepted', () => {
    expect(validateProdConfig(recipe()).errors).toEqual([]);
  });
  test.each([
    { DATABASE_URL: 'mysql://user:fixture@mysql.example/teranga' },
    { DATABASE_URL: 'https://user:fixture@mysql.example/teranga_recette' },
    { DATABASE_URL: 'mysql://user:fixture@mysql.example/teranga_https_e2e_1' },
    { FRONTEND_URL: 'http://recette.example' },
    { FRONTEND_URL: 'https://recette.example/path' },
    { CORS_ORIGINS: 'https://production.example' },
    { CLIENT_URL: 'https://production.example' },
    { CORS_ORIGINS: 'https://recette.example,https://production.example' },
    { SERVE_FRONTEND: 'false' }, { COOKIE_SAME_SITE: 'none' },
  ])('an incorrect or mixed environment is rejected before any connection: %j', extra => {
    expect(validateProdConfig(recipe(extra)).errors.length).toBeGreaterThan(0);
  });
  test('validation errors do not print database credentials', () => {
    const result = validateProdConfig(recipe({ DATABASE_URL: 'mysql://private:private-password@mysql.example/production' }));
    expect(JSON.stringify(result.errors)).not.toContain('private-password');
  });
});
