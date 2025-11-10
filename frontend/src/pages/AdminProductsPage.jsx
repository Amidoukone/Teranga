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

  // form state
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    currency: 'XOF',
    stock: 0,
    categoryId: '',
    imageFile: null,
  });
  const [previewUrl, setPreviewUrl] = useState('');

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

    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    });
    setEditing(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
    }
  }

  /* ===========================
     🖼️ Gestion image (aperçu)
  =========================== */
  function handleImageChange(file) {
    setForm((f) => ({ ...f, imageFile: file || null }));
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl('');
    }
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
      const msg = err?.response?.data?.error || "Erreur lors de l'enregistrement du produit.";
      alert(msg);
    }
  }

  /* ===========================
     🗑️ Delete
  =========================== */
  async function handleDelete(id) {
    const confirm = window.confirm(
      '⚠️ Voulez-vous vraiment supprimer ce produit ?\n\nCette action est irréversible.'
    );
    if (!confirm) return;

    try {
      // utilise le flag force=true pour suppression directe côté backend
      await deleteProduct(`${id}?force=true`);
      alert('🗑 Produit supprimé avec succès.');
      await loadProducts();
    } catch (err) {
      console.error('❌ deleteProduct:', err);
      const msg = err?.response?.data?.error || 'Erreur lors de la suppression du produit.';
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
      imageFile: null,
    });
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const currentImage = p.imageUrl || p.image || '';
    setPreviewUrl(
      currentImage
        ? currentImage.startsWith('http')
          ? currentImage
          : `http://127.0.0.1:5000${currentImage}`
        : ''
    );
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
            <h1 className="text-2xl font-bold text-gray-900">📦 Gestion des produits</h1>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
              <input
                placeholder="Nom"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Prix */}
            <div className="sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Prix</label>
              <input
                placeholder="Prix"
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Devise */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Devise</label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="XOF">Franc CFA (XOF)</option>
                <option value="EUR">Euro (€)</option>
                <option value="USD">Dollar ($)</option>
              </select>
            </div>

            {/* Stock */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
              <input
                placeholder="Stock"
                type="number"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Catégorie */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                placeholder="Description (optionnelle)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Image upload + preview */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={(e) => handleImageChange(e.target.files?.[0] || null)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Formats: JPG/PNG/WebP. Le fichier sera envoyé via <code>image</code> (FormData).
              </p>
            </div>

            <div className="flex items-end">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Prévisualisation"
                  className="w-32 h-32 object-cover rounded-lg border border-gray-200"
                />
              ) : (
                <div className="w-32 h-32 flex items-center justify-center rounded-lg border border-dashed border-gray-300 text-gray-400 text-xs">
                  Aucun aperçu
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
          <p className="text-gray-500 italic text-center py-6">Aucun produit trouvé.</p>
        ) : (
          <div className="grid gap-5">
            {products.map((p) => {
              const cat = p.category || categoriesById.get(p.categoryId);
              const img = p.imageUrl || p.image || '';
              const imgSrc =
                img && !img.startsWith('http') ? `http://127.0.0.1:5000${img}` : img;

              return (
                <div
                  key={p.id}
                  className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 hover:shadow-md transition"
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                    <div className="flex gap-4">
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt={p.name}
                          className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                        />
                      ) : (
                        <div className="w-20 h-20 flex items-center justify-center rounded-lg border border-dashed border-gray-300 text-gray-400 text-xs">
                          —
                        </div>
                      )}

                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {p.name}{' '}
                          <span className="text-xs font-normal text-gray-500">#{p.id}</span>
                        </h3>
                        <p className="text-sm text-gray-600">
                          {Number(p.price || 0).toLocaleString()} {formatCurrency(p.currency || 'XOF')}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Stock : {p.stock ?? 0}
                          {cat ? (
                            <>
                              {' '}• Catégorie : <span className="font-medium">{cat.name}</span>
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
                    <p className="mt-3 text-sm text-gray-700">{p.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
