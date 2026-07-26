'use strict';

const { geocodeAddress } = require('../../src/services/geocoding.service');

describe('geocoding.service.geocodeAddress', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.GOOGLE_MAPS_SERVER_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.GOOGLE_MAPS_SERVER_KEY = originalKey;
  });

  test('returns null without throwing when no API key is configured', async () => {
    delete process.env.GOOGLE_MAPS_SERVER_KEY;
    const result = await geocodeAddress('123 Rue Test, Bamako');
    expect(result).toBeNull();
  });

  test('returns null for an empty address without calling the API', async () => {
    process.env.GOOGLE_MAPS_SERVER_KEY = 'test-key';
    global.fetch = jest.fn();
    const result = await geocodeAddress('   ');
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('parses a successful Geocoding API response', async () => {
    process.env.GOOGLE_MAPS_SERVER_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'OK',
        results: [
          {
            formatted_address: 'Bamako, Mali',
            geometry: { location: { lat: 12.6392, lng: -8.0029 } },
          },
        ],
      }),
    });

    const result = await geocodeAddress('Bamako');
    expect(result).toEqual({
      latitude: 12.6392,
      longitude: -8.0029,
      formattedAddress: 'Bamako, Mali',
    });
  });

  test('returns null when the API reports ZERO_RESULTS', async () => {
    process.env.GOOGLE_MAPS_SERVER_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ZERO_RESULTS', results: [] }),
    });

    const result = await geocodeAddress('adresse-inexistante-xyz');
    expect(result).toBeNull();
  });

  test('returns null when the HTTP call fails', async () => {
    process.env.GOOGLE_MAPS_SERVER_KEY = 'test-key';
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

    const result = await geocodeAddress('Bamako');
    expect(result).toBeNull();
  });
});
