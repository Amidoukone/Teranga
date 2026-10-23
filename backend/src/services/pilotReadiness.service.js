'use strict';

const { Op } = require('sequelize');

// Rôles opérationnels génériques, identiques pour chaque pays/région.
// Les variantes de gouvernance (global/country/region) sont acceptées.
const REQUIRED_ROLE_GROUPS = {
  admin: ['admin', 'global_admin', 'country_admin', 'region_admin'],
  master: ['master', 'country_master', 'region_master', 'country_admin'],
  agent: ['agent'],
  provider: ['provider'],
};

function id(value) {
  return value === null || value === undefined ? null : String(value);
}

function validAt(record, now) {
  const from = record.validFrom == null ? null : new Date(record.validFrom).getTime();
  const until = record.validUntil == null ? null : new Date(record.validUntil).getTime();
  return (from === null || (Number.isFinite(from) && from <= now)) &&
    (until === null || (Number.isFinite(until) && until >= now));
}

function evaluatePilotReadiness({ countryCode, territories = [], organizations = [], assignments = [], definitions = [], availabilities = [], memberships = [], users = [], providers = [], now = new Date() } = {}) {
  const issues = [];
  const timestamp = new Date(now).getTime();
  const requestedCode = String(countryCode || '').trim().toUpperCase();
  const country = territories.find((item) => item.type === 'COUNTRY' && (String(item.code).toUpperCase() === requestedCode || (Array.isArray(item.aliases) && item.aliases.some((alias) => String(alias).toUpperCase() === requestedCode))));
  if (!country) issues.push({ code: 'PILOT_COUNTRY_NOT_FOUND', severity: 'blocking', message: `Aucun territoire pays pour ${countryCode}.` });
  const activeOrganizations = new Map(organizations.filter((org) => org.status === 'active').map((org) => [id(org.id), org]));
  const operatorsFor = (territoryId) => new Set(assignments.filter((assignment) =>
    id(assignment.territoryId) === id(territoryId) && assignment.status === 'active' && assignment.isPrimary &&
    validAt(assignment, timestamp) && activeOrganizations.has(id(assignment.organizationId))
  ).map((assignment) => id(assignment.organizationId)));
  const operatorIds = country ? operatorsFor(country.id) : new Set();
  const operators = [...operatorIds].map((operatorId) => activeOrganizations.get(operatorId));
  if (operators.length !== 1) issues.push({ code: 'PILOT_OPERATOR_INVALID', severity: 'blocking', message: 'Le pilote doit avoir exactement un opérateur principal actif.' });

  // Le pays peut être encore en préparation, ses régions ouvertes doivent être actives.
  const localTerritories = country ? territories.filter((territory) =>
    id(territory.id) === id(country.id) || (territory.type === 'REGION' && id(territory.countryId) === id(country.countryId) && territory.isActive !== false && territory.isActive !== 0)
  ) : [];
  const localTerritoryIds = new Set(localTerritories.map((territory) => id(territory.id)));
  const operatorIdsByTerritory = new Map(localTerritories.map((territory) => {
    const localOperators = operatorsFor(territory.id);
    if (localOperators.size > 1 && territory.type === 'REGION') issues.push({ code: 'PILOT_REGION_OPERATOR_INVALID', severity: 'blocking', territoryId: territory.id, message: 'Plusieurs opérateurs principaux actifs couvrent une région.' });
    return [id(territory.id), localOperators.size ? localOperators : operatorIds];
  }));
  const activeDefinitions = definitions.filter((definition) => definition.isActive !== false && definition.isActive !== 0);
  if (!activeDefinitions.length) issues.push({ code: 'PILOT_CATALOG_EMPTY', severity: 'blocking', message: 'Le catalogue actif est vide.' });
  const activeDefinitionIds = new Set(activeDefinitions.map((definition) => id(definition.id)));
  const available = new Set(availabilities.filter((offering) =>
    localTerritoryIds.has(id(offering.territoryId)) && operatorIdsByTerritory.get(id(offering.territoryId))?.has(id(offering.organizationId)) &&
    offering.isActive !== false && offering.isActive !== 0 && validAt(offering, timestamp) && activeDefinitionIds.has(id(offering.serviceDefinitionId))
  ).map((offering) => id(offering.serviceDefinitionId)));
  if (!available.size) issues.push({ code: 'PILOT_CATALOG_NOT_AVAILABLE', severity: 'blocking', message: 'Aucun service actif disponible dans le pays pilote.' });
  const roleSet = new Set(memberships.filter((membership) =>
    localTerritoryIds.has(id(membership.territoryId)) && membership.status === 'active' && validAt(membership, timestamp) &&
    (membership.organizationId == null || activeOrganizations.has(id(membership.organizationId)))
  ).map((membership) => String(membership.roleKey).toLowerCase()));
  const inCountry = (user) => Boolean(country?.countryId) && (
    (id(user.countryId) !== null && id(user.countryId) === id(country.countryId)) ||
    (id(user.regionId) !== null && localTerritories.some((territory) => id(territory.regionId) === id(user.regionId)))
  );
  if (users.some((user) => user.role === 'agent' && user.isActive !== false && inCountry(user))) roleSet.add('agent');
  if (providers.some((provider) => provider.status === 'active' && String(provider.countryCode || '').toUpperCase() === requestedCode)) roleSet.add('provider');
  const missingRoles = Object.entries(REQUIRED_ROLE_GROUPS).filter(([, aliases]) => !aliases.some((role) => roleSet.has(role))).map(([role]) => role);
  if (missingRoles.length) issues.push({ code: 'PILOT_ROLES_INCOMPLETE', severity: 'blocking', roles: missingRoles, message: `Rôles manquants : ${missingRoles.join(', ')}.` });
  return { ready: !issues.length, country: country ? { id: country.id, code: country.code, name: country.name, isActive: country.isActive !== false } : null, operator: operators[0] ? { id: operators[0].id, code: operators[0].code } : null, catalog: { activeDefinitions: activeDefinitions.length, available: available.size, missing: activeDefinitions.length - available.size }, requiredRoles: Object.keys(REQUIRED_ROLE_GROUPS), issues };
}

async function loadPilotReadiness(db, countryCode) {
  const requestedCode = String(countryCode || '').trim().toUpperCase();
  const country = await db.Country.findOne({ where: { isoCode: requestedCode }, attributes: ['id'] });
  if (!country) return evaluatePilotReadiness({ countryCode: requestedCode });
  const territories = await db.Territory.findAll({ where: { countryId: country.id }, raw: true });
  const territoryIds = territories.map((territory) => territory.id);
  const regionIds = territories.filter((territory) => territory.regionId != null).map((territory) => territory.regionId);
  const [assignments, definitions, availabilities, memberships, users, providers] = await Promise.all([
    db.OrganizationTerritory.findAll({ where: { territoryId: territoryIds }, raw: true }),
    db.ServiceDefinition.findAll({ where: { isActive: true }, raw: true }),
    db.ServiceAvailability.findAll({ where: { territoryId: territoryIds }, raw: true }),
    db.Membership.findAll({ where: { territoryId: territoryIds, status: 'active' }, raw: true }),
    db.User.findAll({ where: { role: 'agent', [Op.or]: [{ countryId: country.id }, { regionId: regionIds }] }, raw: true }),
    db.Provider.findAll({ where: { status: 'active', countryCode: requestedCode }, raw: true }),
  ]);
  const organizationIds = [...new Set([...assignments, ...memberships].map((record) => record.organizationId).filter((value) => value != null))];
  const organizations = await db.Organization.findAll({ where: { id: organizationIds }, raw: true });
  return evaluatePilotReadiness({ countryCode: requestedCode, territories, organizations, assignments, definitions, availabilities, memberships, users, providers });
}

module.exports = { REQUIRED_ROLE_GROUPS, evaluatePilotReadiness, loadPilotReadiness };
