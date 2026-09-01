'use strict';

const { isGlobalAdmin } = require('./roles.middleware');
const { PERMISSIONS } = require('../constants/permissions');

const ALL_ROLES = Object.freeze([
  'client',
  'agent',
  'admin',
  'provider',
  'category_manager',
]);

function roles(...values) {
  return Object.freeze({ roles: Object.freeze(values) });
}

const AUTHORIZATION_POLICIES = Object.freeze({
  [PERMISSIONS.GEO_REFERENCE_READ]: roles(...ALL_ROLES),
  [PERMISSIONS.GEO_REFERENCE_MANAGE]: Object.freeze({ globalOnly: true }),
  [PERMISSIONS.FRANCHISE_READ]: roles('admin'),
  [PERMISSIONS.FRANCHISE_WRITE]: roles('admin'),
  [PERMISSIONS.SERVICE_ADMIN_LIST]: roles('admin'),
  [PERMISSIONS.SERVICE_ASSIGN]: roles('admin'),
  [PERMISSIONS.SERVICE_CREATE]: roles('client', 'admin'),
  [PERMISSIONS.SERVICE_UPDATE]: roles('admin', 'client'),
  [PERMISSIONS.SERVICE_DELETE]: roles('admin', 'client'),
  [PERMISSIONS.SERVICE_CLIENT_LIST]: roles('client', 'admin'),
  [PERMISSIONS.SERVICE_AGENT_LIST]: roles('agent'),
  [PERMISSIONS.SERVICE_AGENT_EXECUTE]: roles('agent'),
  [PERMISSIONS.SERVICE_VALIDATE]: roles('client'),
  [PERMISSIONS.SERVICE_DETAIL]: roles('client', 'agent', 'admin'),
  [PERMISSIONS.MISSION_CLIENT_SELF]: roles('client'),
  [PERMISSIONS.MISSION_OPERATE]: roles('admin'),
  [PERMISSIONS.MISSION_PROVIDER_EXECUTE]: roles('provider'),
  [PERMISSIONS.MISSION_STATUS_UPDATE]: roles(
    'client',
    'agent',
    'provider',
    'admin'
  ),
  [PERMISSIONS.MISSION_FIELD_EXECUTE]: roles('agent', 'provider'),
  [PERMISSIONS.MISSION_TRACK]: roles('client', 'agent', 'provider'),
  [PERMISSIONS.MISSION_DISPUTE_MANAGE]: roles('admin'),
  [PERMISSIONS.PROVIDER_ONBOARD]: roles('provider', 'admin'),
  [PERMISSIONS.PROVIDER_SELF]: roles('provider'),
  [PERMISSIONS.PROVIDER_MANAGE]: roles('admin', 'category_manager'),
  [PERMISSIONS.FINANCE_REPORT]: roles('admin'),
  [PERMISSIONS.FINANCE_TRANSACTION_ACCESS]: roles('client', 'agent', 'admin'),
  [PERMISSIONS.FINANCE_TRANSACTION_DELETE]: roles('admin'),
  [PERMISSIONS.PROJECT_WRITE]: roles('client', 'admin'),
  [PERMISSIONS.PROJECT_READ]: roles('client', 'agent', 'admin'),
  [PERMISSIONS.PROJECT_ASSIGN]: roles('admin'),
  [PERMISSIONS.CATALOG_MANAGE]: roles('admin'),
});

function getAuthorizationDecision(permission, user) {
  const policy = AUTHORIZATION_POLICIES[permission];
  if (!policy) {
    throw new Error(`authorization.middleware: permission inconnue "${permission}".`);
  }

  if (!user?.role) {
    return { allowed: false, status: 401, error: 'Non authentifié' };
  }

  if (policy.globalOnly && !isGlobalAdmin(user)) {
    return {
      allowed: false,
      status: 403,
      error: 'Action réservée à un administrateur global',
    };
  }

  if (policy.roles && !policy.roles.includes(user.role)) {
    return { allowed: false, status: 403, error: 'Accès interdit' };
  }

  return { allowed: true, status: 200, error: null };
}

function requirePermission(permission) {
  if (!AUTHORIZATION_POLICIES[permission]) {
    throw new Error(`authorization.middleware: permission inconnue "${permission}".`);
  }

  return (req, res, next) => {
    try {
      const decision = getAuthorizationDecision(permission, req.user);
      if (!decision.allowed) {
        return res.status(decision.status).json({ error: decision.error });
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  ALL_ROLES,
  AUTHORIZATION_POLICIES,
  getAuthorizationDecision,
  requirePermission,
};
