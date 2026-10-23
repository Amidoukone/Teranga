'use strict';

const {
  ServiceAvailability,
  ServiceDefinition,
  Territory,
  Organization,
  Country,
  Region,
} = require('../../models');
const { canAccessGeoResource, getUserGeoScope } = require('../utils/geoScope');
const { isGlobalAdmin } = require('../middleware/roles.middleware');
const logger = require('../utils/logger');
const {
  buildTerritoryWhere,
  activeOfferingWhere,
  activeCatalogIncludes,
  isCatalogConfigured,
} = require('../services/localCatalog.service');

function toSafeInt(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function catalogIncludes(activeOnly) {
  return [
    {
      model: ServiceDefinition,
      as: 'definition',
      required: true,
      ...(activeOnly ? { where: { isActive: true } } : {}),
    },
    { model: Territory, as: 'territory', required: true, ...(activeOnly ? { where: { isActive: true } } : {}) },
    {
      model: Organization,
      as: 'operatingOrganization',
      required: true,
      attributes: ['id', 'code', 'displayName', 'legalName'],
      ...(activeOnly ? { where: { status: 'active' } } : {}),
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
    const countryId = toSafeInt(req.query?.countryId);
    const regionId = req.query?.regionId == null ? null : toSafeInt(req.query.regionId);
    if (!countryId || (req.query?.regionId != null && !regionId)) {
      return res.status(400).json({ error: 'Pays valide requis pour consulter le catalogue' });
    }
    const country = await Country.findByPk(countryId, { attributes: ['id', 'isActive'] });
    if (!country?.isActive) {
      return res.status(404).json({ error: 'Pays non disponible' });
    }
    if (regionId) {
      const region = await Region.findByPk(regionId, { attributes: ['id', 'countryId', 'isActive'] });
      if (!region?.isActive || String(region.countryId) !== String(countryId)) {
        return res.status(400).json({ error: 'Région incompatible avec le pays sélectionné' });
      }
    }
    const territoryWhere = buildTerritoryWhere(req.query);
    const records = await ServiceAvailability.findAll({
      where: activeOfferingWhere(),
      include: activeCatalogIncludes(req.query),
      order: [
        [{ model: ServiceDefinition, as: 'definition' }, 'name', 'ASC'],
      ],
    });

    const selected = territoryWhere
      ? preferMostSpecificAvailability(records)
      : records;
    const configured = await isCatalogConfigured(countryId);
    return res.json({ catalog: selected.map(serializeAvailability), configured });
  } catch (error) {
    if (error?.original?.code === 'ER_NO_SUCH_TABLE' || error?.parent?.code === 'ER_NO_SUCH_TABLE') {
      return res.json({ catalog: [], configured: false });
    }
    logger.error({ err: error }, 'service_catalog.list.failed');
    return res.status(500).json({ error: 'Impossible de charger le catalogue de services' });
  }
};

exports.listForAdmin = async (req, res) => {
  try {
    const scope = isGlobalAdmin(req.user) ? req.query : getUserGeoScope(req.user);
    const territoryWhere = scope.regionId
      ? buildTerritoryWhere(scope)
      : scope.countryId
        ? { countryId: toSafeInt(scope.countryId) }
        : isGlobalAdmin(req.user) ? null : { id: 0 };
    const records = await ServiceAvailability.findAll({
      include: catalogIncludes(false).map((include) =>
        include.as === 'territory' && territoryWhere
          ? { ...include, where: { ...include.where, ...territoryWhere } }
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

    const validFrom = req.body.validFrom !== undefined ? req.body.validFrom : availability.validFrom;
    const validUntil = req.body.validUntil !== undefined ? req.body.validUntil : availability.validUntil;
    if (validFrom != null && validUntil != null && new Date(validFrom) > new Date(validUntil)) {
      return res.status(400).json({ error: 'La fin de validité doit suivre le début de validité' });
    }

    const nextRules = req.body.providerRules !== undefined ? req.body.providerRules : availability.providerRules;
    const nextSla = req.body.slaMinutes !== undefined ? req.body.slaMinutes : availability.slaMinutes;
    if (nextRules?.coordination?.enabled && (!nextSla || !(nextRules.serviceOutcome || availability.definition?.description)?.trim())) {
      return res.status(400).json({ error: 'Définissez le résultat attendu et le délai avant d’activer la coordination automatique' });
    }
    if (nextRules?.coordination?.enabled && !availability.definition?.legacyTradeCategoryId && availability.definition?.executionProfile !== 'agent') {
      return res.status(400).json({ error: 'L’affectation automatique nécessite une offre exécutée par un agent ou un prestataire' });
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
