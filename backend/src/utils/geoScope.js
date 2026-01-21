"use strict";

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

function applyGeoScope(where = {}, user) {
  if (!user) return where;

  if (isGlobalAdmin(user)) return where;

  const { countryId, regionId } = getUserGeoScope(user);

  if (regionId) return { ...where, regionId };
  if (countryId) return { ...where, countryId };

  return { ...where, id: 0 };
}

function canAccessGeoResource(resource, user) {
  if (!user) return false;
  if (isGlobalAdmin(user)) return true;

  const { countryId, regionId } = getUserGeoScope(user);

  const resRegion =
    resource?.regionId ?? resource?.region_id ?? null;
  const resCountry =
    resource?.countryId ?? resource?.country_id ?? null;

  if (regionId) return String(resRegion) === String(regionId);
  if (countryId) return String(resCountry) === String(countryId);

  return false;
}

module.exports = {
  applyGeoScope,
  canAccessGeoResource,
  getUserGeoScope,
  toSafeInt,
  isGlobalAdmin,
};
