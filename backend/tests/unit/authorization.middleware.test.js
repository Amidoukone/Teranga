'use strict';

const { PERMISSIONS } = require('../../src/constants/permissions');
const {
  AUTHORIZATION_POLICIES,
  getAuthorizationDecision,
  requirePermission,
} = require('../../src/middleware/authorization.middleware');

describe('central authorization policies', () => {
  test('defines a policy for every declared permission', () => {
    expect(Object.values(PERMISSIONS).sort()).toEqual(
      Object.keys(AUTHORIZATION_POLICIES).sort()
    );
  });

  test.each([
    [PERMISSIONS.SERVICE_ADMIN_LIST, 'admin', true],
    [PERMISSIONS.SERVICE_ADMIN_LIST, 'client', false],
    [PERMISSIONS.SERVICE_CREATE, 'client', true],
    [PERMISSIONS.SERVICE_CREATE, 'admin', true],
    [PERMISSIONS.SERVICE_CREATE, 'agent', false],
    [PERMISSIONS.SERVICE_AGENT_EXECUTE, 'agent', true],
    [PERMISSIONS.SERVICE_AGENT_EXECUTE, 'provider', false],
    [PERMISSIONS.SERVICE_DETAIL, 'client', true],
    [PERMISSIONS.SERVICE_DETAIL, 'agent', true],
    [PERMISSIONS.SERVICE_DETAIL, 'admin', true],
    [PERMISSIONS.SERVICE_DETAIL, 'category_manager', false],
    [PERMISSIONS.GEO_REFERENCE_READ, 'provider', true],
    [PERMISSIONS.FRANCHISE_WRITE, 'admin', true],
    [PERMISSIONS.FRANCHISE_WRITE, 'agent', false],
  ])('%s keeps the legacy decision for %s', (permission, role, expected) => {
    expect(
      getAuthorizationDecision(permission, {
        role,
        countryId: null,
        regionId: null,
      }).allowed
    ).toBe(expected);
  });

  test('reserves geographic reference writes to global admins', () => {
    expect(
      getAuthorizationDecision(PERMISSIONS.GEO_REFERENCE_MANAGE, {
        role: 'admin',
        countryId: null,
        regionId: null,
      }).allowed
    ).toBe(true);
    expect(
      getAuthorizationDecision(PERMISSIONS.GEO_REFERENCE_MANAGE, {
        role: 'admin',
        countryId: 1,
        regionId: null,
      })
    ).toEqual({
      allowed: false,
      status: 403,
      error: 'Action réservée à un administrateur global',
    });
  });

  test.each([
    [PERMISSIONS.MISSION_CLIENT_SELF, ['client']],
    [PERMISSIONS.MISSION_OPERATE, ['admin']],
    [PERMISSIONS.MISSION_PROVIDER_EXECUTE, ['provider']],
    [
      PERMISSIONS.MISSION_STATUS_UPDATE,
      ['client', 'agent', 'provider', 'admin'],
    ],
    [PERMISSIONS.MISSION_FIELD_EXECUTE, ['agent', 'provider']],
    [PERMISSIONS.MISSION_TRACK, ['client', 'agent', 'provider']],
    [PERMISSIONS.MISSION_DISPUTE_MANAGE, ['admin']],
    [PERMISSIONS.PROVIDER_ONBOARD, ['provider', 'admin']],
    [PERMISSIONS.PROVIDER_SELF, ['provider']],
    [PERMISSIONS.PROVIDER_MANAGE, ['admin', 'category_manager']],
    [PERMISSIONS.FINANCE_REPORT, ['admin']],
    [PERMISSIONS.FINANCE_TRANSACTION_ACCESS, ['client', 'agent', 'admin']],
    [PERMISSIONS.FINANCE_TRANSACTION_DELETE, ['admin']],
    [PERMISSIONS.PROJECT_WRITE, ['client', 'admin']],
    [PERMISSIONS.PROJECT_READ, ['client', 'agent', 'admin']],
    [PERMISSIONS.PROJECT_ASSIGN, ['admin']],
    [PERMISSIONS.CATALOG_MANAGE, ['admin']],
  ])('%s preserves its existing role boundary', (permission, expectedRoles) => {
    expect(AUTHORIZATION_POLICIES[permission].roles).toEqual(expectedRoles);
  });

  test('returns 401 before evaluating a permission for an anonymous request', () => {
    expect(getAuthorizationDecision(PERMISSIONS.SERVICE_DETAIL, null)).toEqual({
      allowed: false,
      status: 401,
      error: 'Non authentifié',
    });
  });

  test('rejects an unknown permission when the middleware is constructed', () => {
    expect(() => requirePermission('unknown.permission')).toThrow(
      'permission inconnue'
    );
  });
});
