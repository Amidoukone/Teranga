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
  return mergeGeoPayload(params);
}

export function mergeGeoPayload(payload = {}) {
  const geo = getGeoParams();
  const hasCountry = payload.countryId !== undefined || payload.country_id !== undefined;
  const hasRegion = payload.regionId !== undefined || payload.region_id !== undefined;
  const countryId = payload.countryId !== undefined ? payload.countryId : payload.country_id;
  // Un pays explicite remplace aussi sa région héritée si le pays change.
  // Les alias snake_case doivent pouvoir remplacer la sélection courante.
  if (hasCountry) {
    if (String(countryId ?? '') !== String(geo.countryId ?? '')) delete geo.regionId;
    delete geo.countryId;
  }
  if (hasRegion) delete geo.regionId;
  return { ...geo, ...payload };
}

export function appendGeoFormData(formData) {
  if (!formData) return;
  const merged = mergeGeoPayload(Object.fromEntries(formData.entries()));
  for (const field of ['countryId', 'regionId']) {
    if (merged[field] != null && !formData.has(field)) {
      formData.append(field, String(merged[field]));
    }
  }
}
