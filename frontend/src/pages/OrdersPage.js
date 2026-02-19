// ============================================================
// OrdersPage.jsx — Teranga PRODUCTION READY (Option B Premium)
// Clean Shop, filtres, tri, formulaires, responsivité mobile
// Design B : Style marketplace / SaaS Pro 2025
// ============================================================

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getOrders, createOrder } from '../services/orders';
import { getProducts } from '../services/products';
import { getCountries } from '../services/countries';
import { getRegions } from '../services/regions';
import { me } from '../services/auth';
import PaginationBar from '../components/PaginationBar';
import {
  canonicalizeOrderStatus,
  canonicalizePaymentStatus,
} from '../utils/labels';
import { isGlobalAdminUser } from '../utils/role';
import { useLocale } from '../i18n/useLocale';
import { useTranslation } from 'react-i18next';
import { notify } from '../utils/notify';

/* ============================================================
   🎨 Helpers de style pour les statuts (Badges / Timeline)
============================================================ */
function getOrderStatusStyle(status) {
  const canon = canonicalizeOrderStatus(status);

  switch (canon) {
    case 'created':
      return 'bg-slate-100 text-slate-700 border border-slate-200';
    case 'processing':
      return 'bg-blue-50 text-blue-700 border border-blue-100';
    case 'shipped':
      return 'bg-indigo-50 text-indigo-700 border border-indigo-100';
    case 'delivered':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
    case 'cancelled':
      return 'bg-rose-50 text-rose-700 border border-rose-100';
    case 'refunded':
      return 'bg-amber-50 text-amber-700 border border-amber-100';
    default:
      return 'bg-slate-50 text-slate-600 border border-slate-100';
  }
}

function getPaymentStatusStyle(status) {
  const canon = canonicalizePaymentStatus(status);

  switch (canon) {
    case 'paid':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
    case 'partial':
      return 'bg-amber-50 text-amber-700 border border-amber-100';
    case 'unpaid':
      return 'bg-slate-100 text-slate-700 border border-slate-200';
    case 'refunded':
      return 'bg-rose-50 text-rose-700 border border-rose-100';
    default:
      return 'bg-slate-50 text-slate-600 border border-slate-100';
  }
}

/* ============================================================
   ✅ Helpers API (compat array OU { orders/products })
============================================================ */
function normalizeListResponse(data, key) {
  if (Array.isArray(data)) return data;
  const arr = data?.[key];
  return Array.isArray(arr) ? arr : [];
}

/* ============================================================
   ⭐ Page Commandes — Clean Shop Premium (Style B)
============================================================ */
export default function OrdersPage() {
  const { formatNumber, formatDateTime } = useLocale();
  const { t } = useTranslation();
  const [user, setUser] = useState(null);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const isGlobalAdmin = isGlobalAdminUser(user);
  const [countries, setCountries] = useState([]);
  const [regions, setRegions] = useState([]);

  // Produits pour création rapide de commande
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [filters, setFilters] = useState({
    q: '',
    status: '',
    payment: '',
    sort: '-createdAt',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });

  const [showForm, setShowForm] = useState(() => {
    const saved = localStorage.getItem('teranga_orders_showForm');
    return saved === null ? true : saved === '1';
  });

  const [form, setForm] = useState({
    customerNote: '',
    withItem: false,
    productId: '',
    quantity: 1,
    unitPrice: '',
  });

  const navigate = useNavigate();

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

  const getGeoLabel = useCallback(
    (entity) => {
      if (!entity) return '';
      const countryId =
        entity.countryId ?? entity.country?.id ?? entity.country_id ?? null;
      const regionId =
        entity.regionId ?? entity.region?.id ?? entity.region_id ?? null;

      const countryName =
        entity.country?.name ||
        countriesById.get(String(countryId))?.name ||
        '';
      const regionName =
        entity.region?.name ||
        regionsById.get(String(regionId))?.name ||
        '';

      const countryLabel =
        countryName ||
        (countryId ? `${t('common.countryLabel')} #${countryId}` : '');
      const regionLabel =
        regionName ||
        (regionId ? `${t('common.regionLabel')} #${regionId}` : '');

      if (countryLabel && regionLabel) return `${countryLabel} • ${regionLabel}`;
      return countryLabel || regionLabel || '';
    },
    [countriesById, regionsById, t]
  );

  /* ============================================================
     🔄 Loaders (useCallback pour éviter les recréations)
  ============================================================ */
  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: pageSize,
        q: filters.q?.trim() || undefined,
        status: filters.status || undefined,
        paymentStatus: filters.payment || undefined,
        sort: filters.sort || undefined,
      };

      const res = await getOrders(params, { withPagination: true });
      const items = Array.isArray(res)
        ? res
        : Array.isArray(res?.items)
        ? res.items
        : res?.orders || [];

      setOrders(items);
      const pg = res?.pagination || null;
      setPagination(
        pg
          ? {
              page: pg.page ?? page,
              limit: pg.limit ?? pageSize,
              total: pg.total ?? pg.count ?? items.length,
            }
          : { page, limit: pageSize, total: items.length }
      );
    } catch (e) {
      console.error('? Erreur chargement commandes:', e);
      notify(t("orders.alerts.loadError"));
      setOrders([]);
      setPagination({ page, limit: pageSize, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize, t]);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const data = await getProducts({ limit: 200 });
      setProducts(normalizeListResponse(data, 'products'));
    } catch (e) {
      console.error('❌ Erreur chargement produits:', e);
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  /* ============================================================
     ?? Initialisation
  ============================================================ */
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const ud = await me();
        if (!mounted) return;
        const current = ud?.user;
        if (!current) {
          window.location.href = '/login';
          return;
        }
        setUser(current);
        await loadProducts();
      } catch (e) {
        console.error('? Erreur init OrdersPage:', e);
        if (e?.response?.status === 401) {
          localStorage.removeItem('teranga_token');
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
      }
    }

    init();
    return () => {
      mounted = false;
    };
  }, [loadProducts]);

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
        console.error('❌ Erreur chargement pays/régions:', e);
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
    if (!user) return;
    loadOrders();
  }, [user, loadOrders]);

  // Persistance de l’affichage du formulaire
  useEffect(() => {
    localStorage.setItem('teranga_orders_showForm', showForm ? '1' : '0');
  }, [showForm]);

  /* ============================================================
     ➕ Création commande (avec protection anti double-submit)
  ============================================================ */
  async function handleCreate(e) {
    e.preventDefault();
    if (creating) return;

    try {
      setCreating(true);

      const payload = {
        customerNote: form.customerNote || '',
      };

      if (form.withItem && form.productId) {
        const prod = products.find((p) => String(p.id) === String(form.productId));

        const unit =
          form.unitPrice !== '' && form.unitPrice !== null
            ? Number(form.unitPrice)
            : Number(prod?.price || 0);

        payload.items = [
          {
            productId: Number(form.productId),
            quantity: Number(form.quantity) > 0 ? Number(form.quantity) : 1,
            unitPrice: Number.isFinite(unit) ? unit : 0,
          },
        ];
      }

      const newOrder = await createOrder(payload);

      // Reset propre
      setForm({
        customerNote: '',
        withItem: false,
        productId: '',
        quantity: 1,
        unitPrice: '',
      });

      notify(t("orders.alerts.createSuccess"));

      // Redirection automatique vers la commande
      const id = newOrder?.id || newOrder?.order?.id;
      if (id) {
        navigate(`/orders/${id}`);
      } else {
        await loadOrders();
      }
    } catch (err) {
      console.error('❌ Erreur création commande:', err);
      notify(t("orders.alerts.createError"));
    } finally {
      setCreating(false);
    }
  }

  /* ============================================================
     🎛️ Filtres + tri (mémoïsés) — canon robustes
  ============================================================ */
  const totalOrders = useMemo(
    () => pagination?.total ?? pagination?.count ?? orders.length,
    [pagination, orders.length]
  );
  const activeFiltersCount = [filters.q, filters.status, filters.payment].filter(
    Boolean
  ).length;

  const getCurrencyLabel = useCallback(
    (code) => t(`currency.${code}`, { defaultValue: code || 'XOF' }),
    [t]
  );
  const getOrderStatusLabel = useCallback(
    (status) =>
      t(`orders.status.${canonicalizeOrderStatus(status)}`, {
        defaultValue: status,
      }),
    [t]
  );
  const getPaymentStatusLabel = useCallback(
    (status) =>
      t(`orders.payment.${canonicalizePaymentStatus(status)}`, {
        defaultValue: status,
      }),
    [t]
  );

  useEffect(() => {
    setPage(1);
  }, [filters.q, filters.status, filters.payment, filters.sort, pageSize]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalOrders / pageSize));
    if (page > totalPages) setPage(totalPages);
  }, [totalOrders, pageSize, page]);

  /* ============================================================
     UI principale - wrapper + skeleton
  ============================================================ */
  if (!user) {
    return (
      <div className="app-page-wrap flex min-h-screen items-center justify-center">
        <p className="text-lg animate-pulse text-text-secondary">
          {t("common.loading")}
        </p>
      </div>
    );
  }

  return (
    <div className="app-page-wrap">
      <div className="app-page-shell p-4 sm:p-8">

        {/* ===================================================== */}
        {/* 🧭 Header Premium Responsive (Style B) */}
        {/* ===================================================== */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-full break-words">
            <h1 className="app-page-headline flex items-center gap-2">
              🧾 <span>{t("orders.title")}</span>
            </h1>
            <p className="app-page-subtitle mt-1">
              {t("orders.subtitle")}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Link
              to="/shop"
              className="app-btn-primary w-full text-center sm:w-auto"
            >
              🛍️ {t("orders.buttons.viewCatalog")}
            </Link>

            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="app-btn-neutral w-full text-center sm:w-auto"
            >
              {showForm
                ? `➖ ${t("orders.buttons.hideForm")}`
                : `➕ ${t("orders.buttons.newOrder")}`}
            </button>

            <button
              type="button"
              onClick={loadOrders}
              disabled={loading}
              className={`w-full sm:w-auto rounded-lg px-4 py-2 text-sm font-semibold text-center ${
                loading
                  ? 'cursor-not-allowed bg-blue-300 text-white'
                  : 'app-btn-primary'
              }`}
            >
              {loading
                ? t("orders.buttons.refreshLoading")
                : `🔄 ${t("orders.buttons.refresh")}`}
            </button>
          </div>
        </div>

        {/* ===================================================== */}
        {/* 🎛️ Filtres Premium Responsive (Style SaaS) */}
        {/* ===================================================== */}
        <div className="mb-6 rounded-2xl border border-border/70 bg-surface-main/55 p-4 sm:p-5">
          {/* Recherche */}
          <div className="flex flex-col lg:flex-row gap-3 mb-4">
            <div className="w-full lg:w-2/3">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                {t("orders.filters.searchLabel")}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">
                  🔍
                </span>
                <input
                  value={filters.q}
                  onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                  placeholder={t("orders.filters.searchPlaceholder")}
                  className="w-full rounded-xl border border-border/80 bg-white py-2 pl-8 pr-3 text-sm text-text-primary shadow-sm break-words"
                />
              </div>
            </div>

            <div className="w-full lg:w-1/3 flex items-end justify-end">
              <div className="flex w-full flex-col items-start gap-1 text-xs text-text-secondary lg:items-end">
                <span className="inline-flex items-center rounded-full border border-border/80 bg-white px-3 py-1 shadow-sm">
                  {t("orders.filters.displayedCount", {
                    count: orders.length,
                    total: totalOrders,
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Sélecteurs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Statut commande */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                {t("orders.filters.orderStatusLabel")}
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full rounded-xl border border-border/80 bg-white px-3 py-2 text-sm text-text-primary"
              >
                <option value="">{t("orders.filters.all")}</option>
                <option value="created">{t("orders.status.created")}</option>
                <option value="processing">{t("orders.status.processing")}</option>
                <option value="shipped">{t("orders.status.shipped")}</option>
                <option value="delivered">{t("orders.status.delivered")}</option>
                <option value="cancelled">{t("orders.status.cancelled")}</option>
                <option value="refunded">{t("orders.status.refunded")}</option>
              </select>
            </div>

            {/* Paiement */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                {t("orders.filters.paymentStatusLabel")}
              </label>
              <select
                value={filters.payment}
                onChange={(e) => setFilters({ ...filters, payment: e.target.value })}
                className="w-full rounded-xl border border-border/80 bg-white px-3 py-2 text-sm text-text-primary"
              >
                <option value="">{t("orders.filters.all")}</option>
                <option value="unpaid">{t("orders.payment.unpaid")}</option>
                <option value="partial">{t("orders.payment.partial")}</option>
                <option value="paid">{t("orders.payment.paid")}</option>
                <option value="refunded">{t("orders.payment.refunded")}</option>
              </select>
            </div>

            {/* Tri */}
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                {t("orders.filters.sortLabel")}
              </label>
              <select
                value={filters.sort}
                onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
                className="w-full rounded-xl border border-border/80 bg-white px-3 py-2 text-sm text-text-primary"
              >
                <option value="-createdAt">{t("orders.filters.sortNewest")}</option>
                <option value="createdAt">{t("orders.filters.sortOldest")}</option>
                <option value="-totalAmount">{t("orders.filters.sortAmountDesc")}</option>
                <option value="totalAmount">{t("orders.filters.sortAmountAsc")}</option>
              </select>
            </div>
          </div>

          {/* Reset + compteur en bas */}
          <div className="mt-4 flex flex-col gap-2 text-xs text-text-secondary sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span>{t("orders.filters.activeLabel")}</span>
              <span className="inline-flex items-center rounded-full border border-border/80 bg-white px-2 py-0.5">
                {activeFiltersCount
                  ? activeFiltersCount
                  : t("orders.filters.activeNone")}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setFilters({ q: '', status: '', payment: '', sort: '-createdAt' })}
              className="app-btn-soft w-full text-center sm:w-auto"
            >
              {t("orders.filters.reset")}
            </button>
          </div>
        </div>
        {/* ===================================================== */}
        {/* ➕ Formulaire création commande (Premium Responsive) */}
        {/* ===================================================== */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="mb-8 rounded-2xl border border-border/70 bg-surface-main/55 p-4 sm:p-6"
          >
            <h2 className="mb-3 text-lg font-semibold text-text-primary">
              ➕ {t("orders.form.title")}
            </h2>

            {/* Note client */}
            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium text-text-secondary">
                {t("orders.form.customerNoteLabel")}
              </label>
              <textarea
                rows={3}
                value={form.customerNote}
                onChange={(e) =>
                  setForm((f) => ({ ...f, customerNote: e.target.value }))
                }
                className="w-full rounded-lg border border-border/80 bg-white px-3 py-2 text-sm text-text-primary break-words"
                placeholder={t("orders.form.customerNotePlaceholder")}
              />
            </div>

            {/* Ajouter un article */}
            <div className="mt-2 flex items-center gap-2">
              <input
                id="withItem"
                type="checkbox"
                checked={form.withItem}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    withItem: e.target.checked,
                    productId: e.target.checked ? f.productId : '',
                    quantity: e.target.checked ? f.quantity : 1,
                    unitPrice: e.target.checked ? f.unitPrice : '',
                  }))
                }
                className="rounded border-border/80"
              />
              <label
                htmlFor="withItem"
                className="cursor-pointer text-sm text-text-secondary"
              >
                {t("orders.form.addItemLabel")}
              </label>
            </div>

            {form.withItem && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
                {/* Produit */}
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-text-secondary">
                    {t("orders.form.productLabel")}
                  </label>
                  <select
                    disabled={loadingProducts}
                    value={form.productId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, productId: e.target.value }))
                    }
                    className="w-full rounded-lg border border-border/80 bg-white px-3 py-2 text-sm text-text-primary"
                  >
                    <option value="">{t("orders.form.productPlaceholder")}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} - {formatNumber(p.price || 0)} {getCurrencyLabel(p.currency || 'XOF')}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quantité */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">
                    {t("orders.form.quantityLabel")}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.quantity}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, quantity: e.target.value }))
                    }
                    className="w-full rounded-lg border border-border/80 bg-white px-3 py-2 text-sm text-text-primary"
                  />
                </div>

                {/* PU */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">
                    {t("orders.form.unitPriceLabel")}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.unitPrice}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, unitPrice: e.target.value }))
                    }
                    className="w-full rounded-lg border border-border/80 bg-white px-3 py-2 text-sm text-text-primary"
                    placeholder={t("orders.form.unitPricePlaceholder")}
                  />
                </div>
              </div>
            )}

            {/* Bouton soumission */}
            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                disabled={creating}
                className={`w-full sm:w-auto rounded-lg px-5 py-2.5 text-sm font-semibold ${
                  creating
                    ? 'cursor-not-allowed bg-blue-300 text-white'
                    : 'app-btn-primary'
                }`}
              >
                {creating ? t("orders.form.submitting") : `➕ ${t("orders.form.submit")}`}
              </button>
            </div>
          </form>
        )}

        {/* ===================================================== */}
        <PaginationBar
          page={page}
          pageSize={pageSize}
          totalItems={totalOrders}
          pageSizeOptions={[10, 20, 50]}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          className="mb-4"
        />

        {/* 📄 LISTE Commandes — Cards marketplace style B */}
        {/* ===================================================== */}
        {loading ? (
          <p className="rounded-2xl border border-border/70 bg-white/70 py-6 text-center italic text-text-secondary">
            {t("orders.list.loading")}
          </p>
        ) : orders.length === 0 ? (
          <p className="rounded-2xl border border-border/70 bg-white/70 py-6 text-center italic text-text-secondary">
            {t("orders.list.empty")}
          </p>
        ) : (
          <div className="grid gap-5">
            {orders.map((o) => {
              const currency = o.currency || 'XOF';
              const total = Number(o.totalAmount || 0);

              const orderStatusChip = getOrderStatusLabel(o.orderStatus);
              const paymentStatusChip = getPaymentStatusLabel(o.paymentStatus);

              const orderStatusClass = getOrderStatusStyle(o.orderStatus);
              const paymentStatusClass = getPaymentStatusStyle(o.paymentStatus);

              return (
                <div
                  key={o.id}
                  className="w-full overflow-hidden rounded-2xl border border-border/70 bg-white shadow-sm transition hover:shadow-md break-words"
                >
                  {/* Bandeau supérieur */}
                  <div className="flex flex-col gap-3 border-b border-border/70 bg-surface-main/60 px-4 pb-3 pt-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-semibold text-text-primary break-words">
                        {o.code || t("orders.list.orderNumber", { id: o.id })}
                      </h3>
                      <p className="mt-0.5 text-xs text-text-secondary break-words">
                        {t("orders.list.internalId", { id: o.id })}
                      </p>
                    </div>

                    <div className="flex flex-col items-start text-xs text-text-secondary sm:items-end">
                      <span>
                        {o.createdAt
                          ? formatDateTime(o.createdAt)
                          : t("common.dash")}
                      </span>
                      {o.updatedAt && (
                        <span className="mt-0.5">
                          {t("orders.list.updatedAt")}{' '}
                          {formatDateTime(o.updatedAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Corps */}
                  <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                      <div className="space-y-1 text-sm text-text-secondary">
                        <p>
                          <span className="font-medium text-text-primary">
                            {t("orders.list.customerLabel")}
                          </span>{' '}
                          {o.customer?.email || t("common.dash")}
                        </p>
                        {isGlobalAdmin && (
                          <p className="text-xs text-text-muted break-words">
                            <span className="font-medium text-text-secondary">
                              {t("common.locationLabel")}:
                            </span>{' '}
                            {getGeoLabel(o) || t("common.dash")}
                          </p>
                        )}
                        {o.customerNote && (
                          <p className="text-xs text-text-secondary">
                            <span className="font-medium">
                              {t("orders.list.noteLabel")}
                            </span>{' '}
                            {o.customerNote}
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        <p className="text-[11px] uppercase text-text-muted">
                          {t("orders.list.amountLabel")}
                        </p>
                        <p className="text-lg font-bold text-blue-600">
                          {formatNumber(total)}{' '}
                          {getCurrencyLabel(currency)}
                        </p>
                      </div>
                    </div>

                    {/* Statuts */}
                    <div className="flex flex-wrap gap-2 items-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${orderStatusClass}`}
                      >
                        {t("orders.list.orderStatusLabel")} {orderStatusChip}
                      </span>

                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${paymentStatusClass}`}
                      >
                        {t("orders.list.paymentStatusLabel")} {paymentStatusChip}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="border-t border-border/70 bg-surface-main/60 px-4 pb-4 pt-2 sm:px-5">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Link
                        to={`/orders/${o.id}`}
                        className="app-btn-primary w-full text-center sm:w-auto"
                      >
                        📄 {t("orders.buttons.openOrder")}
                      </Link>

                      <Link
                        to={`/orders/${o.id}/transactions`}
                        className="app-btn-neutral w-full text-center sm:w-auto"
                      >
                        💰 {t("orders.buttons.viewTransactions")}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


