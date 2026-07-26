'use strict';

const { getDistanceMatrix } = require('../../src/services/distanceMatrix.service');

describe('distanceMatrix.service.getDistanceMatrix', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.GOOGLE_MAPS_SERVER_KEY;

  const origin = { lat: 12.65, lng: -8.0 };
  const destination = { lat: 12.6, lng: -7.99 };

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.GOOGLE_MAPS_SERVER_KEY = originalKey;
  });

  test('returns null without an API key configured', async () => {
    delete process.env.GOOGLE_MAPS_SERVER_KEY;
    const result = await getDistanceMatrix([origin], [destination]);
    expect(result).toBeNull();
  });

  test('parses a successful Distance Matrix response', async () => {
    process.env.GOOGLE_MAPS_SERVER_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'OK',
        rows: [
          {
            elements: [
              { status: 'OK', distance: { value: 4200 }, duration: { value: 720 } },
            ],
          },
        ],
      }),
    });

    const result = await getDistanceMatrix([origin], [destination]);
    expect(result).toEqual({
      rows: [[{ status: 'OK', distanceMeters: 4200, durationSeconds: 720 }]],
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('caches results and does not re-call the API for the same pair', async () => {
    process.env.GOOGLE_MAPS_SERVER_KEY = 'test-key';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'OK',
        rows: [
          {
            elements: [
              { status: 'OK', distance: { value: 1000 }, duration: { value: 100 } },
            ],
          },
        ],
      }),
    });
    global.fetch = fetchMock;

    const uniqueOrigin = { lat: 1.111, lng: 2.222 };
    const uniqueDestination = { lat: 3.333, lng: 4.444 };

    await getDistanceMatrix([uniqueOrigin], [uniqueDestination]);
    await getDistanceMatrix([uniqueOrigin], [uniqueDestination]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('returns null when the API reports an error status', async () => {
    process.env.GOOGLE_MAPS_SERVER_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'REQUEST_DENIED' }),
    });

    const result = await getDistanceMatrix(
      [{ lat: 9.1, lng: 9.1 }],
      [{ lat: 9.2, lng: 9.2 }]
    );
    expect(result).toBeNull();
  });
});
