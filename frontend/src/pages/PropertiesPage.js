// frontend/src/pages/PropertiesPage.js
// ============================================================================
// PropertiesPage — Version Premium 2025
// Client / Admin / Master / Multi-pays READY — ZERO régression
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import {
  getProperties,
  createProperty,
  deleteProperty,
} from '../services/properties';
import api from '../services/api';
import {
  PROPERTY_TYPES,
  PROPERTY_STATUSES,
} from '../utils/labels';
import { useLocale } from '../i18n/useLocale';
import { useTranslation } from 'react-i18next';
import { notify } from '../utils/notify';
import { useDeleteConfirm } from '../hooks/useDeleteConfirm';

// ============================================================================
// 🌍 FILE_BASE — Standard Teranga (Render / Netlify / CDN / Multi-pays SAFE)
// ============================================================================
const FILE_BASE =
  (typeof window !== 'undefined' && window.__TERANGA_FILE_BASE_URL) ||
  (typeof window !== 'undefined' &&
  window.__TERANGA_API_BASE_URL
    ? window.__TERANGA_API_BASE_URL.replace(/\/api\/?$/, '')
    : '');

function toAbsUrl(pathOrUrl = '') {
  if (!pathOrUrl) return '';
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const normalized = pathOrUrl.startsWith('/')
    ? pathOrUrl
    : `/${pathOrUrl}`;
  return `${FILE_BASE}${normalized}`.replace(/([^:]\/)\/+/g, '$1');
}

function isPdf(path = '') {
  return /\.pdf($|\?)/i.test(path);
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
// 🧩 PAGE PRINCIPALE
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
  const [showPreview, setShowPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Affichage formulaire persisté
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
      console.error('❌ load properties:', e);
      notify(t('propertiesPage.alerts.loadError'));
    }
  }

  // --------------------------------------------------------------------------
  // FILES
  // --------------------------------------------------------------------------
  function handleFileChange(e) {
    const selected = Array.from(e.target.files || []);
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
      console.error('❌ create property:', e);
      notify(t('propertiesPage.alerts.createError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  // --------------------------------------------------------------------------
  // UPDATE
  // --------------------------------------------------------------------------
  async function handleUpdate(id) {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v !== undefined && v !== null) formData.append(k, v);
      });
      files.forEach((f) => formData.append('files', f));

      await api.put(`/properties/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      notify(t('propertiesPage.alerts.updateSuccess'));
      resetForm();
      await load();
    } catch (e) {
      console.error('❌ update property:', e);
      notify(t('propertiesPage.alerts.updateError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  // --------------------------------------------------------------------------
  // DELETE (≤ 1h)
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
      console.error('❌ delete property:', e);
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
    setShowPreview(false);
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-3 sm:px-4 lg:px-6 py-8 lg:py-10">
      <div className="max-w-6xl mx-auto bg-white/95 shadow-2xl rounded-3xl border border-gray-100 p-5 sm:p-8 lg:p-10 space-y-8 relative">
        {/* 🧭 En-tête */}
        <Header
          showForm={showForm}
          setShowForm={setShowForm}
          load={load}
          total={properties.length}
        />

        {/* 🔍 Filtres */}
        <PropertyFilters
          filters={filters}
          setFilters={setFilters}
          typeOptions={typeOptions}
          cityOptions={cityOptions}
          filteredCount={filtered.length}
        />

        {/* 🏗️ Formulaire */}
        {showForm && (
          <PropertyForm
            form={form}
            setForm={setForm}
            showPreview={showPreview}
            setShowPreview={setShowPreview}
            handleFileChange={handleFileChange}
            previewUrls={previewUrls}
            handleSubmit={handleSubmit}
            handleUpdate={handleUpdate}
            resetForm={resetForm}
            editId={editId}
            isSubmitting={isSubmitting}
          />
        )}

        {/* 🏠 Liste */}
        <PropertyList
          filtered={filtered}
          now={now}
          setEditId={setEditId}
          setShowForm={setShowForm}
          setShowPreview={setShowPreview}
          setForm={setForm}
          handleDelete={handleDelete}
          toAbsUrl={toAbsUrl}
          isPdf={isPdf}
          openLightbox={openLightbox}
        />

        {/* 🖼️ Lightbox plein écran avec navigation */}
        {lightbox.open && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeLightbox();
            }}
          >
            <button
              onClick={closeLightbox}
              className="absolute top-6 right-6 bg-white/90 hover:bg-white text-gray-900 rounded-full p-2 shadow-md text-xl"
              aria-label={t('propertiesPage.lightbox.closeLabel')}
              title={t('propertiesPage.lightbox.closeTitle')}
            >
              ✕
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                prevImage();
              }}
              className="absolute left-6 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-900 rounded-full p-3 shadow-lg text-xl"
              aria-label={t('propertiesPage.lightbox.prevLabel')}
              title={t('propertiesPage.lightbox.prevTitle')}
            >
              ‹
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
              className="absolute right-6 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-900 rounded-full p-3 shadow-lg text-xl"
              aria-label={t('propertiesPage.lightbox.nextLabel')}
              title={t('propertiesPage.lightbox.nextTitle')}
            >
              ›
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
// ✅ SOUS-COMPOSANTS
============================================================================ */

function Header({ showForm, setShowForm, load, total }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4 pb-4 border-b border-gray-100">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
          🏠 {t('propertiesPage.header.title')}
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          {t('propertiesPage.header.subtitle')}
        </p>
        <span className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200 mt-2">
          <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
          {t('propertiesPage.header.count', { count: total })}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold rounded-lg shadow-sm bg-slate-900 text-white hover:bg-slate-800 transition"
        >
          {showForm
            ? `➖ ${t('propertiesPage.buttons.hideForm')}`
            : `➕ ${t('propertiesPage.buttons.newProperty')}`}
        </button>
        <button
          onClick={load}
          className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold rounded-lg shadow-sm bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition"
        >
          🔄 {t('common.refresh')}
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
    <div className="mb-8 bg-gray-50 border border-gray-200 rounded-2xl p-4 sm:p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-3">
        {/* Recherche globale */}
        <input
          placeholder={t('propertiesPage.filters.searchPlaceholder')}
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm sm:text-base focus:ring-2 focus:ring-blue-500 col-span-1 lg:col-span-3"
        />

        {/* Type */}
        <select
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
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
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
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
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
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
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
        />

        {/* Surface max */}
        <input
          type="number"
          step="0.01"
          placeholder={t('propertiesPage.filters.maxSurfacePlaceholder')}
          value={filters.maxSurface}
          onChange={(e) => setFilters({ ...filters, maxSurface: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Ligne tri + reset */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-500">
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
            className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 bg-white"
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
          className="text-xs sm:text-sm px-3 py-1.5 bg-gray-200 rounded-md hover:bg-gray-300 font-medium transition w-full sm:w-auto text-center"
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
  showPreview,
  setShowPreview,
  handleFileChange,
  previewUrls,
  handleSubmit,
  handleUpdate,
  resetForm,
  editId,
  isSubmitting,
}) {
  const { t } = useTranslation();

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
          {editId
            ? `✏️ ${t('propertiesPage.form.titleEdit')}`
            : `➕ ${t('propertiesPage.form.titleCreate')}`}
        </h2>
        {!editId && (
          <p className="text-xs sm:text-sm text-gray-500">
            {t('propertiesPage.form.helperCreate')}
          </p>
        )}
      </div>

      {showPreview && !editId ? (
        <PropertyPreview
          form={form}
          previewUrls={previewUrls}
          setShowPreview={setShowPreview}
          handleSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      ) : (
        <PropertyEditor
          editId={editId}
          form={form}
          setForm={setForm}
          handleFileChange={handleFileChange}
          previewUrls={previewUrls}
          handleUpdate={handleUpdate}
          resetForm={resetForm}
          setShowPreview={setShowPreview}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}

function PropertyPreview({
  form,
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
    <div className="bg-gray-50 border border-gray-200 p-5 sm:p-6 rounded-2xl mb-8">
      <h3 className="text-base sm:text-lg font-semibold mb-4 text-gray-900">
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
          <p className="text-xs sm:text-sm text-gray-500 mb-2">
            {t('propertiesPage.preview.photosLabel')}
          </p>
          <div className="flex flex-wrap gap-3">
            {previewUrls.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={t('propertiesPage.preview.photoAlt', { index: i + 1 })}
                className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-lg border border-gray-200 shadow-sm"
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mt-5 justify-end">
        <button
          onClick={() => setShowPreview(false)}
          disabled={isSubmitting}
          className="px-4 py-2 rounded-lg bg-gray-300 hover:bg-gray-400 text-sm font-semibold"
        >
          🔙 {t('propertiesPage.preview.edit')}
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white text-sm font-semibold"
        >
          ✅ {t('propertiesPage.preview.create')}
        </button>
      </div>
    </div>
  );
}

function PropertyEditor({
  editId,
  form,
  setForm,
  handleFileChange,
  previewUrls,
  handleUpdate,
  resetForm,
  setShowPreview,
  isSubmitting,
}) {
  const { t } = useTranslation();
  const fieldConfig = getPropertyTypeFieldConfig(form.type, t);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!editId) setShowPreview(true);
        else handleUpdate(editId);
      }}
      className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 sm:p-5 rounded-2xl border border-gray-200"
    >
      {/* Titre */}
      <div className="w-full">
        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
          {t('propertiesPage.form.labels.title')}{' '}
          <span className="text-red-500">*</span>
        </label>
        <input
          placeholder={t('propertiesPage.form.placeholders.title')}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Type */}
      <div className="w-full">
        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
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
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
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
        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
          {t('propertiesPage.form.labels.address')}{' '}
          <span className="text-red-500">*</span>
        </label>
        <input
          placeholder={t('propertiesPage.form.placeholders.address')}
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Ville */}
      <div className="w-full">
        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
          {t('propertiesPage.form.labels.city')}{' '}
          <span className="text-red-500">*</span>
        </label>
        <input
          placeholder={t('propertiesPage.form.placeholders.city')}
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Code postal */}
      <div className="w-full">
        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
          {t('propertiesPage.form.labels.postalCode')}
        </label>
        <input
          placeholder={t('propertiesPage.form.placeholders.postalCode')}
          value={form.postalCode}
          onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Surface / Kilométrage */}
      {fieldConfig.showSurface && (
        <div className="w-full">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            {fieldConfig.surfaceLabel}
          </label>
          <input
            type="number"
            step="0.01"
            placeholder={fieldConfig.surfacePlaceholder}
            value={form.surfaceArea}
            onChange={(e) => setForm({ ...form, surfaceArea: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Pièces / Espaces / Places */}
      {fieldConfig.showRooms && (
        <div className="w-full">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            {fieldConfig.roomsLabel}
          </label>
          <input
            type="number"
            step="1"
            placeholder={fieldConfig.roomsPlaceholder}
            value={form.roomCount}
            onChange={(e) => setForm({ ...form, roomCount: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Description */}
      <div className="sm:col-span-2">
        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
          {t('propertiesPage.form.labels.description')}
        </label>
        <textarea
          placeholder={t('propertiesPage.form.placeholders.description')}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
          rows={3}
        />
      </div>

      {/* Fichiers */}
      <div className="sm:col-span-2">
        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
          📁 {t('propertiesPage.form.filesLabel')}
        </label>
        <input
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.pdf"
          onChange={handleFileChange}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base cursor-pointer focus:ring-2 focus:ring-blue-500"
        />
        {previewUrls.length > 0 && (
          <p className="mt-1 text-xs text-gray-500">
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
              className="w-24 h-24 sm:w-28 sm:h-28 border border-gray-300 rounded-lg overflow-hidden shadow-sm bg-white"
            >
              <img
                src={url}
                alt={t('propertiesPage.form.previewAlt', { index: i + 1 })}
                className="w-full h-full object-cover"
              />
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
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-gray-300 hover:bg-gray-400 transition"
          >
            {t('propertiesPage.form.cancel')}
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting && Boolean(editId)}
          className="px-5 py-2.5 text-sm sm:text-base font-semibold rounded-lg shadow-sm bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400 disabled:cursor-not-allowed transition"
        >
          {editId
            ? `💾 ${t('propertiesPage.form.save')}`
            : `👁 ${t('propertiesPage.form.preview')}`}
        </button>
      </div>
    </form>
  );
}

function PropertyList({
  filtered,
  now,
  setEditId,
  setShowForm,
  setShowPreview,
  setForm,
  handleDelete,
  toAbsUrl,
  isPdf,
  openLightbox,
}) {
  const { t } = useTranslation();
  const { formatDateTime } = useLocale();

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
          📋 {t('propertiesPage.list.title')}
        </h2>
        <span className="text-xs sm:text-sm text-gray-500">
          {t('propertiesPage.list.results', { count: filtered.length })}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500 italic text-center py-6 text-sm sm:text-base">
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
              ? `${p.surfaceArea} m²`
              : t('common.dash');
            const roomCount = Number(p.roomCount || 0);

            const imageUrls = (p.photos || [])
              .filter((ph) => !isPdf(ph))
              .map((ph) => toAbsUrl(ph));

            return (
              <div
                key={p.id}
                className="
                  bg-white border border-gray-200 rounded-2xl shadow-sm
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
                        if (isPdf(photo)) {
                          return (
                            <a
                              key={i}
                              href={absUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="
                                w-20 h-20 sm:w-24 sm:h-24 inline-flex items-center justify-center
                                rounded-lg border border-gray-200 bg-gray-50 text-[0.7rem] sm:text-xs
                                font-medium text-gray-700 hover:bg-gray-100 transition
                              "
                              title={t('propertiesPage.list.openPdf')}
                            >
                              📄 {t('propertiesPage.list.pdfLabel')}
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
                              w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg border border-gray-200
                              cursor-zoom-in hover:scale-105 transition-transform duration-200
                            "
                            title={t('propertiesPage.list.zoomHint')}
                          />
                        );
                      })}
                    </div>
                  )}

                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                    {p.title}
                  </h3>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {p.city} — {PROPERTY_TYPES[p.type] || p.type || t('common.dash')}
                  </p>

                  {p.status && (
                    <p className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[0.7rem] font-medium bg-gray-50 text-gray-700 border border-gray-200">
                      {t('propertiesPage.list.status', { status: statusLabel })}
                    </p>
                  )}

                  <p className="text-sm text-gray-500 mt-2 line-clamp-3">
                    {p.description || t('propertiesPage.list.noDescription')}
                  </p>

                  {(p.surfaceArea || p.roomCount) && (
                    <p className="text-sm text-gray-700 mt-2">
                      {t('propertiesPage.list.surfaceRooms', {
                        surface: surfaceLabel,
                        count: roomCount,
                      })}
                    </p>
                  )}

                  <p className="text-[0.7rem] text-gray-400 mt-2">
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
                          setEditId(p.id);
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
                        }}
                        className="
                          bg-yellow-500 text-white rounded-lg px-4 py-2
                          text-xs sm:text-sm font-medium hover:bg-yellow-600 transition
                        "
                      >
                        ✏️ {t('propertiesPage.list.edit')}
                      </button>

                      <button
                        onClick={() => handleDelete(p.id, p.createdAt)}
                        className="
                          bg-red-600 text-white rounded-lg px-4 py-2
                          text-xs sm:text-sm font-medium hover:bg-red-700 transition
                        "
                      >
                        ❌ {t('propertiesPage.list.delete')}
                      </button>
                    </>
                  ) : (
                    <p className="text-[0.7rem] sm:text-xs text-gray-400 italic">
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

