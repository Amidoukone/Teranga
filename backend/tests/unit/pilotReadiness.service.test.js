const { evaluatePilotReadiness } = require('../../src/services/pilotReadiness.service');

test('pilot readiness requires operator, complete catalog and local roles', () => {
  const base = { countryCode: 'ML', territories: [{ id: 1, type: 'COUNTRY', code: 'ML', name: 'Mali', isActive: true }], organizations: [{ id: 8, code: 'ML-OPS', status: 'active' }], assignments: [{ territoryId: 1, organizationId: 8, status: 'active', isPrimary: true }], definitions: [{ id: 10, isActive: true }], availabilities: [{ territoryId: 1, serviceDefinitionId: 10, isActive: true }], memberships: ['country_admin', 'master', 'agent', 'provider'].map((roleKey, index) => ({ id: index, territoryId: 1, roleKey, status: 'active' })) };
  expect(evaluatePilotReadiness(base).ready).toBe(true);
  expect(evaluatePilotReadiness({ ...base, availabilities: [] }).issues[0].code).toBe('PILOT_CATALOG_INCOMPLETE');
});
