import { useEffect, useState } from 'react';
import {
  getAllProperties,
  getClientProperties,
  updateProperty,
  createPropertyForClient,
} from '../services/properties';
import api from '../services/api';

export default function AdminPropertiesPage() {
  const [properties, setProperties] = useState([]);
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]); // 🔍 clients filtrés
  const [searchTerm, setSearchTerm] = useState(''); // 🔍 terme de recherche client
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

  // 🖼️ Lightbox (agrandissement + navigation)
  const [lightbox, setLightbox] = useState({
    open: false,
    images: [],
    index: 0,
  });

  // ==============================================
  // 🔹 Initialisation
  // ==============================================
  useEffect(() => {
    loadClients();
    loadProperties();
  }, []);

  // Gestion clavier Lightbox
  useEffect(() => {
    if (!lightbox.open) return;
    function onKey(e) {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextImage();
      if (e.key === 'ArrowLeft') prevImage();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  // ==============================================
  // 🔹 Charger clients & propriétés
  // ==============================================
  async function loadClients() {
    try {
      const { data } = await api.get('/users?role=client');
      const list = data.users || [];
      setClients(list);
      setFilteredClients(list);
    } catch (e) {
      console.error('❌ Erreur chargement clients:', e);
    }
  }

  async function loadProperties(clientId) {
    try {
      setLoading(true);
      let props = [];
      if (clientId) props = await getClientProperties(clientId);
      else props = await getAllProperties();
      setProperties(props);
    } catch (e) {
      console.error('❌ Erreur chargement biens:', e);
    } finally {
      setLoading(false);
    }
  }

  // ==============================================
  // 🔹 Recherche client (filtrage)
  // ==============================================
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

  // ==============================================
  // 🔹 Gestion fichiers
  // ==============================================
  function handleFileChange(e) {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    const previews = selectedFiles.map((file) => URL.createObjectURL(file));
    setPreviewUrls(previews);
  }

  // ==============================================
  // 🔹 Ajouter un bien (admin)
  // ==============================================
  async function handleCreate(e) {
    e.preventDefault();
    if (!selectedClient) {
      alert('⚠️ Veuillez sélectionner un client avant d’ajouter un bien.');
      return;
    }
    try {
      await createPropertyForClient(selectedClient, form, files);
      alert('✅ Bien ajouté avec succès !');
      resetForm();
      loadProperties(selectedClient);
      setIsCreating(false);
    } catch (err) {
      console.error('❌ Erreur création bien:', err);
      alert('Erreur lors de la création du bien.');
    }
  }

  // ==============================================
  // 🔹 Préparer la modification
  // ==============================================
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
    setPreviewUrls(
      p.photos ? p.photos.map((photo) => `http://localhost:5000${photo}`) : []
    );
  }

  // ==============================================
  // 🔹 Soumettre la mise à jour
  // ==============================================
  async function handleUpdate(e) {
    e.preventDefault();
    try {
      await updateProperty(editId, form, files);
      alert('✅ Bien mis à jour avec succès !');
      resetForm();
      loadProperties(selectedClient);
    } catch (err) {
      console.error('❌ Erreur mise à jour bien:', err);
      alert('Erreur lors de la mise à jour du bien.');
    }
  }

  // ==============================================
  // 🔹 Supprimer un bien
  // ==============================================
  async function handleDelete(id) {
    if (!window.confirm('Supprimer ce bien ?')) return;
    try {
      await api.delete(`/properties/${id}`);
      loadProperties(selectedClient);
    } catch (e) {
      alert('Erreur lors de la suppression.');
    }
  }

  // ==============================================
  // 🔹 Réinitialisation du formulaire
  // ==============================================
  function resetForm() {
    setEditId(null);
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
  }

  // ==============================================
  // 🖼️ Lightbox Controls
  // ==============================================
  function openLightbox(images, startIndex = 0) {
    if (!images?.length) return;
    setLightbox({ open: true, images, index: startIndex });
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

  // ==============================================
  // 🧩 Helpers
  // ==============================================
  function isPdf(path = '') {
    return /\.pdf($|\?)/i.test(path);
  }
  function toAbsUrl(path = '') {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `http://localhost:5000${normalized}`;
  }

  // ==============================================
  // 🖥️ UI
  // ==============================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 py-10">
      <div className="max-w-7xl mx-auto bg-white shadow-xl rounded-2xl p-8 border border-gray-100 relative">
        {/* 🧭 En-tête */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            🏡 Gestion des Biens (Admin)
          </h1>
          <button
            onClick={() => loadProperties(selectedClient)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
          >
            🔄 Rafraîchir
          </button>
        </div>

        {/* 🔍 Recherche et filtre client */}
        <div className="mb-8 bg-gray-50 border border-gray-200 rounded-xl p-4">
          <h2 className="text-sm font-medium text-gray-800 mb-2">
            👤 Sélectionner un client
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="🔎 Rechercher un client (nom, email...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={selectedClient}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedClient(id);
                loadProperties(id);
                resetForm();
              }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Sélectionner un client —</option>
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
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition"
              >
                ➕ Ajouter un bien pour ce client
              </button>
            )}
          </div>
        </div>

        {/* 🏗️ Formulaire création / édition */}
        {(isCreating || editId) && (
          <div className="mb-10 bg-gray-50 border border-gray-200 rounded-xl p-6 shadow-inner">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              {editId
                ? `✏️ Modifier le bien #${editId}`
                : '➕ Ajouter un nouveau bien'}
            </h2>
            <form
              onSubmit={editId ? handleUpdate : handleCreate}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              {/* Champs identiques à avant */}
              <input
                placeholder="Titre *"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                required
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
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
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
              <input
                placeholder="Ville *"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                required
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
              <input
                placeholder="Code postal"
                value={form.postalCode}
                onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Surface (m²)"
                value={form.surfaceArea}
                onChange={(e) =>
                  setForm({ ...form, surfaceArea: e.target.value })
                }
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                step="1"
                placeholder="Nombre de pièces"
                value={form.roomCount}
                onChange={(e) =>
                  setForm({ ...form, roomCount: e.target.value })
                }
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                placeholder="Description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                rows={3}
              />

              {/* Upload fichiers */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  📁 Photos
                </label>
                <input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={handleFileChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm cursor-pointer focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {previewUrls.length > 0 && (
                <div className="col-span-2 mt-3 flex flex-wrap gap-3">
                  {previewUrls.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`preview-${i}`}
                      className="w-24 h-24 object-cover rounded-lg border border-gray-300"
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
                  className="px-4 py-2 bg-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-400"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
                >
                  {editId ? '💾 Enregistrer' : '➕ Créer'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 📋 Liste des biens */}
        {loading ? (
          <p className="text-gray-500 text-center py-8 animate-pulse">
            Chargement…
          </p>
        ) : properties.length === 0 ? (
          <p className="text-gray-500 italic text-center py-6">
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
                  className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition p-4 flex flex-col justify-between"
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
                                className="w-24 h-24 inline-flex items-center justify-center border border-gray-200 bg-gray-50 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-100"
                              >
                                📄 PDF
                              </a>
                            );
                          }
                          const startIndex = imageUrls.indexOf(abs);
                          return (
                            <img
                              key={i}
                              src={abs}
                              alt={`photo-${i}`}
                              onClick={() =>
                                openLightbox(imageUrls, Math.max(0, startIndex))
                              }
                              className="w-24 h-24 object-cover rounded-md border border-gray-200 cursor-zoom-in hover:scale-105 transition-transform"
                            />
                          );
                        })}
                      </div>
                    )}
                    <h3 className="text-lg font-semibold text-gray-900">
                      {p.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {p.city} — {p.type}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      {p.description || 'Aucune description.'}
                    </p>
                    {p.surfaceArea && (
                      <p className="text-sm text-gray-700 mt-2">
                        🏠 {p.surfaceArea} m² — {p.roomCount || 0} pièce(s)
                      </p>
                    )}
                  </div>
                  <div className="mt-4 flex gap-2 justify-end">
                    <button
                      onClick={() => startEdit(p)}
                      className="bg-yellow-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-yellow-600 transition"
                    >
                      ✏️ Modifier
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-700 transition"
                    >
                      ❌ Supprimer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 🖼️ Lightbox plein écran */}
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
            >
              ✕
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                prevImage();
              }}
              className="absolute left-6 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-900 rounded-full p-3 shadow-lg text-xl"
            >
              ‹
            </button>
            <img
              src={lightbox.images[lightbox.index]}
              alt="Aperçu bien"
              className="max-w-[92vw] max-h-[86vh] object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                nextImage();
              }}
              className="absolute right-6 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-900 rounded-full p-3 shadow-lg text-xl"
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
