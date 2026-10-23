const { evaluatePilotReadiness } = require('../../src/services/pilotReadiness.service');

function regionalPilot() {
  return {
    countryCode: 'GH', now: new Date('2026-10-22T12:00:00Z'),
    territories: [
      { id: 1, type: 'COUNTRY', countryId: 10, code: 'GH', isActive: false },
      { id: 2, type: 'REGION', countryId: 10, regionId: 20, isActive: true },
      { id: 3, type: 'REGION', countryId: 11, regionId: 30, isActive: true },
    ],
    organizations: [{ id: 8, status: 'active' }, { id: 9, status: 'active' }],
    assignments: [{ territoryId: 1, organizationId: 8, status: 'active', isPrimary: true }, { territoryId: 2, organizationId: 9, status: 'active', isPrimary: true }],
    definitions: [{ id: 10, isActive: true }],
    availabilities: [{ territoryId: 2, organizationId: 9, serviceDefinitionId: 10, isActive: true }],
    memberships: [
      { territoryId: 1, organizationId: 8, roleKey: 'country_admin', status: 'active' },
      { territoryId: 2, organizationId: 9, roleKey: 'agent', status: 'active' },
      { territoryId: 2, organizationId: 9, roleKey: 'provider', status: 'active' },
    ],
  };
}

test('a country can open with a valid regional offering and regional operations', () => {
  expect(evaluatePilotReadiness(regionalPilot()).ready).toBe(true);
});

test.each([
  { validFrom: '2026-11-01T00:00:00Z' },
  { validUntil: '2026-10-01T00:00:00Z' },
])('an offering outside its validity period cannot make a country ready: %p', (dates) => {
  const base = regionalPilot();
  base.availabilities[0] = { ...base.availabilities[0], ...dates };
  expect(evaluatePilotReadiness(base).issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'PILOT_CATALOG_NOT_AVAILABLE' })]));
});

test('expired operators and memberships do not satisfy the launch checks', () => {
  const base = regionalPilot();
  base.assignments[0].validUntil = '2026-10-01T00:00:00Z';
  base.memberships[1].validUntil = '2026-10-01T00:00:00Z';
  const result = evaluatePilotReadiness(base);
  expect(result.ready).toBe(false);
  expect(result.issues).toEqual(expect.arrayContaining([
    expect.objectContaining({ code: 'PILOT_OPERATOR_INVALID' }),
    expect.objectContaining({ code: 'PILOT_ROLES_INCOMPLETE', roles: ['agent'] }),
  ]));
});

test.each(['foreign', 'inactive', 'ambiguous'])('regional launch checks reject a %s region', (kind) => {
  const base = regionalPilot();
  if (kind === 'foreign') base.availabilities[0].territoryId = 3;
  if (kind === 'inactive') base.territories[1].isActive = false;
  if (kind === 'ambiguous') base.assignments.push({ territoryId: 2, organizationId: 8, status: 'active', isPrimary: true });
  expect(evaluatePilotReadiness(base).ready).toBe(false);
});

test('pilot readiness requires operator, complete catalog and local roles', () => {
  const base = { countryCode: 'ML', territories: [{ id: 1, type: 'COUNTRY', countryId: 1, code: 'ML', name: 'Mali', isActive: true }], organizations: [{ id: 8, code: 'ML-OPS', status: 'active' }], assignments: [{ territoryId: 1, organizationId: 8, status: 'active', isPrimary: true }], definitions: [{ id: 10, isActive: true }], availabilities: [{ territoryId: 1, organizationId: 8, serviceDefinitionId: 10, isActive: true }], memberships: ['country_admin', 'master', 'agent', 'provider'].map((roleKey, index) => ({ id: index, territoryId: 1, roleKey, status: 'active' })) };
  expect(evaluatePilotReadiness(base).ready).toBe(true);
  expect(evaluatePilotReadiness({ ...base, territories: [{ ...base.territories[0], isActive: false }] }).ready).toBe(true);
  expect(evaluatePilotReadiness({ ...base, availabilities: [] }).issues[0].code).toBe('PILOT_CATALOG_NOT_AVAILABLE');
  expect(evaluatePilotReadiness({ ...base, availabilities: [{ territoryId: 1, organizationId: 9, serviceDefinitionId: 10, isActive: true }] }).issues[0].code).toBe('PILOT_CATALOG_NOT_AVAILABLE');
  expect(evaluatePilotReadiness({ ...base, definitions: [{ id: 10, isActive: true }, { id: 11, isActive: true }] }).ready).toBe(true);
  expect(evaluatePilotReadiness({
    ...base,
    memberships: [{ territoryId: 1, roleKey: 'country_admin', status: 'active' }],
    users: [{ role: 'agent', countryId: 1 }],
    providers: [{ status: 'active', countryCode: 'ML' }],
  }).ready).toBe(true);
  expect(evaluatePilotReadiness({
    ...base,
    memberships: [{ territoryId: 1, roleKey: 'country_admin', status: 'active' }],
    users: [{ role: 'agent', countryId: 2 }],
    providers: [{ status: 'active', countryCode: 'CI' }],
  }).issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'PILOT_ROLES_INCOMPLETE' })]));
});
