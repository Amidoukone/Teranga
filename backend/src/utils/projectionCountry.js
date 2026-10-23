'use strict';

function projectionCountry(countries, countryCode) {
  if (countryCode === undefined || countryCode === null) return null;
  const code = String(countryCode).trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) throw new Error('Projection country must be a two-letter ISO code');
  const country = countries.find((row) => String(row.isoCode).toUpperCase() === code);
  if (!country) throw new Error(`Projection country not found: ${code}`);
  return country;
}

function projectionArgs(argv) {
  for (const arg of argv) {
    if (!['--apply', '--json', '--fail-on-blocking'].includes(arg) && !arg.startsWith('--country=')) throw new Error(`Unknown projection option: ${arg}`);
  }
  const selections = argv.filter((arg) => arg.startsWith('--country='));
  if (selections.length > 1) throw new Error('Specify the projection country only once');
  const countryCode = selections.length ? selections[0].slice('--country='.length).toUpperCase() : undefined;
  if (countryCode !== undefined && !/^[A-Z]{2}$/.test(countryCode)) throw new Error('Use --country=ML with a valid two-letter ISO code');
  return { apply: argv.includes('--apply'), json: argv.includes('--json'), failOnBlocking: argv.includes('--fail-on-blocking'), countryCode };
}
module.exports = { projectionCountry, projectionArgs };
