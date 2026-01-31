'use strict';

const { getUserGeoScope, isGlobalAdmin, toSafeInt } = require('../utils/geoScope');

function requireScopeMatch({ allowQuery = false } = {}) {
  return (req, res, next) => {
    if (!req.user?.role) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé à un administrateur' });
    }

    if (isGlobalAdmin(req.user)) return next();

    const scope = getUserGeoScope(req.user);
    const source = allowQuery ? { ...req.query, ...req.body } : req.body || {};

    const countryId = toSafeInt(source.countryId ?? source.country_id);
    const regionId = toSafeInt(source.regionId ?? source.region_id);

    if (scope.regionId && regionId && String(regionId) !== String(scope.regionId)) {
      return res.status(403).json({ error: 'Accès interdit hors de votre région.' });
    }

    if (scope.countryId && countryId && String(countryId) !== String(scope.countryId)) {
      return res.status(403).json({ error: 'Accès interdit hors de votre pays.' });
    }

    return next();
  };
}

module.exports = {
  requireScopeMatch,
};
