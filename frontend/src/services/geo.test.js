import {
  GEO_SELECTION_CHANGED_EVENT,
  getGeoSelection,
  setGeoSelection,
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
