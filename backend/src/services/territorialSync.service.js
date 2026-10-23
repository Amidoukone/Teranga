'use strict';

const { Country, Region, Territory } = require('../../models');

// Le catalogue lit les territoires projetés ; leur activation doit suivre
// le référentiel pays/régions dans la même transaction.
async function syncCountryTerritories(country, transaction, inheritTimezone = false) {
  try {
    await Territory.update({ name: country.name, timezone: country.timezone, isActive: country.isActive }, {
      where: { countryId: country.id, type: 'COUNTRY' }, transaction,
    });
    if (inheritTimezone) {
      const regions = await Region.findAll({ where: { countryId: country.id, timezone: null }, attributes: ['id'], transaction });
      if (regions.length) await Territory.update({ timezone: country.timezone }, {
        where: { countryId: country.id, type: 'REGION', regionId: regions.map((region) => region.id) }, transaction,
      });
    }
  } catch (error) {
    if (error?.original?.code !== 'ER_NO_SUCH_TABLE' && error?.parent?.code !== 'ER_NO_SUCH_TABLE') throw error;
  }
}

async function syncRegionTerritories(region, transaction) {
  try {
    const country = region.timezone ? null : await Country.findByPk(region.countryId, { attributes: ['timezone'], transaction });
    await Territory.update({ name: region.name, timezone: region.timezone || country?.timezone || null, isActive: region.isActive }, {
      where: { regionId: region.id, countryId: region.countryId, type: 'REGION' }, transaction,
    });
  } catch (error) {
    if (error?.original?.code !== 'ER_NO_SUCH_TABLE' && error?.parent?.code !== 'ER_NO_SUCH_TABLE') throw error;
  }
}

module.exports = { syncCountryTerritories, syncRegionTerritories };
