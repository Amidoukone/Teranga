/* eslint-disable jsx-a11y/img-redundant-alt */
// frontend/src/pages/AdminProductsPage.jsx
import { useEffect, useRef, useState, useMemo } from "react";
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
import { notify } from '../utils/notify';
import { useDeleteConfirm } from "../hooks/useDeleteConfirm";
import useFocusTrap from "../hooks/useFocusTrap";

/* ============================================================
   URLs API/fichiers (dev/prod).
============================================================ */
const FILE_BASE =
  (typeof window !== "undefined" &&
    (window.__TERANGA_FILE_BASE_URL ||
      (window.__TERANGA_API_BASE_URL
        ? window.__TERANGA_API_BASE_URL.replace(/\/api\/?$/, "")
        : "") ||
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
   Module: administration des produits.
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

 // Contexte: administration des produits.
  const seen = new Set();
  return urls
    .map((u) => toAbsUrl(u))
    .filter((u) => u && !seen.has(u) && seen.add(u));
}

/* ============================================================
   Sous-composant formulaire.
============================================================ */
export default function AdminProductsPage() {
  const { formatNumber } = useLocale();
  const { t } = useTranslation();
  const { confirmDelete } = useDeleteConfirm();
  const [user, setUser] = useState(null);
  const [countries, setCountries] = useState([]);
  const [regions, setRegions] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [search, setSearch] = useState("");
  const [geoFilters, setGeoFilters] = useState({
    countryId: "",
    regionId: "",
  });

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    currency: "XOF",
    stock: 0,
    categoryId: "",
    countryId: "",
    regionId: "",
    imageFile: null,
    imageFiles: [],
  });

  const [previewCoverUrl, setPreviewCoverUrl] = useState("");
  const [previewGalleryUrls, setPreviewGalleryUrls] = useState([]);

  const isGlobalAdmin = isGlobalAdminUser(user);

  function getRegionCountryId(region) {
    return region?.countryId ?? region?.country?.id ?? region?.country_id ?? null;
  }

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

  const availableRegions = useMemo(() => {
    if (!isGlobalAdmin) return [];
    const selectedCountryId = geoFilters.countryId ? String(geoFilters.countryId) : "";
    if (!selectedCountryId) return regions || [];

    return (regions || []).filter(
      (r) => String(getRegionCountryId(r) ?? "") === selectedCountryId
    );
  }, [regions, geoFilters.countryId, isGlobalAdmin]);

  const formAvailableRegions = useMemo(() => {
    if (!isGlobalAdmin) return [];
    const selectedCountryId = form.countryId ? String(form.countryId) : "";
    if (!selectedCountryId) return regions || [];

    return (regions || []).filter(
      (r) => String(getRegionCountryId(r) ?? "") === selectedCountryId
    );
  }, [regions, form.countryId, isGlobalAdmin]);

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

      if (countryLabel && regionLabel) return `${countryLabel} \u00B7 ${regionLabel}`;
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

  const lightboxRef = useRef(null);
  useFocusTrap({
    active: lightbox.open,
    containerRef: lightboxRef,
    onEscape: () => closeLightbox(),
  });

  useEffect(() => {
    if (!lightbox.open) return;

    function onKey(e) {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox.open, lightbox.index]);

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
        await loadCategories();
        if (!isGlobalAdminUser(current)) {
          await loadProducts();
        }
      } catch (err) {
        console.error("AdminProductsPage init error:", err);
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
        console.error("AdminProductsPage load countries/regions error:", e);
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

  useEffect(() => {
    if (!isGlobalAdmin) return;
    loadProducts(geoFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGlobalAdmin, geoFilters.countryId, geoFilters.regionId]);

  async function loadProducts(filters = geoFilters) {
    setLoading(true);
    try {
      const query = { limit: 200 };
      const countryId = Number(filters?.countryId);
      const regionId = Number(filters?.regionId);

      if (isGlobalAdmin && Number.isFinite(countryId) && countryId > 0) {
        query.countryId = countryId;
      }
      if (isGlobalAdmin && Number.isFinite(regionId) && regionId > 0) {
        query.regionId = regionId;
      }

      const res = await getProducts(query);

      // Compat: certains services renvoient {products, pagination}
      const list = Array.isArray(res) ? res : res?.products;
      const normalizedList = list || [];

      setProducts(normalizedList);
      return normalizedList;
    } catch (e) {
      console.error("AdminProductsPage load products error:", e);
      notify(t("adminProductsPage.alerts.loadProductsError"));
      setProducts([]);
      return [];
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
      console.error("AdminProductsPage load categories error:", e);
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
      countryId: "",
      regionId: "",
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

  function handleFormCountryChange(value) {
    setForm((prev) => {
      const nextCountryId = value || "";
      if (!prev.regionId) {
        return { ...prev, countryId: nextCountryId };
      }

      const region = regionsById.get(String(prev.regionId));
      const regionCountryId = region ? String(getRegionCountryId(region) ?? "") : "";
      const keepRegion =
        !nextCountryId || (regionCountryId && regionCountryId === String(nextCountryId));

      return {
        ...prev,
        countryId: nextCountryId,
        regionId: keepRegion ? prev.regionId : "",
      };
    });
  }

  function isTimeoutError(err) {
    if (!err) return false;
    if (err?.code === "ECONNABORTED") return true;
    const message = String(err?.message || "").toLowerCase();
    return message.includes("timeout") || message.includes("timed out");
  }

  function toIntOrNull(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function toComparableName(value) {
    return String(value || "").trim().toLowerCase();
  }

  function findMatchingSubmittedProduct(items, payload) {
    const targetName = toComparableName(payload?.name);
    const targetPrice = Number(payload?.price);
    const targetStock = Number(payload?.stock);
    const targetCategoryId = toIntOrNull(payload?.categoryId);
    const targetCountryId = toIntOrNull(payload?.countryId);
    const targetRegionId = toIntOrNull(payload?.regionId);

    return (items || []).find((item) => {
      if (toComparableName(item?.name) !== targetName) return false;
      if (Number(item?.price) !== targetPrice) return false;
      if (Number(item?.stock) !== targetStock) return false;
      if (toIntOrNull(item?.categoryId) !== targetCategoryId) return false;

      if (isGlobalAdmin) {
        const itemCountryId = toIntOrNull(item?.countryId ?? item?.country?.id);
        const itemRegionId = toIntOrNull(item?.regionId ?? item?.region?.id);

        if (targetCountryId && itemCountryId !== targetCountryId) {
          return false;
        }
        if (targetRegionId && itemRegionId !== targetRegionId) {
          return false;
        }
      }

      return true;
    });
  }

  async function confirmProductCreatedAfterTimeout(payload) {
    const timeoutFilters = isGlobalAdmin
      ? {
          countryId: payload?.countryId ? String(payload.countryId) : "",
          regionId: payload?.regionId ? String(payload.regionId) : "",
        }
      : geoFilters;
    const latestProducts = await loadProducts(timeoutFilters);
    return Boolean(findMatchingSubmittedProduct(latestProducts, payload));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (isSubmitting) return;

    const isUpdateMode = Boolean(editing);
    let payload = null;

    try {
      if (!form.name.trim())
        return notify(t("adminProductsPage.alerts.nameRequired"));
      if (form.price === "")
        return notify(t("adminProductsPage.alerts.priceRequired"));

      payload = {
        ...form,
        price: Number(form.price),
        stock: Number(form.stock),
        categoryId: form.categoryId ? Number(form.categoryId) : "",
      };

      if (!isGlobalAdmin) {
        delete payload.countryId;
        delete payload.regionId;
      }

      setIsSubmitting(true);

      if (isUpdateMode) {
        await updateProduct(editing.id, payload);
        notify(t("adminProductsPage.alerts.updateSuccess"));
      } else {
        await createProduct(payload);
        notify(t("adminProductsPage.alerts.createSuccess"));
      }

      resetForm();
      await loadProducts();
      setShowForm(false);
    } catch (err) {
      console.error("AdminProductsPage save product error:", err);

      if (!isUpdateMode && isTimeoutError(err)) {
        const createdAfterTimeout = await confirmProductCreatedAfterTimeout(payload);
        if (createdAfterTimeout) {
          notify(t("adminProductsPage.alerts.createSuccessAfterTimeout"));
          resetForm();
          setShowForm(false);
          return;
        }

        notify(t("adminProductsPage.alerts.createPendingAfterTimeout"));
        return;
      }

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
      notify(`${t("adminProductsPage.alerts.saveError")}${suffix}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id) {
    const ok = await confirmDelete("product");
    if (!ok) return;

    try {
      await deleteProduct(`${id}?force=true`);
      await loadProducts();
      notify(t("adminProductsPage.alerts.deleteSuccess"));
    } catch (err) {
      console.error("AdminProductsPage delete product error:", err);
      notify(t("adminProductsPage.alerts.deleteError"));
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
      countryId: p.countryId ? String(p.countryId) : (p.country?.id ? String(p.country.id) : ""),
      regionId: p.regionId ? String(p.regionId) : (p.region?.id ? String(p.region.id) : ""),
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

  function handleCountryFilterChange(value) {
    setGeoFilters((prev) => {
      const nextCountryId = value || "";
      if (!prev.regionId) {
        return { ...prev, countryId: nextCountryId };
      }

      const region = regionsById.get(String(prev.regionId));
      const regionCountryId = region ? String(getRegionCountryId(region) ?? "") : "";
      const keepRegion =
        !nextCountryId || (regionCountryId && regionCountryId === String(nextCountryId));

      return {
        countryId: nextCountryId,
        regionId: keepRegion ? prev.regionId : "",
      };
    });
  }

  function resetGeoFilters() {
    setGeoFilters({ countryId: "", regionId: "" });
  }

  /* ============================================================
     RENDER
  ============================================================ */
  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-surface-main">
        <p className="text-text-secondary text-lg animate-pulse">
          {t("adminProductsPage.loading")}
        </p>
      </div>
    );
  }

  const roleLabel = prettyRoleLabel(user);

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-3 sm:px-4 py-8 sm:py-10">
      <div className="max-w-6xl mx-auto bg-surface-card rounded-3xl shadow-xl p-4 sm:p-6 md:p-8 border border-border/70">
        {/* ============================================
            HEADER
        ============================================ */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">
              {t("adminProductsPage.header.title")}
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              {t("adminProductsPage.header.connectedLabel")}{" "}
              <strong>{user.email}</strong> ({roleLabel})
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setShowForm((v) => !v)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold shadow-sm ${
                isSubmitting
                  ? "app-btn-neutral opacity-60 cursor-not-allowed"
                  : "app-btn-neutral"
              }`}
            >
              {showForm
                ? t("adminProductsPage.buttons.hideForm")
                : t("adminProductsPage.buttons.newProduct")}
            </button>

            <button
              type="button"
              disabled={loading || isSubmitting}
              onClick={() => loadProducts()}
              className={`px-4 py-2 rounded-xl text-sm font-semibold shadow-sm ${
                loading || isSubmitting
                  ? "bg-blue-300 cursor-not-allowed text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {loading
                ? t("adminProductsPage.buttons.refreshLoading")
                : t("adminProductsPage.buttons.refresh")}
            </button>
          </div>
        </div>

        {/* ============================================
            BARRE DE RECHERCHE
        ============================================ */}
        <div className="mb-6">
          {isGlobalAdmin && (
            <div className="mb-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-text-secondary">
                  {t("adminProductsPage.filters.countryLabel")}
                </label>
                <select
                  value={geoFilters.countryId}
                  onChange={(e) => handleCountryFilterChange(e.target.value)}
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-surface-main text-text-primary"
                >
                  <option value="">
                    {t("adminProductsPage.filters.countryAll")}
                  </option>
                  {(countries || []).map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name || `${t("common.countryLabel")} #${c.id}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-text-secondary">
                  {t("adminProductsPage.filters.regionLabel")}
                </label>
                <select
                  value={geoFilters.regionId}
                  onChange={(e) =>
                    setGeoFilters((prev) => ({ ...prev, regionId: e.target.value }))
                  }
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-surface-main text-text-primary"
                >
                  <option value="">
                    {t("adminProductsPage.filters.regionAll")}
                  </option>
                  {availableRegions.map((r) => (
                    <option key={r.id} value={String(r.id)}>
                      {r.name || `${t("common.regionLabel")} #${r.id}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={resetGeoFilters}
                  className="px-3 py-2 rounded-lg bg-surface-main border border-border text-sm text-text-secondary hover:text-text-primary"
                >
                  {t("adminProductsPage.filters.reset")}
                </button>
              </div>
            </div>
          )}

          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">
              /
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("adminProductsPage.search.placeholder")}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-surface-main text-text-primary focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <p className="mt-2 text-xs text-text-muted">
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
            className="mb-8 bg-surface-main border border-border rounded-2xl p-5 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-5"
          >
            {/* NOM */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-text-secondary">
                {t("adminProductsPage.form.nameLabel")} *
              </label>
              <input
                value={form.name}
                required
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* PRIX */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-text-secondary">
                {t("adminProductsPage.form.priceLabel")} *
              </label>
              <input
                type="number"
                required
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* DEVISE */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-text-secondary">
                {t("adminProductsPage.form.currencyLabel")}
              </label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-surface-card text-text-primary"
              >
                <option value="XOF">{t("currency.XOF")}</option>
                <option value="EUR">{t("currency.EUR")}</option>
                <option value="USD">{t("currency.USD")}</option>
              </select>
            </div>

            {/* STOCK */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-text-secondary">
                {t("adminProductsPage.form.stockLabel")}
              </label>
              <input
                type="number"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-surface-card text-text-primary"
              />
            </div>

 {/* Contexte: administration des produits. */}
            <div className="md:col-span-2 flex flex-col gap-1">
              <label className="text-xs font-semibold text-text-secondary">
                {t("adminProductsPage.form.categoryLabel")}
              </label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-surface-card text-text-primary"
              >
                <option value="">{t("adminProductsPage.form.categoryNone")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {isGlobalAdmin && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-text-secondary">
                    {t("adminProductsPage.form.countryLabel")}
                  </label>
                  <select
                    value={form.countryId}
                    onChange={(e) => handleFormCountryChange(e.target.value)}
                    className="border border-border rounded-lg px-3 py-2 text-sm bg-surface-card text-text-primary"
                  >
                    <option value="">
                      {t("adminProductsPage.form.countryAll")}
                    </option>
                    {(countries || []).map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name || `${t("common.countryLabel")} #${c.id}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-text-secondary">
                    {t("adminProductsPage.form.regionLabel")}
                  </label>
                  <select
                    value={form.regionId}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, regionId: e.target.value }))
                    }
                    className="border border-border rounded-lg px-3 py-2 text-sm bg-surface-card text-text-primary"
                  >
                    <option value="">
                      {t("adminProductsPage.form.regionAll")}
                    </option>
                    {formAvailableRegions.map((r) => (
                      <option key={r.id} value={String(r.id)}>
                        {r.name || `${t("common.regionLabel")} #${r.id}`}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* DESCRIPTION */}
            <div className="md:col-span-2 flex flex-col gap-1">
              <label className="text-xs font-semibold text-text-secondary">
                {t("adminProductsPage.form.descriptionLabel")}
              </label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className="border border-border rounded-lg px-3 py-2 text-sm bg-surface-card text-text-primary min-h-[80px] resize-y"
              ></textarea>
            </div>

            {/* IMAGE PRINCIPALE */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-text-secondary">
                {t("adminProductsPage.form.coverLabel")}
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleCoverChange(e.target.files?.[0] || null)}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-surface-card text-text-primary"
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
                <div className="w-24 h-24 border border-dashed rounded-xl flex items-center justify-center text-xs text-text-muted">
                  {t("adminProductsPage.form.coverEmpty")}
                </div>
              )}
            </div>

            {/* GALERIE */}
            <div className="md:col-span-2 flex flex-col gap-1">
              <label className="text-xs font-semibold text-text-secondary">
                {t("adminProductsPage.form.galleryLabel")}
              </label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => handleGalleryChange(e.target.files)}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-surface-card text-text-primary"
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
                disabled={isSubmitting}
                className={`px-4 py-2 rounded-xl bg-surface-main/80 text-text-secondary text-sm font-semibold ${
                  isSubmitting
                    ? "opacity-60 cursor-not-allowed"
                    : "hover:bg-surface-main"
                }`}
              >
                {t("adminProductsPage.form.reset")}
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className={`px-5 py-2 rounded-xl text-white shadow-sm text-sm font-semibold ${
                  isSubmitting
                    ? "bg-blue-300 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {isSubmitting
                  ? t("adminProductsPage.form.submitting")
                  : editing
                    ? t("adminProductsPage.form.update")
                    : t("adminProductsPage.form.create")}
              </button>
            </div>
          </form>
        )}

         {/* ============================================================
            Contexte: administration des produits.
        ============================================================ */}
        <div className="mt-4">
          <div className="overflow-x-auto border border-border rounded-2xl shadow-sm bg-surface-card">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-main text-text-secondary border-b border-border">
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
                      className="py-6 text-center text-text-muted text-sm italic"
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
                        className="border-t border-border/70 hover:bg-surface-main transition-colors"
                      >
                        {/* PRODUIT */}
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => openLightbox(p, 0)}
                              className="w-14 h-14 rounded-xl border border-border overflow-hidden bg-surface-main/80 flex-shrink-0 hover:border-blue-400 transition"
                            >
                              {mainImg ? (
                                <img
                                  src={mainImg}
                                  alt={p.name}
                                  className="object-cover w-full h-full"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] text-text-muted">
                                  {t("adminProductsPage.table.noImage")}
                                </div>
                              )}
                            </button>

                            <div className="min-w-0">
                              <div className="font-semibold text-text-primary truncate">
                                {p.name || t("common.dash")}
                              </div>
                              <div className="text-[11px] text-text-muted mt-1">
                                {t("adminProductsPage.table.id", { id: p.id })}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* PRIX */}
                        <td className="px-4 py-3 align-top whitespace-nowrap">
                          <div className="font-semibold text-text-primary">
                            {formatNumber(p.price || 0)}{" "}
                            {formatCurrency(p.currency)}
                          </div>
                        </td>

                        {/* STOCK */}
                        <td className="px-4 py-3 align-top whitespace-nowrap">
                          <span className="text-sm text-text-primary">
                            {p.stock ?? 0}
                          </span>
                        </td>

 {/* Contexte: administration des produits. */}
                        <td className="px-4 py-3 align-top">
                          <span className="text-sm text-text-primary">
                            {cat ? cat.name : t("common.dash")}
                          </span>
                        </td>

                        {isGlobalAdmin && (
                          <td className="px-4 py-3 align-top">
                            <span className="text-xs text-text-secondary break-words line-clamp-2">
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
                              {t("adminProductsPage.table.edit")}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(p.id)}
                              className="px-3 py-1.5 text-xs rounded-xl bg-red-600 text-white hover:bg-red-700"
                            >
                              {t("adminProductsPage.table.delete")}
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
            ref={lightboxRef}
            className="relative bg-black rounded-2xl max-w-3xl w-full border border-border overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label={t("adminProductsPage.lightbox.ariaLabel")}
          >
            {/* Bouton fermer */}
            <button
              onClick={closeLightbox}
              className="absolute top-3 right-3 z-50 bg-surface-card/20 hover:bg-surface-card/30 text-white px-3 py-1 rounded-full text-sm font-semibold backdrop-blur-md"
              aria-label={t("adminProductsPage.lightbox.close")}
            >
              x
            </button>

            {/* Navigation gauche */}
            {lightbox.product._images.length > 1 && (
              <button
                onClick={goPrev}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-surface-card/20 hover:bg-surface-card/30 text-white px-3 py-2 rounded-full text-lg backdrop-blur-md"
                aria-label={t("adminProductsPage.lightbox.prev")}
              >
                {"<"}
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
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-surface-card/20 hover:bg-surface-card/30 text-white px-3 py-2 rounded-full text-lg backdrop-blur-md"
                aria-label={t("adminProductsPage.lightbox.next")}
              >
                {">"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}




