// frontend/src/services/propertyListings.js
// Marketplace immobilière (docs/BRAINSTORM_ECOSYSTEME_TERANGA.md §7) — annonces publiques
// gérées par l'admin, aucun compte agence. GET /property-listings + GET /property-listings/:id
// sont publics (pas d'auth) ; le reste réservé admin/master.
import api from './api';

const UPLOAD_TIMEOUT_MS =
  Number(process.env.REACT_APP_UPLOAD_TIMEOUT_MS) || 120000;

function buildFormData(fields = {}, photos = []) {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      formData.append(key, value);
    }
  });
  (photos || []).forEach((file) => {
    if (file) formData.append('photos', file);
  });
  return formData;
}

/** GET /v1/property-listings — public, filtres optionnels countryId/regionId/city. */
export async function listPropertyListings(params = {}) {
  const { data } = await api.get('/v1/property-listings', { params });
  return data?.listings || [];
}

/** GET /v1/property-listings/:id — public, page individuelle partageable. */
export async function getPropertyListing(id) {
  const { data } = await api.get(`/v1/property-listings/${id}`);
  return data?.listing || null;
}

/** GET /v1/property-listings/admin — admin/master, scope géographique, tous statuts. */
export async function listPropertyListingsAdmin(params = {}) {
  const { data } = await api.get('/v1/property-listings/admin', { params });
  return data?.listings || [];
}

/** POST /v1/property-listings — admin/master, multipart. */
export async function createPropertyListing(fields, photos = []) {
  const formData = buildFormData(fields, photos);
  const { data } = await api.post('/v1/property-listings', formData, {
    timeout: UPLOAD_TIMEOUT_MS,
  });
  return data?.listing;
}

/** PUT /v1/property-listings/:id — admin/master. Nouvelles photos = remplacement complet. */
export async function updatePropertyListing(id, fields, photos = []) {
  const formData = buildFormData(fields, photos);
  const { data } = await api.put(`/v1/property-listings/${id}`, formData, {
    timeout: UPLOAD_TIMEOUT_MS,
  });
  return data?.listing;
}

/** DELETE /v1/property-listings/:id — admin/master, suppression physique. */
export async function deletePropertyListing(id) {
  const { data } = await api.delete(`/v1/property-listings/${id}`);
  return data;
}
