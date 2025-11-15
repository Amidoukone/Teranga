// frontend/src/pages/AdminProductsPage.jsx
import { useEffect, useState, useMemo } from 'react';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../services/products';
import { getCategories } from '../services/categories';
import { me } from '../services/auth';
import { formatCurrency } from '../utils/labels';

export default function AdminProductsPage() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  // 🔹 État du formulaire
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    currency: 'XOF',
    stock: 0,
    categoryId: '',
    imageFile: null,   // image principale (cover)
    imageFiles: [],    // galerie (0 à 3 images)
  });

  // 🔹 Prévisualisation (cover + galerie)
  const [previewCoverUrl, setPreviewCoverUrl] = useState('');
  const [previewGalleryUrls, setPreviewGalleryUrls] = useState([]);

  // 🔹 Lightbox pour agrandir les images d’un produit
  const [lightbox, setLightbox] = useState({
    open: false,
    product: null,
    index: 0,
  });

  /* ===========================
     🔄 Init
  =========================== */
  useEffect(() => {
    async function init() {
      try {
        const ud = await me();
        setUser(ud.user);
        await Promise.all([loadCategories(), loadProducts()]);
      } catch (err) {
        console.error('❌ init AdminProductsPage:', err);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nettoyage des URLs de preview quand elles changent / au démontage
  useEffect(() => {
    return () => {
      if (previewCoverUrl) URL.revokeObjectURL(previewCoverUrl);
      previewGalleryUrls.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {
          /* ignore */
        }
      });
    };
  }, [previewCoverUrl, previewGalleryUrls]);

  async function loadProducts() {
    setLoading(true);
    try {
      const prods = await getProducts({ limit: 200 });
      setProducts(prods || []);
    } catch (err) {
      console.error('❌ loadProducts:', err);
      alert('Erreur lors du chargement des produits.');
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const cats = await getCategories({ limit: 200 });
      setCategories(cats || []);
    } catch (err) {
      console.error('❌ loadCategories:', err);
      setCategories([]);
    }
  }

  /* ===========================
     🧹 Reset form
  =========================== */
  function resetForm() {
    setForm({
      name: '',
      description: '',
      price: '',
      currency: 'XOF',
      stock: 0,
      categoryId: '',
      imageFile: null,
      imageFiles: [],
    });
    setEditing(null);
    setPreviewCoverUrl('');
    setPreviewGalleryUrls([]);
  }

  /* ===========================
     🖼️ Gestion image principale
  =========================== */
  function handleCoverChange(file) {
    setForm((f) => ({ ...f, imageFile: file || null }));
    setPreviewCoverUrl((old) => {
      if (old) {
        try {
          URL.revokeObjectURL(old);
        } catch {
          /* ignore */
        }
      }
      if (!file) return '';
      return URL.createObjectURL(file);
    });
  }

  /* ===========================
     🖼️ Gestion galerie (0–3 images)
  =========================== */
  function handleGalleryChange(fileList) {
    const files = Array.from(fileList || []).filter((f) => f instanceof File);
    const limited = files.slice(0, 3); // limite à 3 images

    setForm((f) => ({ ...f, imageFiles: limited }));

    // Nettoyage des anciennes urls
    setPreviewGalleryUrls((oldUrls) => {
      oldUrls.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {
          /* ignore */
        }
      });
      // Création des nouvelles urls
      return limited.map((file) => URL.createObjectURL(file));
    });
  }

  /* ===========================
     💾 Submit
  =========================== */
  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (!form.name || form.price === '' || form.price === null) {
        alert('Nom et prix sont requis.');
        return;
      }

      const payload = {
        ...form,
        price: form.price === '' ? '' : Number(form.price),
        stock: form.stock === '' ? 0 : Number(form.stock),
        categoryId: form.categoryId ? Number(form.categoryId) : '',
        // imageFile (File) et imageFiles (File[]) sont déjà dans form,
        // et seront correctement sérialisés par toFormData côté service.
      };

      if (editing) {
        await updateProduct(editing.id, payload);
        alert('✅ Produit mis à jour avec succès.');
      } else {
        await createProduct(payload);
        alert('✅ Produit ajouté avec succès.');
      }

      resetForm();
      await loadProducts();
      setShowForm(false);
    } catch (err) {
      console.error('❌ handleSubmit:', err);
      const msg =
        err?.response?.data?.error ||
        "Erreur lors de l'enregistrement du produit.";
      alert(msg);
    }
  }

  /* ===========================
     🗑️ Delete
  =========================== */
  async function handleDelete(id) {
    const confirmDelete = window.confirm(
      '⚠️ Voulez-vous vraiment supprimer ce produit ?\n\nCette action est irréversible.'
    );
    if (!confirmDelete) return;

    try {
      // utilise le flag force=true pour suppression directe côté backend
      await deleteProduct(`${id}?force=true`);
      alert('🗑 Produit supprimé avec succès.');
      await loadProducts();
    } catch (err) {
      console.error('❌ deleteProduct:', err);
      const msg =
        err?.response?.data?.error ||
        'Erreur lors de la suppression du produit.';
      alert(msg);
    }
  }

  /* ===========================
     ✏️ Edit
  =========================== */
  function handleEdit(p) {
    const cId = p.category?.id || p.categoryId || '';
    setForm({
      name: p.name || '',
      description: p.description || '',
      price: p.price ?? '',
      currency: (p.currency || 'XOF').toUpperCase(),
      stock: p.stock ?? 0,
      categoryId: cId ? String(cId) : '',
      imageFile: null,     // on ne pré-remplit pas, l'image actuelle est conservée si on ne choisit rien
      imageFiles: [],      // idem pour la galerie
    });

    // On ne met pas les images existantes dans les previews (elles sont visibles dans la liste + lightbox)
    setPreviewCoverUrl('');
    setPreviewGalleryUrls([]);

    setEditing(p);
    setShowForm(true);
  }

  /* ===========================
     🏷️ Helpers
  =========================== */
  const categoriesById = useMemo(() => {
    const map = new Map();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  /* ===========================
     🔍 Helpers Lightbox
  =========================== */
  function openLightbox(product, startIndex = 0) {
    if (!product) return;
    const urls =
      (product.allImageUrls && product.allImageUrls.length > 0)
        ? product.allImageUrls
        : (product.imageUrl ? [product.imageUrl] : []);

    if (!urls.length) return;

    setLightbox({
      open: true,
      product,
      index: Math.max(0, Math.min(startIndex, urls.length - 1)),
    });
  }

  function closeLightbox() {
    setLightbox({ open: false, product: null, index: 0 });
  }

  function goPrev() {
    if (!lightbox.product) return;
    const urls =
      lightbox.product.allImageUrls && lightbox.product.allImageUrls.length > 0
        ? lightbox.product.allImageUrls
        : (lightbox.product.imageUrl ? [lightbox.product.imageUrl] : []);
    if (!urls.length) return;

    setLightbox((prev) => ({
      ...prev,
      index: (prev.index - 1 + urls.length) % urls.length,
    }));
  }

  function goNext() {
    if (!lightbox.product) return;
    const urls =
      lightbox.product.allImageUrls && lightbox.product.allImageUrls.length > 0
        ? lightbox.product.allImageUrls
        : (lightbox.product.imageUrl ? [lightbox.product.imageUrl] : []);
    if (!urls.length) return;

    setLightbox((prev) => ({
      ...prev,
      index: (prev.index + 1) % urls.length,
    }));
  }

  if (!user)
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <p className="text-gray-600 text-lg animate-pulse">Chargement…</p>
      </div>
    );

  /* ===========================
     🧱 UI principale
  =========================== */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 py-10">
      <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              📦 Gestion des produits
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Connecté en tant que <strong>{user.email}</strong> ({user.role})
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowForm((v) => !v)}
              className="px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-slate-800 text-white hover:bg-slate-900 transition"
            >
              {showForm ? '➖ Masquer le formulaire' : '➕ Nouveau produit'}
            </button>
            <button
              onClick={loadProducts}
              disabled={loading}
              className={`px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition ${
                loading
                  ? 'bg-blue-300 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
              }`}
            >
              {loading ? 'Chargement…' : '🔄 Rafraîchir'}
            </button>
          </div>
        </div>

        {/* Formulaire */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-5 rounded-xl border border-gray-200 mb-8"
          >
            {/* Nom */}
            <div className="sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom
              </label>
              <input
                placeholder="Nom"
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Prix */}
            <div className="sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prix
              </label>
              <input
                placeholder="Prix"
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) =>
                  setForm({ ...form, price: e.target.value })
                }
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Devise */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Devise
              </label>
              <select
                value={form.currency}
                onChange={(e) =>
                  setForm({ ...form, currency: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="XOF">Franc CFA (XOF)</option>
                <option value="EUR">Euro (€)</option>
                <option value="USD">Dollar ($)</option>
              </select>
            </div>

            {/* Stock */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stock
              </label>
              <input
                placeholder="Stock"
                type="number"
                value={form.stock}
                onChange={(e) =>
                  setForm({ ...form, stock: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Catégorie */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Catégorie
              </label>
              <select
                value={form.categoryId}
                onChange={(e) =>
                  setForm({ ...form, categoryId: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Sans catégorie —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                placeholder="Description (optionnelle)"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Image principale */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Image principale
              </label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={(e) =>
                  handleCoverChange(e.target.files?.[0] || null)
                }
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Formats: JPG/PNG/WebP.
                <br />
                En modification, si vous laissez vide, l’image actuelle est conservée.
              </p>
            </div>

            {/* Aperçu image principale */}
            <div className="flex items-end">
              {previewCoverUrl ? (
                <img
                  src={previewCoverUrl}
                  alt="Prévisualisation"
                  className="w-32 h-32 object-cover rounded-lg border border-gray-200"
                />
              ) : (
                <div className="w-32 h-32 flex items-center justify-center rounded-lg border border-dashed border-gray-300 text-gray-400 text-xs">
                  Aucun aperçu
                </div>
              )}
            </div>

            {/* Galerie images */}
            <div className="sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Galerie (jusqu’à 3 images)
              </label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                multiple
                onChange={(e) => handleGalleryChange(e.target.files)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Vous pouvez sélectionner jusqu’à 3 images. Laisser vide pour conserver la galerie existante.
              </p>
            </div>

            {/* Aperçu galerie */}
            <div className="sm:col-span-1 flex items-end">
              {previewGalleryUrls && previewGalleryUrls.length > 0 ? (
                <div className="flex gap-2 flex-wrap">
                  {previewGalleryUrls.map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt={`Prévisualisation ${idx + 1}`}
                      className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                    />
                  ))}
                </div>
              ) : (
                <div className="w-full h-20 flex items-center justify-center rounded-lg border border-dashed border-gray-300 text-gray-400 text-xs">
                  Aucune image de galerie sélectionnée
                </div>
              )}
            </div>

            {/* Boutons form */}
            <div className="sm:col-span-2 text-right">
              <button
                type="button"
                onClick={resetForm}
                className="mr-2 px-4 py-2 text-sm rounded-lg bg-gray-200 hover:bg-gray-300 transition"
              >
                Réinitialiser
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 text-sm font-semibold rounded-lg shadow-sm bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition"
              >
                {editing ? '💾 Mettre à jour' : '➕ Ajouter'}
              </button>
            </div>
          </form>
        )}

        {/* Liste produits */}
        {products.length === 0 ? (
          <p className="text-gray-500 italic text-center py-6">
            Aucun produit trouvé.
          </p>
        ) : (
          <div className="grid gap-5">
            {products.map((p) => {
              const cat = p.category || categoriesById.get(p.categoryId);
              const mainImg =
                (p.allImageUrls && p.allImageUrls[0]) ||
                p.imageUrl ||
                p.image ||
                '';
              const hasGallery =
                p.allImageUrls && p.allImageUrls.length > 1;

              return (
                <div
                  key={p.id}
                  className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 hover:shadow-md transition"
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                    <div className="flex gap-4">
                      {/* Image cliquable (ouvre lightbox) */}
                      {mainImg ? (
                        <button
                          type="button"
                          onClick={() => openLightbox(p, 0)}
                          className="relative w-20 h-20 rounded-lg border border-gray-200 overflow-hidden group focus:outline-none focus:ring-2 focus:ring-blue-500"
                          title="Cliquer pour agrandir"
                        >
                          <img
                            src={mainImg}
                            alt={p.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          {hasGallery && (
                            <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                              {p.allImageUrls.length} img
                            </span>
                          )}
                        </button>
                      ) : (
                        <div className="w-20 h-20 flex items-center justify-center rounded-lg border border-dashed border-gray-300 text-gray-400 text-xs">
                          —
                        </div>
                      )}

                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {p.name}{' '}
                          <span className="text-xs font-normal text-gray-500">
                            #{p.id}
                          </span>
                        </h3>
                        <p className="text-sm text-gray-600">
                          {Number(p.price || 0).toLocaleString()}{' '}
                          {formatCurrency(p.currency || 'XOF')}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Stock : {p.stock ?? 0}
                          {cat ? (
                            <>
                              {' '}
                              • Catégorie :{' '}
                              <span className="font-medium">
                                {cat.name}
                              </span>
                            </>
                          ) : null}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(p)}
                        className="px-3 py-1.5 text-xs rounded bg-yellow-500 text-white hover:bg-yellow-600"
                      >
                        ✏️ Modifier
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="px-3 py-1.5 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                      >
                        🗑 Supprimer
                      </button>
                    </div>
                  </div>

                  {p.description && (
                    <p className="mt-3 text-sm text-gray-700">
                      {p.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox d’images produit */}
      {lightbox.open && lightbox.product && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
          <div className="relative max-w-3xl w-full max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700">
            {/* Header lightbox */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 text-slate-100 text-sm">
              <div className="truncate">
                <span className="font-semibold">
                  {lightbox.product.name}
                </span>
                {lightbox.product.id && (
                  <span className="text-xs text-slate-400 ml-2">
                    #{lightbox.product.id}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={closeLightbox}
                className="px-2 py-1 text-xs rounded-md bg-slate-700 hover:bg-slate-600"
              >
                ✖ Fermer
              </button>
            </div>

            {/* Image + contrôles */}
            <div className="relative flex items-center justify-center bg-black">
              {(() => {
                const urls =
                  (lightbox.product.allImageUrls &&
                    lightbox.product.allImageUrls.length > 0
                    ? lightbox.product.allImageUrls
                    : (lightbox.product.imageUrl
                        ? [lightbox.product.imageUrl]
                        : [])) || [];
                const currentUrl =
                  urls[lightbox.index] || urls[0] || '';

                return currentUrl ? (
                  <>
                    <img
                      src={currentUrl}
                      alt={lightbox.product.name}
                      className="max-h-[70vh] max-w-full object-contain mx-auto"
                    />

                    {urls.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={goPrev}
                          className="absolute left-2 top-1/2 -translate-y-1/2 px-3 py-2 rounded-full bg-black/60 text-white text-sm hover:bg-black/80"
                        >
                          ◀
                        </button>
                        <button
                          type="button"
                          onClick={goNext}
                          className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-2 rounded-full bg-black/60 text-white text-sm hover:bg-black/80"
                        >
                          ▶
                        </button>
                      </>
                    )}

                    {urls.length > 1 && (
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1 bg-black/50 px-2 py-1 rounded-full">
                        {urls.map((u, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() =>
                              setLightbox((prev) => ({
                                ...prev,
                                index: idx,
                              }))
                            }
                            className={`w-2.5 h-2.5 rounded-full border border-white/70 ${
                              idx === lightbox.index
                                ? 'bg-white'
                                : 'bg-white/30'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="h-64 flex items-center justify-center text-slate-300 text-sm">
                    Aucune image à afficher
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
