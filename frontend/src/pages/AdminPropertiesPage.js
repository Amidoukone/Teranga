// ============================================================================
// AdminPropertiesPage.jsx AAAasAAaA VERSION PRODUCTION READY (Apple Light Premium)
// AAA...aAaA Master + multi-pays compatible (backend GeoScope)
// AAA...aAaA FILE_BASE prod-safe (pas de localhost)
// AAA...aAaA Photos: support string | {url,fileId} (ImageKit) | legacy
// AAA...aAaA Lightbox + previews sans erreurs (revokeObjectURL safe)
// 100% fonctionnel, aucune rAAAgression, mAAAame logique, design modernisAAA.
// ============================================================================

import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getAllProperties,
  getClientProperties,
  updateProperty,
  createPropertyForClient,
} from '../services/properties';
import api from '../services/api';
import { me } from '../services/auth';
import { normalizeRole } from '../utils/role';
import { notify } from '../utils/notify';
import { useDeleteConfirm } from '../hooks/useDeleteConfirm';

// ============================================================================
// AAA...A A...aTMAA FILE_BASE + normalizePath + toAbsUrl AAAasAAaA Standard Teranga (PRODUCTION SAFE)
// - Compatible Render/Netlify
// - SSR safe
// - No localhost fallback (AAAvite bugs prod multi-pays)
// ============================================================================
const FILE_BASE =
  (typeof window !== 'undefined' &&
    (window.__TERANGA_FILE_BASE_URL ||
      (window.__TERANGA_API_BASE_URL
        ? window.__TERANGA_API_BASE_URL.replace(/\/api\/?$/, '')
        : ''))) ||
  '';

function normalizePath(path = '') {
  if (!path) return '';
  const p = String(path).trim().replace(/\\/g, '/');
  if (/^https?:\/\//i.test(p)) return p;
  const fixed = p.startsWith('/') ? p : `/${p}`;
  return fixed.replace(/\/{2,}/g, '/');
}

function toAbsUrl(path = '') {
  const norm = normalizePath(path);
  if (!norm) return '';
  if (/^https?:\/\//i.test(norm)) return norm;
  return FILE_BASE.replace(/\/$/, '') + norm;
}

function isPdf(path = '') {
  return /\.pdf($|\?)/i.test(String(path || ''));
}

function getPropertyTypeFieldConfig(type, t) {
  if (type === 'land') {
    return {
      showSurface: true,
      showRooms: false,
      surfaceLabel: t('adminPropertiesPage.form.dynamic.landSurfaceLabel'),
      surfacePlaceholder: t('adminPropertiesPage.form.dynamic.landSurfacePlaceholder'),
      roomsLabel: t('adminPropertiesPage.form.labels.rooms'),
      roomsPlaceholder: t('adminPropertiesPage.form.placeholders.rooms'),
    };
  }

  if (type === 'commercial') {
    return {
      showSurface: true,
      showRooms: true,
      surfaceLabel: t('adminPropertiesPage.form.dynamic.commercialSurfaceLabel'),
      surfacePlaceholder: t('adminPropertiesPage.form.placeholders.surface'),
      roomsLabel: t('adminPropertiesPage.form.dynamic.commercialRoomsLabel'),
      roomsPlaceholder: t('adminPropertiesPage.form.dynamic.commercialRoomsPlaceholder'),
    };
  }

  if (type === 'automobile') {
    return {
      showSurface: true,
      showRooms: true,
      surfaceLabel: t('adminPropertiesPage.form.dynamic.automobileSurfaceLabel'),
      surfacePlaceholder: t('adminPropertiesPage.form.dynamic.automobileSurfacePlaceholder'),
      roomsLabel: t('adminPropertiesPage.form.dynamic.automobileRoomsLabel'),
      roomsPlaceholder: t('adminPropertiesPage.form.dynamic.automobileRoomsPlaceholder'),
    };
  }

  return {
    showSurface: true,
    showRooms: true,
    surfaceLabel: t('adminPropertiesPage.form.labels.surface'),
    surfacePlaceholder: t('adminPropertiesPage.form.placeholders.surface'),
    roomsLabel: t('adminPropertiesPage.form.labels.rooms'),
    roomsPlaceholder: t('adminPropertiesPage.form.placeholders.rooms'),
  };
}

// ============================================================================
// AAA...A AAAA Normalisation Photos (ImageKit + legacy)
// - backend peut renvoyer: ["https://..."] (dAAAjAAA ok)
// - ou [{url,fileId}, ...]
// - ou {photos:[{url}...]} (selon couches)
// ============================================================================
function normalizePhotoValue(photo) {
  if (!photo) return '';
  if (typeof photo === 'string') return photo;
  if (typeof photo === 'object' && photo.url) return photo.url;
  if (typeof photo === 'object' && photo.path) return photo.path;
  if (typeof photo === 'object' && photo.filePath) return photo.filePath;
  return '';
}

// ============================================================================
// AAA...A AAAA Safe revokeObjectURL (AAAvite erreurs si url http)
// ============================================================================
function safeRevoke(url) {
  try {
    if (url && typeof url === 'string' && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  } catch {
    // no-op
  }
}

// ============================================================================
// AAA...A AAAA PAGE PRINCIPALE AAAasAAaA Apple Light Premium
// ============================================================================
export default function AdminPropertiesPage() {
  const { t } = useTranslation();
  const { confirmDelete } = useDeleteConfirm();
  const [user, setUser] = useState(null);

  const [properties, setProperties] = useState([]);
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState('');

  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editId, setEditId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  const [form, setForm] = useState({
    title: '',
    type: 'house',
    address: '',
    city: '',
    postalCode: '',
    surfaceArea: '',
    roomCount: '',
    description: '',
 // AAA...A A...aTMAA Multi-pays (optionnel AAAasAAaA backend gAAA re scope)
    // countryId: '',
    // regionId: '',
  });

  const [files, setFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);

  // ==========================================================================
 // AAA...A AaaAA14AA AA AA LIGHTBOX (Agrandissement + Navigation)
  // ==========================================================================
  const [lightbox, setLightbox] = useState({
    open: false,
    images: [],
    index: 0,
  });

  useEffect(() => {
    if (!lightbox.open) return;

    function onKey(e) {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextImage();
      if (e.key === 'ArrowLeft') prevImage();
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox.open, lightbox.index]);

  // ==========================================================================
 // AAA...A AaAAA1 Initialisation (auth + clients + biens)
  // ==========================================================================
  useEffect(() => {
    (async () => {
      try {
        const u = await me();
        const current = u?.user;
        if (!current) {
          window.location.href = '/login';
          return;
        }
        if (normalizeRole(current.role) !== 'admin') {
          window.location.href = '/dashboard';
          return;
        }
        setUser(current);
        await Promise.all([loadClients(), loadProperties()]);
      } catch (e) {
        console.error('AAAAA...aTM init AdminPropertiesPage:', e);
        localStorage.removeItem('teranga_token');
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==========================================================================
 // AAA...A AaAAA1 Charger Clients (admin/master scoped: backend filtre via GeoScope si appliquAAA)
  // ==========================================================================
  async function loadClients() {
    try {
      const { data } = await api.get('/users?role=client');
      const list = data.users || [];
      setClients(list);
      setFilteredClients(list);
    } catch (e) {
      console.error('AAAAA...aTM Erreur clients:', e);
    }
  }

  // ==========================================================================
 // AAA...A AaAAA1 Charger PropriAAAtAAAs
  // - master/admin scoped: backend filtre via GeoScope automatiquement
  // ==========================================================================
  async function loadProperties(clientId) {
    try {
      setLoading(true);

      let props = clientId
        ? await getClientProperties(clientId)
        : await getAllProperties();

      // normalise property.photos (string | object)
      const normalized = (props || []).map((p) => {
        const photos = Array.isArray(p?.photos)
          ? p.photos.map(normalizePhotoValue).filter(Boolean)
          : [];
        return { ...p, photos };
      });

      setProperties(normalized);
    } catch (e) {
      console.error('AAAAA...aTM Erreur biens:', e);
    } finally {
      setLoading(false);
    }
  }

  // ==========================================================================
 // AAA...A AaAAA1 Recherche Client
  // ==========================================================================
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredClients(clients);
      return;
    }
    const term = searchTerm.toLowerCase();
    const filtered = clients.filter(
      (c) =>
        c.firstName?.toLowerCase().includes(term) ||
        c.lastName?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term)
    );
    setFilteredClients(filtered);
  }, [searchTerm, clients]);

  // ==========================================================================
 // AAA...A AaAAA1 Gestion Upload + previews
  // ==========================================================================
  function handleFileChange(e) {
    const selected = Array.from(e.target.files || []);
    setFiles(selected);

    // Nettoyage anciennes URLs (uniquement blob)
    previewUrls.forEach(safeRevoke);

    // Previews blob pour fichiers locaux
    const previews = selected.map((f) => URL.createObjectURL(f));
    setPreviewUrls(previews);
  }

  // ==========================================================================
 // AAA...A AaAAA1 Ajouter Bien
  // ==========================================================================
  async function handleCreate(e) {
    e.preventDefault();
    if (isSubmitting) return;

    if (!selectedClient) {
      notify(t('adminPropertiesPage.alerts.selectClient'));
      return;
    }

    try {
      setIsSubmitting(true);
      await createPropertyForClient(selectedClient, form, files);
      notify(t('adminPropertiesPage.alerts.createSuccess'));
      resetForm();
      setIsCreating(false);
      await loadProperties(selectedClient);
    } catch (e2) {
      console.error('AAAAA...aTM Erreur crAAAation:', e2);
      notify(t('adminPropertiesPage.alerts.createError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  // ==========================================================================
 // AAA...A AaAAA1 Modifier Bien
  // ==========================================================================
  function startEdit(p) {
    setEditId(p.id);
    setIsCreating(false);

    setForm({
      title: p.title,
      type: p.type,
      address: p.address,
      city: p.city,
      postalCode: p.postalCode || '',
      surfaceArea: p.surfaceArea || '',
      roomCount: p.roomCount || '',
      description: p.description || '',
 // AAA...A A...aTMAA Multi-pays (optionnel) AAAasAAaA si tu ajoutes plus tard les champs UI
      // countryId: p.countryId || '',
      // regionId: p.regionId || '',
    });

    setFiles([]);

    // Nettoyage anciennes previews blob uniquement
    previewUrls.forEach(safeRevoke);

    // Ici on affiche en preview les photos existantes (URL absolues),
    // sans les "revoke" ensuite (safeRevoke ne touchera pas http)
    const previews = (p.photos || [])
      .map(normalizePhotoValue)
      .filter(Boolean)
      .map((photo) => toAbsUrl(photo));

    setPreviewUrls(previews);
  }

  async function handleUpdate(e) {
    e.preventDefault();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      await updateProperty(editId, form, files);
      notify(t('adminPropertiesPage.alerts.updateSuccess'));
      resetForm();
      await loadProperties(selectedClient);
    } catch (e2) {
      console.error('AAAAA...aTM Update:', e2);
      notify(t('adminPropertiesPage.alerts.updateError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  // ==========================================================================
 // AAA...A AaAAA1 Supprimer Bien
  // ==========================================================================
  async function handleDelete(id) {
    const ok = await confirmDelete("property");
    if (!ok) return;
    try {
      await api.delete(`/properties/${id}`);
      await loadProperties(selectedClient);
    } catch (e) {
      console.error('AAAAA...aTM delete property:', e);
      notify(t('adminPropertiesPage.alerts.deleteError'));
    }
  }

  // ==========================================================================
 // AAA...A AaAAA1 Reset Form
  // ==========================================================================
  function resetForm() {
    setEditId(null);
    setFiles([]);

    previewUrls.forEach(safeRevoke);
    setPreviewUrls([]);

    setForm({
      title: '',
      type: 'house',
      address: '',
      city: '',
      postalCode: '',
      surfaceArea: '',
      roomCount: '',
      description: '',
      // countryId: '',
      // regionId: '',
    });
  }

  // ==========================================================================
 // AAA...A AaAAA1 Lightbox Controls
  // ==========================================================================
  function openLightbox(images, index = 0) {
    if (!images || !images.length) return;
    setLightbox({ open: true, images, index });
  }
  function closeLightbox() {
    setLightbox({ open: false, images: [], index: 0 });
  }
  function nextImage() {
    setLightbox((lb) => ({
      ...lb,
      index: (lb.index + 1) % lb.images.length,
    }));
  }
  function prevImage() {
    setLightbox((lb) => ({
      ...lb,
      index: (lb.index - 1 + lb.images.length) % lb.images.length,
    }));
  }

  const selectedClientObj = useMemo(
    () => clients.find((c) => String(c.id) === String(selectedClient)),
    [clients, selectedClient]
  );
  const fieldConfig = getPropertyTypeFieldConfig(form.type, t);

  // ==========================================================================
 // AAA...A AaaAAAA AA AA UI AAAasAAaA Apple Light Premium (Cartes uniquement)
  // ==========================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-3 sm:px-4 py-8 sm:py-10">
      <div className="max-w-7xl mx-auto bg-surface-card/90 backdrop-blur-xl shadow-[0_18px_45px_rgba(15,23,42,0.12)] rounded-3xl border border-border/70 px-4 sm:px-8 py-6 sm:py-8 space-y-8">
        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary">
              {t('adminPropertiesPage.title')}
            </h1>
            <p className="text-sm text-text-muted mt-1">
              {t('adminPropertiesPage.subtitle')}
            </p>

            {selectedClientObj && (
              <p className="text-xs text-text-muted mt-1">
                {t('adminPropertiesPage.labels.selectedClient')}{' '}
                <span className="font-medium text-text-secondary">
                  {selectedClientObj.firstName} {selectedClientObj.lastName} ({selectedClientObj.email})
                </span>
              </p>
            )}

            {user?.role === 'master' && (
              <p className="text-[11px] text-text-muted mt-2">
                {t('adminPropertiesPage.labels.masterNote')}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 justify-start md:justify-end">
            <button
              onClick={() => loadProperties(selectedClient)}
              className="inline-flex items-center justify-center px-4 py-2 text-xs sm:text-sm font-medium rounded-full app-btn-neutral shadow-sm transition"
            >
              {t('adminPropertiesPage.buttons.refresh')}
            </button>
          </div>
        </header>

        {/* CLIENT SELECTION */}
        <section className="bg-surface-main/80 border border-border rounded-2xl px-4 sm:px-5 py-4 sm:py-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              {t('adminPropertiesPage.client.title')}
            </h2>
            {selectedClient && (
              <span className="app-badge app-badge-info text-[11px] px-2 py-1">
                {t('adminPropertiesPage.client.badge', { count: properties.length })}
              </span>
            )}
          </div>

          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-[11px] font-medium text-text-muted mb-1">
                {t('adminPropertiesPage.client.searchLabel')}
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('adminPropertiesPage.client.searchPlaceholder')}
                className="app-input-subtle"
              />
            </div>

            <div className="w-full lg:w-80">
              <label className="block text-[11px] font-medium text-text-muted mb-1">
                {t('adminPropertiesPage.client.selectLabel')}
              </label>
              <select
                value={selectedClient}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedClient(id);
                  loadProperties(id);
                  resetForm();
                }}
                className="app-input-subtle"
              >
                <option value="">{t('adminPropertiesPage.client.selectPlaceholder')}</option>
                {filteredClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName} ({c.email})
                  </option>
                ))}
              </select>
            </div>

            {selectedClient && (
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setIsCreating(true);
                    resetForm();
                  }}
                  disabled={isSubmitting}
                  className="app-btn-success inline-flex items-center justify-center px-4 py-2 text-xs sm:text-sm font-medium rounded-full"
                >
                  {t('adminPropertiesPage.buttons.addProperty')}
                </button>
              </div>
            )}
          </div>
        </section>

 {/* FORMULAIRE (crAAAation / AAAdition) */}
        {(isCreating || editId) && (
          <section className="bg-surface-main/80 border border-border rounded-2xl px-4 sm:px-5 py-5 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="text-base font-semibold text-text-primary">
                {editId
                  ? t('adminPropertiesPage.form.titleEdit', { id: editId })
                  : t('adminPropertiesPage.form.titleCreate')}
              </h2>
              <span className="text-[11px] text-text-muted">
                {t('adminPropertiesPage.form.requiredNote')}
              </span>
            </div>

            <form
              onSubmit={editId ? handleUpdate : handleCreate}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              {/* Titre */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-text-secondary">
                  {t('adminPropertiesPage.form.labels.title')}
                </label>
                <input
                  placeholder={t('adminPropertiesPage.form.placeholders.title')}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  className="app-input-subtle"
                />
              </div>

              {/* Type */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-text-secondary">
                  {t('adminPropertiesPage.form.labels.type')}
                </label>
                <select
                  value={form.type}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    const nextConfig = getPropertyTypeFieldConfig(nextType, t);
                    setForm((prev) => ({
                      ...prev,
                      type: nextType,
                      surfaceArea: nextConfig.showSurface ? prev.surfaceArea : '',
                      roomCount: nextConfig.showRooms ? prev.roomCount : '',
                    }));
                  }}
                  className="app-input-subtle"
                >
                  <option value="house">{t('labels.property.types.house')}</option>
                  <option value="apartment">{t('labels.property.types.apartment')}</option>
                  <option value="land">{t('labels.property.types.land')}</option>
                  <option value="automobile">{t('labels.property.types.automobile')}</option>
                  <option value="commercial">{t('labels.property.types.commercial')}</option>
                </select>
              </div>

              {/* Adresse */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-text-secondary">
                  {t('adminPropertiesPage.form.labels.address')}
                </label>
                <input
                  placeholder={t('adminPropertiesPage.form.placeholders.address')}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  required
                  className="app-input-subtle"
                />
              </div>

              {/* Ville */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-text-secondary">
                  {t('adminPropertiesPage.form.labels.city')}
                </label>
                <input
                  placeholder={t('adminPropertiesPage.form.placeholders.city')}
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  required
                  className="app-input-subtle"
                />
              </div>

              {/* Code postal */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-text-secondary">
                  {t('adminPropertiesPage.form.labels.postalCode')}
                </label>
                <input
                  placeholder={t('adminPropertiesPage.form.placeholders.postalCode')}
                  value={form.postalCode}
                  onChange={(e) =>
                    setForm({ ...form, postalCode: e.target.value })
                  }
                  className="app-input-subtle"
                />
              </div>

 {/* Surface / KilomAAAtrage */}
              {fieldConfig.showSurface && (
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-text-secondary">
                    {fieldConfig.surfaceLabel}
                  </label>
                  <input
                    type="number"
                    placeholder={fieldConfig.surfacePlaceholder}
                    value={form.surfaceArea}
                    onChange={(e) =>
                      setForm({ ...form, surfaceArea: e.target.value })
                    }
                    className="app-input-subtle"
                  />
                </div>
              )}
 {/* PiAAA ces / Espaces / Places */}
              {fieldConfig.showRooms && (
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-text-secondary">
                    {fieldConfig.roomsLabel}
                  </label>
                  <input
                    type="number"
                    placeholder={fieldConfig.roomsPlaceholder}
                    value={form.roomCount}
                    onChange={(e) =>
                      setForm({ ...form, roomCount: e.target.value })
                    }
                    className="app-input-subtle"
                  />
                </div>
              )}

              {/* Description */}
              <div className="sm:col-span-2 flex flex-col gap-1">
                <label className="text-[11px] font-medium text-text-secondary">
                  {t('adminPropertiesPage.form.labels.description')}
                </label>
                <textarea
                  placeholder={t('adminPropertiesPage.form.placeholders.description')}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={3}
                  className="app-input-subtle resize-y"
                />
              </div>

              {/* FILES */}
              <div className="sm:col-span-2 flex flex-col gap-2 mt-1">
                <label className="text-[11px] font-medium text-text-secondary">
                  {t('adminPropertiesPage.form.filesLabel')}
                </label>
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="app-input-subtle"
                />

                {previewUrls.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-3">
                    {previewUrls.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        className="w-20 h-20 object-cover rounded-xl border border-border shadow-sm"
                        alt={t('adminPropertiesPage.form.previewAlt', { index: i + 1 })}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="sm:col-span-2 mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setIsCreating(false);
                  }}
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center px-4 py-2 text-xs sm:text-sm rounded-full bg-surface-main/80 text-text-secondary hover:bg-surface-main/80 transition"
                >
                  {t('adminPropertiesPage.buttons.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="app-btn-primary inline-flex items-center justify-center px-5 py-2 text-xs sm:text-sm font-medium rounded-full"
                >
                  {editId
                    ? t('adminPropertiesPage.buttons.save')
                    : t('adminPropertiesPage.buttons.create')}
                </button>
              </div>
            </form>
          </section>
        )}

 {/* LISTE DES BIENS AAAasAAaA CARTES PREMIUM */}
        <section className="space-y-4">
          {loading ? (
            <p className="text-center text-text-muted py-6 text-sm animate-pulse">
              {t('adminPropertiesPage.loading')}
            </p>
          ) : properties.length === 0 ? (
            <p className="text-center text-text-muted italic py-6 text-sm">
              {t('adminPropertiesPage.empty')}
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-text-muted px-1">
                <span>{t('adminPropertiesPage.list.count', { count: properties.length })}</span>
              </div>

              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {properties.map((p) => {
                  const imageUrls = (p.photos || [])
                    .filter((ph) => !isPdf(ph))
                    .map((ph) => toAbsUrl(ph));
                  const typeLabel = p.type
                    ? t(`labels.property.types.${p.type}`, { defaultValue: p.type })
                    : t('adminPropertiesPage.list.typeUnknown');
                  const surfaceRoomsLabel = t('adminPropertiesPage.list.surfaceRooms', {
                    surface: p.surfaceArea,
                    count: p.roomCount || 0,
                  });

                  return (
                    <article
                      key={p.id}
                      className="bg-surface-card/90 border border-border rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full"
                    >
                      {/* Photos */}
                      {p.photos?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {p.photos.map((photo, i) => {
                            const abs = toAbsUrl(photo);

                            if (isPdf(photo)) {
                              return (
                                <a
                                  key={i}
                                  href={abs}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="w-20 h-20 border border-border bg-surface-main rounded-xl flex items-center justify-center text-xs text-text-secondary hover:bg-surface-main/80 transition"
                                >
                                  {t('adminPropertiesPage.list.pdfLabel')}
                                </a>
                              );
                            }

                            const idx = imageUrls.indexOf(abs);

                            return (
                              <img
                                key={i}
                                src={abs}
                                alt={t('adminPropertiesPage.list.photoAlt', { index: i + 1 })}
                                onClick={() =>
                                  openLightbox(imageUrls, Math.max(idx, 0))
                                }
                                className="w-20 h-20 object-cover rounded-xl border border-border cursor-pointer hover:scale-[1.03] hover:shadow-sm transition-transform"
                              />
                            );
                          })}
                        </div>
                      )}

                      {/* Infos principales */}
                      <div className="flex-1 space-y-1.5">
                        <h3 className="text-base font-semibold text-text-primary line-clamp-2">
                          {p.title}
                        </h3>
                        <p className="text-xs text-text-muted">
                          {p.city} • <span className="uppercase">{typeLabel}</span>
                        </p>

                        {p.description && (
                          <p className="text-sm text-text-secondary mt-1 line-clamp-3">
                            {p.description}
                          </p>
                        )}

                        {p.surfaceArea && (
                          <p className="text-sm text-text-secondary mt-2">
                            {surfaceRoomsLabel}
                          </p>
                        )}

                        {(p.countryId || p.regionId) && (
                          <p className="text-[11px] text-text-muted mt-1">
                            {t('adminPropertiesPage.list.scopePrefix')}{' '}
                            {p.regionId
                              ? t('adminPropertiesPage.list.regionId', { id: p.regionId })
                              : p.countryId
                              ? t('adminPropertiesPage.list.countryId', { id: p.countryId })
                              : null}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="mt-4 flex justify-end gap-2">
                        <button
                          onClick={() => startEdit(p)}
                          className="app-btn-warning inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-full"
                        >
                          {t('adminPropertiesPage.buttons.edit')}
                        </button>

                        <button
                          onClick={() => handleDelete(p.id)}
                          className="app-btn-danger inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-full"
                        >
                          {t('adminPropertiesPage.buttons.delete')}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* LIGHTBOX */}
        {lightbox.open && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeLightbox();
            }}
          >
            <button
              onClick={closeLightbox}
              className="absolute top-6 right-6 bg-surface-card/90 hover:bg-surface-card text-text-primary rounded-full p-2 text-xl shadow-md transition"
              aria-label={t('adminPropertiesPage.lightbox.close')}
            >
              x
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                prevImage();
              }}
              className="absolute left-6 top-1/2 -translate-y-1/2 bg-surface-card/90 hover:bg-surface-card text-text-primary rounded-full p-3 text-xl shadow-md transition"
              aria-label={t('adminPropertiesPage.lightbox.prev')}
            >
              {'<'}
            </button>

            <img
              src={lightbox.images[lightbox.index]}
              alt={t('adminPropertiesPage.lightbox.imageAlt', {
                index: lightbox.index + 1,
                total: lightbox.images.length,
              })}
              className="max-w-[90vw] max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-white/15"
              onClick={(e) => e.stopPropagation()}
            />

            <button
              onClick={(e) => {
                e.stopPropagation();
                nextImage();
              }}
              className="absolute right-6 top-1/2 -translate-y-1/2 bg-surface-card/90 hover:bg-surface-card text-text-primary rounded-full p-3 text-xl shadow-md transition"
              aria-label={t('adminPropertiesPage.lightbox.next')}
            >
              {'>'}
            </button>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white text-xs bg-black/40 px-4 py-1 rounded-full">
              {t('adminPropertiesPage.lightbox.counter', {
                index: lightbox.index + 1,
                total: lightbox.images.length,
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



