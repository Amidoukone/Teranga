'use strict';
jest.mock('../../scripts/operational-env', () => ({ loadOperationalEnv: jest.fn() }));
jest.mock('../../src/utils/validateProdConfig', () => ({ validateProdConfig: jest.fn() }));
jest.mock('../../src/utils/releaseMediaConfig', () => ({ validateReleaseMediaConfig: jest.fn() }));
jest.mock('../../src/services/migrationReadiness.service', () => ({ loadMigrationReadiness: jest.fn() }));
jest.mock('../../src/services/fieldReadiness.service', () => ({ loadFieldReadiness: jest.fn() }));
jest.mock('../../models', () => ({ sequelize: { options: {}, authenticate: jest.fn(), close: jest.fn() }, Country: { findOne: jest.fn() } }));
const { main } = require('../../scripts/check-release-readiness');
const { validateProdConfig } = require('../../src/utils/validateProdConfig');
const { validateReleaseMediaConfig } = require('../../src/utils/releaseMediaConfig');
const { loadMigrationReadiness } = require('../../src/services/migrationReadiness.service');
const { loadFieldReadiness } = require('../../src/services/fieldReadiness.service');
const db = require('../../models');
let previousEnv, previousExit, log;
beforeEach(() => {
  jest.clearAllMocks();
  previousEnv = process.env.NODE_ENV; previousExit = process.exitCode;
  log = jest.spyOn(console, 'log').mockImplementation(() => {});
  validateProdConfig.mockReturnValue({ isProd: true, errors: [], warnings: [] });
  validateReleaseMediaConfig.mockReturnValue([]);
  loadMigrationReadiness.mockResolvedValue({ ready: true, pending: [], unknown: [] });
  loadFieldReadiness.mockResolvedValue({ ready: true, remainingChecks: ['TEST_NOTIFICATION_DELIVERY'] });
  db.Country.findOne.mockResolvedValue({ id: 5 });
  db.sequelize.authenticate.mockResolvedValue(); db.sequelize.close.mockResolvedValue();
});
afterEach(() => { process.env.NODE_ENV = previousEnv; process.exitCode = previousExit; log.mockRestore(); });

test('a configuration failure prevents database access', async () => {
  validateProdConfig.mockReturnValue({ errors: ['DATABASE_URL missing'], warnings: [] });
  expect(await main(['--country=ML'])).toMatchObject({ readyForFieldTests: false, migrations: null, openingApproved: false });
  expect(db.sequelize.authenticate).not.toHaveBeenCalled();
  expect(process.exitCode).toBe(1);
});

test('a migration mismatch prevents field checks', async () => {
  loadMigrationReadiness.mockResolvedValue({ ready: false, pending: ['new.js'], unknown: [] });
  expect(await main(['--country=ML'])).toMatchObject({ readyForFieldTests: false, field: null });
  expect(loadFieldReadiness).not.toHaveBeenCalled();
  expect(db.sequelize.close).toHaveBeenCalledTimes(1);
});

test('successful checks preserve the scope and require human field approval', async () => {
  expect(await main(['--country=ML', '--region=7'])).toMatchObject({ readyForFieldTests: true, openingApproved: false });
  expect(loadFieldReadiness).toHaveBeenCalledWith(db, { countryId: 5, regionId: 7 });
  expect(process.env.NODE_ENV).toBe('production');
});

test('database errors do not expose raw connection messages and close the connection', async () => {
  db.sequelize.authenticate.mockRejectedValue(Object.assign(new Error('mysql://user:secret@server/db'), { code: 'ECONNREFUSED' }));
  const report = await main(['--country=ML']);
  expect(report.error).toBe('ECONNREFUSED');
  expect(JSON.stringify(report)).not.toContain('secret');
  expect(db.sequelize.close).toHaveBeenCalledTimes(1);
});

test('misspelled scope options fail before database access', async () => {
  await expect(main(['--country=ML', '--regoin=7'])).rejects.toThrow();
  expect(db.sequelize.authenticate).not.toHaveBeenCalled();
});
