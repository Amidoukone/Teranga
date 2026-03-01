// frontend/src/services/geo.js
const STORAGE_KEY = 'teranga_geo_scope';
export const GEO_SELECTION_CHANGED_EVENT = 'teranga_geo_changed';

export function getGeoSelection() {
  if (typeof window === 'undefined') return { countryId: null, regionId: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { countryId: null, regionId: null };
    const parsed = JSON.parse(raw);
    return {
      countryId: parsed?.countryId ?? null,
      regionId: parsed?.regionId ?? null,
    };
  } catch {
    return { countryId: null, regionId: null };
  }
}

export function setGeoSelection(selection = {}) {
  if (typeof window === 'undefined') return;
  const previous = getGeoSelection();
  const payload = {
    countryId: selection?.countryId ?? null,
    regionId: selection?.regionId ?? null,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

  const changed =
    String(previous?.countryId ?? '') !== String(payload.countryId ?? '') ||
    String(previous?.regionId ?? '') !== String(payload.regionId ?? '');

  if (changed) {
    window.dispatchEvent(
      new CustomEvent(GEO_SELECTION_CHANGED_EVENT, { detail: payload })
    );
  }
}

export function getGeoParams() {
  const { countryId, regionId } = getGeoSelection();
  const params = {};
  if (countryId) params.countryId = countryId;
  if (regionId) params.regionId = regionId;
  return params;
}

export function mergeGeoParams(params = {}) {
  const geo = getGeoParams();
  return { ...geo, ...params };
}

export function mergeGeoPayload(payload = {}) {
  const geo = getGeoParams();
  return { ...geo, ...payload };
}

export function appendGeoFormData(formData) {
  if (!formData) return;
  const { countryId, regionId } = getGeoSelection();
  if (countryId && !formData.has('countryId') && !formData.has('country_id')) {
    formData.append('countryId', String(countryId));
  }
  if (regionId && !formData.has('regionId') && !formData.has('region_id')) {
    formData.append('regionId', String(regionId));
  }
}
