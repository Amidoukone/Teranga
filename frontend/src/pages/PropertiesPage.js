// frontend/src/pages/PropertiesPage.js
// ============================================================================
// PropertiesPage — Version Premium 2025 (UX améliorée + Responsive + Pro)
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import {
  getProperties,
  createProperty,
  deleteProperty,
} from '../services/properties';
import api from '../services/api';
import { applyLabels, PROPERTY_TYPES, PROPERTY_STATUSES } from '../utils/labels';

/* ============================================================================
// 🔧 HELPERS FICHIERS & URL
============================================================================ */

const FILE_BASE =
  (typeof window !== 'undefined' && window.__TERANGA_FILE_BASE_URL) ||
  (typeof window !== 'undefined' &&
  window.__TERANGA_API_BASE_URL
    ? window.__TERANGA_API_BASE_URL.replace(/\/api\/?$/, '')
    : 'http://localhost:5000');

function toAbsUrl(pathOrUrl = '') {
  if (!pathOrUrl) return '';
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const normalized = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${FILE_BASE}${normalized}`.replace(/([^:]\/)\/+/g, '$1');
}

function isPdf(path = '') {
  return /\.pdf($|\?)/i.test(path);
}

/* ============================================================================
// 🧩 PAGE PRINCIPALE
============================================================================ */

export default function PropertiesPage() {
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

  // 🧭 État d'affichage du formulaire (persisté)
  const [showForm, setShowForm] = useState(() => {
    const saved = localStorage.getItem('teranga_properties_showForm');
    return saved === null ? true : saved === '1';
  });

  // 🖼️ Lightbox : image agrandie + navigation
  const [lightbox, setLightbox] = useState({
    open: false,
    images: [],
    index: 0,
  });

  // 🔍 Filtres de recherche et tri
  const [filters, setFilters] = useState({
    q: '',
    type: '',
    status: '',
    city: '',
    minSurface: '',
    maxSurface: '',
    sort: '-createdAt',
  });

  // ==========================================
  // 🔹 Chargement initial
  // ==========================================
  useEffect(() => {
    load();
    return () => previewUrls.forEach((url) => URL.revokeObjectURL(url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem('teranga_properties_showForm', showForm ? '1' : '0');
  }, [showForm]);

  // Clavier pour lightbox (← / → / ESC)
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
  }, [lightbox.open, lightbox.index, lightbox.images]);

  async function load() {
    try {
      const props = await getProperties();
      const enriched = props.map((p) => ({
        ...p,
        ...(p.typeLabel ? {} : applyLabels(p)),
      }));
      setProperties(enriched);
    } catch (e) {
      console.error('❌ Erreur chargement propriétés:', e);
      alert('Erreur lors du chargement des biens.');
    }
  }

  // ==========================================
  // 🔹 Gestion fichiers & prévisualisation
  // ==========================================
  function handleFileChange(e) {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(selectedFiles);

    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    const previews = selectedFiles.map((file) => URL.createObjectURL(file));
    setPreviewUrls(previews);
  }

  // ==========================================
  // 🔹 Création
  // ==========================================
  async function handleSubmit(e) {
    if (e?.preventDefault) e.preventDefault();

    const formToSend = {
      ...form,
      surfaceArea: form.surfaceArea === '' ? null : parseFloat(form.surfaceArea),
      roomCount: form.roomCount === '' ? null : parseInt(form.roomCount, 10),
    };

    try {
      await createProperty(formToSend, files);
      alert('✅ Bien créé avec succès');
      resetForm();
      load();
    } catch (e) {
      console.error('❌ Erreur création bien:', e);
      alert('Erreur lors de la création du bien.');
    }
  }

  // ==========================================
  // 🔹 Mise à jour
  // ==========================================
  async function handleUpdate(id) {
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (value !== undefined && value !== null) formData.append(key, value);
      });
      files.forEach((f) => formData.append('files', f));
      await api.put(`/properties/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      alert('✅ Bien mis à jour avec succès');
      resetForm();
      load();
    } catch (e) {
      console.error('❌ Erreur update bien:', e);
      alert('Erreur lors de la mise à jour du bien.');
    }
  }

  // ==========================================
  // 🔹 Suppression
  // ==========================================
  async function handleDelete(id, createdAt) {
    const oneHourAgo = Date.now() - 3600 * 1000;
    const created = new Date(createdAt).getTime();

    if (created < oneHourAgo) {
      alert("❌ Suppression non autorisée (plus d'une heure écoulée)");
      return;
    }
    if (!window.confirm('Confirmer la suppression de ce bien ?')) return;
    try {
      await deleteProperty(id);
      load();
    } catch (e) {
      console.error('❌ Erreur suppression bien:', e);
      alert('Erreur lors de la suppression du bien.');
    }
  }

  // ==========================================
  // 🔹 Réinitialisation du formulaire
  // ==========================================
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
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setFiles([]);
    setPreviewUrls([]);
    setEditId(null);
    setShowPreview(false);
  }

  // ==========================================
  // 🔹 Lightbox controls
  // ==========================================
  function openLightbox(imagesAbsUrls = [], startIndex = 0) {
    if (!Array.isArray(imagesAbsUrls) || imagesAbsUrls.length === 0) return;
    const idx = Math.min(Math.max(0, startIndex), imagesAbsUrls.length - 1);
    setLightbox({ open: true, images: imagesAbsUrls, index: idx });
  }

  function closeLightbox() {
    setLightbox({ open: false, images: [], index: 0 });
  }

  function nextImage() {
    setLightbox((lb) => {
      if (!lb.open || lb.images.length === 0) return lb;
      const ni = (lb.index + 1) % lb.images.length;
      return { ...lb, index: ni };
    });
  }

  function prevImage() {
    setLightbox((lb) => {
      if (!lb.open || lb.images.length === 0) return lb;
      const pi = (lb.index - 1 + lb.images.length) % lb.images.length;
      return { ...lb, index: pi };
    });
  }

  // ==========================================
  // 🔹 Filtres et tri côté client
  // ==========================================
  const filtered = useMemo(() => {
    let arr = [...properties];

    if (filters.q.trim()) {
      const q = filters.q.trim().toLowerCase();
      arr = arr.filter((p) =>
        [
          p.title,
          p.city,
          p.address,
          p.description,
          p.typeLabel,
          p.statusLabel,
          p.postalCode,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }

    if (filters.type) arr = arr.filter((p) => p.type === filters.type);
    if (filters.status) arr = arr.filter((p) => p.status === filters.status);

    if (filters.city.trim()) {
      const c = filters.city.trim().toLowerCase();
      arr = arr.filter((p) => (p.city || '').toLowerCase().includes(c));
    }

    const minS = filters.minSurface ? parseFloat(filters.minSurface) : null;
    const maxS = filters.maxSurface ? parseFloat(filters.maxSurface) : null;
    if (minS !== null) arr = arr.filter((p) => (p.surfaceArea || 0) >= minS);
    if (maxS !== null) arr = arr.filter((p) => (p.surfaceArea || 0) <= maxS);

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
        va = parseFloat(a.surfaceArea || 0);
        vb = parseFloat(b.surfaceArea || 0);
      } else {
        va = a[key];
        vb = b[key];
      }

      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      return 0;
    });

    return arr;
  }, [properties, filters]);

  const now = new Date();

  const typeOptions = useMemo(() => {
    const set = new Set(properties.map((p) => p.type).filter(Boolean));
    return Array.from(set);
  }, [properties]);

  const cityOptions = useMemo(() => {
    const set = new Set(
      properties.map((p) => (p.city || '').trim()).filter(Boolean)
    );
    return Array.from(set);
  }, [properties]);

  // ==========================================
  // 🔹 UI
  // ==========================================
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
              aria-label="Fermer l’aperçu"
              title="Fermer"
            >
              ✕
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                prevImage();
              }}
              className="absolute left-6 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-900 rounded-full p-3 shadow-lg text-xl"
              aria-label="Image précédente"
              title="Précédente (←)"
            >
              ‹
            </button>

            <img
              src={lightbox.images[lightbox.index]}
              alt={`Aperçu ${lightbox.index + 1}`}
              className="max-w-[92vw] max-h-[86vh] object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />

            <button
              onClick={(e) => {
                e.stopPropagation();
                nextImage();
              }}
              className="absolute right-6 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-900 rounded-full p-3 shadow-lg text-xl"
              aria-label="Image suivante"
              title="Suivante (→)"
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
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4 pb-4 border-b border-gray-100">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
          🏠 Gestion de vos biens
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          Centralisez vos biens, leurs photos et toutes les informations importantes.
        </p>
        <span className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200 mt-2">
          <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
          {total} bien(s) enregistré(s).
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold rounded-lg shadow-sm bg-slate-900 text-white hover:bg-slate-800 transition"
        >
          {showForm ? '➖ Masquer le formulaire' : '➕ Nouveau bien'}
        </button>
        <button
          onClick={load}
          className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold rounded-lg shadow-sm bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition"
        >
          🔄 Rafraîchir
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
  return (
    <div className="mb-8 bg-gray-50 border border-gray-200 rounded-2xl p-4 sm:p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-3">
        {/* Recherche globale */}
        <input
          placeholder="🔎 Rechercher (titre, ville, adresse...)"
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
          <option value="">Type (tous)</option>
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
          <option value="">Statut (tous)</option>
          {Object.entries(PROPERTY_STATUSES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>

        {/* Ville */}
        <input
          list="cities"
          placeholder="Ville"
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
          placeholder="Surface min (m²)"
          value={filters.minSurface}
          onChange={(e) => setFilters({ ...filters, minSurface: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
        />

        {/* Surface max */}
        <input
          type="number"
          step="0.01"
          placeholder="Surface max (m²)"
          value={filters.maxSurface}
          onChange={(e) => setFilters({ ...filters, maxSurface: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Ligne tri + reset */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-500">
          <span>{filteredCount} bien(s) après filtrage.</span>
          <select
            value={filters.sort}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, sort: e.target.value }))
            }
            className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="-createdAt">Plus récents d’abord</option>
            <option value="createdAt">Plus anciens d’abord</option>
            <option value="title">Titre (A-Z)</option>
            <option value="-title">Titre (Z-A)</option>
            <option value="-surface">Surface (max → min)</option>
            <option value="surface">Surface (min → max)</option>
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
          Réinitialiser tous les filtres
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
}) {
  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
          {editId ? '✏️ Modifier le bien' : '➕ Ajouter un nouveau bien'}
        </h2>
        {!editId && (
          <p className="text-xs sm:text-sm text-gray-500">
            Remplissez les informations, ajoutez des photos, puis validez.
          </p>
        )}
      </div>

      {showPreview && !editId ? (
        <PropertyPreview
          form={form}
          previewUrls={previewUrls}
          setShowPreview={setShowPreview}
          handleSubmit={handleSubmit}
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
        />
      )}
    </div>
  );
}

function PropertyPreview({ form, previewUrls, setShowPreview, handleSubmit }) {
  return (
    <div className="bg-gray-50 border border-gray-200 p-5 sm:p-6 rounded-2xl mb-8">
      <h3 className="text-base sm:text-lg font-semibold mb-4 text-gray-900">
        Aperçu du bien avant validation
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm sm:text-base">
        <p>
          <strong>Titre :</strong> {form.title || '—'}
        </p>
        <p>
          <strong>Type :</strong> {PROPERTY_TYPES[form.type] || form.type}
        </p>
        <p>
          <strong>Adresse :</strong> {form.address || '—'}
        </p>
        <p>
          <strong>Ville :</strong> {form.city || '—'}
        </p>
        <p>
          <strong>Code postal :</strong> {form.postalCode || '—'}
        </p>
        <p>
          <strong>Surface / Pièces :</strong>{' '}
          {form.surfaceArea || '—'} m² — {form.roomCount || '—'} pièce(s)
        </p>
        <p className="sm:col-span-2">
          <strong>Description :</strong>{' '}
          {form.description || 'Aucune description renseignée.'}
        </p>
      </div>

      {previewUrls.length > 0 && (
        <div className="mt-4">
          <p className="text-xs sm:text-sm text-gray-500 mb-2">
            Aperçu des photos sélectionnées :
          </p>
          <div className="flex flex-wrap gap-3">
            {previewUrls.map((url, i) => (
              <img
                key={i}
                src={url}
                alt="preview"
                className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-lg border border-gray-200 shadow-sm"
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mt-5 justify-end">
        <button
          onClick={() => setShowPreview(false)}
          className="px-4 py-2 rounded-lg bg-gray-300 hover:bg-gray-400 text-sm font-semibold"
        >
          🔙 Modifier
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
        >
          ✅ Créer le bien
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
}) {
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
          Titre du bien <span className="text-red-500">*</span>
        </label>
        <input
          placeholder="Ex : Appartement F3 centre-ville"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Type */}
      <div className="w-full">
        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
          Type de bien
        </label>
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
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
          Adresse <span className="text-red-500">*</span>
        </label>
        <input
          placeholder="Adresse complète"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Ville */}
      <div className="w-full">
        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
          Ville <span className="text-red-500">*</span>
        </label>
        <input
          placeholder="Ex : Dakar"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Code postal */}
      <div className="w-full">
        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
          Code postal
        </label>
        <input
          placeholder="Code postal"
          value={form.postalCode}
          onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Surface */}
      <div className="w-full">
        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
          Surface (m²)
        </label>
        <input
          type="number"
          step="0.01"
          placeholder="Ex : 85"
          value={form.surfaceArea}
          onChange={(e) => setForm({ ...form, surfaceArea: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Nombre de pièces */}
      <div className="w-full">
        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
          Nombre de pièces
        </label>
        <input
          type="number"
          step="1"
          placeholder="Ex : 3"
          value={form.roomCount}
          onChange={(e) => setForm({ ...form, roomCount: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Description */}
      <div className="sm:col-span-2">
        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          placeholder="Ajoutez des précisions : étage, vue, état général, équipements…"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
          rows={3}
        />
      </div>

      {/* Fichiers */}
      <div className="sm:col-span-2">
        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
          📁 Photos / documents (jpg, png, pdf)
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
            {previewUrls.length} fichier(s) sélectionné(s).
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
                alt={`preview-${i}`}
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
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-gray-300 hover:bg-gray-400 transition"
          >
            Annuler
          </button>
        )}
        <button
          type="submit"
          className="px-5 py-2.5 text-sm sm:text-base font-semibold rounded-lg shadow-sm bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition"
        >
          {editId ? '💾 Enregistrer' : '👁 Aperçu'}
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
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
          📋 Liste de vos biens
        </h2>
        <span className="text-xs sm:text-sm text-gray-500">
          {filtered.length} résultat(s)
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500 italic text-center py-6 text-sm sm:text-base">
          Aucun bien correspondant aux critères.
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const createdAt = new Date(p.createdAt);
            const diffHours = (now - createdAt) / (1000 * 60 * 60);
            const canEditOrDelete = diffHours <= 1;

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
                              title="Ouvrir le PDF dans un nouvel onglet"
                            >
                              📄 PDF
                            </a>
                          );
                        }
                        const startIndex = imageUrls.indexOf(absUrl);
                        return (
                          <img
                            key={i}
                            src={absUrl}
                            alt={`photo-${i}`}
                            onClick={() =>
                              openLightbox(
                                imageUrls,
                                Math.max(0, startIndex)
                              )
                            }
                            className="
                              w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg border border-gray-200
                              cursor-zoom-in hover:scale-105 transition-transform duration-200
                            "
                            title="Cliquer pour agrandir"
                          />
                        );
                      })}
                    </div>
                  )}

                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                    {p.title}
                  </h3>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {p.city} — {p.typeLabel || PROPERTY_TYPES[p.type] || p.type}
                  </p>

                  {p.status && (
                    <p className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[0.7rem] font-medium bg-gray-50 text-gray-700 border border-gray-200">
                      Statut : {p.statusLabel || PROPERTY_STATUSES[p.status]}
                    </p>
                  )}

                  <p className="text-sm text-gray-500 mt-2 line-clamp-3">
                    {p.description || 'Aucune description.'}
                  </p>

                  {(p.surfaceArea || p.roomCount) && (
                    <p className="text-sm text-gray-700 mt-2">
                      🏠 {p.surfaceArea ? `${p.surfaceArea} m²` : '—'} —{' '}
                      {p.roomCount || 0} pièce(s)
                    </p>
                  )}

                  <p className="text-[0.7rem] text-gray-400 mt-2">
                    Créé le{' '}
                    {new Date(p.createdAt).toLocaleString('fr-FR')}
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
                        ✏️ Modifier
                      </button>

                      <button
                        onClick={() => handleDelete(p.id, p.createdAt)}
                        className="
                          bg-red-600 text-white rounded-lg px-4 py-2
                          text-xs sm:text-sm font-medium hover:bg-red-700 transition
                        "
                      >
                        ❌ Supprimer
                      </button>
                    </>
                  ) : (
                    <p className="text-[0.7rem] sm:text-xs text-gray-400 italic">
                      ⏰ Modifications verrouillées (délai dépassé).
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
