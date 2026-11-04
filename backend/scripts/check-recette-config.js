'use strict';

process.env.NODE_ENV = 'production';
require('./operational-env').loadOperationalEnv();
const fs = require('fs');
const path = require('path');
const { validateProdConfig } = require('../src/utils/validateProdConfig');
const { validateReleaseMediaConfig } = require('../src/utils/releaseMediaConfig');
const result = validateProdConfig(process.env);
const errors = [...result.errors, ...validateReleaseMediaConfig(process.env)];
if (process.env.APP_ENVIRONMENT !== 'recette') errors.push('APP_ENVIRONMENT must explicitly be recette');
const directory = path.resolve(__dirname, '../..', process.env.FRONTEND_BUILD_DIR || 'frontend/build-recette');
if (!fs.existsSync(path.join(directory, 'index.html'))) errors.push('Compiled recette frontend is missing');
for (const message of errors) console.error(`ERROR: ${message}`);
if (errors.length) process.exitCode = 1;
else console.log('Recette configuration: OK (configuration only; hosted resources and user tests still require verification)');
