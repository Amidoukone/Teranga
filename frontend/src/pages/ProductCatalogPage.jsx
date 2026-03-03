/* eslint-disable jsx-a11y/img-redundant-alt */
// ============================================================
// ProductCatalogPage.jsx Aaa Teranga PRODUCTION READY (Style A 2025)
// Clean Shop Premium + FILE_BASE + Lightbox + Optimisations
// + compat multi-pays / master (backend-driven)
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProducts } from '../services/products';
import { getCategories } from '../services/categories';
import { createOrder } from '../services/orders';
import { me } from '../services/auth';
import { formatCurrency } from '../utils/labels';
import PaginationBar from '../components/PaginationBar';
import { useLocale } from '../i18n/useLocale';
import { useTranslation } from 'react-i18next';
import { notify } from '../utils/notify';

/* ============================================================
   URLs API/fichiers (dev/prod).
============================================================ */
const FILE_BASE =
  (typeof window !== 'undefined' &&
    (window.__TERANGA_FILE_BASE_URL ||
      (window.__TERANGA_API_BASE_URL
        ? window.__TERANGA_API_BASE_URL.replace(/\/api\/?$/, '')
        : '') ||
      '')) ||
  '';

function normalizePath(path = '') {
  if (!path) return '';
  const p = String(path).trim().replace(/\\/g, '/');

  if (/^https?:\/\//i.test(p)) return p;

  const start = p.startsWith('/') ? p : '/' + p;
  return start.replace(/\/{2,}/g, '/');
}

function toAbsUrl(path = '') {
  const norm = normalizePath(path);
  if (!norm) return '';
  if (/^https?:\/\//i.test(norm)) return norm;

  return FILE_BASE.replace(/\/$/, '') + '/' + norm.replace(/^\//, '');
}

/* ============================================================
   Module: catalogue des produits.
   (allImageUrls, gallery, coverImage, imageUrl)
============================================================ */
function getImagesForProduct(p) {
  if (!p) return [];

  const urls = [];

  // 1) allImageUrls (backend withLabels)
  if (Array.isArray(p.allImageUrls)) {
    urls.push(...p.allImageUrls);
  }

  // 2) gallery : [{ url }, "string", ...]
  if (Array.isArray(p.gallery)) {
    p.gallery.forEach((g) => {
      if (g && typeof g === 'object' && g.url) urls.push(g.url);
      else if (typeof g === 'string') urls.push(g);
    });
  }

  // 3) coverImage : string ou { url }
  if (p.coverImage) {
    if (typeof p.coverImage === 'string') urls.unshift(p.coverImage);
    else if (p.coverImage.url) urls.unshift(p.coverImage.url);
  }

  // 4) imageUrl (compat)
  if (p.imageUrl) {
    urls.unshift(p.imageUrl);
  }

 // Contexte: catalogue des produits.
  const seen = new Set();
  return urls
    .map((u) => toAbsUrl(u))
    .filter((u) => u && !seen.has(u) && (seen.add(u), true));
}

/* ============================================================
   Sous-composant formulaire.
   Exemple : "12 500 Franc CFA (XOF)"
============================================================ */
function formatProductPrice(amount, currency = 'XOF', locale = 'fr-FR') {
  const numeric = Number(amount || 0);

  const formattedNumber = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numeric);

  const label = formatCurrency(currency || 'XOF');

  // Nombre AVANT la devise (style e-commerce)
  return `${formattedNumber} ${label}`;
}

/* ============================================================
   Composant principal.
============================================================ */
export default function ProductCatalogPage() {
  const { locale } = useLocale();
  const { t } = useTranslation();
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Commander popup
  const [creating, setCreating] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);

  // Lightbox premium
  const [previewProduct, setPreviewProduct] = useState(null);
  const [previewIndex, setPreviewIndex] = useState(0);

  // Filtres + tri
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [sort, setSort] = useState('default');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const navigate = useNavigate();

  /* ============================================================
     ?? Init user
  ============================================================ */
  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      try {
        const ud = await me();
        if (!mounted) return;
        setUser(ud?.user || null);
      } catch {
        if (mounted) setUser(null);
      }
    }

    loadUser();
    return () => {
      mounted = false;
    };
  }, []);

  /* ============================================================
     ?? Cat?gories (filtre stable)
  ============================================================ */
  useEffect(() => {
    let mounted = true;

    async function loadCategories() {
      try {
        const list = await getCategories({ limit: 200 });
        if (!mounted) return;
        setCategories(Array.isArray(list) ? list : []);
      } catch {
        if (mounted) setCategories([]);
      }
    }

    loadCategories();
    return () => {
      mounted = false;
    };
  }, []);

  /* ============================================================
     ?? Produits (server-side: filtres + tri + pagination)
  ============================================================ */
  useEffect(() => {
    let mounted = true;

    async function loadProducts() {
      setLoading(true);
      try {
        const params = {
          page,
          limit: pageSize,
          q: search.trim() || undefined,
          categoryId: categoryFilter || undefined,
          priceMin: priceMin !== '' ? priceMin : undefined,
          priceMax: priceMax !== '' ? priceMax : undefined,
          sort: sort !== 'default' ? sort : undefined,
        };

        const res = await getProducts(params, { withPagination: true });
        const items = Array.isArray(res?.items) ? res.items : [];
        const pg = res?.pagination || null;

        if (!mounted) return;
        setProducts(items);
        setPagination(
          pg
            ? {
                page: pg.page ?? page,
                limit: pg.limit ?? pageSize,
                total: pg.total ?? pg.count ?? items.length,
              }
            : { page, limit: pageSize, total: items.length }
        );
        setError('');
      } catch (e) {
        console.error("Erreur chargement catalogue:", e);
        if (!mounted) return;
        setError(
          e?.response?.data?.error || t('productCatalogPage.errors.load')
        );
        setProducts([]);
        setPagination({ page, limit: pageSize, total: 0 });
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProducts();
    return () => {
      mounted = false;
    };
  }, [search, categoryFilter, priceMin, priceMax, sort, page, pageSize, t]);

  /* ============================================================
     Contexte: catalogue des produits.
  ============================================================ */
  function openPreview(product, startIndex = 0) {
    const imgs = getImagesForProduct(product);
    if (!imgs.length) return;

    const index = Math.min(Math.max(startIndex, 0), imgs.length - 1);
    setPreviewProduct(product);
    setPreviewIndex(index);
  }

  function closePreview() {
    setPreviewProduct(null);
    setPreviewIndex(0);
  }

  function goPrev(e) {
    if (e) e.stopPropagation();
    if (!previewProduct) return;

    const imgs = getImagesForProduct(previewProduct);
    if (!imgs.length) return;

    setPreviewIndex((prev) => (prev === 0 ? imgs.length - 1 : prev - 1));
  }

  function goNext(e) {
    if (e) e.stopPropagation();
    if (!previewProduct) return;

    const imgs = getImagesForProduct(previewProduct);
    if (!imgs.length) return;

    setPreviewIndex((prev) => (prev === imgs.length - 1 ? 0 : prev + 1));
  }

  /* ============================================================
     Contexte: catalogue des produits.
  ============================================================ */
  function handleOrder(product) {
    if (!user) {
      notify(t('productCatalogPage.alerts.loginRequired'));
      return;
    }

    if (user.role === 'admin') {
      notify(t('productCatalogPage.alerts.adminBlocked'));
      return;
    }

    setSelectedProduct(product);
    setQuantity(1);
    setCreating(true);
  }

  async function handleConfirmOrder(e) {
    e.preventDefault();
    if (!selectedProduct) return;

    const requestedQty = Number(quantity);

    if (!Number.isFinite(requestedQty) || requestedQty <= 0) {
      notify(t('productCatalogPage.alerts.invalidQuantity'));
      return;
    }

 // Contexte: catalogue des produits.
    if (typeof selectedProduct.stock === 'number') {
      if (selectedProduct.stock <= 0) {
        notify(t('productCatalogPage.alerts.outOfStock'));
        return;
      }

      if (requestedQty > selectedProduct.stock) {
        notify(
          t('productCatalogPage.alerts.overStock', {
            requested: requestedQty,
            available: selectedProduct.stock,
          })
        );
        return;
      }
    }

    try {
      setCreating(false);

      const payload = {
        customerNote: t('productCatalogPage.order.customerNote', {
          quantity: requestedQty,
          name: selectedProduct.name,
        }),
        items: [
          {
            productId: selectedProduct.id,
            quantity: requestedQty,
            unitPrice: Number(selectedProduct.price || 0),
          },
        ],
      };

      const newOrder = await createOrder(payload);

      notify(
        t('productCatalogPage.alerts.orderSuccess', {
          quantity: requestedQty,
          name: selectedProduct.name,
        })
      );

      setSelectedProduct(null);
      setQuantity(1);

      // compat: API peut renvoyer order ou id direct
      const id = newOrder?.id || newOrder?.order?.id;
      if (id) navigate(`/orders/${id}`);
      else navigate('/orders');
    } catch (err) {
      console.error('Erreur creation commande:', err);
      notify(t('productCatalogPage.alerts.orderError'));
    }
  }

  /* ============================================================
     Filtrage et tri cote interface utilisateur.
  ============================================================ */
  const availableCategories = useMemo(() => {
    if (Array.isArray(categories) && categories.length > 0) {
      return [...categories]
        .map((c) => ({
          id: c.id,
          name: c.name || t('productCatalogPage.categoryFallback', { id: c.id }),
        }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    const map = new Map();
    products.forEach((p) => {
      const cat = p.category;
      if (cat?.id && !map.has(cat.id)) {
        map.set(cat.id, {
          id: cat.id,
          name: cat.name || t('productCatalogPage.categoryFallback', { id: cat.id }),
        });
      }
    });

    return [...map.values()].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    );
  }, [categories, products, t]);

  const totalProducts = useMemo(
    () => pagination?.total ?? pagination?.count ?? products.length,
    [pagination, products.length]
  );

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, priceMin, priceMax, sort, pageSize]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalProducts / pageSize));
    if (page > totalPages) setPage(totalPages);
  }, [totalProducts, pageSize, page]);


  /* ============================================================
     ?? ?tats de chargement / erreur / vide
  ============================================================ */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-main via-surface-card to-surface-main">
        <div className="bg-surface-card/80 backdrop-blur-md border border-border rounded-2xl px-6 py-5 shadow-xl">
          <p className="text-text-secondary text-sm sm:text-lg animate-pulse text-center">
            {t('productCatalogPage.loading')}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-4">
        <div className="max-w-md w-full bg-surface-card border border-rose-500/30 shadow-xl rounded-3xl px-6 py-6">
          <h1 className="text-lg font-bold text-rose-700 dark:text-rose-300 mb-2">
            {t('productCatalogPage.error.title')}
          </h1>
          <p className="text-sm text-rose-700 dark:text-rose-300 mb-4 break-words">{error}</p>
          <p className="text-xs text-text-muted">
            {t('productCatalogPage.error.subtitle')}
          </p>
        </div>
      </div>
    );
  }

  /* ============================================================
     UI PRINCIPALE - Filtres + Tri + Grille Produits (Style A)
  ============================================================ */
  const hasActiveFilters = Boolean(
    search.trim() ||
      categoryFilter ||
      priceMin !== '' ||
      priceMax !== '' ||
      (sort && sort !== 'default')
  );

  const emptyMessage =
    !hasActiveFilters && totalProducts === 0
      ? t('productCatalogPage.empty.noProducts')
      : t('productCatalogPage.empty.noResults');
  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-3 sm:px-4 lg:px-6 py-8 sm:py-10">
      <div className="max-w-6xl mx-auto bg-surface-card shadow-2xl rounded-3xl border border-border/70 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">

        {/* ==== HEADER ==== */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] font-semibold text-blue-600 mb-1">
              {t('productCatalogPage.header.kicker')}
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary flex items-center gap-2">
              <span>{t('productCatalogPage.header.title')}</span>
            </h1>
            <p className="text-xs sm:text-sm text-text-secondary mt-1 max-w-xl">
              {t('productCatalogPage.header.subtitle')}
            </p>
          </div>

          <div className="flex items-end sm:items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            <div className="flex flex-col items-end text-right">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-surface-main border border-border text-[11px] text-text-secondary shadow-sm">
                {t('productCatalogPage.header.count', {
                  count: products.length,
                  total: totalProducts,
                })}
              </span>
              <span className="mt-1 text-[11px] text-text-muted">
                {t('productCatalogPage.header.filtersHint')}
              </span>
            </div>
          </div>
        </div>

        {/* ==== BARRE DE FILTRES ==== */}
        <div className="bg-surface-main/80 backdrop-blur-sm border border-border rounded-2xl shadow-sm px-4 py-4 sm:px-5 sm:py-4 space-y-3">
 {/* Contexte: catalogue des produits. */}
          <div className="grid gap-3 md:grid-cols-4 items-end">
            {/* Recherche */}
            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1">
                {t('productCatalogPage.filters.searchLabel')}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">/</span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('productCatalogPage.filters.searchPlaceholder')}
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-surface-card text-text-primary"
                />
              </div>
            </div>

 {/* Contexte: catalogue des produits. */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1">
                {t('productCatalogPage.filters.categoryLabel')}
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full text-sm rounded-xl border border-border px-3 py-2 bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">{t('productCatalogPage.filters.categoryAll')}</option>
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Ligne 2 : prix, reset, tri */}
          <div className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
            {/* Prix + reset */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1">
                  {t('productCatalogPage.filters.priceMinLabel')}
                </label>
                <input
                  type="number"
                  min="0"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  className="w-full text-sm rounded-xl border border-border px-3 py-2 bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={t('productCatalogPage.filters.priceMinPlaceholder')}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1">
                  {t('productCatalogPage.filters.priceMaxLabel')}
                </label>
                <input
                  type="number"
                  min="0"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  className="w-full text-sm rounded-xl border border-border px-3 py-2 bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={t('productCatalogPage.filters.priceMaxPlaceholder')}
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setCategoryFilter('');
                    setPriceMin('');
                    setPriceMax('');
                    setSort('default');
                  }}
                  className="w-full text-xs font-semibold rounded-xl border border-border px-3 py-2 bg-surface-card hover:bg-surface-main text-text-secondary"
                >
                  {t('productCatalogPage.filters.reset')}
                </button>
              </div>
            </div>

            {/* Tri */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1">
                {t('productCatalogPage.filters.sortLabel')}
              </label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                  className="w-full text-sm rounded-xl border border-border px-3 py-2 bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="default">
                  {t('productCatalogPage.filters.sortDefault')}
                </option>
                <option value="price_asc">
                  {t('productCatalogPage.filters.sortPriceAsc')}
                </option>
                <option value="price_desc">
                  {t('productCatalogPage.filters.sortPriceDesc')}
                </option>
                <option value="name_asc">
                  {t('productCatalogPage.filters.sortNameAsc')}
                </option>
                <option value="name_desc">
                  {t('productCatalogPage.filters.sortNameDesc')}
                </option>
                <option value="stock_desc">
                  {t('productCatalogPage.filters.sortStockDesc')}
                </option>
              </select>
            </div>
          </div>
        </div>

        <PaginationBar
          page={page}
          pageSize={pageSize}
          totalItems={totalProducts}
          pageSizeOptions={[12, 24, 48]}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          className="mt-2"
        />

        {products.length === 0 ? (
          <div className="bg-surface-main border border-border rounded-2xl shadow-sm py-10 flex items-center justify-center">
            <p className="text-text-muted text-sm">{emptyMessage}</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => {
              const images = getImagesForProduct(p);
              const mainImg = images[0] || null;

              return (
                <div
                  key={p.id}
                  className="bg-surface-card border border-border rounded-2xl shadow-sm hover:shadow-lg hover:border-blue-500/30 transition overflow-hidden flex flex-col"
                >
                  {/* Image */}
                  {mainImg ? (
                    <button
                      type="button"
                      onClick={() => openPreview(p, 0)}
                      className="relative group"
                      aria-label={t('productCatalogPage.card.viewImagesAria', {
                        name: p.name,
                      })}
                    >
                      <img
                        src={mainImg}
                        alt={p.name}
                        className="w-full h-44 object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition" />

                      <div className="absolute left-3 bottom-3 text-white text-[11px] bg-black/50 px-2 py-1 rounded">
                        {t('productCatalogPage.card.zoomHint')}
                      </div>

                      {images.length > 1 && (
                        <span className="absolute right-3 bottom-3 text-[11px] bg-black/60 text-white px-2 py-0.5 rounded">
                          {t('productCatalogPage.card.photoCount', {
                            count: images.length,
                          })}
                        </span>
                      )}
                    </button>
                  ) : (
                    <div className="w-full h-44 flex items-center justify-center bg-surface-main/80 text-text-muted text-xs">
                      {t('productCatalogPage.card.noImage')}
                    </div>
                  )}

                  {/* Contenu carte */}
                  <div className="flex-1 flex flex-col px-4 py-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h2 className="text-base font-semibold text-text-primary line-clamp-2">
                        {p.name}
                      </h2>

                      {p.category?.name && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 whitespace-nowrap">
                          {p.category.name}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-text-muted mb-2">
                      {t('productCatalogPage.card.refLabel')}{' '}
                      <span className="font-mono">#{p.id}</span>
                    </p>

                    <p className="text-sm text-text-secondary flex-1 line-clamp-3">
                      {p.description || t('productCatalogPage.card.noDescription')}
                    </p>

                    {/* Prix + Stock */}
                    <div className="mt-3 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] uppercase text-text-muted">
                          {t('productCatalogPage.card.priceLabel')}
                        </p>
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          {formatProductPrice(p.price, p.currency, locale)}
                        </p>
                      </div>

                      {typeof p.stock === 'number' && (
                        <div className="text-right">
                          <p className="text-[11px] uppercase text-text-muted">
                            {t('productCatalogPage.card.stockLabel')}
                          </p>
                          <p
                            className={`text-xs font-semibold ${
                              p.stock > 0
                                ? 'text-emerald-600'
                                : 'text-rose-600'
                            }`}
                          >
                            {p.stock > 0
                              ? t('productCatalogPage.card.stockAvailable', {
                                  count: p.stock,
                                })
                              : t('productCatalogPage.card.stockOut')}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Bouton Commander */}
                    {user && user.role !== 'admin' && (
                      <button
                        onClick={() => handleOrder(p)}
                        className="mt-4 w-full inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-xl shadow-sm bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition"
                      >
                        {t('productCatalogPage.card.order')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ============================================================
            Contexte: catalogue des produits.
        ============================================================ */}
        {creating && selectedProduct && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 px-4">
            <div className="relative w-full max-w-sm rounded-2xl border border-border bg-surface-card shadow-2xl">
              <button
                onClick={() => setCreating(false)}
                className="absolute top-3 right-3 text-text-muted hover:text-text-primary"
                aria-label={t('productCatalogPage.order.close')}
              >
                x
              </button>

              <div className="p-6">
                <h2 className="text-xl font-bold text-text-primary mb-1">
                  {t('productCatalogPage.order.title', {
                    name: selectedProduct.name,
                  })}
                </h2>
                <p className="text-xs text-text-secondary mb-4">
                  {formatProductPrice(
                    selectedProduct.price,
                    selectedProduct.currency || 'XOF',
                    locale
                  )}{' '}
                  {t('productCatalogPage.order.unit')}
                </p>

                <form onSubmit={handleConfirmOrder}>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    {t('productCatalogPage.order.quantityLabel')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm mb-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setCreating(false)}
                      className="px-4 py-2 text-sm bg-surface-main/80 text-text-secondary rounded-lg hover:bg-surface-main/80"
                    >
                      {t('productCatalogPage.order.cancel')}
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800"
                    >
                      {t('productCatalogPage.order.confirm')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            Contexte: catalogue des produits.
        ============================================================ */}
        {previewProduct && (() => {
          const images = getImagesForProduct(previewProduct);
          if (!images.length) return null;

          return (
            <div
              className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4"
              onClick={closePreview}
              role="dialog"
              aria-modal="true"
              aria-label={t('productCatalogPage.lightbox.ariaLabel', {
                name: previewProduct?.name || '',
              })}
            >
              {/* Fermer */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closePreview();
                }}
                className="absolute top-4 right-4 text-white text-xl font-bold px-3 py-1 rounded-full bg-black/60 hover:bg-black/80"
                aria-label={t('productCatalogPage.lightbox.close')}
              >
                x
              </button>

              {/* Navigation */}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goPrev}
                    className="absolute left-4 text-white text-3xl px-3 py-2 rounded-full bg-black/50 hover:bg-black/70"
                    aria-label={t('productCatalogPage.lightbox.prev')}
                  >
                    {"<"}
                  </button>

                  <button
                    type="button"
                    onClick={goNext}
                    className="absolute right-4 text-white text-3xl px-3 py-2 rounded-full bg-black/50 hover:bg-black/70"
                    aria-label={t('productCatalogPage.lightbox.next')}
                  >
                    {">"}
                  </button>
                </>
              )}

              <div
                className="bg-black/95 border border-border rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex-1 flex items-center justify-center">
                  <img
                    src={images[previewIndex]}
                    alt={t('productCatalogPage.lightbox.imageAlt', {
                      index: previewIndex + 1,
                    })}
                    className="max-h-[90vh] max-w-full object-contain"
                  />
                </div>

                {images.length > 1 && (
                  <div className="px-4 py-3 bg-black/80 border-t border-border flex gap-2 overflow-x-auto">
                    {images.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPreviewIndex(idx)}
                        className={`w-16 h-16 rounded-lg overflow-hidden border ${
                          idx === previewIndex
                            ? 'border-blue-400 ring-2 ring-blue-400/70'
                            : 'border-border hover:border-border/70'
                        }`}
                      >
                        <img
                          src={img}
                          alt={t('productCatalogPage.lightbox.thumbAlt', {
                            index: idx + 1,
                          })}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}





