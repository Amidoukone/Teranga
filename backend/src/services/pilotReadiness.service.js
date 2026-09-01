'use strict';

// Rôles opérationnels génériques, identiques pour chaque pays/région.
// Les variantes de gouvernance (global/country/region) sont acceptées.
const REQUIRED_ROLE_GROUPS = {
  admin: ['admin', 'global_admin', 'country_admin', 'region_admin'],
  master: ['master', 'country_master', 'region_master'],
  agent: ['agent'],
  provider: ['provider'],
};

function id(value) {
  return value === null || value === undefined ? null : String(value);
}

function evaluatePilotReadiness({ countryCode, territories = [], organizations = [], assignments = [], definitions = [], availabilities = [], memberships = [] } = {}) {
  const issues = [];
  const requestedCode = String(countryCode || '').trim().toUpperCase();
  const country = territories.find((item) => item.type === 'COUNTRY' && item.isActive !== false && (String(item.code).toUpperCase() === requestedCode || (Array.isArray(item.aliases) && item.aliases.some((alias) => String(alias).toUpperCase() === requestedCode))));
  if (!country) issues.push({ code: 'PILOT_COUNTRY_NOT_FOUND', severity: 'blocking', message: `Aucun territoire pays actif pour ${countryCode}.` });
  const operatorIds = new Set(assignments.filter((a) => id(a.territoryId) === id(country?.id) && a.status === 'active' && a.isPrimary).map((a) => id(a.organizationId)));
  const operators = organizations.filter((org) => operatorIds.has(id(org.id)) && org.status === 'active');
  if (operators.length !== 1) issues.push({ code: 'PILOT_OPERATOR_INVALID', severity: 'blocking', message: 'Le pilote doit avoir exactement un opérateur principal actif.' });
  const activeDefinitions = definitions.filter((definition) => definition.isActive !== false);
  if (activeDefinitions.length === 0) issues.push({ code: 'PILOT_CATALOG_EMPTY', severity: 'blocking', message: 'Le catalogue actif est vide.' });
  const available = new Set(availabilities.filter((a) => id(a.territoryId) === id(country?.id) && a.isActive !== false).map((a) => id(a.serviceDefinitionId)));
  const missing = activeDefinitions.filter((definition) => !available.has(id(definition.id)));
  if (missing.length) issues.push({ code: 'PILOT_CATALOG_INCOMPLETE', severity: 'blocking', count: missing.length, message: `${missing.length} service(s) actif(s) sans disponibilité dans le pays pilote.` });
  const roleSet = new Set(memberships.filter((m) => id(m.territoryId) === id(country?.id) && m.status === 'active').map((m) => String(m.roleKey).toLowerCase()));
  const missingRoles = Object.entries(REQUIRED_ROLE_GROUPS).filter(([, aliases]) => !aliases.some((role) => roleSet.has(role))).map(([role]) => role);
  if (missingRoles.length) issues.push({ code: 'PILOT_ROLES_INCOMPLETE', severity: 'blocking', roles: missingRoles, message: `Rôles manquants : ${missingRoles.join(', ')}.` });
  return { ready: issues.length === 0, country: country ? { id: country.id, code: country.code, name: country.name } : null, operator: operators[0] ? { id: operators[0].id, code: operators[0].code } : null, catalog: { activeDefinitions: activeDefinitions.length, available: available.size, missing: missing.length }, requiredRoles: Object.keys(REQUIRED_ROLE_GROUPS), issues };
}

async function loadPilotReadiness(db, countryCode) {
  const [territories, organizations, assignments, definitions, availabilities, memberships] = await Promise.all([
    db.Territory.findAll({ raw: true }), db.Organization.findAll({ raw: true }), db.OrganizationTerritory.findAll({ raw: true }), db.ServiceDefinition.findAll({ raw: true }), db.ServiceAvailability.findAll({ raw: true }), db.Membership.findAll({ raw: true }),
  ]);
  return evaluatePilotReadiness({ countryCode, territories, organizations, assignments, definitions, availabilities, memberships });
}

module.exports = { REQUIRED_ROLE_GROUPS, evaluatePilotReadiness, loadPilotReadiness };
