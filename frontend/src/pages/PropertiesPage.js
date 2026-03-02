// frontend/src/pages/PropertiesPage.js
// ============================================================================
// PropertiesPage Aaa Version Premium 2025
// Contexte: gestion des biens.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import {
  getProperties,
  createProperty,
  deleteProperty,
} from '../services/properties';
import api, { getFileUrl } from '../services/api';
import {
  PROPERTY_TYPES,
  PROPERTY_STATUSES,
} from '../utils/labels';
import { useLocale } from '../i18n/useLocale';
import { useTranslation } from 'react-i18next';
import { notify } from '../utils/notify';
import { useDeleteConfirm } from '../hooks/useDeleteConfirm';

// ============================================================================
// Contexte: gestion des biens.
// ============================================================================
function resolvePropertyMediaPath(pathOrUrl = '') {
  if (!pathOrUrl) return '';
  if (typeof pathOrUrl === 'string') return pathOrUrl.trim();
  if (typeof pathOrUrl !== 'object') return '';

  const direct =
    pathOrUrl.url ||
    pathOrUrl.path ||
    pathOrUrl.filePath ||
    pathOrUrl.file_url ||
    pathOrUrl.secure_url ||
    pathOrUrl.src ||
    pathOrUrl.href ||
    pathOrUrl.location ||
    pathOrUrl?.file?.url ||
    pathOrUrl?.file?.path ||
    pathOrUrl?.file?.filePath ||
    '';

  return typeof direct === 'string' ? direct.trim() : '';
}

function toAbsUrl(pathOrUrl = '') {
  const mediaPath = resolvePropertyMediaPath(pathOrUrl);
  if (!mediaPath) return '';
  if (/^https?:\/\//i.test(mediaPath)) return mediaPath;
  return getFileUrl(mediaPath);
}

function isPdf(path = '') {
  const mediaPath = resolvePropertyMediaPath(path);
  if (/\.pdf($|[?#])/i.test(mediaPath)) return true;
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
const PROPERTY_UPLOAD_TIMEOUT_MS =
  Number(process.env.REACT_APP_PROPERTY_UPLOAD_TIMEOUT_MS) ||
  Number(process.env.REACT_APP_UPLOAD_TIMEOUT_MS) ||
  180000;
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
      surfaceLabel: t('propertiesPage.form.dynamic.landSurfaceLabel'),
      surfacePlaceholder: t('propertiesPage.form.dynamic.landSurfacePlaceholder'),
      roomsLabel: t('propertiesPage.form.labels.rooms'),
      roomsPlaceholder: t('propertiesPage.form.placeholders.rooms'),
    };
  }

  if (type === 'commercial') {
    return {
      showSurface: true,
      showRooms: true,
      surfaceLabel: t('propertiesPage.form.dynamic.commercialSurfaceLabel'),
      surfacePlaceholder: t('propertiesPage.form.placeholders.surface'),
      roomsLabel: t('propertiesPage.form.dynamic.commercialRoomsLabel'),
      roomsPlaceholder: t('propertiesPage.form.dynamic.commercialRoomsPlaceholder'),
    };
  }

  if (type === 'automobile') {
    return {
      showSurface: true,
      showRooms: true,
      surfaceLabel: t('propertiesPage.form.dynamic.automobileSurfaceLabel'),
      surfacePlaceholder: t('propertiesPage.form.dynamic.automobileSurfacePlaceholder'),
      roomsLabel: t('propertiesPage.form.dynamic.automobileRoomsLabel'),
      roomsPlaceholder: t('propertiesPage.form.dynamic.automobileRoomsPlaceholder'),
    };
  }

  return {
    showSurface: true,
    showRooms: true,
    surfaceLabel: t('propertiesPage.form.labels.surface'),
    surfacePlaceholder: t('propertiesPage.form.placeholders.surface'),
    roomsLabel: t('propertiesPage.form.labels.rooms'),
    roomsPlaceholder: t('propertiesPage.form.placeholders.rooms'),
  };
}

// ============================================================================
// Contexte: gestion des biens.
// ============================================================================
export default function PropertiesPage() {
  const { t } = useTranslation();
  const { confirmDelete } = useDeleteConfirm();
  // --------------------------------------------------------------------------
  // STATE
  // --------------------------------------------------------------------------
  const [properties, setProperties] = useState([]);

  const [form, setForm] = useState({
    title: '',
    type: 'house',
    address: '',
    city: '',
    postalCode: '',
    surfaceArea: '',
    roomCount: '',
    description: '',
  });

  const [files, setFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editExistingMedia, setEditExistingMedia] = useState([]);
  const [removedMedia, setRemovedMedia] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

 // Contexte: gestion des biens.
  const [showForm, setShowForm] = useState(() => {
    const saved = localStorage.getItem('teranga_properties_showForm');
    return saved === null ? true : saved === '1';
  });

  // Lightbox
  const [lightbox, setLightbox] = useState({
    open: false,
    images: [],
    index: 0,
  });

  // Filtres
  const [filters, setFilters] = useState({
    q: '',
    type: '',
    status: '',
    city: '',
    minSurface: '',
    maxSurface: '',
    sort: '-createdAt',
  });

  const editMediaCount = useMemo(() => {
    if (!editId) return 0;
    const removedSet = new Set(removedMedia);
    return editExistingMedia.filter((mediaPath) => !removedSet.has(mediaPath))
      .length;
  }, [editId, editExistingMedia, removedMedia]);

  // --------------------------------------------------------------------------
  // INIT
  // --------------------------------------------------------------------------
  useEffect(() => {
    load();
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem(
      'teranga_properties_showForm',
      showForm ? '1' : '0'
    );
  }, [showForm]);

  // Lightbox keyboard
  useEffect(() => {
    if (!lightbox.open) return;

    function onKey(e) {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextImage();
      if (e.key === 'ArrowLeft') prevImage();
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox.open, lightbox.index, lightbox.images]);

  // --------------------------------------------------------------------------
  // LOAD PROPERTIES
  // --------------------------------------------------------------------------
  async function load() {
    try {
      const props = await getProperties();
      setProperties(props || []);
    } catch (e) {
      console.error('AAA load properties:', e);
      notify(t('propertiesPage.alerts.loadError'));
    }
  }

  // --------------------------------------------------------------------------
  // FILES
  // --------------------------------------------------------------------------
  function handleFileChange(e) {
    const rawSelected = Array.from(e.target.files || []);
    const availableSlots = editId
      ? Math.max(0, PROPERTY_MAX_FILES - editMediaCount)
      : PROPERTY_MAX_FILES;

    if (availableSlots <= 0) {
      notify(
        t('propertiesPage.alerts.mediaLimitReached', {
          max: PROPERTY_MAX_FILES,
        })
      );
      e.target.value = '';
      return;
    }

    const badType = rawSelected.find((f) => !isAllowedPropertyFile(f));
    if (badType) {
      notify(
        t('propertiesPage.alerts.invalidFileType', {
          name: badType.name || 'file',
        })
      );
      e.target.value = '';
      return;
    }

    const tooLarge = rawSelected.find(
      (f) => Number(f.size || 0) > PROPERTY_MAX_FILE_MB * 1024 * 1024
    );
    if (tooLarge) {
      notify(
        t('propertiesPage.alerts.fileTooLarge', {
          name: tooLarge.name || 'file',
          max: PROPERTY_MAX_FILE_MB,
        })
      );
      e.target.value = '';
      return;
    }

    if (rawSelected.length > availableSlots) {
      notify(
        t('propertiesPage.alerts.tooManyFiles', {
          max: availableSlots,
        })
      );
    }

    const selected = rawSelected.slice(0, availableSlots);
    setFiles(selected);

    previewUrls.forEach((u) => URL.revokeObjectURL(u));
    const previews = selected.map((f) => URL.createObjectURL(f));
    setPreviewUrls(previews);
  }

  // --------------------------------------------------------------------------
  // CREATE
  // --------------------------------------------------------------------------
  async function handleSubmit(e) {
    if (e?.preventDefault) e.preventDefault();
    if (isSubmitting) return;

    const payload = {
      ...form,
      surfaceArea:
        form.surfaceArea === '' ? null : Number(form.surfaceArea),
      roomCount:
        form.roomCount === '' ? null : Number(form.roomCount),
    };

    try {
      setIsSubmitting(true);
      await createProperty(payload, files);
      notify(t('propertiesPage.alerts.createSuccess'));
      resetForm();
      await load();
    } catch (e) {
      console.error('AAA create property:', e);
      notify(
        e?.response?.data?.error ||
          e?.message ||
          t('propertiesPage.alerts.createError')
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // --------------------------------------------------------------------------
  // UPDATE
  // --------------------------------------------------------------------------
  async function handleUpdate(id) {
    if (isSubmitting) return;

    const nextTotalMedia = editMediaCount + files.length;
    if (nextTotalMedia > PROPERTY_MAX_FILES) {
      notify(
        t('propertiesPage.alerts.tooManyFiles', {
          max: Math.max(0, PROPERTY_MAX_FILES - editMediaCount),
        })
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v !== undefined && v !== null) formData.append(k, v);
      });
      files.forEach((f) => formData.append('files', f));
      if (removedMedia.length) {
        formData.append('removePhotos', JSON.stringify(removedMedia));
      }

      await api.put(`/properties/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: PROPERTY_UPLOAD_TIMEOUT_MS,
      });

      notify(t('propertiesPage.alerts.updateSuccess'));
      resetForm();
      await load();
    } catch (e) {
      console.error('AAA update property:', e);
      notify(
        e?.response?.data?.error ||
          e?.message ||
          t('propertiesPage.alerts.updateError')
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // --------------------------------------------------------------------------
 // DELETE (AaA 1h)
  // --------------------------------------------------------------------------
  async function handleDelete(id, createdAt) {
    const created = new Date(createdAt).getTime();
    if (Date.now() - created > 3600 * 1000) {
      notify(t('propertiesPage.alerts.deleteNotAllowed'));
      return;
    }

    const ok = await confirmDelete("property");
    if (!ok) return;

    try {
      await deleteProperty(id);
      load();
    } catch (e) {
      console.error('AAA delete property:', e);
      notify(t('propertiesPage.alerts.deleteError'));
    }
  }

  // --------------------------------------------------------------------------
  // RESET
  // --------------------------------------------------------------------------
  function resetForm() {
    setForm({
      title: '',
      type: 'house',
      address: '',
      city: '',
      postalCode: '',
      surfaceArea: '',
      roomCount: '',
      description: '',
    });

    previewUrls.forEach((u) => URL.revokeObjectURL(u));
    setFiles([]);
    setPreviewUrls([]);
    setEditId(null);
    setEditExistingMedia([]);
    setRemovedMedia([]);
    setShowPreview(false);
  }

  function startEditProperty(p) {
    previewUrls.forEach((u) => URL.revokeObjectURL(u));
    setFiles([]);
    setPreviewUrls([]);

    const existingMedia = Array.isArray(p.photos)
      ? p.photos.map((mediaPath) => resolvePropertyMediaPath(mediaPath)).filter(Boolean)
      : [];

    setEditId(p.id);
    setEditExistingMedia(existingMedia);
    setRemovedMedia([]);
    setShowForm(true);
    setShowPreview(false);
    setForm({
      title: p.title,
      type: p.type,
      address: p.address,
      city: p.city,
      postalCode: p.postalCode || '',
      surfaceArea: p.surfaceArea || '',
      roomCount: p.roomCount || '',
      description: p.description || '',
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

  // --------------------------------------------------------------------------
  // LIGHTBOX
  // --------------------------------------------------------------------------
  function openLightbox(images = [], index = 0) {
    if (!images.length) return;
    setLightbox({
      open: true,
      images,
      index: Math.min(Math.max(0, index), images.length - 1),
    });
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
      index:
        (lb.index - 1 + lb.images.length) % lb.images.length,
    }));
  }

  // --------------------------------------------------------------------------
  // FILTERING & SORTING
  // --------------------------------------------------------------------------
  const filtered = useMemo(() => {
    let arr = [...properties];

    if (filters.q.trim()) {
      const q = filters.q.toLowerCase();
        arr = arr.filter((p) => {
          const typeLabel = PROPERTY_TYPES[p.type] || p.type || t('common.dash');
          const statusLabel =
            PROPERTY_STATUSES[p.status] || p.status || t('common.dash');

          return [
            p.title,
            p.city,
            p.address,
            p.description,
            typeLabel,
            statusLabel,
            p.postalCode,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q);
        });
    }

    if (filters.type) arr = arr.filter((p) => p.type === filters.type);
    if (filters.status)
      arr = arr.filter((p) => p.status === filters.status);

    if (filters.city.trim()) {
      const c = filters.city.toLowerCase();
      arr = arr.filter((p) =>
        (p.city || '').toLowerCase().includes(c)
      );
    }

    const minS = filters.minSurface
      ? Number(filters.minSurface)
      : null;
    const maxS = filters.maxSurface
      ? Number(filters.maxSurface)
      : null;

    if (minS !== null)
      arr = arr.filter((p) => (p.surfaceArea || 0) >= minS);
    if (maxS !== null)
      arr = arr.filter((p) => (p.surfaceArea || 0) <= maxS);

    const by = filters.sort || '-createdAt';
    arr.sort((a, b) => {
      const sign = by.startsWith('-') ? -1 : 1;
      const key = by.replace(/^-/, '');

      let va, vb;
      if (key === 'createdAt') {
        va = new Date(a.createdAt).getTime();
        vb = new Date(b.createdAt).getTime();
      } else if (key === 'title') {
        va = (a.title || '').toLowerCase();
        vb = (b.title || '').toLowerCase();
      } else if (key === 'surface') {
        va = Number(a.surfaceArea || 0);
        vb = Number(b.surfaceArea || 0);
      } else {
        va = a[key];
        vb = b[key];
      }

      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      return 0;
    });

    return arr;
  }, [properties, filters, t]);

  const now = new Date();

  const typeOptions = useMemo(
    () =>
      Array.from(
        new Set(properties.map((p) => p.type).filter(Boolean))
      ),
    [properties]
  );

  const cityOptions = useMemo(
    () =>
      Array.from(
        new Set(
          properties.map((p) => (p.city || '').trim()).filter(Boolean)
        )
      ),
    [properties]
  );

    return (
    <div className="app-page-wrap">
      <div className="app-page-shell relative space-y-8 p-5 sm:p-8 lg:p-10">
 {/* Contexte: gestion des biens. */}
        <Header
          showForm={showForm}
          setShowForm={setShowForm}
          load={load}
          total={properties.length}
        />

 {/* Contexte: gestion des biens. */}
        <PropertyFilters
          filters={filters}
          setFilters={setFilters}
          typeOptions={typeOptions}
          cityOptions={cityOptions}
          filteredCount={filtered.length}
        />

 {/* Contexte: gestion des biens. */}
        {showForm && (
        <PropertyForm
          form={form}
          setForm={setForm}
          files={files}
          showPreview={showPreview}
          setShowPreview={setShowPreview}
          handleFileChange={handleFileChange}
          previewUrls={previewUrls}
          handleSubmit={handleSubmit}
          handleUpdate={handleUpdate}
          resetForm={resetForm}
          editId={editId}
          editMediaCount={editMediaCount}
          editExistingMedia={editExistingMedia}
          removedMedia={removedMedia}
          toggleRemoveExistingMedia={toggleRemoveExistingMedia}
          toAbsUrl={toAbsUrl}
          isPdf={isPdf}
          isSubmitting={isSubmitting}
        />
        )}

 {/* Contexte: gestion des biens. */}
        <PropertyList
          filtered={filtered}
          now={now}
          startEditProperty={startEditProperty}
          handleDelete={handleDelete}
          toAbsUrl={toAbsUrl}
          isPdf={isPdf}
          openLightbox={openLightbox}
        />

 {/* Contexte: gestion des biens. */}
        {lightbox.open && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeLightbox();
            }}
          >
            <button
              onClick={closeLightbox}
              className="absolute top-6 right-6 bg-surface-card/90 hover:bg-surface-card text-text-primary rounded-full p-2 shadow-md text-xl"
              aria-label={t('propertiesPage.lightbox.closeLabel')}
              title={t('propertiesPage.lightbox.closeTitle')}
            >
              {"\u00D7"}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                prevImage();
              }}
              className="absolute left-6 top-1/2 -translate-y-1/2 bg-surface-card/80 hover:bg-surface-card text-text-primary rounded-full p-3 shadow-lg text-xl"
              aria-label={t('propertiesPage.lightbox.prevLabel')}
              title={t('propertiesPage.lightbox.prevTitle')}
            >
              {"\u2039"}
            </button>

            <img
              src={lightbox.images[lightbox.index]}
              alt={t('propertiesPage.lightbox.alt', {
                index: lightbox.index + 1,
              })}
              className="max-w-[92vw] max-h-[86vh] object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />

            <button
              onClick={(e) => {
                e.stopPropagation();
                nextImage();
              }}
              className="absolute right-6 top-1/2 -translate-y-1/2 bg-surface-card/80 hover:bg-surface-card text-text-primary rounded-full p-3 shadow-lg text-xl"
              aria-label={t('propertiesPage.lightbox.nextLabel')}
              title={t('propertiesPage.lightbox.nextTitle')}
            >
              {"\u203A"}
            </button>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/90 text-sm px-3 py-1 rounded-full bg-black/30">
              {lightbox.index + 1} / {lightbox.images.length}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
// Contexte: gestion des biens.
============================================================================ */

function Header({ showForm, setShowForm, load, total }) {
  const { t } = useTranslation();

  return (
    <div className="mb-4 flex flex-col gap-4 border-b border-border/70 pb-4 md:flex-row md:items-center md:justify-between">
      <div className="space-y-1">
        <h1 className="app-page-headline">
          {"\u{1F3E0}"} {t('propertiesPage.header.title')}
        </h1>
        <p className="app-page-subtitle">
          {t('propertiesPage.header.subtitle')}
        </p>
        <span className="app-toolbar-pill mt-2 inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
          {t('propertiesPage.header.count', { count: total })}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="app-btn-neutral w-full sm:w-auto"
        >
          {showForm
            ? `\u2796 ${t('propertiesPage.buttons.hideForm')}`
            : `\u2795 ${t('propertiesPage.buttons.newProperty')}`}
        </button>
        <button
          onClick={load}
          className="app-btn-primary w-full sm:w-auto"
        >
          {"\u{1F504}"} {t('common.refresh')}
        </button>
      </div>
    </div>
  );
}

function PropertyFilters({
  filters,
  setFilters,
  typeOptions,
  cityOptions,
  filteredCount,
}) {
  const { t } = useTranslation();

  return (
    <div className="mb-8 rounded-2xl border border-border/70 bg-surface-main/55 p-4 sm:p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-3">
        {/* Recherche globale */}
        <input
          placeholder={t('propertiesPage.filters.searchPlaceholder')}
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          className="col-span-1 w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2.5 text-sm text-text-primary sm:text-base lg:col-span-3"
        />

        {/* Type */}
        <select
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary sm:text-base"
        >
          <option value="">{t('propertiesPage.filters.typeAll')}</option>
          {Object.entries(PROPERTY_TYPES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
          {typeOptions
            .filter((t) => !Object.keys(PROPERTY_TYPES).includes(t))
            .map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
        </select>

        {/* Statut */}
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary sm:text-base"
        >
          <option value="">{t('propertiesPage.filters.statusAll')}</option>
          {Object.entries(PROPERTY_STATUSES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>

        {/* Ville */}
        <input
          list="cities"
          placeholder={t('propertiesPage.filters.cityPlaceholder')}
          value={filters.city}
          onChange={(e) => setFilters({ ...filters, city: e.target.value })}
          className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary sm:text-base"
        />
        <datalist id="cities">
          {cityOptions.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        {/* Surface min */}
        <input
          type="number"
          step="0.01"
          placeholder={t('propertiesPage.filters.minSurfacePlaceholder')}
          value={filters.minSurface}
          onChange={(e) => setFilters({ ...filters, minSurface: e.target.value })}
          className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary sm:text-base"
        />

        {/* Surface max */}
        <input
          type="number"
          step="0.01"
          placeholder={t('propertiesPage.filters.maxSurfacePlaceholder')}
          value={filters.maxSurface}
          onChange={(e) => setFilters({ ...filters, maxSurface: e.target.value })}
          className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary sm:text-base"
        />
      </div>

      {/* Ligne tri + reset */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-3 text-xs text-text-secondary sm:text-sm">
          <span>
            {t('propertiesPage.filters.filteredCount', {
              count: filteredCount,
            })}
          </span>
          <select
            value={filters.sort}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, sort: e.target.value }))
            }
            className="rounded-lg border border-border/80 bg-surface-card px-2.5 py-1.5 text-xs text-text-primary sm:text-sm"
          >
            <option value="-createdAt">
              {t('propertiesPage.filters.sortNewest')}
            </option>
            <option value="createdAt">
              {t('propertiesPage.filters.sortOldest')}
            </option>
            <option value="title">
              {t('propertiesPage.filters.sortTitleAsc')}
            </option>
            <option value="-title">
              {t('propertiesPage.filters.sortTitleDesc')}
            </option>
            <option value="-surface">
              {t('propertiesPage.filters.sortSurfaceDesc')}
            </option>
            <option value="surface">
              {t('propertiesPage.filters.sortSurfaceAsc')}
            </option>
          </select>
        </div>

        <button
          onClick={() =>
            setFilters({
              q: '',
              type: '',
              status: '',
              city: '',
              minSurface: '',
              maxSurface: '',
              sort: '-createdAt',
            })
          }
          className="app-btn-soft w-full text-center sm:w-auto"
        >
          {t('propertiesPage.filters.reset')}
        </button>
      </div>
    </div>
  );
}

/* --- Formulaire global --- */
function PropertyForm({
  form,
  setForm,
  files,
  showPreview,
  setShowPreview,
  handleFileChange,
  previewUrls,
  handleSubmit,
  handleUpdate,
  resetForm,
  editId,
  editMediaCount,
  editExistingMedia,
  removedMedia,
  toggleRemoveExistingMedia,
  toAbsUrl,
  isPdf,
  isSubmitting,
}) {
  const { t } = useTranslation();

  return (
    <div className="mb-10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg sm:text-xl font-semibold text-text-primary">
          {editId
            ? `\u270F\uFE0F ${t('propertiesPage.form.titleEdit')}`
            : `\u2795 ${t('propertiesPage.form.titleCreate')}`}
        </h2>
        {!editId && (
          <p className="text-xs sm:text-sm text-text-secondary">
            {t('propertiesPage.form.helperCreate')}
          </p>
        )}
      </div>

      {showPreview && !editId ? (
        <PropertyPreview
          form={form}
          files={files}
          previewUrls={previewUrls}
          setShowPreview={setShowPreview}
          handleSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      ) : (
        <PropertyEditor
          editId={editId}
          editMediaCount={editMediaCount}
          form={form}
          files={files}
          setForm={setForm}
          handleFileChange={handleFileChange}
          previewUrls={previewUrls}
          handleUpdate={handleUpdate}
          resetForm={resetForm}
          setShowPreview={setShowPreview}
          editExistingMedia={editExistingMedia}
          removedMedia={removedMedia}
          toggleRemoveExistingMedia={toggleRemoveExistingMedia}
          toAbsUrl={toAbsUrl}
          isPdf={isPdf}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}

function PropertyPreview({
  form,
  files,
  previewUrls,
  setShowPreview,
  handleSubmit,
  isSubmitting,
}) {
  const { t } = useTranslation();
  const surfaceValue = form.surfaceArea || t('common.dash');
  const roomsValue = form.roomCount
    ? t('propertiesPage.preview.roomsCount', {
        count: Number(form.roomCount),
      })
    : t('common.dash');

  return (
    <div className="mb-8 rounded-2xl border border-border/70 bg-surface-main/55 p-5 sm:p-6">
      <h3 className="mb-4 text-base sm:text-lg font-semibold text-text-primary">
        {t('propertiesPage.preview.title')}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm sm:text-base">
        <p>
          <strong>{t('propertiesPage.preview.labels.title')} :</strong>{' '}
          {form.title || t('common.dash')}
        </p>
        <p>
          <strong>{t('propertiesPage.preview.labels.type')} :</strong>{' '}
          {PROPERTY_TYPES[form.type] || form.type}
        </p>
        <p>
          <strong>{t('propertiesPage.preview.labels.address')} :</strong>{' '}
          {form.address || t('common.dash')}
        </p>
        <p>
          <strong>{t('propertiesPage.preview.labels.city')} :</strong>{' '}
          {form.city || t('common.dash')}
        </p>
        <p>
          <strong>{t('propertiesPage.preview.labels.postalCode')} :</strong>{' '}
          {form.postalCode || t('common.dash')}
        </p>
        <p>
          <strong>{t('propertiesPage.preview.labels.surfaceRooms')} :</strong>{' '}
          {t('propertiesPage.preview.surfaceRoomsValue', {
            surface: surfaceValue,
            rooms: roomsValue,
          })}
        </p>
        <p className="sm:col-span-2">
          <strong>{t('propertiesPage.preview.labels.description')} :</strong>{' '}
          {form.description || t('propertiesPage.preview.noDescription')}
        </p>
      </div>

      {previewUrls.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs sm:text-sm text-text-secondary">
            {t('propertiesPage.preview.photosLabel')}
          </p>
          <div className="flex flex-wrap gap-3">
            {previewUrls.map((url, i) => (
              isPdf(url) || isPdfFileLike(files?.[i]) ? (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="h-24 w-24 inline-flex items-center justify-center rounded-lg border border-border/80 bg-surface-card text-xs text-text-secondary shadow-sm sm:h-28 sm:w-28"
                >
                  {t('propertiesPage.list.pdfLabel')}
                </a>
              ) : (
                <img
                  key={i}
                  src={url}
                  alt={t('propertiesPage.preview.photoAlt', { index: i + 1 })}
                  className="h-24 w-24 rounded-lg border border-border/80 object-cover shadow-sm sm:h-28 sm:w-28"
                />
              )
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mt-5 justify-end">
        <button
          onClick={() => setShowPreview(false)}
          disabled={isSubmitting}
          className="app-btn-soft"
        >
          {"\u{1F4DD}"} {t('propertiesPage.preview.edit')}
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="app-btn-primary disabled:cursor-not-allowed disabled:bg-blue-400"
        >
          {"\u2705"} {t('propertiesPage.preview.create')}
        </button>
      </div>
    </div>
  );
}

function PropertyEditor({
  editId,
  editMediaCount,
  form,
  files,
  setForm,
  handleFileChange,
  previewUrls,
  handleUpdate,
  resetForm,
  setShowPreview,
  editExistingMedia,
  removedMedia,
  toggleRemoveExistingMedia,
  toAbsUrl,
  isPdf,
  isSubmitting,
}) {
  const { t } = useTranslation();
  const fieldConfig = getPropertyTypeFieldConfig(form.type, t);
  const removedSet = useMemo(
    () => new Set(removedMedia || []),
    [removedMedia]
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!editId) setShowPreview(true);
        else handleUpdate(editId);
      }}
      className="grid grid-cols-1 gap-4 rounded-2xl border border-border/70 bg-surface-main/55 p-4 sm:grid-cols-2 sm:p-5"
    >
      {/* Titre */}
      <div className="w-full">
        <label className="mb-1 block text-xs sm:text-sm font-medium text-text-secondary">
          {t('propertiesPage.form.labels.title')}{' '}
          <span className="text-red-500">*</span>
        </label>
        <input
          placeholder={t('propertiesPage.form.placeholders.title')}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
          className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary sm:text-base"
        />
      </div>

      {/* Type */}
      <div className="w-full">
        <label className="mb-1 block text-xs sm:text-sm font-medium text-text-secondary">
          {t('propertiesPage.form.labels.type')}
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
          required
          className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary sm:text-base"
        >
          {Object.entries(PROPERTY_TYPES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Adresse */}
      <div className="w-full">
        <label className="mb-1 block text-xs sm:text-sm font-medium text-text-secondary">
          {t('propertiesPage.form.labels.address')}{' '}
          <span className="text-red-500">*</span>
        </label>
        <input
          placeholder={t('propertiesPage.form.placeholders.address')}
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          required
          className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary sm:text-base"
        />
      </div>

      {/* Ville */}
      <div className="w-full">
        <label className="mb-1 block text-xs sm:text-sm font-medium text-text-secondary">
          {t('propertiesPage.form.labels.city')}{' '}
          <span className="text-red-500">*</span>
        </label>
        <input
          placeholder={t('propertiesPage.form.placeholders.city')}
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          required
          className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary sm:text-base"
        />
      </div>

      {/* Code postal */}
      <div className="w-full">
        <label className="mb-1 block text-xs sm:text-sm font-medium text-text-secondary">
          {t('propertiesPage.form.labels.postalCode')}
        </label>
        <input
          placeholder={t('propertiesPage.form.placeholders.postalCode')}
          value={form.postalCode}
          onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
          className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary sm:text-base"
        />
      </div>

 {/* Contexte: gestion des biens. */}
      {fieldConfig.showSurface && (
        <div className="w-full">
          <label className="mb-1 block text-xs sm:text-sm font-medium text-text-secondary">
            {fieldConfig.surfaceLabel}
          </label>
          <input
            type="number"
            step="0.01"
            placeholder={fieldConfig.surfacePlaceholder}
            value={form.surfaceArea}
            onChange={(e) => setForm({ ...form, surfaceArea: e.target.value })}
            className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary sm:text-base"
          />
        </div>
      )}

 {/* Contexte: gestion des biens. */}
      {fieldConfig.showRooms && (
        <div className="w-full">
          <label className="mb-1 block text-xs sm:text-sm font-medium text-text-secondary">
            {fieldConfig.roomsLabel}
          </label>
          <input
            type="number"
            step="1"
            placeholder={fieldConfig.roomsPlaceholder}
            value={form.roomCount}
            onChange={(e) => setForm({ ...form, roomCount: e.target.value })}
            className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary sm:text-base"
          />
        </div>
      )}

      {/* Description */}
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs sm:text-sm font-medium text-text-secondary">
          {t('propertiesPage.form.labels.description')}
        </label>
        <textarea
          placeholder={t('propertiesPage.form.placeholders.description')}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary sm:text-base"
          rows={3}
        />
      </div>

      {editId && editExistingMedia.length > 0 && (
        <div className="sm:col-span-2">
          <p className="mb-2 text-xs sm:text-sm font-medium text-text-secondary">
            {t('propertiesPage.form.existingMediaLabel')}
          </p>
          <div className="flex flex-wrap gap-3">
            {editExistingMedia.map((mediaPath, i) => {
              const absUrl = toAbsUrl(mediaPath);
              if (!absUrl) return null;
              const markedForRemoval = removedSet.has(mediaPath);

              return (
                <div
                  key={`${mediaPath}-${i}`}
                  className={`relative h-24 w-24 overflow-hidden rounded-lg border bg-surface-card shadow-sm sm:h-28 sm:w-28 ${
                    markedForRemoval
                      ? 'border-red-400 opacity-60'
                      : 'border-border/80'
                  }`}
                >
                  {isPdf(mediaPath) ? (
                    <a
                      href={absUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-full w-full items-center justify-center text-xs text-text-secondary"
                    >
                      {t('propertiesPage.list.pdfLabel')}
                    </a>
                  ) : (
                    <img
                      src={absUrl}
                      alt={t('propertiesPage.form.previewAlt', { index: i + 1 })}
                      className="h-full w-full object-cover"
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
                      ? t('propertiesPage.form.restoreMedia')
                      : t('propertiesPage.form.removeMedia')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fichiers */}
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs sm:text-sm font-medium text-text-secondary">
          {"\u{1F4C1}"} {t('propertiesPage.form.filesLabel')}
        </label>
        <input
          type="file"
          multiple
          accept="image/*,.pdf,.webp,.heic,.heif"
          onChange={handleFileChange}
          className="w-full cursor-pointer rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary sm:text-base"
        />
        <p className="mt-1 text-xs text-text-secondary">
          {editId
            ? t('propertiesPage.form.editMediaHint', {
                current: editMediaCount,
                remaining: Math.max(0, PROPERTY_MAX_FILES - editMediaCount),
                max: PROPERTY_MAX_FILES,
              })
            : t('propertiesPage.form.createMediaHint', {
                max: PROPERTY_MAX_FILES,
              })}
        </p>
        {previewUrls.length > 0 && (
          <p className="mt-1 text-xs text-text-secondary">
            {t('propertiesPage.form.filesSelected', {
              count: previewUrls.length,
            })}
          </p>
        )}
      </div>

      {/* Vignettes */}
      {previewUrls.length > 0 && (
        <div className="sm:col-span-2 mt-3 flex flex-wrap gap-3">
          {previewUrls.map((url, i) => (
            <div
              key={i}
              className="h-24 w-24 overflow-hidden rounded-lg border border-border/80 bg-surface-card shadow-sm sm:h-28 sm:w-28"
            >
              {isPdf(url) || isPdfFileLike(files?.[i]) ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-full w-full items-center justify-center text-xs text-text-secondary"
                >
                  {t('propertiesPage.list.pdfLabel')}
                </a>
              ) : (
                <img
                  src={url}
                  alt={t('propertiesPage.form.previewAlt', { index: i + 1 })}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Boutons */}
      <div className="sm:col-span-2 text-right mt-4 flex flex-col sm:flex-row gap-3 justify-end">
        {editId && (
          <button
            type="button"
            onClick={resetForm}
            disabled={isSubmitting}
            className="app-btn-soft"
          >
            {t('propertiesPage.form.cancel')}
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting && Boolean(editId)}
          className="app-btn-primary px-5 py-2.5 text-sm sm:text-base disabled:cursor-not-allowed disabled:bg-blue-400"
        >
          {editId
            ? `\u{1F4BE} ${t('propertiesPage.form.save')}`
            : `\u{1F441}\uFE0F ${t('propertiesPage.form.preview')}`}
        </button>
      </div>
    </form>
  );
}

function PropertyList({
  filtered,
  now,
  startEditProperty,
  handleDelete,
  toAbsUrl,
  isPdf,
  openLightbox,
}) {
  const { t } = useTranslation();
  const { formatDateTime } = useLocale();

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg sm:text-xl font-semibold text-text-primary">
          {"\u{1F4CB}"} {t('propertiesPage.list.title')}
        </h2>
        <span className="app-toolbar-pill">
          {t('propertiesPage.list.results', { count: filtered.length })}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-border/70 bg-surface-card/70 py-6 text-center text-sm italic text-text-secondary sm:text-base">
          {t('propertiesPage.list.empty')}
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const createdAt = new Date(p.createdAt);
            const diffHours = (now - createdAt) / (1000 * 60 * 60);
            const canEditOrDelete = diffHours <= 1;
            const statusLabel =
              PROPERTY_STATUSES[p.status] ||
              p.status ||
              t('common.dash');
            const surfaceLabel = p.surfaceArea
              ? `${p.surfaceArea} m\u00B2`
              : t('common.dash');
            const roomCount = Number(p.roomCount || 0);

            const imageUrls = (p.photos || [])
              .filter((ph) => !isPdf(ph))
              .map((ph) => toAbsUrl(ph))
              .filter(Boolean);

            return (
              <div
                key={p.id}
                className="
                  bg-surface-card border border-border/70 rounded-2xl shadow-sm
                  hover:shadow-md transition p-4 sm:p-5
                  flex flex-col justify-between
                "
              >
                <div>
                  {/* Photos / PDF badges */}
                  {p.photos && p.photos.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {p.photos.map((photo, i) => {
                        const absUrl = toAbsUrl(photo);
                        if (!absUrl) return null;
                        if (isPdf(photo)) {
                          return (
                            <a
                              key={i}
                              href={absUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="
                                w-20 h-20 sm:w-24 sm:h-24 inline-flex items-center justify-center
                                rounded-lg border border-border/70 bg-surface-main/60 text-[0.75rem] sm:text-xs
                                font-medium text-text-secondary hover:bg-surface-main transition
                              "
                              title={t('propertiesPage.list.openPdf')}
                            >
                              {"\u{1F4C4}"} {t('propertiesPage.list.pdfLabel')}
                            </a>
                          );
                        }
                        const startIndex = imageUrls.indexOf(absUrl);
                        return (
                          <img
                            key={i}
                            src={absUrl}
                            alt={t('propertiesPage.list.photoAlt', {
                              index: i + 1,
                            })}
                            onClick={() =>
                              openLightbox(imageUrls, Math.max(0, startIndex))
                            }
                            className="
                              w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg border border-border/70
                              cursor-zoom-in hover:scale-105 transition-transform duration-200
                            "
                            title={t('propertiesPage.list.zoomHint')}
                          />
                        );
                      })}
                    </div>
                  )}

                  <h3 className="text-base sm:text-lg font-semibold text-text-primary">
                    {p.title}
                  </h3>
                  <p className="mt-0.5 text-sm text-text-secondary">
                    {p.city} - {PROPERTY_TYPES[p.type] || p.type || t('common.dash')}
                  </p>

                  {p.status && (
                    <p className="mt-1 inline-flex items-center rounded-full border border-border/70 bg-surface-main/60 px-2 py-0.5 text-[0.75rem] font-medium text-text-secondary">
                      {t('propertiesPage.list.status', { status: statusLabel })}
                    </p>
                  )}

                  <p className="mt-2 text-sm text-text-secondary line-clamp-3">
                    {p.description || t('propertiesPage.list.noDescription')}
                  </p>

                  {(p.surfaceArea || p.roomCount) && (
                    <p className="mt-2 text-sm text-text-secondary">
                      {t('propertiesPage.list.surfaceRooms', {
                        surface: surfaceLabel,
                        count: roomCount,
                      })}
                    </p>
                  )}

                  <p className="mt-2 text-[0.75rem] text-text-muted">
                    {t('propertiesPage.list.createdAt', {
                      date: formatDateTime(p.createdAt),
                    })}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 justify-end items-center">
                  {canEditOrDelete ? (
                    <>
                      <button
                        onClick={() => {
                          startEditProperty(p);
                        }}
                        className="w-full sm:w-auto rounded-lg bg-amber-500 px-4 py-2 text-xs font-medium text-white transition hover:bg-amber-600 sm:text-sm"
                      >
                        {"\u270F\uFE0F"} {t('propertiesPage.list.edit')}
                      </button>

                      <button
                        onClick={() => handleDelete(p.id, p.createdAt)}
                        className="w-full sm:w-auto rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-red-700 sm:text-sm"
                      >
                        {"\u274C"} {t('propertiesPage.list.delete')}
                      </button>
                    </>
                  ) : (
                    <p className="text-[0.75rem] italic text-text-muted sm:text-xs">
                      {t('propertiesPage.list.locked')}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}






