// ============================================================================
// AdminPropertiesPage.jsx — VERSION PRODUCTION READY (Option B, 100% stable)
// ============================================================================

import { useEffect, useState } from 'react';
import {
  getAllProperties,
  getClientProperties,
  updateProperty,
  createPropertyForClient,
} from '../services/properties';
import api from '../services/api';

// ============================================================================
// 🌍 FILE_BASE + toAbsUrl — Standard Teranga (PRODUCTION SAFE)
// ============================================================================
const FILE_BASE =
  (typeof window !== 'undefined' && window.__TERANGA_FILE_BASE_URL) ||
  (typeof window !== 'undefined' &&
  window.__TERANGA_API_BASE_URL
    ? window.__TERANGA_API_BASE_URL.replace(/\/api\/?$/, '')
    : 'http://localhost:5000');

function toAbsUrl(path = '') {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${FILE_BASE}${clean}`.replace(/([^:]\/)\/+/g, '$1');
}

function isPdf(path = '') {
  return /\.pdf($|\?)/i.test(path);
}

// ============================================================================
// 🧩 PAGE PRINCIPALE
// ============================================================================
export default function AdminPropertiesPage() {
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
  });

  const [files, setFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);

  // ========================================================================
  // 🖼️ LIGHTBOX (Agrandissement + Navigation)
  // ========================================================================
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
  }, [lightbox.open, lightbox.index]);

  // ========================================================================
  // 🔹 Initialisation
  // ========================================================================
  useEffect(() => {
    loadClients();
    loadProperties();
  }, []);

  // ========================================================================
  // 🔹 Charger Clients
  // ========================================================================
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

  // ========================================================================
  // 🔹 Charger Propriétés
  // ========================================================================
  async function loadProperties(clientId) {
    try {
      setLoading(true);
      let props = clientId
        ? await getClientProperties(clientId)
        : await getAllProperties();

      setProperties(props || []);
    } catch (e) {
      console.error('❌ Erreur biens:', e);
    } finally {
      setLoading(false);
    }
  }

  // ========================================================================
  // 🔹 Recherche Client
  // ========================================================================
  useEffect(() => {
    if (!searchTerm.trim()) return setFilteredClients(clients);
    const term = searchTerm.toLowerCase();
    const filtered = clients.filter(
      (c) =>
        c.firstName?.toLowerCase().includes(term) ||
        c.lastName?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term)
    );
    setFilteredClients(filtered);
  }, [searchTerm, clients]);

  // ========================================================================
  // 🔹 Gestion Upload
  // ========================================================================
  function handleFileChange(e) {
    const selected = Array.from(e.target.files || []);
    setFiles(selected);

    previewUrls.forEach((u) => URL.revokeObjectURL(u));
    const previews = selected.map((f) => URL.createObjectURL(f));
    setPreviewUrls(previews);
  }

  // ========================================================================
  // 🔹 Ajouter Bien
  // ========================================================================
  async function handleCreate(e) {
    e.preventDefault();

    if (!selectedClient) {
      alert('Veuillez sélectionner un client.');
      return;
    }

    try {
      await createPropertyForClient(selectedClient, form, files);
      alert('Bien créé avec succès.');
      resetForm();
      setIsCreating(false);
      loadProperties(selectedClient);
    } catch (e) {
      console.error('❌ Erreur création:', e);
      alert("Erreur lors de la création du bien.");
    }
  }

  // ========================================================================
  // 🔹 Modifier Bien
  // ========================================================================
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
    });

    setFiles([]);
    previewUrls.forEach((u) => URL.revokeObjectURL(u));

    const previews = (p.photos || []).map((photo) => toAbsUrl(photo));
    setPreviewUrls(previews);
  }

  async function handleUpdate(e) {
    e.preventDefault();

    try {
      await updateProperty(editId, form, files);
      alert('Bien mis à jour avec succès.');
      resetForm();
      loadProperties(selectedClient);
    } catch (e) {
      console.error('❌ Update:', e);
      alert('Erreur lors de la mise à jour.');
    }
  }

  // ========================================================================
  // 🔹 Supprimer Bien
  // ========================================================================
  async function handleDelete(id) {
    if (!window.confirm('Supprimer ce bien ?')) return;
    try {
      await api.delete(`/properties/${id}`);
      loadProperties(selectedClient);
    } catch (e) {
      alert('Erreur lors de la suppression.');
    }
  }

  // ========================================================================
  // 🔹 Reset Form
  // ========================================================================
  function resetForm() {
    setEditId(null);
    setFiles([]);
    previewUrls.forEach((u) => URL.revokeObjectURL(u));
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
    });
  }

  // ========================================================================
  // 🔹 Lightbox Controls
  // ========================================================================
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

  // ========================================================================
  // 🖥️ UI
  // ========================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 py-10">
      <div className="max-w-7xl mx-auto bg-white shadow-xl rounded-2xl p-8 border border-gray-100">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">🏡 Gestion des Biens (Admin)</h1>
          <button
            onClick={() => loadProperties(selectedClient)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg"
          >
            🔄 Rafraîchir
          </button>
        </div>

        {/* CLIENT SELECTION */}
        <div className="mb-8 bg-gray-50 border rounded-xl p-4">
          <h2 className="text-sm font-medium text-gray-800 mb-2">👤 Sélectionner un client</h2>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher un client…"
              className="flex-1 border px-3 py-2 rounded-lg text-sm"
            />

            <select
              value={selectedClient}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedClient(id);
                loadProperties(id);
                resetForm();
              }}
              className="border px-3 py-2 rounded-lg text-sm"
            >
              <option value="">— Choisir un client —</option>
              {filteredClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName} ({c.email})
                </option>
              ))}
            </select>

            {selectedClient && (
              <button
                onClick={() => {
                  setIsCreating(true);
                  resetForm();
                }}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg"
              >
                ➕ Ajouter un bien
              </button>
            )}
          </div>
        </div>

        {/* FORM */}
        {(isCreating || editId) && (
          <div className="mb-10 bg-gray-50 border rounded-xl p-6 shadow-inner">
            <h2 className="text-lg font-semibold mb-4">
              {editId ? `✏️ Modifier le bien #${editId}` : '➕ Nouveau bien'}
            </h2>

            <form
              onSubmit={editId ? handleUpdate : handleCreate}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              {/* Form Fields */}
              <input
                placeholder="Titre *"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                className="border px-3 py-2 rounded-lg text-sm"
              />

              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="border px-3 py-2 rounded-lg text-sm"
              >
                <option value="house">Maison</option>
                <option value="apartment">Appartement</option>
                <option value="land">Terrain</option>
                <option value="commercial">Local commercial</option>
              </select>

              <input
                placeholder="Adresse *"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                required
                className="border px-3 py-2 rounded-lg text-sm"
              />

              <input
                placeholder="Ville *"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                required
                className="border px-3 py-2 rounded-lg text-sm"
              />

              <input
                placeholder="Code postal"
                value={form.postalCode}
                onChange={(e) =>
                  setForm({ ...form, postalCode: e.target.value })
                }
                className="border px-3 py-2 rounded-lg text-sm"
              />

              <input
                type="number"
                placeholder="Surface (m²)"
                value={form.surfaceArea}
                onChange={(e) =>
                  setForm({ ...form, surfaceArea: e.target.value })
                }
                className="border px-3 py-2 rounded-lg text-sm"
              />

              <input
                type="number"
                placeholder="Nombre de pièces"
                value={form.roomCount}
                onChange={(e) =>
                  setForm({ ...form, roomCount: e.target.value })
                }
                className="border px-3 py-2 rounded-lg text-sm"
              />

              <textarea
                placeholder="Description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={3}
                className="col-span-2 border px-3 py-2 rounded-lg text-sm"
              />

              {/* FILES */}
              <div className="col-span-2">
                <label className="text-sm font-medium">📁 Photos</label>
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="border px-3 py-2 w-full rounded-lg"
                />
              </div>

              {previewUrls.length > 0 && (
                <div className="col-span-2 mt-3 flex flex-wrap gap-3">
                  {previewUrls.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      className="w-24 h-24 object-cover rounded-lg border"
                      alt=""
                    />
                  ))}
                </div>
              )}

              <div className="col-span-2 mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setIsCreating(false);
                  }}
                  className="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editId ? '💾 Enregistrer' : '➕ Créer'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* LIST */}
        {loading ? (
          <p className="text-center text-gray-500 py-6 animate-pulse">
            Chargement…
          </p>
        ) : properties.length === 0 ? (
          <p className="text-center text-gray-500 italic">
            Aucun bien trouvé.
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {properties.map((p) => {
              const imageUrls = (p.photos || [])
                .filter((ph) => !isPdf(ph))
                .map((ph) => toAbsUrl(ph));

              return (
                <div
                  key={p.id}
                  className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition"
                >
                  <div>
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
                                className="w-24 h-24 border bg-gray-100 rounded-md flex items-center justify-center"
                              >
                                📄 PDF
                              </a>
                            );
                          }

                          const idx = imageUrls.indexOf(abs);

                          return (
                            <img
                              key={i}
                              src={abs}
                              alt=""
                              onClick={() =>
                                openLightbox(imageUrls, Math.max(idx, 0))
                              }
                              className="w-24 h-24 object-cover rounded-md border cursor-pointer hover:scale-105 transition-transform"
                            />
                          );
                        })}
                      </div>
                    )}

                    <h3 className="text-lg font-semibold">{p.title}</h3>
                    <p className="text-sm text-gray-600">
                      {p.city} — {p.type}
                    </p>
                    {p.description && (
                      <p className="text-sm mt-1">{p.description}</p>
                    )}
                    {p.surfaceArea && (
                      <p className="text-sm mt-2 text-gray-700">
                        🏠 {p.surfaceArea} m² — {p.roomCount || 0} pièces
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      onClick={() => startEdit(p)}
                      className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm rounded-lg"
                    >
                      ✏️ Modifier
                    </button>

                    <button
                      onClick={() => handleDelete(p.id)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg"
                    >
                      ❌ Supprimer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

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
              className="absolute top-6 right-6 bg-white rounded-full p-2 text-xl shadow-md"
            >
              ✕
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                prevImage();
              }}
              className="absolute left-6 top-1/2 -translate-y-1/2 bg-white rounded-full p-3 text-xl shadow-md"
            >
              ‹
            </button>

            <img
              src={lightbox.images[lightbox.index]}
              alt=""
              className="max-w-[90vw] max-h-[80vh] object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />

            <button
              onClick={(e) => {
                e.stopPropagation();
                nextImage();
              }}
              className="absolute right-6 top-1/2 -translate-y-1/2 bg-white rounded-full p-3 text-xl shadow-md"
            >
              ›
            </button>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white text-sm bg-black/40 px-4 py-1 rounded-full">
              {lightbox.index + 1} / {lightbox.images.length}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
