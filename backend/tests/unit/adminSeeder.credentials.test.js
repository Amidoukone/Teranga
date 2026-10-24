'use strict';
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const seeder = require('../../seeders/20250920205101-seed-admin-user');
const previous = {};
let query;
beforeEach(() => {
  for (const key of ['NODE_ENV', 'SEED_ADMIN_EMAIL', 'SEED_ADMIN_PASSWORD']) previous[key] = process.env[key];
  process.env.NODE_ENV = 'test';
  process.env.SEED_ADMIN_EMAIL = ' Admin.Seed@Example.test ';
  process.env.SEED_ADMIN_PASSWORD = crypto.randomBytes(24).toString('hex');
  query = { bulkInsert: jest.fn(), bulkDelete: jest.fn() };
});
afterEach(() => {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

test('production cannot create or remove a seeded administrator', async () => {
  process.env.NODE_ENV = 'production';
  await expect(seeder.up(query)).rejects.toThrow('local only');
  await expect(seeder.down(query)).rejects.toThrow('local only');
  expect(query.bulkInsert).not.toHaveBeenCalled();
  expect(query.bulkDelete).not.toHaveBeenCalled();
});

test('no default administrator email is supplied', async () => {
  delete process.env.SEED_ADMIN_EMAIL;
  await expect(seeder.up(query)).rejects.toThrow('SEED_ADMIN_EMAIL');
  expect(query.bulkInsert).not.toHaveBeenCalled();
});

test.each([undefined, 'short', ' '.repeat(20), 'é'.repeat(37)])('missing or invalid passwords cannot initialize an administrator: %s', async (password) => {
  if (password === undefined) delete process.env.SEED_ADMIN_PASSWORD;
  else process.env.SEED_ADMIN_PASSWORD = password;
  await expect(seeder.up(query)).rejects.toThrow('SEED_ADMIN_PASSWORD');
  expect(query.bulkInsert).not.toHaveBeenCalled();
});

test('only the supplied password hash is stored for the explicitly named local account', async () => {
  await seeder.up(query);
  const [table, [account]] = query.bulkInsert.mock.calls[0];
  expect(table).toBe('users');
  expect(account.email).toBe('admin.seed@example.test');
  expect(account.passwordHash).not.toBe(process.env.SEED_ADMIN_PASSWORD);
  expect(await bcrypt.compare(process.env.SEED_ADMIN_PASSWORD, account.passwordHash)).toBe(true);
  expect(account).not.toHaveProperty('password');
});

test('rollback requires an explicit email and never deletes an implicit default account', async () => {
  delete process.env.SEED_ADMIN_EMAIL;
  await expect(seeder.down(query)).rejects.toThrow('SEED_ADMIN_EMAIL');
  expect(query.bulkDelete).not.toHaveBeenCalled();
});
