'use strict';
jest.mock('../../models', () => ({}));
jest.mock('../../src/services/notification.service', () => ({ invalidateNotificationSummary: jest.fn() }));
const { normalizePolicy, isOfferingOpen } = require('../../src/services/missionCoordination.service');
test('dispatch limits are bounded and activation must be explicit', () => {
  expect(normalizePolicy({ enabled: 'true', maxAttempts: 100, acceptanceSeconds: -1 })).toMatchObject({ enabled: false, maxAttempts: 3, acceptanceSeconds: 120 });
  expect(normalizePolicy({ enabled: true, maxAttempts: 2 })).toMatchObject({ enabled: true, maxAttempts: 2 });
});
test('opening hours use the execution timezone and reject unknown schedules', () => {
  const offering = { openingHours: { fri: [['08:00', '18:00']] } };
  const now = new Date('2026-10-23T16:30:00Z');
  expect(isOfferingOpen(offering, { timezone: 'Africa/Accra' }, now)).toBe(true);
  expect(isOfferingOpen(offering, { timezone: 'Africa/Nairobi' }, now)).toBe(false);
  expect(isOfferingOpen(offering, {}, now)).toBe(false);
  expect(isOfferingOpen({ openingHours: { unexpected: true } }, { timezone: 'Africa/Accra' }, now)).toBe(false);
});
