'use strict';

const { loadOperationalEnv } = require('./operational-env');
const { validateProdConfig } = require('../src/utils/validateProdConfig');

process.env.NODE_ENV = 'production';
loadOperationalEnv();

const result = validateProdConfig({
  ...process.env,
  NODE_ENV: 'production',
});

if (result.warnings.length > 0) {
  result.warnings.forEach((msg) => {
    console.warn(`WARN: ${msg}`);
  });
}

if (result.errors.length > 0) {
  result.errors.forEach((msg) => {
    console.error(`ERROR: ${msg}`);
  });
  process.exit(1);
}

console.log('Production configuration validation: OK');
