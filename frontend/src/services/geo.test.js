import {
  GEO_SELECTION_CHANGED_EVENT,
  getGeoSelection,
  setGeoSelection,
  mergeGeoParams,
  mergeGeoPayload,
  appendGeoFormData,
} from './geo';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

test('setGeoSelection dispatches event when scope changes', () => {
  const listener = jest.fn();
  window.addEventListener(GEO_SELECTION_CHANGED_EVENT, listener);

  setGeoSelection({ countryId: 1, regionId: 2 });

  expect(getGeoSelection()).toEqual({ countryId: 1, regionId: 2 });
  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener.mock.calls[0][0]?.detail).toEqual({
    countryId: 1,
    regionId: 2,
  });

  window.removeEventListener(GEO_SELECTION_CHANGED_EVENT, listener);
});

test('setGeoSelection does not dispatch event when scope is unchanged', () => {
  setGeoSelection({ countryId: 3, regionId: 7 });

  const listener = jest.fn();
  window.addEventListener(GEO_SELECTION_CHANGED_EVENT, listener);

  setGeoSelection({ countryId: 3, regionId: 7 });

  expect(listener).not.toHaveBeenCalled();

  window.removeEventListener(GEO_SELECTION_CHANGED_EVENT, listener);
});

test.each([mergeGeoParams, mergeGeoPayload])('an explicit country never inherits a region from another country', (merge) => {
  setGeoSelection({ countryId: 1, regionId: 10 });
  expect(merge({ countryId: 2 })).toEqual({ countryId: 2 });
  expect(merge({ country_id: 2 })).toEqual({ country_id: 2 });
  expect(merge({ countryId: null })).toEqual({ countryId: null });
  expect(merge({ countryId: '1' })).toEqual({ countryId: '1', regionId: 10 });
  expect(merge({ countryId: 2, regionId: 20 })).toEqual({ countryId: 2, regionId: 20 });
  expect(merge({ region_id: 12 })).toEqual({ countryId: 1, region_id: 12 });
  expect(merge({ regionId: null })).toEqual({ countryId: 1, regionId: null });
});

test('multipart scope follows the same country and region rules as JSON', () => {
  setGeoSelection({ countryId: 1, regionId: 10 });
  const inherited = new FormData();
  appendGeoFormData(inherited);
  expect(Object.fromEntries(inherited)).toEqual({ countryId: '1', regionId: '10' });

  const destination = new FormData();
  destination.append('country_id', '2');
  appendGeoFormData(destination);
  expect(Object.fromEntries(destination)).toEqual({ country_id: '2' });

  const regional = new FormData();
  regional.append('country_id', '2');
  regional.append('region_id', '20');
  appendGeoFormData(regional);
  expect(Object.fromEntries(regional)).toEqual({ country_id: '2', region_id: '20' });
});
