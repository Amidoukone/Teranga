'use strict';

function parseFieldCheckOptions(argv) {
  const result = { countryCode: null, regionId: null };
  const seen = new Set();
  for (const arg of argv) {
    const match = /^(--country|--region)=(.+)$/.exec(arg);
    if (!match || seen.has(match[1])) throw new Error('Usage: --country=ML [--region=123]');
    seen.add(match[1]);
    if (match[1] === '--country') {
      if (!/^[a-z]{2}$/i.test(match[2])) throw new Error('Code pays invalide');
      result.countryCode = match[2].toUpperCase();
    } else {
      if (!/^[1-9][0-9]*$/.test(match[2]) || !Number.isSafeInteger(Number(match[2]))) throw new Error('Identifiant de région invalide');
      result.regionId = Number(match[2]);
    }
  }
  if (!result.countryCode) throw new Error('Usage: --country=ML [--region=123]');
  return result;
}

module.exports = { parseFieldCheckOptions };
