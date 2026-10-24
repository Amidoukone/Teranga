'use strict';
const path = require('path');

function loadRuntimeEnv({ env = process.env, root = path.resolve(__dirname, '../..') } = {}) {
  const file = env.NODE_ENV === 'production' ? '.env.production' : '.env';
  // override=false : les valeurs fournies par l'hébergeur restent prioritaires.
  require('dotenv').config({ path: path.join(root, file), processEnv: env, quiet: true });
}

module.exports = { loadRuntimeEnv };
