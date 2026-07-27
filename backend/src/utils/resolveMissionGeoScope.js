'use strict';

const { Region, Sequelize } = require('../../models');
const { resolveGeoScope, countryHasActiveMaster } = require('../controllers/auth.controller');

/**
 * Résout le géo-scope RÉEL d'une mission — le pays/région où elle est exécutée,
 * PAS celui du compte du demandeur (docs/DEV_SPEC_TERANGA_v3.md, correction
 * transfrontalière : un client basé à Bamako doit pouvoir demander une mission
 * à exécuter à Abidjan, routée/tarifée selon Abidjan, pas selon son compte).
 *
 * @param {object} params
 * @param {string|null} params.countryIso - ISO alpha-2 résolu par geocodeAddress
 * @param {string|null} params.adminAreaName - nom de région résolu par geocodeAddress (best-effort, nullable)
 * @param {number|null} params.fallbackCountryId - pays du compte, utilisé si aucune adresse (types de
 *   mission sans lieu, ex. paiement/transfert d'argent — voir décision 0.9.e)
 * @param {number|null} params.fallbackRegionId - région du compte, même fallback
 * @returns {Promise<{countryId: number|null, regionId: number|null}|{error: string}>}
 */
async function resolveMissionGeoScope({
  countryIso,
  adminAreaName,
  fallbackCountryId = null,
  fallbackRegionId = null,
}) {
  if (!countryIso) {
    return { countryId: fallbackCountryId, regionId: fallbackRegionId };
  }

  const geoScope = await resolveGeoScope({ country: countryIso });
  if (geoScope?.error) {
    return { error: geoScope.error };
  }

  let regionId = null;
  if (adminAreaName) {
    const region = await Region.findOne({
      where: Sequelize.and(
        { countryId: geoScope.countryId },
        Sequelize.where(
          Sequelize.fn('lower', Sequelize.col('name')),
          String(adminAreaName).trim().toLowerCase()
        )
      ),
      attributes: ['id'],
    });
    regionId = region?.id ?? null;
  }

  const hasMaster = await countryHasActiveMaster(geoScope.countryId);
  if (!hasMaster) {
    return { error: 'Nos services ne sont pas disponibles pour le moment dans ce pays.' };
  }

  return { countryId: geoScope.countryId, regionId };
}

module.exports = { resolveMissionGeoScope };
