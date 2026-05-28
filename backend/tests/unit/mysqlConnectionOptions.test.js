'use strict';

const {
  buildMysqlDialectOptions,
  normalizeMysqlDatabaseUrl,
} = require('../../src/utils/mysqlConnectionOptions');

describe('mysql connection options', () => {
  test('keeps production SSL defaults secure', () => {
    const options = buildMysqlDialectOptions({
      env: {},
      baseDialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: true,
        },
      },
    });

    expect(options.ssl).toEqual({
      require: true,
      rejectUnauthorized: true,
    });
  });

  test('allows explicit SSL opt-out for providers with private non-TLS endpoints', () => {
    const options = buildMysqlDialectOptions({
      env: { DB_SSL: 'false' },
      baseDialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: true,
        },
      },
    });

    expect(options.ssl).toBeUndefined();
  });

  test('loads inline CA certificates from escaped env values', () => {
    const options = buildMysqlDialectOptions({
      env: {
        DB_SSL: 'true',
        DB_SSL_CA: '-----BEGIN CERTIFICATE-----\\nabc\\n-----END CERTIFICATE-----',
      },
      baseDialectOptions: {},
    });

    expect(options.ssl).toMatchObject({
      require: true,
      ca: '-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----',
    });
  });

  test('lifts JSON ssl query parameter out of the URL for mysql2', () => {
    const normalized = normalizeMysqlDatabaseUrl(
      'mysql://user:pass@example.com:3306/app?ssl=%7B%22rejectUnauthorized%22%3Afalse%7D',
      {
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: true,
          },
        },
      }
    );

    expect(normalized.url).toBe('mysql://user:pass@example.com:3306/app');
    expect(normalized.extraDialectOptions.ssl).toEqual({
      require: true,
      rejectUnauthorized: false,
    });
  });

  test('supports ssl-mode=VERIFY_IDENTITY connection strings', () => {
    const normalized = normalizeMysqlDatabaseUrl(
      'mysql://user:pass@db.example.com:3306/app?ssl-mode=VERIFY_IDENTITY',
      {}
    );

    expect(normalized.url).toBe('mysql://user:pass@db.example.com:3306/app');
    expect(normalized.extraDialectOptions.ssl).toEqual({
      require: true,
      rejectUnauthorized: true,
      servername: 'db.example.com',
    });
  });

  test('respects ssl-mode=DISABLED overrides from provider URLs', () => {
    const normalized = normalizeMysqlDatabaseUrl(
      'mysql://user:pass@db.example.com:3306/app?ssl-mode=DISABLED',
      {
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: true,
          },
        },
      }
    );

    const options = buildMysqlDialectOptions({
      env: {},
      baseDialectOptions: {
        ssl: normalized.extraDialectOptions.ssl,
      },
    });

    expect(normalized.url).toBe('mysql://user:pass@db.example.com:3306/app');
    expect(options.ssl).toBeUndefined();
  });
});
