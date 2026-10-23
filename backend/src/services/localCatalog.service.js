'use strict';

const { Op } = require('sequelize');
const {
  ServiceAvailability,
  ServiceDefinition,
  Territory,
  Organization,
} = require('../../models');

function toSafeInt(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function buildTerritoryWhere({ countryId, regionId } = {}) {
  const safeCountryId = toSafeInt(countryId);
  const safeRegionId = toSafeInt(regionId);
  if (safeRegionId) {
    return {
      [Op.or]: [
        { regionId: safeRegionId, ...(safeCountryId ? { countryId: safeCountryId } : {}) },
        ...(safeCountryId ? [{ type: 'COUNTRY', countryId: safeCountryId }] : []),
      ],
    };
  }
  if (safeCountryId) return { type: 'COUNTRY', countryId: safeCountryId };
  return null;
}

function activeOfferingWhere(now = new Date()) {
  return {
    isActive: true,
    [Op.and]: [
      { [Op.or]: [{ validFrom: null }, { validFrom: { [Op.lte]: now } }] },
      { [Op.or]: [{ validUntil: null }, { validUntil: { [Op.gte]: now } }] },
    ],
  };
}

function activeCatalogIncludes(scope, definitionWhere = {}) {
  const territoryWhere = buildTerritoryWhere(scope);
  return [
    { model: ServiceDefinition, as: 'definition', required: true, where: { isActive: true, ...definitionWhere } },
    { model: Territory, as: 'territory', required: true, where: { isActive: true, ...territoryWhere } },
    { model: Organization, as: 'operatingOrganization', required: true, where: { status: 'active' }, attributes: ['id', 'code', 'displayName', 'legalName'] },
  ];
}

async function isCatalogConfigured(countryId) {
  try {
    const count = await ServiceAvailability.count({
      include: [{
        model: Territory,
        as: 'territory',
        required: true,
        where: { countryId: toSafeInt(countryId) },
      }],
    });
    return count > 0;
  } catch (error) {
    if (error?.original?.code === 'ER_NO_SUCH_TABLE' || error?.parent?.code === 'ER_NO_SUCH_TABLE') {
      return false;
    }
    throw error;
  }
}

async function isServiceAvailable({ countryId, regionId = null, tradeCategoryId = null, serviceType = null }) {
  if (!countryId) return true;
  // Les pays historiques sans projection continuent de fonctionner pendant la transition.
  if (!await isCatalogConfigured(countryId)) return true;
  if (!tradeCategoryId && !serviceType) return false;
  const definitionWhere = tradeCategoryId
    ? { legacyTradeCategoryId: toSafeInt(tradeCategoryId) }
    : { legacyServiceType: serviceType };
  const offering = await ServiceAvailability.findOne({
    where: activeOfferingWhere(),
    include: activeCatalogIncludes({ countryId, regionId }, definitionWhere),
  });
  return Boolean(offering);
}

module.exports = {
  toSafeInt,
  buildTerritoryWhere,
  activeOfferingWhere,
  activeCatalogIncludes,
  isCatalogConfigured,
  isServiceAvailable,
};
