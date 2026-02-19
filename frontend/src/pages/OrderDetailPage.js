// ============================================================
// OrderDetailPage.jsx — Teranga PRODUCTION READY (Option B2)
// Clean Shop Premium — Responsive — FILE_BASE system (multi-pays)
// ============================================================

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';

import {
  getOrderById,
  updateOrder,
  addOrderItem,
  updateOrderItem,
  deleteOrderItem,
} from '../services/orders';

import { getProducts } from '../services/products';
import { getCountries } from '../services/countries';
import { getRegions } from '../services/regions';

import {
  uploadOrderEvidences,
  getOrderEvidences,
  deleteOrderEvidence,
} from '../services/evidences';

import { me } from '../services/auth';

import {
  canonicalizeOrderStatus,
  canonicalizePaymentStatus,
} from '../utils/labels';
import { isGlobalAdminUser } from '../utils/role';
import { useLocale } from '../i18n/useLocale';
import { useTranslation } from 'react-i18next';
import { notify } from '../utils/notify';
import { useDeleteConfirm } from '../hooks/useDeleteConfirm';

/* ============================================================
   🌍 FILE_BASE + normalizePath + toAbsUrl (multi-pays / master)
============================================================ */
const FILE_BASE =
  (typeof window !== 'undefined' &&
    (window.__TERANGA_FILE_BASE_URL ||
      window.__TERANGA_API_BASE_URL ||
      '')) ||
  '';

function normalizePath(path = '') {
  if (!path) return '';
  const p = String(path).trim().replace(/\\/g, '/');
  if (/^https?:\/\//i.test(p)) return p;
  const fixed = p.startsWith('/') ? p : '/' + p;
  return fixed.replace(/\/{2,}/g, '/');
}

function toAbsUrl(path = '') {
  const norm = normalizePath(path);
  if (!norm) return '';
  if (/^https?:\/\//i.test(norm)) return norm;
  // FILE_BASE déjà sans trailing slash dans la plupart des cas
  return FILE_BASE.replace(/\/$/, '') + norm;
}

/* ============================================================
   🧭 Timeline des statuts (visuelle + animée)
============================================================ */
const ORDER_STEP_DEFS = [
  { key: 'created', labelKey: 'orderDetail.timeline.created', icon: '📝' },
  { key: 'processing', labelKey: 'orderDetail.timeline.processing', icon: '⚙️' },
  { key: 'paid', labelKey: 'orderDetail.timeline.paid', icon: '💳' },
  { key: 'delivered', labelKey: 'orderDetail.timeline.delivered', icon: '📦' },
  { key: 'closed', labelKey: 'orderDetail.timeline.closed', icon: '✅' },
];

const DELETE_WINDOW_MS = 60 * 60 * 1000;

function mapStatusToStepKey(status = '') {
  const s = String(status || '').toLowerCase();
  if (!s) return 'created';
  if (['created'].includes(s)) return 'created';
  if (['processing', 'in_progress', 'pending', 'shipped'].includes(s)) return 'processing';
  if (['paid', 'settled'].includes(s)) return 'paid';
  if (['delivered', 'completed'].includes(s)) return 'delivered';
  if (['cancelled', 'canceled', 'refunded', 'closed'].includes(s)) return 'closed';
  return 'created';
}

/* ============================================================
   ⭐ Page Détail Commande
============================================================ */
export default function OrderDetailPage() {
  const { formatNumber, formatDateTime } = useLocale();
  const { t } = useTranslation();
  const { confirmDelete } = useDeleteConfirm();
  const { id } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [countries, setCountries] = useState([]);
  const [regions, setRegions] = useState([]);
  const [order, setOrder] = useState(null);
  const [products, setProducts] = useState([]);

  const [loading, setLoading] = useState(true);

  // Form ajout article
  const [itemForm, setItemForm] = useState({
    productId: '',
    quantity: 1,
    unitPrice: '',
  });

  // Preuves
  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState('');
  const [evidences, setEvidences] = useState([]);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef(null);
  const [fileInputKey, setFileInputKey] = useState(() => Date.now());

  // Lightbox preuves (images)
  const [evidenceLightbox, setEvidenceLightbox] = useState({
    open: false,
    index: 0,
  });

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
     👤 Affichage client
  ============================================================ */
  const customerDisplay = useMemo(() => {
    if (!order?.customer) return '—';
    const c = order.customer;

    const first = c.firstName ?? c.firstname ?? '';
    const last = c.lastName ?? c.lastname ?? '';

    return `${first} ${last}`.trim() || c.name || c.email || '—';
  }, [order]);

  /* ============================================================
     👤 Affichage uploader (preuves)
  ============================================================ */
  function formatUploader(u) {
    if (!u) return '—';
    const first = u.firstName ?? u.firstname ?? '';
    const last = u.lastName ?? u.lastname ?? '';
    return `${first} ${last}`.trim() || u.name || u.email || '—';
  }

  /* ============================================================
     🔍 Helpers preuves
  ============================================================ */
  function isEvidenceImage(ev) {
    return (ev?.mimeType || '').toLowerCase().startsWith('image/');
  }

  function inferEvidenceKind(ev) {
    const name = ev?.originalName || ev?.filePath || '';
    const mime = (ev?.mimeType || '').toLowerCase();
    if (mime.startsWith('image/')) return 'image';
    if (mime === 'application/pdf' || /\.pdf$/i.test(name)) return 'pdf';
    return 'other';
  }

  function getFileExtLabel(name = '', fallback = 'FILE') {
    const base = String(name || '').trim();
    if (!base) return fallback;
    const parts = base.split('.');
    if (parts.length < 2) return fallback;
    const ext = parts[parts.length - 1].slice(0, 6).toUpperCase();
    return ext || fallback;
  }

  function getDeleteEligibility(currentUser, ev) {
    if (!currentUser || !ev) return { allowed: false, reason: 'no-user' };
    if (currentUser.role === 'admin' || currentUser.role === 'master') {
      return { allowed: true, reason: 'admin' };
    }

    if (!ev.uploaderId || String(ev.uploaderId) !== String(currentUser.id)) {
      return { allowed: false, reason: 'not-owner' };
    }

    const createdAtMs = ev.createdAt ? new Date(ev.createdAt).getTime() : NaN;
    if (!Number.isFinite(createdAtMs)) {
      return { allowed: false, reason: 'invalid-date' };
    }

    const remainingMs = DELETE_WINDOW_MS - (Date.now() - createdAtMs);
    if (remainingMs <= 0) {
      return { allowed: false, reason: 'expired', remainingMs: 0 };
    }

    return { allowed: true, reason: 'within-window', remainingMs };
  }

  function formatRemainingMs(ms) {
    const safeMs = Math.max(0, Number(ms) || 0);
    const totalSeconds = Math.ceil(safeMs / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins <= 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  }

  const imageEvidences = useMemo(() => {
    return (evidences || []).filter((ev) => isEvidenceImage(ev));
  }, [evidences]);

  const nonImageEvidences = useMemo(() => {
    return (evidences || []).filter((ev) => inferEvidenceKind(ev) !== 'image');
  }, [evidences]);

  // ✅ UTILISÉ dans la liste des preuves (vignettes)
  function openEvidenceLightbox(fromId) {
    const idx = imageEvidences.findIndex((e) => e.id === fromId);
    if (idx >= 0) setEvidenceLightbox({ open: true, index: idx });
  }

  function closeEvidenceLightbox() {
    setEvidenceLightbox({ open: false, index: 0 });
  }

  function prevEvidence() {
    if (!imageEvidences.length) return;
    setEvidenceLightbox((lb) => ({
      open: true,
      index: (lb.index - 1 + imageEvidences.length) % imageEvidences.length,
    }));
  }

  function nextEvidence() {
    if (!imageEvidences.length) return;
    setEvidenceLightbox((lb) => ({
      open: true,
      index: (lb.index + 1) % imageEvidences.length,
    }));
  }

  /* ============================================================
     🔄 Initialisation sécurisée (master / multi-pays)
  ============================================================ */
  const init = useCallback(async () => {
    try {
      const ud = await me();
      const current = ud?.user;
      if (!current) {
        navigate('/login');
        return;
      }
      setUser(current);

      const [o, prodsRes] = await Promise.all([
        getOrderById(id),
        getProducts({ limit: 200 }),
      ]);

      if (!o) {
        navigate('/orders');
        return;
      }

      setOrder(o);

      const prods = Array.isArray(prodsRes) ? prodsRes : prodsRes?.products;
      setProducts(Array.isArray(prods) ? prods : []);

      const evsRes = await getOrderEvidences(id);
      const evs = Array.isArray(evsRes) ? evsRes : evsRes?.evidences;
      setEvidences(Array.isArray(evs) ? evs : []);
    } catch (e) {
      if (e?.response?.status === 401) {
        localStorage.removeItem('teranga_token');
        localStorage.removeItem('token');
        navigate('/login');
      } else {
        console.error('❌ init OrderDetailPage:', e);
      }
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    init();
  }, [init]);

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

  const refresh = useCallback(async () => {
    const o = await getOrderById(id);
    setOrder(o || null);
  }, [id]);

  const refreshEvidences = useCallback(async () => {
    const evsRes = await getOrderEvidences(id);
    const evs = Array.isArray(evsRes) ? evsRes : evsRes?.evidences;
    setEvidences(Array.isArray(evs) ? evs : []);
  }, [id]);

  /* ============================================================
     🔄 Mise à jour statut commande
  ============================================================ */
  async function handleOrderUpdate(patch) {
    try {
      const payload = {};

      if (patch.orderStatus) {
        payload.status = canonicalizeOrderStatus(patch.orderStatus);
      }
      if (patch.paymentStatus) {
        payload.paymentStatus = canonicalizePaymentStatus(patch.paymentStatus);
      }

      await updateOrder(id, payload);
      await refresh();
      notify(t("orderDetail.alerts.updateSuccess"));
    } catch (e) {
      console.error('❌ update order:', e);
      notify(t("orderDetail.alerts.updateError"));
    }
  }

  /* ============================================================
     🧩 Gestion articles
  ============================================================ */
  async function handleAddItem(e) {
    e.preventDefault();

    if (!itemForm.productId) return notify(t("orderDetail.alerts.productRequired"));
    if (Number(itemForm.quantity) <= 0)
      return notify(t("orderDetail.alerts.invalidQuantity"));

    try {
      const payload = {
        productId: Number(itemForm.productId),
        quantity: Number(itemForm.quantity),
      };

      if (itemForm.unitPrice !== '' && itemForm.unitPrice !== null) {
        payload.unitPrice = Number(itemForm.unitPrice);
      }

      await addOrderItem(id, payload);

      setItemForm({ productId: '', quantity: 1, unitPrice: '' });
      await refresh();
      notify(t("orderDetail.alerts.itemAdded"));
    } catch (e2) {
      console.error('❌ add item:', e2);
      notify(t("orderDetail.alerts.itemAddError"));
    }
  }

  async function handleUpdateItem(itemId, patch) {
    try {
      await updateOrderItem(id, itemId, patch);
      await refresh();
    } catch (e) {
      console.error('❌ update item:', e);
      notify(t("orderDetail.alerts.itemUpdateError"));
    }
  }

  async function handleDeleteItem(itemId) {
    const ok = await confirmDelete("orderItem");
    if (!ok) return;

    try {
      await deleteOrderItem(id, itemId);
      await refresh();
    } catch (e) {
      console.error('❌ delete item:', e);
      notify(t("orderDetail.alerts.itemDeleteError"));
    }
  }

  /* ============================================================
     📎 Gestion preuves
  ============================================================ */
  function onFilesChange(ev) {
    const selected = Array.from(ev.target.files || []);
    setFiles(selected);
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!files.length) return notify(t("orderDetail.alerts.fileRequired"));

    setUploading(true);
    try {
      await uploadOrderEvidences(id, files, notes);

      setFiles([]);
      setNotes('');

      if (fileInputRef.current) fileInputRef.current.value = '';
      setFileInputKey(Date.now());

      await refreshEvidences();
      notify(t("orderDetail.alerts.evidenceAdded"));
    } catch (e2) {
      console.error('❌ upload evidences:', e2);
      notify(t("orderDetail.alerts.evidenceUploadError"));
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteEvidence(evId) {
    const ok = await confirmDelete("evidence");
    if (!ok) return;

    try {
      await deleteOrderEvidence(evId);
      await refreshEvidences();
    } catch (e) {
      console.error('❌ delete evidence:', e);
      const msg =
        e?.response?.data?.error || t("orderDetail.alerts.evidenceDeleteError");
      notify(msg);
    }
  }
  /* ============================================================
     ⏳ Loading + commande introuvable
  ============================================================ */
  if (!user || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <p className="text-lg text-gray-600 animate-pulse">
          {t("orderDetail.loading")}
        </p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <p className="text-gray-600 text-lg">{t("orderDetail.notFound")}</p>
      </div>
    );
  }

  // ✅ Multi-pays / master: on autorise admin + master aux actions admin
  const canAdmin = user.role === 'admin' || user.role === 'master';
  const canUploadProofs = ['admin', 'agent', 'client', 'master'].includes(user.role);

  const total = Number(order.totalAmount || 0);
  const currency = order.currency || 'XOF';
  const currencyLabel = t(`currency.${currency}`, { defaultValue: currency });
  const getCurrencyLabel = (code) =>
    t(`currency.${code || currency}`, { defaultValue: code || currency });
  const orderStatusLabel = t(
    `orders.status.${canonicalizeOrderStatus(order.orderStatus)}`,
    { defaultValue: order.orderStatus }
  );
  const paymentStatusLabel = t(
    `orders.payment.${canonicalizePaymentStatus(order.paymentStatus)}`,
    { defaultValue: order.paymentStatus }
  );

  const statusStepKey = mapStatusToStepKey(order.orderStatus);
  const activeStepIndex = ORDER_STEP_DEFS.findIndex((s) => s.key === statusStepKey);

  /* ============================================================
     ⭐ UI PRINCIPALE
  ============================================================ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-3 sm:px-4 py-10">
      <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-2xl p-5 sm:p-8 border border-gray-100">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 break-words">
              🧾 {order.code || t("orderDetail.title", { id: order.id })}
            </h1>
            <p className="text-sm text-slate-600">
              {t("orderDetail.subtitle")}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              to="/orders"
              className="px-4 py-2 text-sm rounded-lg bg-slate-700 text-white hover:bg-slate-800 shadow-sm"
            >
              {t("orderDetail.actions.back")}
            </Link>

            {canAdmin && (
              <button
                onClick={() => handleOrderUpdate({ orderStatus: 'cancelled' })}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 shadow-sm"
              >
                {t("orderDetail.actions.cancel")}
              </button>
            )}
          </div>
        </div>

        {/* RÉSUMÉ */}
        <div className="grid lg:grid-cols-3 gap-4 mb-10">
          {/* CLIENT */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 p-4 rounded-xl shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
              👤 {t("orderDetail.sections.customer")}
            </h3>
            <p className="font-medium text-slate-900 break-words">{customerDisplay}</p>

            {order.customer?.email && (
              <p className="text-xs text-slate-500 mt-1 break-all">{order.customer.email}</p>
            )}

            {isGlobalAdmin && (
              <p className="text-xs text-slate-500 mt-2 break-words">
                <span className="font-semibold text-slate-700">
                  {t("common.locationLabel")}:
                </span>{' '}
                {getGeoLabel(order) || t("common.dash")}
              </p>
            )}

            {order.customerNote && (
              <p className="text-sm text-slate-700 mt-3 break-words">
                <span className="font-semibold">
                  {t("orderDetail.labels.note")}
                </span>{' '}
                {order.customerNote}
              </p>
            )}
          </div>

          {/* STATUTS + TIMELINE */}
          <div className="bg-gradient-to-br from-blue-50 to-slate-50 border border-slate-200 p-4 rounded-xl shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
              📌 {t("orderDetail.sections.statuses")}
            </h3>

            <div className="flex flex-wrap gap-2 mb-3">
              <span className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-xs font-semibold">
                {t("orderDetail.labels.orderStatus")} {orderStatusLabel}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-xs font-semibold">
                {t("orderDetail.labels.paymentStatus")} {paymentStatusLabel}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {ORDER_STEP_DEFS.map((s, i) => (
                <div
                  key={s.key}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs border transition ${
                    i <= activeStepIndex
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-100 text-slate-400 border-slate-200'
                  }`}
                  title={t(s.labelKey)}
                >
                  {s.icon}
                </div>
              ))}
            </div>

            {canAdmin && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="px-3 py-1 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                  onClick={() =>
                    handleOrderUpdate({
                      orderStatus: 'paid',
                      paymentStatus: 'paid',
                    })
                  }
                >
                  {t("orderDetail.actions.markPaid")}
                </button>

                <button
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  onClick={() =>
                    handleOrderUpdate({
                      orderStatus: 'delivered',
                      paymentStatus: 'paid',
                    })
                  }
                >
                  {t("orderDetail.actions.markDelivered")}
                </button>
              </div>
            )}
          </div>

          {/* MONTANT */}
          <div className="bg-gradient-to-br from-emerald-50 via-white to-blue-50 border border-emerald-100 p-4 rounded-xl shadow-sm">
            <h3 className="text-slate-800 font-semibold mb-2 flex items-center gap-2">
              💰 {t("orderDetail.sections.summary")}
            </h3>

            <p className="text-xs text-slate-500 uppercase">
              {t("orderDetail.labels.totalAmount")}
            </p>
            <p className="text-2xl font-extrabold text-blue-600">
              {formatNumber(total)} {currencyLabel}
            </p>

            {order.items?.length > 0 && (
              <p className="text-xs text-slate-500 mt-3">
                {t("orderDetail.summary.itemsCount", {
                  count: order.items.length,
                })}
              </p>
            )}
          </div>
        </div>

        {/* ===================== ARTICLES ===================== */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
            🧩 {t("orderDetail.items.title")}
            {order.items?.length ? (
              <span className="text-xs text-slate-500">
                ({t("orderDetail.items.count", { count: order.items.length })})
              </span>
            ) : null}
          </h2>

          {order.items?.length ? (
            <div className="grid gap-4">
              {order.items.map((it) => {
                const unit = Number(it.unitPrice || it.price || 0);
                const lineTotal = unit * Number(it.quantity || 0);

                return (
                  <div
                    key={it.id}
                    className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex flex-col sm:flex-row justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <p className="font-semibold text-slate-900 break-words">
                        {it.product?.name ||
                          t("orderDetail.items.itemFallback", { id: it.id })}
                      </p>

                      <p className="text-xs text-slate-500">
                        {t("orderDetail.items.itemId", { id: it.id })}
                      </p>

                      <p className="text-sm text-slate-700">
                        {t("orderDetail.items.quantity")}{" "}
                        <span className="font-semibold">{it.quantity}</span>
                      </p>

                      <p className="text-sm text-slate-700">
                        {t("orderDetail.items.unitPrice")}{' '}
                        <span className="font-semibold">
                          {formatNumber(unit)} {getCurrencyLabel(currency)}
                        </span>
                      </p>

                      <p className="text-sm text-slate-700">
                        {t("orderDetail.items.total")}{' '}
                        <span className="font-semibold text-blue-700">
                          {formatNumber(lineTotal)} {getCurrencyLabel(currency)}
                        </span>
                      </p>
                    </div>

                    {canAdmin && (
                      <div className="flex flex-wrap gap-2 justify-end items-start">
                        <button
                          className="px-3 py-1 bg-amber-500 text-white rounded-lg text-xs hover:bg-amber-600"
                          onClick={() => handleUpdateItem(it.id, { itemStatus: 'cancelled' })}
                        >
                          {t("orderDetail.items.cancel")}
                        </button>

                        <button
                          className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs hover:bg-red-700"
                          onClick={() => handleDeleteItem(it.id)}
                        >
                          {t("orderDetail.items.delete")}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">
              {t("orderDetail.items.empty")}
            </p>
          )}

          {/* Ajout d’article - Admin/Master */}
          {canAdmin && (
            <form
              onSubmit={handleAddItem}
              className="mt-5 bg-gray-50 border border-slate-200 p-4 rounded-xl shadow-sm"
            >
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                ➕ {t("orderDetail.items.addTitle")}
              </h3>

              <div className="grid md:grid-cols-4 gap-3">
                <select
                  value={itemForm.productId}
                  onChange={(e) => setItemForm({ ...itemForm, productId: e.target.value })}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="">{t("orderDetail.items.selectPlaceholder")}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatNumber(p.price || 0)}{' '}
                      {getCurrencyLabel(p.currency || currency)}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min={1}
                  value={itemForm.quantity}
                  onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  placeholder={t("orderDetail.items.quantityPlaceholder")}
                />

                <input
                  type="number"
                  step="0.01"
                  value={itemForm.unitPrice}
                  onChange={(e) => setItemForm({ ...itemForm, unitPrice: e.target.value })}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  placeholder={t("orderDetail.items.unitPricePlaceholder")}
                />

                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm"
                >
                  {t("orderDetail.items.addButton")}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* ===================== PREUVES ===================== */}
        {canUploadProofs && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
              📎 {t("orderDetail.sections.evidences")}
              {evidences.length > 0 && (
                <span className="text-xs text-slate-500">
                  ({t("orderDetail.evidences.count", {
                    count: evidences.length,
                  })})
                </span>
              )}
            </h2>
            {!canAdmin && (
              <p className="text-xs text-slate-500 italic mb-3">
                🕒 {t("orderDetail.evidences.hintDeleteWindow")}
              </p>
            )}

            {/* Upload */}
            <form
              onSubmit={handleUpload}
              className="bg-gray-50 border border-slate-200 p-4 rounded-xl shadow-sm mb-5"
            >
              <div className="grid md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">
                    {t("orderDetail.labels.files")}
                  </label>
                  <input
                    key={fileInputKey}
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={onFilesChange}
                    className="w-full border border-slate-300 px-3 py-2 rounded-lg text-sm bg-white"
                  />
                  {files.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      {t("orderDetail.evidences.filesSelected", {
                        count: files.length,
                      })}
                    </p>
                  )}
                  <p className="text-[0.7rem] text-slate-400 mt-1">
                    {t("orderDetail.evidences.addMoreLater")}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">
                    {t("orderDetail.labels.uploadNotes")}
                  </label>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t("orderDetail.evidences.notesPlaceholder")}
                    className="w-full border border-slate-300 px-3 py-2 rounded-lg text-sm bg-white"
                  />
                </div>
              </div>

              <div className="text-right mt-3">
                <button
                  type="submit"
                  disabled={uploading}
                  className={`px-4 py-2 text-sm rounded-lg shadow-sm ${
                    uploading
                      ? 'bg-blue-300 cursor-not-allowed text-white'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {uploading
                    ? t("orderDetail.evidences.uploading")
                    : t("orderDetail.evidences.uploadButton")}
                </button>
              </div>
            </form>

            {imageEvidences.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm sm:text-base font-semibold text-slate-900">
                    {t("orderDetail.sections.imagesGallery")}
                  </h3>
                  <span className="text-xs text-slate-500">
                    {t("orderDetail.evidences.imagesCount", {
                      count: imageEvidences.length,
                    })}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {imageEvidences.map((ev) => {
                    const fileUrl = toAbsUrl(ev.filePath);
                    return (
                      <button
                        key={`gallery-${ev.id}`}
                        type="button"
                        onClick={() => openEvidenceLightbox(ev.id)}
                        className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-slate-200 bg-slate-50"
                        title={t("orderDetail.labels.preview")}
                      >
                        <img
                          src={fileUrl}
                          alt={ev.originalName || t("orderDetail.labels.proof")}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition" />
                        <div className="absolute bottom-2 left-2 right-2 text-[0.7rem] text-white font-semibold truncate drop-shadow">
                          {ev.originalName || t("orderDetail.labels.proof")}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {nonImageEvidences.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm sm:text-base font-semibold text-slate-900">
                    {t("orderDetail.sections.docsGallery")}
                  </h3>
                  <span className="text-xs text-slate-500">
                    {t("orderDetail.evidences.docsCount", {
                      count: nonImageEvidences.length,
                    })}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {nonImageEvidences.map((ev) => {
                    const fileUrl = toAbsUrl(ev.filePath);
                    const kind = inferEvidenceKind(ev);
                    const extLabel = getFileExtLabel(
                      ev.originalName || ev.filePath,
                      kind === 'pdf'
                        ? t("orderDetail.labels.pdf")
                        : t("orderDetail.labels.file")
                    );
                    const typeLabel =
                      kind === 'pdf'
                        ? t("orderDetail.labels.pdf")
                        : t("orderDetail.labels.file");

                    return (
                      <a
                        key={`doc-${ev.id}`}
                        href={fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-slate-200 bg-white hover:shadow-md transition"
                      >
                        <div
                          className={`absolute top-2 left-2 text-[0.65rem] font-semibold px-2 py-0.5 rounded-full border ${
                            kind === 'pdf'
                              ? 'bg-red-50 text-red-700 border-red-100'
                              : 'bg-gray-50 text-gray-700 border-gray-200'
                          }`}
                        >
                          {typeLabel}
                        </div>

                        <div className="h-full w-full flex flex-col items-center justify-center px-2 text-center">
                          <div className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-2 py-1 rounded-full inline-flex">
                            {extLabel}
                          </div>
                          <div className="mt-2 text-[0.7rem] text-slate-600 truncate w-full">
                            {ev.originalName || t("orderDetail.labels.document")}
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Liste des preuves */}
            {evidences.length === 0 ? (
              <p className="text-sm text-slate-500 italic">
                {t("orderDetail.evidences.noEvidence")}
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {evidences.map((ev) => {
                  const kind = inferEvidenceKind(ev);
                  const isImg = kind === 'image';
                  const fileUrl = toAbsUrl(ev.filePath);
                  const extLabel = getFileExtLabel(
                    ev.originalName || ev.filePath,
                    kind === 'pdf'
                      ? t("orderDetail.labels.pdf")
                      : t("orderDetail.labels.file")
                  );
                  const deleteInfo = getDeleteEligibility(user, ev);

                  return (
                    <div
                      key={ev.id}
                      className="group bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-lg transition overflow-hidden"
                    >
                      {/* PREVIEW */}
                      <div className="relative aspect-[4/3] bg-gradient-to-br from-slate-50 via-white to-slate-100 border-b border-slate-200">
                        {isImg ? (
                          <button
                            type="button"
                            onClick={() => openEvidenceLightbox(ev.id)}
                            className="w-full h-full"
                            title={t("orderDetail.labels.preview")}
                          >
                            <img
                              src={fileUrl}
                              alt={ev.originalName || t("orderDetail.labels.proof")}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                            />
                          </button>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="text-center">
                              <div className="text-xs font-semibold text-slate-700 bg-white/80 border border-slate-200 px-2 py-1 rounded-full inline-flex">
                                {extLabel}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="absolute top-3 left-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[0.7rem] font-semibold border ${
                              kind === 'image'
                                ? 'bg-blue-50 text-blue-700 border-blue-100'
                                : kind === 'pdf'
                                ? 'bg-red-50 text-red-700 border-red-100'
                                : 'bg-gray-50 text-gray-700 border-gray-200'
                            }`}
                          >
                            {kind === 'image'
                              ? t("orderDetail.labels.image")
                              : kind === 'pdf'
                              ? t("orderDetail.labels.pdf")
                              : t("orderDetail.labels.file")}
                          </span>
                        </div>

                        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                          {isImg && (
                            <button
                              type="button"
                              onClick={() => openEvidenceLightbox(ev.id)}
                              className="px-2.5 py-1.5 text-[0.7rem] font-semibold bg-white/90 border border-slate-200 rounded-lg hover:bg-white"
                            >
                              {t("orderDetail.labels.preview")}
                            </button>
                          )}
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 text-[0.7rem] font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800"
                          >
                            {t("orderDetail.labels.open")}
                          </a>
                        </div>
                      </div>

                      {/* META */}
                      <div className="p-4 sm:p-5">
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 font-semibold hover:underline break-words break-all text-sm block"
                        >
                          {ev.originalName || ev.filePath}
                        </a>

                        <p className="mt-2 text-xs text-slate-500">
                          {t("orderDetail.labels.addedOn")}{' '}
                          {ev.createdAt
                            ? formatDateTime(ev.createdAt)
                            : t("common.dash")}{' '}
                          {t("orderDetail.labels.by")}{' '}
                          <strong>{formatUploader(ev.uploader)}</strong>
                        </p>

                        {ev.notes && (
                          <p className="mt-2 text-sm text-slate-700 break-words">
                            <span className="font-semibold">
                              {t("orderDetail.labels.notes")}
                            </span>{' '}
                            {ev.notes}
                          </p>
                        )}

                        {deleteInfo.allowed && (
                          <div className="mt-3 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleDeleteEvidence(ev.id)}
                              className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                              {t("orderDetail.evidences.delete")}
                            </button>
                          </div>
                        )}
                        {!canAdmin && deleteInfo.allowed && deleteInfo.reason === 'within-window' && (
                          <p className="mt-2 text-[0.7rem] text-slate-400">
                            {t("orderDetail.evidences.deletePossible", {
                              time: formatRemainingMs(deleteInfo.remainingMs),
                            })}
                          </p>
                        )}
                        {!canAdmin && !deleteInfo.allowed && deleteInfo.reason === 'expired' && (
                          <p className="mt-2 text-[0.7rem] text-slate-400">
                            {t("orderDetail.evidences.deleteExpired")}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* BOTTOM LINKS */}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to={`/orders/${id}/transactions`}
            className="px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900 shadow-sm"
          >
            💰 {t("orderDetail.actions.viewTransactions")}
          </Link>

          <Link
            to="/orders"
            className="px-4 py-2 text-sm bg-gray-200 text-slate-800 rounded-lg hover:bg-gray-300"
          >
            {t("orderDetail.actions.backToOrders")}
          </Link>
        </div>
      </div>

      {/* ============================================================
          💡 LIGHTBOX PLEIN ÉCRAN POUR PREUVES (IMAGES)
      ============================================================ */}
      {evidenceLightbox.open && imageEvidences.length > 0 && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4"
          onClick={closeEvidenceLightbox}
          role="dialog"
          aria-modal="true"
          aria-label={t("orderDetail.lightbox.ariaLabel")}
        >
          {/* Close */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              closeEvidenceLightbox();
            }}
            className="absolute top-4 right-4 text-white text-xl font-bold px-3 py-1 rounded-full bg-black/60 hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white"
            aria-label={t("orderDetail.lightbox.close")}
          >
            ✕
          </button>

          {/* Navigation */}
          {imageEvidences.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  prevEvidence();
                }}
                className="absolute left-4 text-white text-3xl px-3 py-2 rounded-full bg-black/50 hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
                aria-label={t("orderDetail.lightbox.prev")}
              >
                ‹
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  nextEvidence();
                }}
                className="absolute right-4 text-white text-3xl px-3 py-2 rounded-full bg-black/50 hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
                aria-label={t("orderDetail.lightbox.next")}
              >
                ›
              </button>
            </>
          )}

          {/* Contenu lightbox */}
          <div
            className="bg-slate-900/95 border border-slate-700 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 text-slate-100 text-sm">
              <div className="truncate">
                <span className="font-semibold">
                  {imageEvidences[evidenceLightbox.index].originalName ||
                    imageEvidences[evidenceLightbox.index].filePath}
                </span>
              </div>

              {imageEvidences.length > 1 && (
                <div className="text-xs text-slate-400">
                  {evidenceLightbox.index + 1} / {imageEvidences.length}
                </div>
              )}
            </div>

            {/* Image principale */}
            <div className="flex-1 flex items-center justify-center bg-black">
              <img
                src={toAbsUrl(imageEvidences[evidenceLightbox.index].filePath)}
                alt={
                  imageEvidences[evidenceLightbox.index].originalName ||
                    t("orderDetail.labels.proof")
                }
                className="max-h-[70vh] max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


