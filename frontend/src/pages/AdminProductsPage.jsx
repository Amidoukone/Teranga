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
   ⭐ PAGE ADMIN PRODUITS — VERSION PREMIUM & RESPONSIVE
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

  // Filtre (recherche texte locale)
  const [search, setSearch] = useState("");

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
      if (previewCoverUrl) {
        try {
          URL.revokeObjectURL(previewCoverUrl);
        } catch {}
      }
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
      console.error("❌ loadProducts:", e);
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
      console.error("❌ deleteProduct:", e);
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
     🔍 Filtrage local produits (par nom)
  ============================================================= */
  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) =>
      String(p.name || "")
        .toLowerCase()
        .includes(term)
    );
  }, [products, search]);

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
     🧱 UI — Loader initial
  ============================================================= */
  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-50">
        <p className="text-slate-600 text-lg animate-pulse">
          Chargement…
        </p>
      </div>
    );
  }

  // 🔚 FIN PARTIE 1/2 — la suite contient tout le JSX du rendu principal

    return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-3 sm:px-4 py-8 sm:py-10">
      <div className="max-w-6xl mx-auto bg-white rounded-3xl shadow-xl p-4 sm:p-6 md:p-8 border border-slate-100">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="space-y-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 break-words">
              📦 Gestion des produits
            </h1>
            <p className="text-xs sm:text-sm text-slate-600">
              Connecté en tant que{" "}
              <span className="font-semibold">{user.email}</span> (
              {user.role})
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center justify-center px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl shadow-sm bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 transition"
            >
              {showForm ? "➖ Masquer le formulaire" : "➕ Nouveau produit"}
            </button>

            <button
              disabled={loading}
              onClick={loadProducts}
              className={`inline-flex items-center justify-center px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition ${
                loading
                  ? "bg-blue-200 text-blue-800 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"
              }`}
            >
              {loading ? "Chargement…" : "🔄 Rafraîchir"}
            </button>
          </div>
        </div>

        {/* BARRE DE RECHERCHE */}
        <div className="mb-6">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400 text-sm">
              🔍
            </span>
            <input
              type="text"
              placeholder="Rechercher un produit par nom…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {filteredProducts.length} produit
            {filteredProducts.length > 1 ? "s" : ""} affiché
            {search.trim() ? " (filtré)" : ""}.
          </p>
        </div>

        {/* FORMULAIRE PRODUIT */}
        {showForm && (
          <section className="mb-8">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 md:p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-800 mb-4">
                {editing ? "✏️ Modifier le produit" : "➕ Nouveau produit"}
              </h2>

              <form
                onSubmit={handleSubmit}
                className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5"
              >
                {/* NOM */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-700">
                    Nom <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={form.name}
                    required
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>

                {/* PRIX */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-700">
                    Prix <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={form.price}
                    required
                    onChange={(e) =>
                      setForm({ ...form, price: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>

                {/* DEVISE */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-700">
                    Devise
                  </label>
                  <select
                    value={form.currency}
                    onChange={(e) =>
                      setForm({ ...form, currency: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="XOF">Franc CFA (XOF)</option>
                    <option value="EUR">Euro (EUR)</option>
                    <option value="USD">Dollar (USD)</option>
                  </select>
                </div>

                {/* STOCK */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-700">
                    Stock
                  </label>
                  <input
                    type="number"
                    value={form.stock}
                    onChange={(e) =>
                      setForm({ ...form, stock: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>

                {/* CATÉGORIE */}
                <div className="md:col-span-2 flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-700">
                    Catégorie
                  </label>
                  <select
                    value={form.categoryId}
                    onChange={(e) =>
                      setForm({ ...form, categoryId: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
                <div className="md:col-span-2 flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-700">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-y min-h-[80px]"
                  ></textarea>
                </div>

                {/* IMAGE PRINCIPALE + PREVIEW */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-700">
                    Image principale
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      handleCoverChange(e.target.files?.[0] || null)
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Formats recommandés : JPG, PNG. Taille raisonnable pour
                    alléger le chargement.
                  </p>
                </div>

                <div className="flex items-center md:justify-start">
                  {previewCoverUrl ? (
                    <img
                      src={previewCoverUrl}
                      alt="Prévisualisation image principale"
                      className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-xl border border-slate-200"
                    />
                  ) : (
                    <div className="w-24 h-24 sm:w-28 sm:h-28 border border-dashed border-slate-300 rounded-xl flex items-center justify-center text-[11px] text-slate-400 bg-white">
                      Aucun aperçu
                    </div>
                  )}
                </div>

                {/* GALERIE */}
                <div className="md:col-span-2 flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-700">
                    Galerie (max 3 images)
                  </label>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleGalleryChange(e.target.files)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Ajoute quelques images supplémentaires pour mieux présenter
                    le produit (facultatif).
                  </p>
                </div>

                <div className="md:col-span-2 flex flex-wrap gap-2">
                  {previewGalleryUrls.length === 0 && (
                    <span className="text-[11px] text-slate-400">
                      Aucune image galerie sélectionnée.
                    </span>
                  )}
                  {previewGalleryUrls.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Prévisualisation galerie ${i + 1}`}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border border-slate-200 object-cover"
                    />
                  ))}
                </div>

                {/* ACTIONS */}
                <div className="md:col-span-2 flex flex-wrap justify-end gap-2 pt-1">
                  {editing && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="inline-flex items-center justify-center px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200"
                    >
                      Annuler la modification
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={resetForm}
                    className="inline-flex items-center justify-center px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200"
                  >
                    Réinitialiser
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center px-4 sm:px-5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm"
                  >
                    {editing ? "💾 Mettre à jour" : "➕ Ajouter"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* LISTE PRODUITS */}
        <section>
          <h2 className="text-sm font-semibold text-slate-800 mb-3">
            Produits ({filteredProducts.length})
          </h2>

          {filteredProducts.length === 0 ? (
            <div className="border border-dashed border-slate-300 rounded-2xl p-6 text-center text-sm text-slate-500 bg-slate-50">
              Aucun produit trouvé
              {search.trim()
                ? " pour cette recherche."
                : ". Utilise le bouton “Nouveau produit” pour en ajouter un."}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProducts.map((p) => {
                const allAbs = (p.allImageUrls || []).map(toAbsUrl) || [];
                const imgMain =
                  allAbs[0] || toAbsUrl(p.imageUrl || p.image || "");

                const cat =
                  p.category || categoriesById.get(p.categoryId);

                return (
                  <article
                    key={p.id}
                    className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-5"
                  >
                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-between">
                      {/* Image + infos */}
                      <div className="flex gap-4 min-w-0">
                        <button
                          type="button"
                          onClick={() => openLightbox(p, 0)}
                          className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 hover:border-blue-400 transition"
                        >
                          {imgMain ? (
                            <img
                              src={imgMain}
                              alt={p.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex items-center justify-center w-full h-full text-xs text-slate-400">
                              Pas d'image
                            </div>
                          )}
                        </button>

                        <div className="min-w-0 space-y-1">
                          <h3 className="text-sm sm:text-base font-semibold text-slate-900 truncate">
                            {p.name}{" "}
                            <span className="text-[11px] text-slate-400">
                              #{p.id}
                            </span>
                          </h3>

                          <p className="text-sm text-slate-800 font-medium">
                            {Number(p.price || 0).toLocaleString("fr-FR")}{" "}
                            {formatCurrency(p.currency)}
                          </p>

                          <p className="text-[11px] text-slate-500">
                            Stock :{" "}
                            <span className="font-medium">{p.stock}</span>
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

                      {/* Actions */}
                      <div className="flex sm:flex-col gap-2 sm:items-end shrink-0">
                        <button
                          onClick={() => handleEdit(p)}
                          className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-xl bg-amber-500 text-white hover:bg-amber-600"
                        >
                          ✏️ Modifier
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-xl bg-rose-600 text-white hover:bg-rose-700"
                        >
                          🗑 Supprimer
                        </button>
                      </div>
                    </div>

                    {p.description && (
                      <p className="mt-3 text-xs sm:text-sm text-slate-700 whitespace-pre-line break-words">
                        {p.description}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ====================== LIGHTBOX ====================== */}
      {lightbox.open && lightbox.product && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-3 sm:px-4">
          <div className="bg-black rounded-2xl max-w-3xl w-full overflow-hidden border border-slate-700">
            <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-slate-700 text-white text-xs sm:text-sm">
              <span className="truncate font-semibold">
                {lightbox.product.name}
              </span>
              <button
                className="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-[11px]"
                onClick={closeLightbox}
              >
                ✖ Fermer
              </button>
            </div>

            <div className="relative flex items-center justify-center p-3 sm:p-4">
              <img
                src={lightbox.product._images[lightbox.index] || ""}
                alt="Agrandissement image produit"
                className="max-h-[70vh] max-w-[90vw] object-contain"
              />

              {lightbox.product._images.length > 1 && (
                <>
                  <button
                    onClick={goPrev}
                    className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 bg-black/60 text-white px-3 py-2 rounded-full text-sm"
                  >
                    ◀
                  </button>

                  <button
                    onClick={goNext}
                    className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 bg-black/60 text-white px-3 py-2 rounded-full text-sm"
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
