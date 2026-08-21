'use strict';

const mockEmitEvent = jest.fn();

jest.mock('../../src/services/notification.service', () => ({
  computeProgress: jest.fn(() => 'started'),
  getAdminRecipientIds: jest.fn(async () => [7]),
}));
jest.mock('../../src/services/activity.service', () => ({ emitEvent: mockEmitEvent }));
jest.mock('../../src/utils/logger', () => ({ warn: jest.fn() }));

const { notifyServiceCreated } = require('../../src/services/serviceNotification.service');

test('a mobility notification carries enough context to open the admin dispatch', async () => {
  await notifyServiceCreated({
    actorId: 15,
    service: {
      id: 81,
      title: 'Course Teranga en moto',
      missionStatus: 'CREATED',
      requestedVehicleType: 'motorcycle',
    },
    fullService: null,
    targetClientId: 15,
    countryId: 1,
    regionId: null,
  });

  expect(mockEmitEvent).toHaveBeenCalledWith(
    expect.objectContaining({
      entityType: 'service',
      entityId: 81,
      metadata: expect.objectContaining({
        serviceId: 81,
        missionStatus: 'CREATED',
        requestedVehicleType: 'motorcycle',
      }),
    })
  );
});
