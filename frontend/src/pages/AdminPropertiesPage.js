// ============================================================================
// AdminPropertiesPage.jsx — VERSION PRODUCTION READY (Apple Light Premium)
// ✅ Master + multi-pays compatible (backend GeoScope)
// ✅ FILE_BASE prod-safe (pas de localhost)
// ✅ Photos: support string | {url,fileId} (ImageKit) | legacy
// ✅ Lightbox + previews sans erreurs (revokeObjectURL safe)
// 100% fonctionnel, aucune régression, même logique, design modernisé.
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

// ============================================================================
// 🌍 FILE_BASE + normalizePath + toAbsUrl — Standard Teranga (PRODUCTION SAFE)
// - Compatible Render/Netlify
// - SSR safe
// - No localhost fallback (évite bugs prod multi-pays)
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

// ============================================================================
// 🧩 Normalisation Photos (ImageKit + legacy)
// - backend peut renvoyer: ["https://..."] (déjà ok)
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
// 🧩 Safe revokeObjectURL (évite erreurs si url http)
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
// 🧩 PAGE PRINCIPALE — Apple Light Premium
// ============================================================================
export default function AdminPropertiesPage() {
  const { t } = useTranslation();
  const [user, setUser] = useState(null);

  const [properties, setProperties] = useState([]);
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState('');

  const [loading, setLoading] = useState(false);
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
    // 🌍 Multi-pays (optionnel — backend gère scope)
    // countryId: '',
    // regionId: '',
  });

  const [files, setFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);

  // ==========================================================================
  // 🖼️ LIGHTBOX (Agrandissement + Navigation)
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
  // 🔹 Initialisation (auth + clients + biens)
  // ==========================================================================
  useEffect(() => {
    (async () => {
      try {
        const u = await me();
        setUser(u.user);
        await Promise.all([loadClients(), loadProperties()]);
      } catch (e) {
        console.error('❌ init AdminPropertiesPage:', e);
        localStorage.removeItem('teranga_token');
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==========================================================================
  // 🔹 Charger Clients (admin/master scoped: backend filtre via GeoScope si appliqué)
  // ==========================================================================
  async function loadClients() {
    try {
      const { data } = await api.get('/users?role=client');
      const list = data.users || [];
      setClients(list);
      setFilteredClients(list);
    } catch (e) {
      console.error('❌ Erreur clients:', e);
    }
  }

  // ==========================================================================
  // 🔹 Charger Propriétés
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
      console.error('❌ Erreur biens:', e);
    } finally {
      setLoading(false);
    }
  }

  // ==========================================================================
  // 🔹 Recherche Client
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
  // 🔹 Gestion Upload + previews
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
  // 🔹 Ajouter Bien
  // ==========================================================================
  async function handleCreate(e) {
    e.preventDefault();

    if (!selectedClient) {
      alert(t('adminPropertiesPage.alerts.selectClient'));
      return;
    }

    try {
      await createPropertyForClient(selectedClient, form, files);
      alert(t('adminPropertiesPage.alerts.createSuccess'));
      resetForm();
      setIsCreating(false);
      loadProperties(selectedClient);
    } catch (e2) {
      console.error('❌ Erreur création:', e2);
      alert(t('adminPropertiesPage.alerts.createError'));
    }
  }

  // ==========================================================================
  // 🔹 Modifier Bien
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
      // 🌍 Multi-pays (optionnel) — si tu ajoutes plus tard les champs UI
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

    try {
      await updateProperty(editId, form, files);
      alert(t('adminPropertiesPage.alerts.updateSuccess'));
      resetForm();
      loadProperties(selectedClient);
    } catch (e2) {
      console.error('❌ Update:', e2);
      alert(t('adminPropertiesPage.alerts.updateError'));
    }
  }

  // ==========================================================================
  // 🔹 Supprimer Bien
  // ==========================================================================
  async function handleDelete(id) {
    if (!window.confirm(t('adminPropertiesPage.alerts.deleteConfirm'))) return;
    try {
      await api.delete(`/properties/${id}`);
      loadProperties(selectedClient);
    } catch (e) {
      console.error('❌ delete property:', e);
      alert(t('adminPropertiesPage.alerts.deleteError'));
    }
  }

  // ==========================================================================
  // 🔹 Reset Form
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
  // 🔹 Lightbox Controls
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

  // ==========================================================================
  // 🖥️ UI — Apple Light Premium (Cartes uniquement)
  // ==========================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-blue-100 px-3 sm:px-4 py-8 sm:py-10">
      <div className="max-w-7xl mx-auto bg-white/90 backdrop-blur-xl shadow-[0_18px_45px_rgba(15,23,42,0.12)] rounded-3xl border border-slate-100 px-4 sm:px-8 py-6 sm:py-8 space-y-8">
        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
              {t('adminPropertiesPage.title')}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {t('adminPropertiesPage.subtitle')}
            </p>

            {selectedClientObj && (
              <p className="text-xs text-slate-400 mt-1">
                {t('adminPropertiesPage.labels.selectedClient')}{' '}
                <span className="font-medium text-slate-700">
                  {selectedClientObj.firstName} {selectedClientObj.lastName} ({selectedClientObj.email})
                </span>
              </p>
            )}

            {user?.role === 'master' && (
              <p className="text-[11px] text-slate-500 mt-2">
                {t('adminPropertiesPage.labels.masterNote')}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 justify-start md:justify-end">
            <button
              onClick={() => loadProperties(selectedClient)}
              className="inline-flex items-center justify-center px-4 py-2 text-xs sm:text-sm font-medium rounded-full bg-slate-900 text-white shadow-sm hover:bg-black transition"
            >
              {t('adminPropertiesPage.buttons.refresh')}
            </button>
          </div>
        </header>

        {/* CLIENT SELECTION */}
        <section className="bg-slate-50/80 border border-slate-200 rounded-2xl px-4 sm:px-5 py-4 sm:py-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              {t('adminPropertiesPage.client.title')}
            </h2>
            {selectedClient && (
              <span className="text-[11px] px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                {t('adminPropertiesPage.client.badge', { count: properties.length })}
              </span>
            )}
          </div>

          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                {t('adminPropertiesPage.client.searchLabel')}
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('adminPropertiesPage.client.searchPlaceholder')}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white/80 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
              />
            </div>

            <div className="w-full lg:w-80">
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
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
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
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
                  className="inline-flex items-center justify-center px-4 py-2 text-xs sm:text-sm font-medium rounded-full bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 transition"
                >
                  {t('adminPropertiesPage.buttons.addProperty')}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* FORMULAIRE (création / édition) */}
        {(isCreating || editId) && (
          <section className="bg-slate-50/80 border border-slate-200 rounded-2xl px-4 sm:px-5 py-5 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="text-base font-semibold text-slate-900">
                {editId
                  ? t('adminPropertiesPage.form.titleEdit', { id: editId })
                  : t('adminPropertiesPage.form.titleCreate')}
              </h2>
              <span className="text-[11px] text-slate-500">
                {t('adminPropertiesPage.form.requiredNote')}
              </span>
            </div>

            <form
              onSubmit={editId ? handleUpdate : handleCreate}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              {/* Titre */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-600">
                  {t('adminPropertiesPage.form.labels.title')}
                </label>
                <input
                  placeholder={t('adminPropertiesPage.form.placeholders.title')}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
                />
              </div>

              {/* Type */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-600">
                  {t('adminPropertiesPage.form.labels.type')}
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
                >
                  <option value="house">{t('labels.property.types.house')}</option>
                  <option value="apartment">{t('labels.property.types.apartment')}</option>
                  <option value="land">{t('labels.property.types.land')}</option>
                  <option value="commercial">{t('labels.property.types.commercial')}</option>
                </select>
              </div>

              {/* Adresse */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-600">
                  {t('adminPropertiesPage.form.labels.address')}
                </label>
                <input
                  placeholder={t('adminPropertiesPage.form.placeholders.address')}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  required
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
                />
              </div>

              {/* Ville */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-600">
                  {t('adminPropertiesPage.form.labels.city')}
                </label>
                <input
                  placeholder={t('adminPropertiesPage.form.placeholders.city')}
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  required
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
                />
              </div>

              {/* Code postal */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-600">
                  {t('adminPropertiesPage.form.labels.postalCode')}
                </label>
                <input
                  placeholder={t('adminPropertiesPage.form.placeholders.postalCode')}
                  value={form.postalCode}
                  onChange={(e) =>
                    setForm({ ...form, postalCode: e.target.value })
                  }
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
                />
              </div>

              {/* Surface */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-600">
                  {t('adminPropertiesPage.form.labels.surface')}
                </label>
                <input
                  type="number"
                  placeholder={t('adminPropertiesPage.form.placeholders.surface')}
                  value={form.surfaceArea}
                  onChange={(e) =>
                    setForm({ ...form, surfaceArea: e.target.value })
                  }
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
                />
              </div>
              {/* Pièces */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-600">
                  {t('adminPropertiesPage.form.labels.rooms')}
                </label>
                <input
                  type="number"
                  placeholder={t('adminPropertiesPage.form.placeholders.rooms')}
                  value={form.roomCount}
                  onChange={(e) =>
                    setForm({ ...form, roomCount: e.target.value })
                  }
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
                />
              </div>

              {/* Description */}
              <div className="sm:col-span-2 flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-600">
                  {t('adminPropertiesPage.form.labels.description')}
                </label>
                <textarea
                  placeholder={t('adminPropertiesPage.form.placeholders.description')}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={3}
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500 resize-y"
                />
              </div>

              {/* FILES */}
              <div className="sm:col-span-2 flex flex-col gap-2 mt-1">
                <label className="text-[11px] font-medium text-slate-600">
                  {t('adminPropertiesPage.form.filesLabel')}
                </label>
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
                />

                {previewUrls.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-3">
                    {previewUrls.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        className="w-20 h-20 object-cover rounded-xl border border-slate-200 shadow-sm"
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
                  className="inline-flex items-center justify-center px-4 py-2 text-xs sm:text-sm rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                >
                  {t('adminPropertiesPage.buttons.cancel')}
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center px-5 py-2 text-xs sm:text-sm font-medium rounded-full bg-blue-600 text-white shadow-sm hover:bg-blue-700 transition"
                >
                  {editId
                    ? t('adminPropertiesPage.buttons.save')
                    : t('adminPropertiesPage.buttons.create')}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* LISTE DES BIENS — CARTES PREMIUM */}
        <section className="space-y-4">
          {loading ? (
            <p className="text-center text-slate-500 py-6 text-sm animate-pulse">
              {t('adminPropertiesPage.loading')}
            </p>
          ) : properties.length === 0 ? (
            <p className="text-center text-slate-500 italic py-6 text-sm">
              {t('adminPropertiesPage.empty')}
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
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
                      className="bg-white/90 border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full"
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
                                  className="w-20 h-20 border border-slate-200 bg-slate-50 rounded-xl flex items-center justify-center text-xs text-slate-600 hover:bg-slate-100 transition"
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
                                className="w-20 h-20 object-cover rounded-xl border border-slate-200 cursor-pointer hover:scale-[1.03] hover:shadow-sm transition-transform"
                              />
                            );
                          })}
                        </div>
                      )}

                      {/* Infos principales */}
                      <div className="flex-1 space-y-1.5">
                        <h3 className="text-base font-semibold text-slate-900 line-clamp-2">
                          {p.title}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {p.city} • <span className="uppercase">{typeLabel}</span>
                        </p>

                        {p.description && (
                          <p className="text-sm text-slate-600 mt-1 line-clamp-3">
                            {p.description}
                          </p>
                        )}

                        {p.surfaceArea && (
                          <p className="text-sm text-slate-700 mt-2">
                            {surfaceRoomsLabel}
                          </p>
                        )}

                        {(p.countryId || p.regionId) && (
                          <p className="text-[11px] text-slate-400 mt-1">
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
                          className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-full bg-amber-500 text-white hover:bg-amber-600 transition"
                        >
                          {t('adminPropertiesPage.buttons.edit')}
                        </button>

                        <button
                          onClick={() => handleDelete(p.id)}
                          className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-full bg-red-600 text-white hover:bg-red-700 transition"
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
              className="absolute top-6 right-6 bg-white/90 hover:bg-white text-slate-800 rounded-full p-2 text-xl shadow-md transition"
              aria-label={t('adminPropertiesPage.lightbox.close')}
            >
              ✕
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                prevImage();
              }}
              className="absolute left-6 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-slate-800 rounded-full p-3 text-xl shadow-md transition"
              aria-label={t('adminPropertiesPage.lightbox.prev')}
            >
              ‹
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
              className="absolute right-6 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-slate-800 rounded-full p-3 text-xl shadow-md transition"
              aria-label={t('adminPropertiesPage.lightbox.next')}
            >
              ›
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
