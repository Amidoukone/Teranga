'use strict';
const path = require('path');

function loadRuntimeEnv({ env = process.env, root = path.resolve(__dirname, '../..') } = {}) {
  const file = env.NODE_ENV === 'production' ? '.env.production' : '.env';
  // override=false : les valeurs fournies par l'hébergeur restent prioritaires.
  require('dotenv').config({ path: path.join(root, file), processEnv: env, quiet: true });
}

const KNOWN_NODE_ENVS = new Set(['production', 'development', 'test']);

/**
 * Décide si l'environnement courant doit être traité comme la production.
 * NODE_ENV absent reste "development" (confort du développement local), mais
 * toute valeur PRÉSENTE et non reconnue (faute de frappe, variante de casse,
 * variable d'hébergeur mal recopiée) ne doit jamais retomber silencieusement
 * sur la posture permissive "développement" (CORS ouvert, secrets non
 * vérifiés) : on la traite comme production (stricte) et on le signale.
 */
function resolveNodeEnvPosture(env = process.env) {
  const raw = env.NODE_ENV || '';
  const recognized = !raw || KNOWN_NODE_ENVS.has(raw);
  const isProd = recognized ? raw === 'production' : true;
  return { raw: raw || null, recognized, isProd };
}

module.exports = { loadRuntimeEnv, resolveNodeEnvPosture };
