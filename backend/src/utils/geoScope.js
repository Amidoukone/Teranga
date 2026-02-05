"use strict";

const { Op } = require("sequelize");
const { Country, Region } = require("../../models");

function toSafeInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function getUserGeoScope(user) {
  if (!user) return { countryId: null, regionId: null };

  return {
    countryId: toSafeInt(user.countryId ?? user.country_id),
    regionId: toSafeInt(user.regionId ?? user.region_id),
  };
}

function isGlobalAdmin(user) {
  if (user?.role !== "admin") return false;
  const { countryId, regionId } = getUserGeoScope(user);
  return !countryId && !regionId;
}

function isAdminRole(user) {
  return user?.role === "admin";
}

function isScopedAdmin(user) {
  if (!isAdminRole(user)) return false;
  return !isGlobalAdmin(user);
}

async function getCountryIsoById(countryId) {
  if (!countryId) return null;

  const record = await Country.findByPk(countryId, {
    attributes: ["isoCode", "isActive"],
  });

  if (!record || record.isActive === false) return null;
  return record.isoCode || null;
}

async function getCountryIdByIso(isoCode) {
  if (!isoCode) return null;

  const record = await Country.findOne({
    where: { isoCode: String(isoCode).toUpperCase() },
    attributes: ["id", "isActive"],
  });

  if (!record || record.isActive === false) return null;
  return record.id || null;
}

/**
 * 🌍 GeoScope LEGACY (SAFE)
 * - admin global : aucun filtre
 * - admin scoped région : regionId
 * - admin scoped pays :
 *    - countryId direct
 *    - fallback legacy via User.country (ISO)
 *
 * ⚠️ IMPORTANT :
 * Cette fonction ne doit PAS référencer des alias SQL non présents dans la requête.
 * Donc PAS de "$owner.country$" ici, car les listes Service n'ont pas d'include owner.
 *
 * ✅ On garde uniquement "$client.country$" (utilisé dans ServiceController, TaskController)
 */
async function applyGeoScopeWithLegacy(where = {}, user) {
  if (!user) return where;

  // ✅ Admin global : pas de filtre
  if (isGlobalAdmin(user)) return where;

  const { countryId, regionId } = getUserGeoScope(user);

  // ✅ Scope région prioritaire
  if (regionId) {
    return { ...where, regionId };
  }

  // ✅ Scope pays (avec fallback legacy ISO)
  if (countryId) {
    const iso = await getCountryIsoById(countryId);

    // Base : filtrer sur countryId natif (données modernes)
    const scopeOr = [{ countryId }];

    // Fallback legacy : pour anciens enregistrements sans countryId/regionId
    // ⚠️ On utilise uniquement "$client.country$" car c'est l'alias garanti côté Services/Tasks.
    if (iso) {
      scopeOr.push({
        [Op.and]: [
          { countryId: null },
          { regionId: null },
          { "$client.country$": iso },
        ],
      });
    }

    // On combine proprement avec les filtres existants
    const andFilters = Array.isArray(where[Op.and]) ? [...where[Op.and]] : [];
    andFilters.push({ [Op.or]: scopeOr });

    return { ...where, [Op.and]: andFilters };
  }

  // ✅ Anti-régression historique : admin/agent sans scope => aucune donnée
  return { ...where, id: 0 };
}

/**
 * Applique un filtre geo (countryId/regionId) sur un WHERE Sequelize.
 * - Uniquement pour admin/agent
 * - Admin global => aucun filtre
 * - Admin/agent scoped => filtre regionId si présent sinon countryId
 *
 * ⚠️ Comportement historique conservé :
 * si admin/agent n'a aucun scope => renvoie un where "vide" (id:0)
 */
function applyGeoScope(where = {}, user) {
  if (!user) return where;

  const role = user?.role;
  if (!["admin", "agent"].includes(role)) return where;

  if (isGlobalAdmin(user)) return where;

  const { countryId, regionId } = getUserGeoScope(user);

  if (regionId) return { ...where, regionId };
  if (countryId) return { ...where, countryId };

  // ✅ On conserve exactement la logique existante (anti-régression)
  return { ...where, id: 0 };
}

/**
 * Vérifie si un modèle Sequelize supporte le geo-scope
 * via rawAttributes (countryId/regionId ou country_id/region_id).
 */
function modelSupportsGeoScope(model) {
  if (!model || !model.rawAttributes) return false;

  return Boolean(
    model.rawAttributes.countryId ||
      model.rawAttributes.regionId ||
      model.rawAttributes.country_id ||
      model.rawAttributes.region_id
  );
}

/**
 * Applique le scope uniquement si le modèle a bien les champs geo.
 * ✅ Permet d'éviter des filtres sur des modèles non concernés.
 */
function applyGeoScopeForModel(where = {}, user, model) {
  if (!modelSupportsGeoScope(model)) return where;
  return applyGeoScope(where, user);
}

/**
 * Nettoie un objet d’assignation (create/update) selon les champs du modèle.
 * Exemple: si un modèle n'a pas regionId, on supprime regionId/region_id.
 */
function filterGeoAssignmentsForModel(model, assignments = {}) {
  if (!assignments || typeof assignments !== "object") return assignments;

  // Si le modèle ne supporte pas le geo-scope, on enlève tous les champs geo.
  if (!modelSupportsGeoScope(model)) {
    const { countryId, regionId, country_id, region_id, ...rest } = assignments;
    return rest;
  }

  // Modèle supporte le geo-scope : on supprime seulement les champs inexistants.
  const out = { ...assignments };
  const attrs = model?.rawAttributes || {};

  const hasCountry = Boolean(attrs.countryId) || Boolean(attrs.country_id);
  const hasRegion = Boolean(attrs.regionId) || Boolean(attrs.region_id);

  if (!hasCountry) {
    delete out.countryId;
    delete out.country_id;
  }

  if (!hasRegion) {
    delete out.regionId;
    delete out.region_id;
  }

  return out;
}

function canAccessGeoResource(resource, user) {
  if (!user) return false;
  if (isGlobalAdmin(user)) return true;

  const { countryId, regionId } = getUserGeoScope(user);

  const resRegion = resource?.regionId ?? resource?.region_id ?? null;
  const resCountry = resource?.countryId ?? resource?.country_id ?? null;

  if (regionId) return String(resRegion) === String(regionId);
  if (countryId) return String(resCountry) === String(countryId);

  return false;
}

module.exports = {
  applyGeoScope,
  applyGeoScopeWithLegacy,
  applyGeoScopeForModel,
  canAccessGeoResource,
  filterGeoAssignmentsForModel,
  getUserGeoScope,
  getCountryIdByIso,
  getCountryIsoById,
  toSafeInt,
  isGlobalAdmin,
  isAdminRole,
  isScopedAdmin,
};
