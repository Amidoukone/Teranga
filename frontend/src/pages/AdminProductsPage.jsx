/* eslint-disable jsx-a11y/img-redundant-alt */
// frontend/src/pages/AdminProductsPage.jsx
import { useEffect, useState, useMemo } from "react";
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../services/products";
import { getCategories } from "../services/categories";
import { me } from "../services/auth";
import { formatCurrency } from "../utils/labels";

/* ============================================================
   🌍 CONFIG PRODUCTION (Option A)
   - Utilise FILE_BASE / API_BASE du runtime (injecté via index.html)
   - Aucun localhost en dur
============================================================ */
const FILE_BASE =
  (typeof window !== "undefined" &&
    (window.__TERANGA_FILE_BASE_URL ||
      window.__TERANGA_API_BASE_URL ||
      "")) ||
  "";

/* Normalisation des URLs absolues */
function toAbsUrl(path = "") {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return (
    FILE_BASE.replace(/\/$/, "") + "/" + String(path).replace(/^\//, "")
  );
}

/* ============================================================
   ⭐ PAGE ADMIN PRODUITS — VERSION PRODUCTION READY
============================================================ */
export default function AdminProductsPage() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    currency: "XOF",
    stock: 0,
    categoryId: "",
    imageFile: null, // file cover
    imageFiles: [], // file[] gallery
  });

  // Prévisualisations
  const [previewCoverUrl, setPreviewCoverUrl] = useState("");
  const [previewGalleryUrls, setPreviewGalleryUrls] = useState([]);

  // Lightbox
  const [lightbox, setLightbox] = useState({
    open: false,
    product: null,
    index: 0,
  });

  /* ============================================================
     🔄 Initialisation
  ============================================================= */
  useEffect(() => {
    async function init() {
      try {
        const u = await me();
        setUser(u.user);
        await Promise.all([loadCategories(), loadProducts()]);
      } catch (err) {
        console.error("❌ init AdminProductsPage:", err);
      }
    }
    init();
  }, []);

  // Nettoyage des URL de preview
  useEffect(() => {
    return () => {
      if (previewCoverUrl) URL.revokeObjectURL(previewCoverUrl);
      previewGalleryUrls.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {}
      });
    };
  }, [previewCoverUrl, previewGalleryUrls]);

  /* ============================================================
     📦 Loaders
  ============================================================= */
  async function loadProducts() {
    setLoading(true);
    try {
      const prods = await getProducts({ limit: 200 });
      setProducts(prods || []);
    } catch (e) {
      alert("Erreur chargement produits");
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const cats = await getCategories({ limit: 200 });
      setCategories(cats || []);
    } catch (err) {
      console.error("❌ loadCategories:", err);
      setCategories([]);
    }
  }

  /* ============================================================
     🧹 Reset form
  ============================================================= */
  function resetForm() {
    setForm({
      name: "",
      description: "",
      price: "",
      currency: "XOF",
      stock: 0,
      categoryId: "",
      imageFile: null,
      imageFiles: [],
    });
    setEditing(null);
    setPreviewCoverUrl("");
    setPreviewGalleryUrls([]);
  }

  /* ============================================================
     🖼 COVER
  ============================================================= */
  function handleCoverChange(file) {
    setForm((f) => ({ ...f, imageFile: file || null }));
    setPreviewCoverUrl((old) => {
      if (old) {
        try {
          URL.revokeObjectURL(old);
        } catch {}
      }
      return file ? URL.createObjectURL(file) : "";
    });
  }

  /* ============================================================
     🖼 GALERIE (max 3 images)
  ============================================================= */
  function handleGalleryChange(fileList) {
    const list = Array.from(fileList || []).slice(0, 3);

    setForm((f) => ({ ...f, imageFiles: list }));

    previewGalleryUrls.forEach((u) => {
      try {
        URL.revokeObjectURL(u);
      } catch {}
    });

    setPreviewGalleryUrls(list.map((f) => URL.createObjectURL(f)));
  }

  /* ============================================================
     💾 SUBMIT
  ============================================================= */
  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (!form.name || form.price === "") {
        alert("Nom et prix obligatoires");
        return;
      }

      const payload = {
        ...form,
        price: Number(form.price),
        stock: Number(form.stock || 0),
        categoryId: form.categoryId ? Number(form.categoryId) : "",
      };

      if (editing) {
        await updateProduct(editing.id, payload);
        alert("Produit mis à jour");
      } else {
        await createProduct(payload);
        alert("Produit ajouté");
      }

      resetForm();
      await loadProducts();
      setShowForm(false);
    } catch (e) {
      console.error("❌ handleSubmit:", e);
      alert("Erreur enregistrement produit");
    }
  }

  /* ============================================================
     🗑 SUPPRESSION
  ============================================================= */
  async function handleDelete(id) {
    if (!window.confirm("Supprimer ce produit ?")) return;
    try {
      await deleteProduct(`${id}?force=true`);
      await loadProducts();
      alert("Produit supprimé");
    } catch (e) {
      alert("Erreur suppression");
    }
  }

  /* ============================================================
     ✏️ EDIT
  ============================================================= */
  function handleEdit(p) {
    setForm({
      name: p.name || "",
      description: p.description || "",
      price: p.price ?? "",
      currency: (p.currency || "XOF").toUpperCase(),
      stock: p.stock ?? 0,
      categoryId: p.categoryId ? String(p.categoryId) : "",
      imageFile: null,
      imageFiles: [],
    });

    setEditing(p);
    setPreviewCoverUrl("");
    setPreviewGalleryUrls([]);
    setShowForm(true);
  }

  /* ============================================================
     📌 Mapping catégories
  ============================================================= */
  const categoriesById = useMemo(() => {
    const m = new Map();
    categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [categories]);

  /* ============================================================
     🔍 Lightbox
  ============================================================= */
  function openLightbox(product, index = 0) {
    if (!product) return;

    // Convertit toutes les URLs en absolues
    const imgs = (product.allImageUrls || [])
      .map(toAbsUrl)
      .filter(Boolean);

    const fallback = product.imageUrl ? [toAbsUrl(product.imageUrl)] : [];
    const final = imgs.length ? imgs : fallback;

    if (!final.length) return;

    setLightbox({
      open: true,
      product: { ...product, _images: final },
      index: Math.max(0, Math.min(index, final.length - 1)),
    });
  }

  function goPrev() {
    const imgs = lightbox.product?._images || [];
    if (!imgs.length) return;
    setLightbox((lb) => ({
      ...lb,
      index: (lb.index - 1 + imgs.length) % imgs.length,
    }));
  }

  function goNext() {
    const imgs = lightbox.product?._images || [];
    if (!imgs.length) return;
    setLightbox((lb) => ({
      ...lb,
      index: (lb.index + 1) % imgs.length,
    }));
  }

  function closeLightbox() {
    setLightbox({ open: false, product: null, index: 0 });
  }

  /* ============================================================
     🧱 UI
  ============================================================= */
  if (!user)
    return (
      <div className="flex justify-center items-center min-h-screen">
        Chargement…
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 py-10">
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-xl p-8 border">

        {/* HEADER */}
        <div className="flex justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">📦 Gestion des produits</h1>
            <p className="text-sm text-gray-600">
              Connecté : <strong>{user.email}</strong> ({user.role})
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowForm((v) => !v)}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg"
            >
              {showForm ? "➖ Masquer" : "➕ Nouveau"}
            </button>

            <button
              disabled={loading}
              onClick={loadProducts}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg"
            >
              🔄 Rafraîchir
            </button>
          </div>
        </div>

        {/* FORMULAIRE */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-5 rounded-xl border mb-10"
          >
            {/* NOM */}
            <div>
              <label className="text-sm font-medium">Nom</label>
              <input
                value={form.name}
                required
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            {/* PRIX */}
            <div>
              <label className="text-sm font-medium">Prix</label>
              <input
                type="number"
                value={form.price}
                required
                onChange={(e) =>
                  setForm({ ...form, price: e.target.value })
                }
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            {/* DEVISE */}
            <div>
              <label className="text-sm font-medium">Devise</label>
              <select
                value={form.currency}
                onChange={(e) =>
                  setForm({ ...form, currency: e.target.value })
                }
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="XOF">Franc CFA</option>
                <option value="EUR">Euro</option>
                <option value="USD">Dollar</option>
              </select>
            </div>

            {/* STOCK */}
            <div>
              <label className="text-sm font-medium">Stock</label>
              <input
                type="number"
                value={form.stock}
                onChange={(e) =>
                  setForm({ ...form, stock: e.target.value })
                }
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            {/* CATÉGORIE */}
            <div className="col-span-2">
              <label className="text-sm font-medium">Catégorie</label>
              <select
                value={form.categoryId}
                onChange={(e) =>
                  setForm({ ...form, categoryId: e.target.value })
                }
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">— Sans catégorie —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* DESCRIPTION */}
            <div className="col-span-2">
              <label className="text-sm font-medium">Description</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className="w-full border rounded-lg px-3 py-2"
              ></textarea>
            </div>

            {/* IMAGE PRINCIPALE */}
            <div>
              <label className="text-sm font-medium">
                Image principale
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  handleCoverChange(e.target.files?.[0] || null)
                }
                className="w-full border rounded-lg px-3 py-2 bg-white"
              />
            </div>

            <div className="flex items-center">
              {previewCoverUrl ? (
                <img
                  src={previewCoverUrl}
                  alt="Prévisualisation image principale"
                  className="w-32 h-32 object-cover rounded border"
                />
              ) : (
                <div className="w-32 h-32 border border-dashed rounded flex items-center justify-center text-xs text-gray-400">
                  Aucun aperçu
                </div>
              )}
            </div>

            {/* GALERIE */}
            <div className="col-span-2">
              <label className="text-sm font-medium">
                Galerie (max 3)
              </label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => handleGalleryChange(e.target.files)}
                className="w-full border rounded-lg px-3 py-2 bg-white"
              />
            </div>

            <div className="col-span-2 flex gap-2">
              {previewGalleryUrls.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`Prévisualisation galerie ${i + 1}`}
                  className="w-20 h-20 rounded border object-cover"
                />
              ))}
            </div>

            {/* ACTIONS */}
            <div className="col-span-2 text-right">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-200 rounded-lg mr-2"
              >
                Réinitialiser
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 text-white rounded-lg"
              >
                {editing ? "💾 Mettre à jour" : "➕ Ajouter"}
              </button>
            </div>
          </form>
        )}

        {/* LISTE PRODUITS */}
        <div className="grid gap-6">
          {products.map((p) => {
            const allAbs =
              (p.allImageUrls || []).map(toAbsUrl) || [];
            const imgMain =
              allAbs[0] ||
              toAbsUrl(p.imageUrl || p.image || "");

            const cat =
              p.category || categoriesById.get(p.categoryId);

            return (
              <div
                key={p.id}
                className="bg-white border rounded-xl shadow-sm p-5"
              >
                <div className="flex justify-between">
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => openLightbox(p, 0)}
                      className="w-20 h-20 border rounded overflow-hidden"
                    >
                      {imgMain ? (
                        <img
                          src={imgMain}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center w-full h-full text-xs text-gray-400">
                          —
                        </div>
                      )}
                    </button>

                    <div>
                      <h3 className="text-lg font-semibold">
                        {p.name}{" "}
                        <span className="text-xs text-gray-500">
                          #{p.id}
                        </span>
                      </h3>
                      <p className="text-sm text-gray-700">
                        {Number(p.price).toLocaleString()}{" "}
                        {formatCurrency(p.currency)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Stock : {p.stock}
                        {cat && (
                          <>
                            {" "}
                            • Catégorie :{" "}
                            <span className="font-medium">
                              {cat.name}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(p)}
                      className="px-3 py-1 text-xs bg-yellow-500 text-white rounded"
                    >
                      ✏️ Modifier
                    </button>

                    <button
                      onClick={() => handleDelete(p.id)}
                      className="px-3 py-1 text-xs bg-red-600 text-white rounded"
                    >
                      🗑 Supprimer
                    </button>
                  </div>
                </div>

                {p.description && (
                  <p className="text-sm text-gray-700 mt-3">
                    {p.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ====================== LIGHTBOX ====================== */}
      {lightbox.open && lightbox.product && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4">
          <div className="bg-black rounded-2xl max-w-3xl w-full overflow-hidden border border-gray-700">

            <div className="flex justify-between items-center px-4 py-2 text-white border-b border-gray-700">
              <span className="truncate font-semibold">
                {lightbox.product.name}
              </span>
              <button
                className="px-2 py-1 bg-gray-700 rounded text-xs"
                onClick={closeLightbox}
              >
                ✖ Fermer
              </button>
            </div>

            <div className="relative flex items-center justify-center p-4">
              <img
                src={
                  lightbox.product._images[lightbox.index] ||
                  ""
                }
                alt="Agrandissement image produit"
                className="max-h-[70vh] max-w-[90vw] object-contain"
              />

              {lightbox.product._images.length > 1 && (
                <>
                  <button
                    onClick={goPrev}
                    className="absolute left-3 top-1/2 bg-black/60 text-white px-3 py-2 rounded-full"
                  >
                    ◀
                  </button>

                  <button
                    onClick={goNext}
                    className="absolute right-3 top-1/2 bg-black/60 text-white px-3 py-2 rounded-full"
                  >
                    ▶
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
