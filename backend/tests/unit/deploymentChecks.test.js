'use strict';
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const { loadRuntimeEnv } = require('../../src/utils/runtimeEnv');
const { parseFieldCheckOptions } = require('../../src/utils/fieldCheckOptions');
const { validateReleaseMediaConfig } = require('../../src/utils/releaseMediaConfig');
const { loadMigrationReadiness } = require('../../src/services/migrationReadiness.service');
const { recordProof, verifyProof, readProof } = require('../../src/services/proofPersistence.service');
const { localRestoreConfig } = require('../../src/services/backupRestore.service');
let root;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'teranga-deploy-')); });
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

test('production never falls back to development secrets, and hosting values win', async () => {
  await fs.writeFile(path.join(root, '.env'), 'JWT_SECRET=local-only\n');
  const env = { NODE_ENV: 'production' };
  loadRuntimeEnv({ env, root });
  expect(env.JWT_SECRET).toBeUndefined();
  await fs.writeFile(path.join(root, '.env.production'), 'JWT_SECRET=from-file\nMETRICS_TOKEN=from-file\n');
  env.JWT_SECRET = 'from-host';
  loadRuntimeEnv({ env, root });
  expect(env.JWT_SECRET).toBe('from-host');
  expect(env.METRICS_TOKEN).toBe('from-file');
});

test('local field checks retain their local configuration', async () => {
  await fs.writeFile(path.join(root, '.env'), 'DB_NAME_TEST=local-test\n');
  const env = { NODE_ENV: 'test' };
  loadRuntimeEnv({ env, root });
  expect(env.DB_NAME_TEST).toBe('local-test');
});

test.each([['--country=ML', '--region=2', '--regoin=3'], ['--country=ML', '--country=CI'], ['--country=ML', '--region=1e2'], ['--country=ML', '--region=0'], ['--country=ML=CI'], []])('a malformed scope is rejected before database access: %j', (...args) => {
  expect(() => parseFieldCheckOptions(args)).toThrow();
});

test('country and region scope normalize correctly', () => {
  expect(parseFieldCheckOptions(['--country=ml', '--region=123'])).toEqual({ countryCode: 'ML', regionId: 123 });
});

test('pending and unknown migrations are distinguished without running migrations', async () => {
  await fs.writeFile(path.join(root, '001.js'), ''); await fs.writeFile(path.join(root, '002.js'), '');
  const sequelize = { query: jest.fn(async () => [{ name: '001.js' }, { name: '999.js' }]) };
  const result = await loadMigrationReadiness(sequelize, { directory: root });
  expect(result).toMatchObject({ ready: false, pending: ['002.js'], unknown: ['999.js'] });
  expect(sequelize.query).toHaveBeenCalledTimes(1);
  expect(sequelize.query.mock.calls[0][0]).toMatch(/^SELECT /);
});

test('missing metadata lists all migrations as pending; database errors propagate', async () => {
  await fs.writeFile(path.join(root, '001.js'), '');
  const sequelize = { query: jest.fn().mockRejectedValue({ original: { code: 'ER_NO_SUCH_TABLE' } }) };
  expect(await loadMigrationReadiness(sequelize, { directory: root })).toMatchObject({ ready: false, metadataPresent: false, pending: ['001.js'] });
  sequelize.query.mockRejectedValue(new Error('unavailable'));
  await expect(loadMigrationReadiness(sequelize, { directory: root })).rejects.toThrow('unavailable');
});

test('release blocks explicit ephemeral fallback even when ImageKit is configured', () => {
  const env = { IMAGEKIT_PUBLIC_KEY: 'pk', IMAGEKIT_PRIVATE_KEY: 'sk', IMAGEKIT_URL_ENDPOINT: 'https://ik.imagekit.io/test' };
  expect(validateReleaseMediaConfig(env)).toEqual([]);
  expect(validateReleaseMediaConfig({ ...env, EVIDENCE_ALLOW_LOCAL_FALLBACK: 'true' })).not.toEqual([]);
  expect(validateReleaseMediaConfig({ ...env, UPLOADS_ROOT: './uploads' })).not.toEqual([]);
  expect(validateReleaseMediaConfig({ UPLOADS_ROOT: root })).toEqual([]);
  expect(validateReleaseMediaConfig({ UPLOADS_ROOT: root, EVIDENCE_ALLOW_LOCAL_FALLBACK: 'false' })).not.toEqual([]);
});

test('an existing proof can be reread; changed and missing files fail', async () => {
  const file = path.join(root, 'proof.txt'); const reference = path.join(root, 'reference.json');
  const options = { uploadsRoot: root };
  await fs.writeFile(file, 'justificatif original');
  await recordProof('/uploads/proof.txt', reference, options);
  expect(await verifyProof(reference, options)).toMatchObject({ matches: true, requiresRestartConfirmation: true });
  await expect(recordProof('/uploads/proof.txt', reference, options)).rejects.toMatchObject({ code: 'EEXIST' });
  await fs.writeFile(file, 'justificatif altéré');
  await expect(verifyProof(reference, options)).rejects.toThrow('changé');
  await fs.unlink(file);
  await expect(verifyProof(reference, options)).rejects.toMatchObject({ code: 'ENOENT' });
});

test.each(['/uploads/../secret', '/uploads/%2e%2e/secret', '/uploads/a%2f..%2fsecret', '/uploads/file?token=x', 'https://other.example/proof'])('a proof cannot escape its storage: %s', async (location) => {
  await expect(readProof(location, { uploadsRoot: root, env: { IMAGEKIT_URL_ENDPOINT: 'https://ik.imagekit.io/test' } })).rejects.toThrow();
});

test('ImageKit proof verification hashes the downloaded bytes and rejects HTTP errors', async () => {
  const fetchImpl = jest.fn(async () => new Response(Buffer.from('photo originale')));
  const options = { env: { IMAGEKIT_URL_ENDPOINT: 'https://ik.imagekit.io/test' }, fetchImpl };
  expect(await readProof('https://ik.imagekit.io/test/photo.jpg', options)).toMatchObject({ bytes: 15, sha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
  expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: 'error', cache: 'no-store' });
  fetchImpl.mockResolvedValue(new Response('', { status: 404 }));
  await expect(readProof('https://ik.imagekit.io/test/photo.jpg', options)).rejects.toThrow('inaccessible');
});

test.each(['mysql://root:pass@remote.example/', 'mysql://root:pass@127.0.0.1/production', 'mysql://root:pass@127.0.0.1/?database=production', 'https://root:pass@127.0.0.1/'])('restore cannot select an existing or remote database: %s', (url) => {
  expect(() => localRestoreConfig(url)).toThrow();
});
