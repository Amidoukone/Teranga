'use strict';

function selectedGeo(query = {}) {
  const scope = {};
  for (const [field, alias] of [['countryId', 'country_id'], ['regionId', 'region_id']]) {
    const raw = query[field] ?? query[alias];
    if (raw === undefined || raw === null || raw === '') continue;
    const id = Number(raw);
    if (!Number.isSafeInteger(id) || id <= 0) throw Object.assign(new Error('Périmètre géographique invalide'), { status: 400 });
    scope[field] = id;
  }
  return scope;
}
module.exports = { selectedGeo };
