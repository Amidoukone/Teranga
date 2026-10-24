'use strict';
const { loadRuntimeEnv } = require('../src/utils/runtimeEnv');

// Un contrôle de production ne doit pas valider les secrets locaux de .env.
function loadOperationalEnv({ defaultEnv = 'production' } = {}) {
  process.env.NODE_ENV = process.env.NODE_ENV || defaultEnv;
  loadRuntimeEnv();
}

module.exports = { loadOperationalEnv };
