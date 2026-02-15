/* eslint-disable jsx-a11y/img-redundant-alt */
// frontend/src/pages/AdminProductsPage.jsx
import { useEffect, useState, useMemo } from "react";
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../services/products";
import { getCountries } from "../services/countries";
import { getRegions } from "../services/regions";
import { getCategories } from "../services/categories";
import { me } from "../services/auth";
import { formatCurrency } from "../utils/labels";
import { normalizeRole, prettyRoleLabel, isGlobalAdminUser } from "../utils/roles";
import { useLocale } from "../i18n/useLocale";
import { useTranslation } from "react-i18next";

/* ============================================================
   🌍 CONFIG PRODUCTION
============================================================ */
const FILE_BASE =
  (typeof window !== "undefined" &&
    (window.__TERANGA_FILE_BASE_URL ||
      window.__TERANGA_API_BASE_URL ||
      "")) ||
  "";

function toAbsUrl(path = "") {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return (
    FILE_BASE.replace(/\/$/, "") + "/" + String(path).replace(/^\//, "")
  );
}

/* ============================================================
   🖼 Helper : récupérer toutes les images d’un produit
   (allImageUrls, gallery, coverImage, imageUrl)
============================================================ */
function getProductImages(product) {
  if (!product) return [];

  const urls = [];

  // 1) allImageUrls (backend withLabels)
  if (Array.isArray(product.allImageUrls)) {
    urls.push(...product.allImageUrls);
  }

  // 2) gallery : [{ url }, "string", ...]
  if (Array.isArray(product.gallery)) {
    product.gallery.forEach((g) => {
      if (g && typeof g === "object" && g.url) {
        urls.push(g.url);
      } else if (typeof g === "string") {
        urls.push(g);
      }
    });
  }

  // 3) coverImage : string ou { url }
  if (product.coverImage) {
    if (typeof product.coverImage === "string") {
      urls.unshift(product.coverImage);
    } else if (product.coverImage.url) {
      urls.unshift(product.coverImage.url);
    }
  }

  // 4) imageUrl (compat)
  if (product.imageUrl) {
    urls.unshift(product.imageUrl);
  }

  // Déduplication + normalisation en URL absolues
  const seen = new Set();
  return urls
    .map((u) => toAbsUrl(u))
    .filter((u) => u && !seen.has(u) && seen.add(u));
}

/* ============================================================
   ⭐ ADMIN PRODUITS — Apple Light Premium (Table + Miniature)
============================================================ */
export default function AdminProductsPage() {
  const { formatNumber } = useLocale();
  const { t } = useTranslation();
  const [user, setUser] = useState(null);
  const [countries, setCountries] = useState([]);
  const [regions, setRegions] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    currency: "XOF",
    stock: 0,
    categoryId: "",
    imageFile: null,
    imageFiles: [],
  });

  const [previewCoverUrl, setPreviewCoverUrl] = useState("");
  const [previewGalleryUrls, setPreviewGalleryUrls] = useState([]);

  const isGlobalAdmin = isGlobalAdminUser(user);

  const countriesById = useMemo(() => {
    const map = new Map();
    (countries || []).forEach((c) => map.set(String(c.id), c));
    return map;
  }, [countries]);

  const regionsById = useMemo(() => {
    const map = new Map();
    (regions || []).forEach((r) => map.set(String(r.id), r));
    return map;
  }, [regions]);

  const getGeoLabel = useMemo(() => {
    return (entity) => {
      if (!entity) return "";
      const countryId =
        entity.countryId ?? entity.country?.id ?? entity.country_id ?? null;
      const regionId =
        entity.regionId ?? entity.region?.id ?? entity.region_id ?? null;

      const countryName =
        entity.country?.name ||
        countriesById.get(String(countryId))?.name ||
        "";
      const regionName =
        entity.region?.name ||
        regionsById.get(String(regionId))?.name ||
        "";

      const countryLabel =
        countryName ||
        (countryId ? `${t("common.countryLabel")} #${countryId}` : "");
      const regionLabel =
        regionName ||
        (regionId ? `${t("common.regionLabel")} #${regionId}` : "");

      if (countryLabel && regionLabel) return `${countryLabel} • ${regionLabel}`;
      return countryLabel || regionLabel || "";
    };
  }, [countriesById, regionsById, t]);

  /* ============================================================
     LIGHTBOX (Premium + responsive)
  ============================================================ */
  const [lightbox, setLightbox] = useState({
    open: false,
    product: null,
    index: 0,
  });

  function openLightbox(product, index = 0) {
    if (!product) return;

    const imgs = getProductImages(product);
    if (!imgs.length) return;

    setLightbox({
      open: true,
      product: { ...product, _images: imgs },
      index: Math.min(index, imgs.length - 1),
    });
  }

  function closeLightbox() {
    setLightbox({ open: false, product: null, index: 0 });
  }

  function goPrev() {
    if (!lightbox.product) return;
    const imgs = lightbox.product._images || [];
    if (!imgs.length) return;
    setLightbox((lb) => ({
      ...lb,
      index: (lb.index - 1 + imgs.length) % imgs.length,
    }));
  }

  function goNext() {
    if (!lightbox.product) return;
    const imgs = lightbox.product._images || [];
    if (!imgs.length) return;
    setLightbox((lb) => ({
      ...lb,
      index: (lb.index + 1) % imgs.length,
    }));
  }

  /* ============================================================
     INIT
  ============================================================ */
  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const u = await me();
        if (!mounted) return;
        const current = u?.user;
        if (!current) {
          window.location.href = "/login";
          return;
        }
        if (normalizeRole(current.role) !== "admin") {
          window.location.href = "/dashboard";
          return;
        }
        setUser(current);
        await Promise.all([loadCategories(), loadProducts()]);
      } catch (err) {
        console.error("❌ init AdminProductsPage:", err);
        if (!mounted) return;
        window.location.href = "/login";
      }
    }
    init();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isGlobalAdmin) return;
    let mounted = true;
    (async () => {
      try {
        const [cList, rList] = await Promise.all([
          getCountries({ limit: 500 }),
          getRegions({ limit: 1000 }),
        ]);
        if (!mounted) return;
        setCountries(Array.isArray(cList) ? cList : []);
        setRegions(Array.isArray(rList) ? rList : []);
      } catch (e) {
        console.error("❌ Erreur chargement pays/régions:", e);
        if (mounted) {
          setCountries([]);
          setRegions([]);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isGlobalAdmin]);

  async function loadProducts() {
    setLoading(true);
    try {
      const res = await getProducts({ limit: 200 });

      // Compat: certains services renvoient {products, pagination}
      const list = Array.isArray(res) ? res : res?.products;

      setProducts(list || []);
    } catch (e) {
      console.error("❌ Erreur chargement produits:", e);
      alert(t("adminProductsPage.alerts.loadProductsError"));
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const res = await getCategories({ limit: 200 });

      // Compat: certains services renvoient {categories, pagination}
      const list = Array.isArray(res) ? res : res?.categories;

      setCategories(list || []);
    } catch (e) {
      console.error("❌ Erreur chargement catégories:", e);
      setCategories([]);
    }
  }

  /* ============================================================
     FORM HANDLERS
  ============================================================ */
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

    if (previewCoverUrl) URL.revokeObjectURL(previewCoverUrl);
    previewGalleryUrls.forEach((u) => URL.revokeObjectURL(u));

    setPreviewCoverUrl("");
    setPreviewGalleryUrls([]);
  }

  function handleCoverChange(file) {
    if (previewCoverUrl) URL.revokeObjectURL(previewCoverUrl);
    setForm((f) => ({ ...f, imageFile: file }));
    setPreviewCoverUrl(file ? URL.createObjectURL(file) : "");
  }

  function handleGalleryChange(files) {
    previewGalleryUrls.forEach((u) => URL.revokeObjectURL(u));
    const arr = Array.from(files || []).slice(0, 3);
    setForm((f) => ({ ...f, imageFiles: arr }));
    setPreviewGalleryUrls(arr.map((f) => URL.createObjectURL(f)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (!form.name.trim())
        return alert(t("adminProductsPage.alerts.nameRequired"));
      if (form.price === "")
        return alert(t("adminProductsPage.alerts.priceRequired"));

      const payload = {
        ...form,
        price: Number(form.price),
        stock: Number(form.stock),
        categoryId: form.categoryId ? Number(form.categoryId) : "",
      };

      if (editing) {
        await updateProduct(editing.id, payload);
        alert(t("adminProductsPage.alerts.updateSuccess"));
      } else {
        await createProduct(payload);
        alert(t("adminProductsPage.alerts.createSuccess"));
      }

      resetForm();
      await loadProducts();
      setShowForm(false);
    } catch (err) {
      console.error("❌ Erreur sauvegarde produit:", err);
      const status = err?.response?.status;
      const apiMessage =
        err?.response?.data?.error || err?.response?.data?.message || "";
      const fallback = err?.message || "";
      const detail = apiMessage || fallback;
      const statusHint =
        status === 401
          ? t("common.sessionExpired", {
              defaultValue: "Session expirée. Veuillez vous reconnecter.",
            })
          : status === 403
            ? t("common.accessDenied", {
                defaultValue: "Accès interdit pour cette action.",
              })
            : "";
      const suffix = [statusHint, detail]
        .filter(Boolean)
        .map((msg) => `\n${msg}`)
        .join("");
      alert(`${t("adminProductsPage.alerts.saveError")}${suffix}`);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm(t("adminProductsPage.alerts.deleteConfirm"))) return;

    try {
      await deleteProduct(`${id}?force=true`);
      await loadProducts();
      alert(t("adminProductsPage.alerts.deleteSuccess"));
    } catch (err) {
      console.error("❌ Erreur suppression :", err);
      alert(t("adminProductsPage.alerts.deleteError"));
    }
  }

  function handleEdit(p) {
    setEditing(p);
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

    setPreviewCoverUrl("");
    setPreviewGalleryUrls([]);
    setShowForm(true);
  }

  /* ============================================================
     FILTRAGE
  ============================================================ */
  const categoriesById = useMemo(() => {
    const m = new Map();
    categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [categories]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) => (p.name || "").toLowerCase().includes(term));
  }, [products, search]);

  /* ============================================================
     RENDER
  ============================================================ */
  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <p className="text-gray-600 text-lg animate-pulse">
          {t("adminProductsPage.loading")}
        </p>
      </div>
    );
  }

  const roleLabel = prettyRoleLabel(user);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-3 sm:px-4 py-8 sm:py-10">
      <div className="max-w-6xl mx-auto bg-white rounded-3xl shadow-xl p-4 sm:p-6 md:p-8 border border-slate-100">
        {/* ============================================
            HEADER
        ============================================ */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              📦 {t("adminProductsPage.header.title")}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              {t("adminProductsPage.header.connectedLabel")}{" "}
              <strong>{user.email}</strong> ({roleLabel})
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowForm((v) => !v)}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-sm font-semibold shadow-sm"
            >
              {showForm
                ? `➖ ${t("adminProductsPage.buttons.hideForm")}`
                : `➕ ${t("adminProductsPage.buttons.newProduct")}`}
            </button>

            <button
              disabled={loading}
              onClick={loadProducts}
              className={`px-4 py-2 rounded-xl text-sm font-semibold shadow-sm ${
                loading
                  ? "bg-blue-300 cursor-not-allowed text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {loading
                ? t("adminProductsPage.buttons.refreshLoading")
                : `🔄 ${t("adminProductsPage.buttons.refresh")}`}
            </button>
          </div>
        </div>

        {/* ============================================
            BARRE DE RECHERCHE
        ============================================ */}
        <div className="mb-6">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              🔍
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("adminProductsPage.search.placeholder")}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {t("adminProductsPage.search.count", {
              count: filteredProducts.length,
              total: products.length,
            })}
          </p>
        </div>

        {/* ============================================
            FORMULAIRE PRODUIT
        ============================================ */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-8 bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-5"
          >
            {/* NOM */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-700">
                {t("adminProductsPage.form.nameLabel")} *
              </label>
              <input
                value={form.name}
                required
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* PRIX */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-700">
                {t("adminProductsPage.form.priceLabel")} *
              </label>
              <input
                type="number"
                required
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* DEVISE */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-700">
                {t("adminProductsPage.form.currencyLabel")}
              </label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="XOF">{t("currency.XOF")}</option>
                <option value="EUR">{t("currency.EUR")}</option>
                <option value="USD">{t("currency.USD")}</option>
              </select>
            </div>

            {/* STOCK */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-700">
                {t("adminProductsPage.form.stockLabel")}
              </label>
              <input
                type="number"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              />
            </div>

            {/* CATÉGORIE */}
            <div className="md:col-span-2 flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-700">
                {t("adminProductsPage.form.categoryLabel")}
              </label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">{t("adminProductsPage.form.categoryNone")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* DESCRIPTION */}
            <div className="md:col-span-2 flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-700">
                {t("adminProductsPage.form.descriptionLabel")}
              </label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[80px] resize-y"
              ></textarea>
            </div>

            {/* IMAGE PRINCIPALE */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-700">
                {t("adminProductsPage.form.coverLabel")}
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleCoverChange(e.target.files?.[0] || null)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              />
            </div>

            <div className="flex items-center">
              {previewCoverUrl ? (
                <img
                  src={previewCoverUrl}
                  alt={t("adminProductsPage.form.coverAlt")}
                  className="w-24 h-24 object-cover rounded-xl border"
                />
              ) : (
                <div className="w-24 h-24 border border-dashed rounded-xl flex items-center justify-center text-xs text-slate-400">
                  {t("adminProductsPage.form.coverEmpty")}
                </div>
              )}
            </div>

            {/* GALERIE */}
            <div className="md:col-span-2 flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-700">
                {t("adminProductsPage.form.galleryLabel")}
              </label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => handleGalleryChange(e.target.files)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              />
            </div>

            <div className="md:col-span-2 flex gap-2 flex-wrap">
              {previewGalleryUrls.map((u, i) => (
                <img
                  key={i}
                  src={u}
                  alt={t("adminProductsPage.form.galleryAlt", { index: i + 1 })}
                  className="w-20 h-20 rounded-xl border object-cover"
                />
              ))}
            </div>

            {/* ACTIONS */}
            <div className="md:col-span-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 hover:bg-slate-300 text-sm font-semibold"
              >
                {t("adminProductsPage.form.reset")}
              </button>

              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm text-sm font-semibold"
              >
                {editing
                  ? `💾 ${t("adminProductsPage.form.update")}`
                  : `➕ ${t("adminProductsPage.form.create")}`}
              </button>
            </div>
          </form>
        )}

         {/* ============================================================
            TABLEAU DES PRODUITS — Option A1 (Miniature Apple Light)
        ============================================================ */}
        <div className="mt-4">
          <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                    {t("adminProductsPage.table.product")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                    {t("adminProductsPage.table.price")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                    {t("adminProductsPage.table.stock")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                    {t("adminProductsPage.table.category")}
                  </th>
                  {isGlobalAdmin && (
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                      {t("common.locationLabel")}
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                    {t("adminProductsPage.table.actions")}
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isGlobalAdmin ? 6 : 5}
                      className="py-6 text-center text-slate-500 text-sm italic"
                    >
                      {t("adminProductsPage.table.empty")}
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const images = getProductImages(p);
                    const mainImg = images[0] || "";
                    const cat =
                      p.category || categoriesById.get(p.categoryId);

                    return (
                      <tr
                        key={p.id}
                        className="border-t border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        {/* PRODUIT */}
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => openLightbox(p, 0)}
                              className="w-14 h-14 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 flex-shrink-0 hover:border-blue-400 transition"
                            >
                              {mainImg ? (
                                <img
                                  src={mainImg}
                                  alt={p.name}
                                  className="object-cover w-full h-full"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">
                                  {t("adminProductsPage.table.noImage")}
                                </div>
                              )}
                            </button>

                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 truncate">
                                {p.name || t("common.dash")}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-1">
                                {t("adminProductsPage.table.id", { id: p.id })}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* PRIX */}
                        <td className="px-4 py-3 align-top whitespace-nowrap">
                          <div className="font-semibold text-slate-900">
                            {formatNumber(p.price || 0)}{" "}
                            {formatCurrency(p.currency)}
                          </div>
                        </td>

                        {/* STOCK */}
                        <td className="px-4 py-3 align-top whitespace-nowrap">
                          <span className="text-sm text-slate-800">
                            {p.stock ?? 0}
                          </span>
                        </td>

                        {/* CATÉGORIE */}
                        <td className="px-4 py-3 align-top">
                          <span className="text-sm text-slate-800">
                            {cat ? cat.name : t("common.dash")}
                          </span>
                        </td>

                        {isGlobalAdmin && (
                          <td className="px-4 py-3 align-top">
                            <span className="text-xs text-slate-600 break-words line-clamp-2">
                              {getGeoLabel(p) || t("common.dash")}
                            </span>
                          </td>
                        )}

                        {/* ACTIONS */}
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(p)}
                              className="px-3 py-1.5 text-xs rounded-xl bg-amber-500 text-white hover:bg-amber-600"
                            >
                              ✏️ {t("adminProductsPage.table.edit")}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(p.id)}
                              className="px-3 py-1.5 text-xs rounded-xl bg-red-600 text-white hover:bg-red-700"
                            >
                              🗑 {t("adminProductsPage.table.delete")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ============================================================
          LIGHTBOX PREMIUM (navigation active)
      ============================================================ */}
      {lightbox.open && lightbox.product && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4 select-none">
          <div
            className="relative bg-black rounded-2xl max-w-3xl w-full border border-slate-700 overflow-hidden"
            role="dialog"
            aria-label={t("adminProductsPage.lightbox.ariaLabel")}
          >
            {/* Bouton fermer */}
            <button
              onClick={closeLightbox}
              className="absolute top-3 right-3 z-50 bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-full text-sm font-semibold backdrop-blur-md"
              aria-label={t("adminProductsPage.lightbox.close")}
            >
              ✕
            </button>

            {/* Navigation gauche */}
            {lightbox.product._images.length > 1 && (
              <button
                onClick={goPrev}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-full text-lg backdrop-blur-md"
                aria-label={t("adminProductsPage.lightbox.prev")}
              >
                ◀
              </button>
            )}

            {/* Image */}
            <div className="flex items-center justify-center p-4">
              <img
                src={lightbox.product._images[lightbox.index]}
                className="max-h-[75vh] max-w-full object-contain rounded-lg"
                alt={t("adminProductsPage.lightbox.imageAlt", {
                  index: lightbox.index + 1,
                })}
              />
            </div>

            {/* Navigation droite */}
            {lightbox.product._images.length > 1 && (
              <button
                onClick={goNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-full text-lg backdrop-blur-md"
                aria-label={t("adminProductsPage.lightbox.next")}
              >
                ▶
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


