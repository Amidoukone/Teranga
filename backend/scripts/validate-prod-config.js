'use strict';

const path = require('path');
const dotenv = require('dotenv');
const { validateProdConfig } = require('../src/utils/validateProdConfig');

const envProductionPath = path.resolve(__dirname, '..', '.env.production');
const envPath = path.resolve(__dirname, '..', '.env');

dotenv.config({ path: envProductionPath });
dotenv.config({ path: envPath });

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
