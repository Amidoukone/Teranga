'use strict';

const { Op } = require('sequelize');
const {
  ServiceAvailability,
  ServiceDefinition,
  Territory,
  Organization,
} = require('../../models');
const { canAccessGeoResource, getUserGeoScope } = require('../utils/geoScope');
const { isGlobalAdmin } = require('../middleware/roles.middleware');
const logger = require('../utils/logger');

function toSafeInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function buildTerritoryWhere({ countryId, regionId } = {}) {
  const safeCountryId = toSafeInt(countryId);
  const safeRegionId = toSafeInt(regionId);
  if (safeRegionId) {
    return {
      [Op.or]: [
        { regionId: safeRegionId },
        ...(safeCountryId ? [{ type: 'COUNTRY', countryId: safeCountryId }] : []),
      ],
    };
  }
  if (safeCountryId) return { type: 'COUNTRY', countryId: safeCountryId };
  return null;
}

function catalogIncludes(activeOnly) {
  return [
    {
      model: ServiceDefinition,
      as: 'definition',
      required: true,
      ...(activeOnly ? { where: { isActive: true } } : {}),
    },
    { model: Territory, as: 'territory', required: true },
    {
      model: Organization,
      as: 'operatingOrganization',
      required: true,
      attributes: ['id', 'code', 'displayName', 'legalName'],
    },
  ];
}

function serializeAvailability(record) {
  const value = record?.toJSON ? record.toJSON() : record;
  return {
    id: value.id,
    definition: value.definition,
    territory: value.territory,
    operatingOrganization: value.operatingOrganization,
    offering: {
      currency: value.currency,
      basePrice: value.basePrice,
      slaMinutes: value.slaMinutes,
      openingHours: value.openingHours,
      requiredFields: value.requiredFields,
      providerRules: value.providerRules,
      version: value.version,
      isActive: value.isActive,
      validFrom: value.validFrom,
      validUntil: value.validUntil,
    },
  };
}

function preferMostSpecificAvailability(records) {
  const byDefinition = new Map();
  for (const record of records) {
    const current = byDefinition.get(String(record.serviceDefinitionId));
    const currentScore = current?.territory?.type === 'REGION' ? 2 : 1;
    const nextScore = record?.territory?.type === 'REGION' ? 2 : 1;
    if (!current || nextScore > currentScore) {
      byDefinition.set(String(record.serviceDefinitionId), record);
    }
  }
  return [...byDefinition.values()];
}

exports.list = async (req, res) => {
  try {
    const territoryWhere = buildTerritoryWhere(req.query);
    const records = await ServiceAvailability.findAll({
      where: { isActive: true },
      include: catalogIncludes(true).map((include) =>
        include.as === 'territory' && territoryWhere
          ? { ...include, where: territoryWhere }
          : include
      ),
      order: [
        [{ model: ServiceDefinition, as: 'definition' }, 'name', 'ASC'],
      ],
    });

    const selected = territoryWhere
      ? preferMostSpecificAvailability(records)
      : records;
    return res.json({ catalog: selected.map(serializeAvailability) });
  } catch (error) {
    logger.error({ err: error }, 'service_catalog.list.failed');
    return res.status(500).json({ error: 'Impossible de charger le catalogue de services' });
  }
};

exports.listForAdmin = async (req, res) => {
  try {
    const scope = isGlobalAdmin(req.user) ? req.query : getUserGeoScope(req.user);
    const territoryWhere = buildTerritoryWhere(scope);
    const records = await ServiceAvailability.findAll({
      include: catalogIncludes(false).map((include) =>
        include.as === 'territory' && territoryWhere
          ? { ...include, where: territoryWhere }
          : include
      ),
      order: [
        [{ model: ServiceDefinition, as: 'definition' }, 'name', 'ASC'],
      ],
    });
    return res.json({ catalog: records.map(serializeAvailability) });
  } catch (error) {
    logger.error({ err: error }, 'service_catalog.list_admin.failed');
    return res.status(500).json({ error: 'Impossible de charger le catalogue local' });
  }
};

exports.updateAvailability = async (req, res) => {
  try {
    const id = toSafeInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalide' });

    const availability = await ServiceAvailability.findByPk(id, {
      include: catalogIncludes(false),
    });
    if (!availability) return res.status(404).json({ error: 'Disponibilite introuvable' });
    if (!canAccessGeoResource(availability.territory, req.user)) {
      return res.status(403).json({ error: 'Offre hors de votre perimetre geographique' });
    }

    await availability.update(req.body);
    const refreshed = await ServiceAvailability.findByPk(id, {
      include: catalogIncludes(false),
    });
    return res.json({ availability: serializeAvailability(refreshed) });
  } catch (error) {
    logger.error({ err: error }, 'service_catalog.update_availability.failed');
    return res.status(500).json({ error: 'Impossible de mettre a jour cette offre locale' });
  }
};

module.exports.buildTerritoryWhere = buildTerritoryWhere;
module.exports.preferMostSpecificAvailability = preferMostSpecificAvailability;
