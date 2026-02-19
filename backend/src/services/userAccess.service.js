'use strict';

const { Country } = require('../../models');
const { getUserGeoScope, isGlobalAdmin } = require('../utils/geoScope');

function toTrimOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function isScopedAdmin(user) {
  if (!user || user.role !== 'admin') return false;
  return user.countryId != null || user.regionId != null;
}

function isAdminRole(role) {
  return String(role || '').trim().toLowerCase() === 'admin';
}

async function getCountryIsoById(countryId) {
  if (!countryId) return null;

  const record = await Country.findByPk(countryId, {
    attributes: ['isoCode', 'isActive'],
  });

  if (!record || record.isActive === false) return null;
  return record.isoCode || null;
}

async function canAccessUserByScope(actor, targetUser) {
  if (!actor || actor.role !== 'admin') return false;
  if (!targetUser) return false;

  if (isGlobalAdmin(actor)) return true;

  const actorScope = getUserGeoScope(actor);
  if (actorScope.regionId != null) {
    return String(targetUser.regionId ?? '') === String(actorScope.regionId);
  }
  if (actorScope.countryId != null) {
    if (String(targetUser.countryId ?? '') === String(actorScope.countryId)) {
      return true;
    }

    const actorIso = await getCountryIsoById(actorScope.countryId);
    const targetIso = toTrimOrNull(targetUser.country)?.toUpperCase() || null;
    return Boolean(actorIso && targetIso && actorIso === targetIso);
  }

  return false;
}

function assertGlobalAdminOnly(reqUser, errMessage) {
  if (!isGlobalAdmin(reqUser)) {
    const err = new Error(errMessage || 'Action reservee a un administrateur global');
    err.status = 403;
    throw err;
  }
}

module.exports = {
  isScopedAdmin,
  isAdminRole,
  getCountryIsoById,
  canAccessUserByScope,
  assertGlobalAdminOnly,
};

