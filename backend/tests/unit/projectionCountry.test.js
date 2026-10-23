'use strict';

const { projectionArgs, projectionCountry } = require('../../src/utils/projectionCountry');

describe('projection country scope', () => {
  test('keeps the all-country default and normalizes an explicit country', () => {
    expect(projectionArgs([])).toEqual({ apply: false, json: false, failOnBlocking: false, countryCode: undefined });
    expect(projectionArgs(['--apply', '--json', '--fail-on-blocking', '--country=ml']))
      .toEqual({ apply: true, json: true, failOnBlocking: true, countryCode: 'ML' });
    expect(projectionCountry([], undefined)).toBeNull();
    const country = { id: 5, isoCode: 'ML' };
    expect(projectionCountry([country], 'ml')).toBe(country);
  });

  test.each([
    ['--apply', '--country='],
    ['--apply', '--country=MALI'],
    ['--apply', '--country=ML', '--country=CI'],
    ['--apply', '--county=ML'],
    ['--apply', '--country', 'ML'],
    ['--apply', '--force'],
  ])('rejects unsafe arguments rather than applying every country: %j', (...args) => {
    expect(() => projectionArgs(args)).toThrow();
  });

  test('rejects an unknown or invalid country instead of removing the scope', () => {
    expect(() => projectionCountry([{ id: 5, isoCode: 'ML' }], 'CI')).toThrow('not found: CI');
    expect(() => projectionCountry([], '')).toThrow('two-letter ISO');
  });
});
