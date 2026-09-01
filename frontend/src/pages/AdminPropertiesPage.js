// ============================================================================
// AdminPropertiesPage.jsx VERSION PRODUCTION READY (Apple Light Premium)
// Master + multi-pays compatible (backend GeoScope)
// FILE_BASE prod-safe (pas de localhost)
// Photos: support string | {url,fileId} (ImageKit) | legacy
// Lightbox + previews sans erreurs (revokeObjectURL safe)
// 100% fonctionnel, aucune regression, meme logique, design modernise.
// ============================================================================

import { useEffect, useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getAllProperties,
  getClientProperties,
  updateProperty,
  createPropertyForClient,
} from '../services/properties';
import api, { getFileUrl } from '../services/api';
import { me } from '../services/auth';
import { normalizeRole } from '../utils/role';
import { notify } from '../utils/notify';
import { useDeleteConfirm } from '../hooks/useDeleteConfirm';
import useFocusTrap from '../hooks/useFocusTrap';
import LocationAutocompleteInput from '../features/mission-creation/LocationAutocompleteInput';
import MissionLocationMap from '../features/mission-creation/MissionLocationMap';

function normalizePath(path = '') {
  if (!path) return '';
  const p = String(path).trim().replace(/\\/g, '/');
  if (/^https?:\/\//i.test(p)) return p;
  const fixed = p.startsWith('/') ? p : `/${p}`;
  return fixed.replace(/\/{2,}/g, '/');
}

function resolvePropertyMediaPath(value = '') {
  if (!value) return '';
  if (typeof value === 'string') return normalizePath(value);
  if (typeof value !== 'object') return '';

  const direct =
    value.url ||
    value.path ||
    value.filePath ||
    value.file_url ||
    value.secure_url ||
    value.src ||
    value.href ||
    value.location ||
    value?.file?.url ||
    value?.file?.path ||
    value?.file?.filePath ||
    '';

  return normalizePath(direct);
}

function toAbsUrl(path = '') {
  const norm = resolvePropertyMediaPath(path);
  if (!norm) return '';
  if (/^https?:\/\//i.test(norm)) return norm;
  return getFileUrl(norm);
}

function isPdf(path = '') {
  const mediaPath = resolvePropertyMediaPath(path);
  if (/\.pdf($|[?#])/i.test(String(mediaPath || ''))) return true;
  if (!path || typeof path !== 'object') return false;

  const mime = String(
    path.mimeType || path.mimetype || path.contentType || path.type || ''
  ).toLowerCase();
  if (mime.includes('pdf')) return true;

  const fileName = String(
    path.originalName || path.fileName || path.name || ''
  ).toLowerCase();
  return /\.pdf($|[?#])/i.test(fileName);
}

const PROPERTY_MAX_FILES = 10;
const PROPERTY_MAX_FILE_MB = 15;
const IS_PROD_RUNTIME =
  String(process.env.NODE_ENV || 'development').trim().toLowerCase() ===
  'production';

function logAdminPropertiesError(message, error) {
  if (IS_PROD_RUNTIME) return;
  console.error(message, error);
}
const PROPERTY_ALLOWED_EXTS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'heic',
  'heif',
  'pdf',
]);

function getFileExt(fileName = '') {
  const dot = String(fileName).lastIndexOf('.');
  if (dot < 0) return '';
  return String(fileName).slice(dot + 1).toLowerCase();
}

function isAllowedPropertyFile(file) {
  const ext = getFileExt(file?.name || '');
  const mime = String(file?.type || '').toLowerCase();

  const extOk = PROPERTY_ALLOWED_EXTS.has(ext);
  const mimeOk =
    !mime ||
    mime.startsWith('image/') ||
    mime === 'application/pdf' ||
    mime === 'application/x-pdf' ||
    mime === 'application/octet-stream' ||
    mime === 'binary/octet-stream';

  return extOk && mimeOk;
}

function isPdfFileLike(file) {
  if (!file) return false;
  const ext = getFileExt(file?.name || '');
  const mime = String(file?.type || '').toLowerCase();
  return ext === 'pdf' || mime === 'application/pdf' || mime === 'application/x-pdf';
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
// Normalisation Photos (ImageKit + legacy)
// - backend peut renvoyer: ["https://..."] (deja ok)
// - ou [{url,fileId}, ...]
// - ou {photos:[{url}...]} (selon couches)
// ============================================================================
function normalizePhotoValue(photo) {
  return resolvePropertyMediaPath(photo);
}

// ============================================================================
// Safe revokeObjectURL (evite erreurs si url http)
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
// PAGE PRINCIPALE Apple Light Premium
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
  const [editExistingMedia, setEditExistingMedia] = useState([]);
  const [removedMedia, setRemovedMedia] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [coordinates, setCoordinates] = useState(null);

  const [form, setForm] = useState({
    title: '',
    type: 'house',
    address: '',
    city: '',
    postalCode: '',
    surfaceArea: '',
    roomCount: '',
    description: '',
 // Multi-pays (optionnel, backend gere le scope)
    // countryId: '',
    // regionId: '',
  });

  const [files, setFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const editMediaCount = useMemo(() => {
    if (!editId) return 0;
    const removedSet = new Set(removedMedia);
    return editExistingMedia.filter((mediaPath) => !removedSet.has(mediaPath))
      .length;
  }, [editId, editExistingMedia, removedMedia]);

  // ==========================================================================
  // LIGHTBOX (Agrandissement + Navigation)
  // ==========================================================================
  const [lightbox, setLightbox] = useState({
    open: false,
    images: [],
    index: 0,
  });
  const lightboxRef = useRef(null);

  useEffect(() => {
    if (!lightbox.open) return;

    function onKey(e) {
      if (e.key === 'ArrowRight') nextImage();
      if (e.key === 'ArrowLeft') prevImage();
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox.open, lightbox.index]);

  useFocusTrap({
    active: lightbox.open,
    containerRef: lightboxRef,
    onEscape: () => closeLightbox(),
  });

  // ==========================================================================
  // Initialisation (auth + clients + biens)
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
        logAdminPropertiesError('AdminPropertiesPage init error:', e);
        localStorage.removeItem('teranga_token');
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==========================================================================
  // Charger clients (admin/master scoped: backend filtre via GeoScope si applique)
  // ==========================================================================
  async function loadClients() {
    try {
      const { data } = await api.get('/users?role=client');
      const list = data.users || [];
      setClients(list);
      setFilteredClients(list);
    } catch (e) {
      logAdminPropertiesError('AdminPropertiesPage load clients error:', e);
    }
  }

  // ==========================================================================
  // Charger proprietes
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
      logAdminPropertiesError('AdminPropertiesPage load properties error:', e);
    } finally {
      setLoading(false);
    }
  }

  // ==========================================================================
  // Recherche client
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
  // Gestion upload + previews
  // ==========================================================================
  function handleFileChange(e) {
    const selected = Array.from(e.target.files || []);
    const availableSlots = editId
      ? Math.max(0, PROPERTY_MAX_FILES - editMediaCount)
      : PROPERTY_MAX_FILES;

    if (availableSlots <= 0) {
      notify(
        t('adminPropertiesPage.alerts.mediaLimitReached', {
          max: PROPERTY_MAX_FILES,
        })
      );
      e.target.value = '';
      return;
    }

    const badType = selected.find((f) => !isAllowedPropertyFile(f));
    if (badType) {
      notify(
        t('adminPropertiesPage.alerts.invalidFileType', {
          name: badType.name || 'file',
        })
      );
      e.target.value = '';
      return;
    }

    const tooLarge = selected.find(
      (f) => Number(f.size || 0) > PROPERTY_MAX_FILE_MB * 1024 * 1024
    );
    if (tooLarge) {
      notify(
        t('adminPropertiesPage.alerts.fileTooLarge', {
          name: tooLarge.name || 'file',
          max: PROPERTY_MAX_FILE_MB,
        })
      );
      e.target.value = '';
      return;
    }

    if (selected.length > availableSlots) {
      notify(
        t('adminPropertiesPage.alerts.tooManyFiles', {
          max: availableSlots,
        })
      );
    }

    const limited = selected.slice(0, availableSlots);
    setFiles(limited);

    // Nettoyage anciennes URLs (uniquement blob)
    previewUrls.forEach(safeRevoke);

    // Previews blob pour fichiers locaux
    const previews = limited.map((f) => URL.createObjectURL(f));
    setPreviewUrls(previews);
  }

  // ==========================================================================
  // Ajouter bien
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
      await createPropertyForClient(selectedClient, { ...form, latitude: coordinates?.latitude, longitude: coordinates?.longitude }, files);
      notify(t('adminPropertiesPage.alerts.createSuccess'));
      resetForm();
      setIsCreating(false);
      await loadProperties(selectedClient);
    } catch (e2) {
      logAdminPropertiesError('AdminPropertiesPage create property error:', e2);
      notify(
        e2?.response?.data?.error ||
          e2?.message ||
          t('adminPropertiesPage.alerts.createError')
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // ==========================================================================
  // Modifier bien
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
 // Multi-pays (optionnel) si tu ajoutes plus tard les champs UI
      // countryId: p.countryId || '',
      // regionId: p.regionId || '',
    });
    setCoordinates(
      p.latitude != null && p.longitude != null
        ? { latitude: Number(p.latitude), longitude: Number(p.longitude) }
        : null
    );

    setFiles([]);
    setRemovedMedia([]);
    setEditExistingMedia(
      Array.isArray(p.photos)
        ? p.photos.map(normalizePhotoValue).filter(Boolean)
        : []
    );

    // Nettoyage anciennes previews blob uniquement
    previewUrls.forEach(safeRevoke);
    setPreviewUrls([]);
  }

  async function handleUpdate(e) {
    e.preventDefault();
    if (isSubmitting) return;

    const nextTotalMedia = editMediaCount + files.length;
    if (nextTotalMedia > PROPERTY_MAX_FILES) {
      notify(
        t('adminPropertiesPage.alerts.tooManyFiles', {
          max: Math.max(0, PROPERTY_MAX_FILES - editMediaCount),
        })
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = removedMedia.length
        ? { ...form, latitude: coordinates?.latitude, longitude: coordinates?.longitude, removePhotos: JSON.stringify(removedMedia) }
        : { ...form, latitude: coordinates?.latitude, longitude: coordinates?.longitude };
      await updateProperty(editId, payload, files);
      notify(t('adminPropertiesPage.alerts.updateSuccess'));
      resetForm();
      await loadProperties(selectedClient);
    } catch (e2) {
      logAdminPropertiesError('AdminPropertiesPage update property error:', e2);
      notify(
        e2?.response?.data?.error ||
          e2?.message ||
          t('adminPropertiesPage.alerts.updateError')
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // ==========================================================================
  // Supprimer bien
  // ==========================================================================
  async function handleDelete(id) {
    const ok = await confirmDelete("property");
    if (!ok) return;
    try {
      await api.delete(`/properties/${id}`);
      await loadProperties(selectedClient);
    } catch (e) {
      logAdminPropertiesError('AdminPropertiesPage delete property error:', e);
      notify(t('adminPropertiesPage.alerts.deleteError'));
    }
  }

  // ==========================================================================
  // Reset form
  // ==========================================================================
  function resetForm() {
    setEditId(null);
    setEditExistingMedia([]);
    setRemovedMedia([]);
    setFiles([]);
    setCoordinates(null);

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

  function toggleRemoveExistingMedia(mediaPath) {
    if (!mediaPath) return;
    setRemovedMedia((prev) =>
      prev.includes(mediaPath)
        ? prev.filter((item) => item !== mediaPath)
        : [...prev, mediaPath]
    );
  }

  // ==========================================================================
  // Lightbox controls
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
  const removedSet = useMemo(
    () => new Set(removedMedia || []),
    [removedMedia]
  );

  // ==========================================================================
  // UI Apple Light Premium (cartes uniquement)
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

{/* FORMULAIRE (creation / edition) */}
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
                <LocationAutocompleteInput
                  placeholder={t('adminPropertiesPage.form.placeholders.address')}
                  value={form.address}
                  onChange={(address) => setForm((prev) => ({ ...prev, address }))}
                  onPlaceSelected={({ address, latitude, longitude }) => {
                    setForm((prev) => ({ ...prev, address }));
                    setCoordinates({ latitude, longitude });
                  }}
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

              <div className="sm:col-span-2">
                <p className="mb-2 text-[11px] font-medium text-text-secondary">
                  {t('adminPropertiesPage.form.labels.locationMap', { defaultValue: 'Localisation précise' })}
                </p>
                <MissionLocationMap
                  latitude={coordinates?.latitude}
                  longitude={coordinates?.longitude}
                  onPositionChange={setCoordinates}
                />
                <p className="mt-2 text-xs text-text-muted">
                  {coordinates
                    ? `${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`
                    : t('adminPropertiesPage.form.hints.locationMap', { defaultValue: 'Sélectionnez une adresse ou déplacez le marqueur sur la carte.' })}
                </p>
                {coordinates ? (
                  <a className="mt-1 inline-flex text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${coordinates.latitude},${coordinates.longitude}`}>
                    {t('adminPropertiesPage.form.actions.openMap', { defaultValue: 'Ouvrir dans Google Maps' })}
                  </a>
                ) : null}
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

{/* Surface / Kilometrage */}
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
{/* Pieces / Espaces / Places */}
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

              {editId && editExistingMedia.length > 0 && (
                <div className="sm:col-span-2 flex flex-col gap-2 mt-1">
                  <label className="text-[11px] font-medium text-text-secondary">
                    {t('adminPropertiesPage.form.existingMediaLabel')}
                  </label>

                  <div className="flex flex-wrap gap-3">
                    {editExistingMedia.map((mediaPath, i) => {
                      const absUrl = toAbsUrl(mediaPath);
                      if (!absUrl) return null;
                      const markedForRemoval = removedSet.has(mediaPath);

                      return (
                        <div
                          key={`${mediaPath}-${i}`}
                          className={`relative w-20 h-20 border rounded-xl overflow-hidden ${
                            markedForRemoval
                              ? 'border-red-500 opacity-60'
                              : 'border-border'
                          } bg-surface-main`}
                        >
                          {isPdf(mediaPath) ? (
                            <a
                              href={absUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="w-full h-full flex items-center justify-center text-xs text-text-secondary"
                              title={t('adminPropertiesPage.list.pdfLabel')}
                            >
                              {t('adminPropertiesPage.list.pdfLabel')}
                            </a>
                          ) : (
                            <img
                              src={absUrl}
                              className="w-full h-full object-cover"
                              alt={t('adminPropertiesPage.form.previewAlt', { index: i + 1 })}
                            />
                          )}

                          <button
                            type="button"
                            onClick={() => toggleRemoveExistingMedia(mediaPath)}
                            className={`absolute bottom-1 left-1 right-1 rounded px-1 py-0.5 text-[10px] font-medium ${
                              markedForRemoval
                                ? 'bg-emerald-600 text-white'
                                : 'bg-red-600 text-white'
                            }`}
                          >
                            {markedForRemoval
                              ? t('adminPropertiesPage.form.restoreMedia')
                              : t('adminPropertiesPage.form.removeMedia')}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* FILES */}
              <div className="sm:col-span-2 flex flex-col gap-2 mt-1">
                <label className="text-[11px] font-medium text-text-secondary">
                  {t('adminPropertiesPage.form.filesLabel')}
                </label>
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  accept="image/*,.pdf,.webp,.heic,.heif"
                  className="app-input-subtle"
                />
                <p className="text-[11px] text-text-muted">
                  {editId
                    ? t('adminPropertiesPage.form.editMediaHint', {
                        current: editMediaCount,
                        remaining: Math.max(0, PROPERTY_MAX_FILES - editMediaCount),
                        max: PROPERTY_MAX_FILES,
                      })
                    : t('adminPropertiesPage.form.createMediaHint', {
                        max: PROPERTY_MAX_FILES,
                      })}
                </p>
                {files.length > 0 && (
                  <p className="text-[11px] text-text-muted">
                    {t('adminPropertiesPage.form.filesSelected', {
                      count: files.length,
                    })}
                  </p>
                )}

                {previewUrls.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-3">
                    {previewUrls.map((url, i) => (
                      isPdf(url) || isPdfFileLike(files?.[i]) ? (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="w-20 h-20 border border-border bg-surface-main rounded-xl flex items-center justify-center text-xs text-text-secondary"
                          title={t('adminPropertiesPage.list.pdfLabel')}
                        >
                          {t('adminPropertiesPage.list.pdfLabel')}
                        </a>
                      ) : (
                        <img
                          key={i}
                          src={url}
                          className="w-20 h-20 object-cover rounded-xl border border-border shadow-sm"
                          alt={t('adminPropertiesPage.form.previewAlt', { index: i + 1 })}
                        />
                      )
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

{/* LISTE DES BIENS - CARTES PREMIUM */}
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
                    .map((ph) => toAbsUrl(ph))
                    .filter(Boolean);
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
                            if (!abs) return null;

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
            ref={lightboxRef}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeLightbox();
            }}
            role="dialog"
            aria-modal="true"
            aria-label={t('adminPropertiesPage.lightbox.ariaLabel')}
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
