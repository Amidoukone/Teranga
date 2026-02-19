'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const jestBin = path.resolve(__dirname, '..', 'node_modules', 'jest', 'bin', 'jest.js');
const args = [jestBin, ...process.argv.slice(2)];

const result = spawnSync(process.execPath, args, {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status == null ? 1 : result.status);
