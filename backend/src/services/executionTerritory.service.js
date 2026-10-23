'use strict';

const { Country, Region, User } = require('../../models');
const { canAccessGeoResource } = require('../utils/geoScope');

async function resolveExecutionTerritory(countryId, regionId, { requireActive = true } = {}) {
  if (regionId) {
    const region = await Region.findByPk(regionId, { attributes: ['id', 'countryId', 'isActive'] });
    if (!region || (requireActive && (region.isActive === false || region.isActive === 0))) return { error: "Région d'exécution indisponible" };
    if (countryId && String(region.countryId) !== String(countryId)) return { error: 'Région incompatible avec le pays sélectionné' };
    countryId = region.countryId;
  }
  const country = countryId ? await Country.findByPk(countryId, { attributes: ['id', 'currency', 'isActive'] }) : null;
  if (countryId && (!country || (requireActive && (country.isActive === false || country.isActive === 0)))) return { error: "Pays d'exécution indisponible" };
  return { countryId, regionId, country };
}

async function validateAgentForTerritory(agentId, territory, actor) {
  if (agentId == null) return { agent: null };
  const agent = await User.findByPk(agentId);
  if (!agent || agent.role !== 'agent') return { error: 'Agent introuvable ou rôle invalide', status: 400 };
  if (!canAccessGeoResource(territory, agent) || (actor && !canAccessGeoResource(agent, actor))) {
    return { error: 'Agent hors du périmètre géographique de l’opération', status: 403 };
  }
  return { agent };
}

module.exports = { resolveExecutionTerritory, validateAgentForTerritory };
