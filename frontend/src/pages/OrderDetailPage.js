// ============================================================
// OrderDetailPage.jsx Aaa Teranga PRODUCTION READY (Option B2)
// Clean Shop Premium Aaa Responsive Aaa FILE_BASE system (multi-pays)
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
  const fixed = p.startsWith('/') ? p : '/' + p;
  return fixed.replace(/\/{2,}/g, '/');
}

function toAbsUrl(path = '') {
  const norm = normalizePath(path);
  if (!norm) return '';
  if (/^https?:\/\//i.test(norm)) return norm;
 // Contexte: detail de commande.
  return FILE_BASE.replace(/\/$/, '') + norm;
}

/* ============================================================
   Module: detail d une commande.
============================================================ */
const ORDER_STEP_DEFS = [
  { key: 'created', labelKey: 'orderDetail.timeline.created', icon: 'C' },
  { key: 'processing', labelKey: 'orderDetail.timeline.processing', icon: 'P' },
  { key: 'paid', labelKey: 'orderDetail.timeline.paid', icon: '$' },
  { key: 'delivered', labelKey: 'orderDetail.timeline.delivered', icon: 'D' },
  { key: 'closed', labelKey: 'orderDetail.timeline.closed', icon: 'OK' },
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
   Sous-composant formulaire.
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

      if (countryLabel && regionLabel) return `${countryLabel} - ${regionLabel}`;
      return countryLabel || regionLabel || '';
    },
    [countriesById, regionsById, t]
  );

  /* ============================================================
     Filtrage et tri cote interface utilisateur.
  ============================================================ */
  const customerDisplay = useMemo(() => {
    if (!order?.customer) return "-";
    const c = order.customer;

    const first = c.firstName ?? c.firstname ?? '';
    const last = c.lastName ?? c.lastname ?? '';

    return `${first} ${last}`.trim() || c.name || c.email || "-";
  }, [order]);

  /* ============================================================
     Sous-composant formulaire.
  ============================================================ */
  function formatUploader(u) {
    if (!u) return "-";
    const first = u.firstName ?? u.firstname ?? '';
    const last = u.lastName ?? u.lastname ?? '';
    return `${first} ${last}`.trim() || u.name || u.email || "-";
  }

  /* ============================================================
     Rendu principal.
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

 // Contexte: detail de commande.
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
     Initialisation au montage.
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
        console.error("init OrderDetailPage:", e);
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
        console.error("Erreur chargement pays/regions:", e);
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
     Contexte: detail d une commande.
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
      console.error("update order:", e);
      notify(t("orderDetail.alerts.updateError"));
    }
  }

  /* ============================================================
     Contexte: detail d une commande.
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
      console.error("add item:", e2);
      notify(t("orderDetail.alerts.itemAddError"));
    }
  }

  async function handleUpdateItem(itemId, patch) {
    try {
      await updateOrderItem(id, itemId, patch);
      await refresh();
    } catch (e) {
      console.error("update item:", e);
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
      console.error("delete item:", e);
      notify(t("orderDetail.alerts.itemDeleteError"));
    }
  }

  /* ============================================================
     Contexte: detail d une commande.
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
      console.error("upload evidences:", e2);
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
      console.error("delete evidence:", e);
      const msg =
        e?.response?.data?.error || t("orderDetail.alerts.evidenceDeleteError");
      notify(msg);
    }
  }
  /* ============================================================
     Affiche l etat de chargement.
  ============================================================ */
  if (!user || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-surface-main">
        <p className="text-lg text-text-secondary animate-pulse">
          {t("orderDetail.loading")}
        </p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-surface-main">
        <p className="text-text-secondary text-lg">{t("orderDetail.notFound")}</p>
      </div>
    );
  }

 // Contexte: detail de commande.
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
     Rendu principal.
  ============================================================ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-3 sm:px-4 py-10">
      <div className="max-w-6xl mx-auto bg-surface-card shadow-xl rounded-2xl p-5 sm:p-8 border border-border/70">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary break-words">              {order.code || t("orderDetail.title", { id: order.id })}
            </h1>
            <p className="text-sm text-text-secondary">
              {t("orderDetail.subtitle")}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              to="/orders"
              className="px-4 py-2 text-sm rounded-lg app-btn-neutral shadow-sm"
            >
              {t("orderDetail.actions.back")}
            </Link>

            {canAdmin && (
              <button
                onClick={() => handleOrderUpdate({ orderStatus: 'cancelled' })}
                className="px-4 py-2 text-sm rounded-lg app-btn-danger shadow-sm"
              >
                {t("orderDetail.actions.cancel")}
              </button>
            )}
          </div>
        </div>

 {/* RAaSUMAa */}
        <div className="grid lg:grid-cols-3 gap-4 mb-10">
          {/* CLIENT */}
          <div className="bg-gradient-to-br from-surface-main to-surface-main border border-border p-4 rounded-xl shadow-sm">
            <h3 className="font-semibold text-text-primary mb-2 flex items-center gap-2">              {t("orderDetail.sections.customer")}
            </h3>
            <p className="font-medium text-text-primary break-words">{customerDisplay}</p>

            {order.customer?.email && (
              <p className="text-xs text-text-muted mt-1 break-all">{order.customer.email}</p>
            )}

            {isGlobalAdmin && (
              <p className="text-xs text-text-muted mt-2 break-words">
                <span className="font-semibold text-text-secondary">
                  {t("common.locationLabel")}:
                </span>{' '}
                {getGeoLabel(order) || t("common.dash")}
              </p>
            )}

            {order.customerNote && (
              <p className="text-sm text-text-secondary mt-3 break-words">
                <span className="font-semibold">
                  {t("orderDetail.labels.note")}
                </span>{' '}
                {order.customerNote}
              </p>
            )}
          </div>

          {/* STATUTS + TIMELINE */}
          <div className="bg-gradient-to-br from-surface-main via-surface-card to-surface-main border border-border p-4 rounded-xl shadow-sm">
            <h3 className="font-semibold text-text-primary mb-2 flex items-center gap-2">              {t("orderDetail.sections.statuses")}
            </h3>

            <div className="flex flex-wrap gap-2 mb-3">
              <span className="px-2.5 py-1 rounded-full bg-surface-card border border-border text-xs font-semibold">
                {t("orderDetail.labels.orderStatus")} {orderStatusLabel}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-surface-card border border-border text-xs font-semibold">
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
                      : 'bg-surface-main/80 text-text-muted border-border'
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
                  className="px-3 py-1 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600/90 dark:hover:bg-emerald-500"
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
                  className="px-3 py-1 text-xs rounded-lg app-btn-primary"
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
          <div className="bg-gradient-to-br from-surface-main via-surface-card to-surface-main border border-border p-4 rounded-xl shadow-sm">
            <h3 className="text-text-primary font-semibold mb-2 flex items-center gap-2">              {t("orderDetail.sections.summary")}
            </h3>

            <p className="text-xs text-text-muted uppercase">
              {t("orderDetail.labels.totalAmount")}
            </p>
            <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-300">
              {formatNumber(total)} {currencyLabel}
            </p>

            {order.items?.length > 0 && (
              <p className="text-xs text-text-muted mt-3">
                {t("orderDetail.summary.itemsCount", {
                  count: order.items.length,
                })}
              </p>
            )}
          </div>
        </div>

        {/* ===================== ARTICLES ===================== */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">            {t("orderDetail.items.title")}
            {order.items?.length ? (
              <span className="text-xs text-text-muted">
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
                    className="bg-surface-card border border-border p-4 rounded-xl shadow-sm flex flex-col sm:flex-row justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <p className="font-semibold text-text-primary break-words">
                        {it.product?.name ||
                          t("orderDetail.items.itemFallback", { id: it.id })}
                      </p>

                      <p className="text-xs text-text-muted">
                        {t("orderDetail.items.itemId", { id: it.id })}
                      </p>

                      <p className="text-sm text-text-secondary">
                        {t("orderDetail.items.quantity")}{" "}
                        <span className="font-semibold">{it.quantity}</span>
                      </p>

                      <p className="text-sm text-text-secondary">
                        {t("orderDetail.items.unitPrice")}{' '}
                        <span className="font-semibold">
                          {formatNumber(unit)} {getCurrencyLabel(currency)}
                        </span>
                      </p>

                      <p className="text-sm text-text-secondary">
                        {t("orderDetail.items.total")}{' '}
                        <span className="font-semibold text-blue-700 dark:text-blue-300">
                          {formatNumber(lineTotal)} {getCurrencyLabel(currency)}
                        </span>
                      </p>
                    </div>

                    {canAdmin && (
                      <div className="flex flex-wrap gap-2 justify-end items-start">
                        <button
                          className="px-3 py-1 text-xs rounded-lg app-btn-warning"
                          onClick={() => handleUpdateItem(it.id, { itemStatus: 'cancelled' })}
                        >
                          {t("orderDetail.items.cancel")}
                        </button>

                        <button
                          className="px-3 py-1 text-xs rounded-lg app-btn-danger"
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
            <p className="text-sm text-text-muted italic">
              {t("orderDetail.items.empty")}
            </p>
          )}

 {/* Ajout dAaaarticle - Admin/Master */}
          {canAdmin && (
            <form
              onSubmit={handleAddItem}
              className="mt-5 bg-surface-main border border-border p-4 rounded-xl shadow-sm"
            >
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">                {t("orderDetail.items.addTitle")}
              </h3>

              <div className="grid md:grid-cols-4 gap-3">
                <select
                  value={itemForm.productId}
                  onChange={(e) => setItemForm({ ...itemForm, productId: e.target.value })}
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-surface-card"
                >
                  <option value="">{t("orderDetail.items.selectPlaceholder")}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} - {formatNumber(p.price || 0)}{" "}
                      {getCurrencyLabel(p.currency || currency)}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min={1}
                  value={itemForm.quantity}
                  onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })}
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-surface-card"
                  placeholder={t("orderDetail.items.quantityPlaceholder")}
                />

                <input
                  type="number"
                  step="0.01"
                  value={itemForm.unitPrice}
                  onChange={(e) => setItemForm({ ...itemForm, unitPrice: e.target.value })}
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-surface-card"
                  placeholder={t("orderDetail.items.unitPricePlaceholder")}
                />

                <button
                  type="submit"
                  className="px-4 py-2 text-sm rounded-lg app-btn-primary shadow-sm"
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
            <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">              {t("orderDetail.sections.evidences")}
              {evidences.length > 0 && (
                <span className="text-xs text-text-muted">
                  ({t("orderDetail.evidences.count", {
                    count: evidences.length,
                  })})
                </span>
              )}
            </h2>
            {!canAdmin && (
              <p className="text-xs text-text-muted italic mb-3">                {t("orderDetail.evidences.hintDeleteWindow")}
              </p>
            )}

            {/* Upload */}
            <form
              onSubmit={handleUpload}
              className="bg-surface-main border border-border p-4 rounded-xl shadow-sm mb-5"
            >
              <div className="grid md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-text-secondary mb-1 block">
                    {t("orderDetail.labels.files")}
                  </label>
                  <input
                    key={fileInputKey}
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={onFilesChange}
                    className="w-full border border-border px-3 py-2 rounded-lg text-sm bg-surface-card"
                  />
                  {files.length > 0 && (
                    <p className="text-xs text-text-muted mt-1">
                      {t("orderDetail.evidences.filesSelected", {
                        count: files.length,
                      })}
                    </p>
                  )}
                  <p className="text-[0.7rem] text-text-muted mt-1">
                    {t("orderDetail.evidences.addMoreLater")}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-text-secondary mb-1 block">
                    {t("orderDetail.labels.uploadNotes")}
                  </label>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t("orderDetail.evidences.notesPlaceholder")}
                    className="w-full border border-border px-3 py-2 rounded-lg text-sm bg-surface-card"
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
                      : 'app-btn-primary'
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
                  <h3 className="text-sm sm:text-base font-semibold text-text-primary">
                    {t("orderDetail.sections.imagesGallery")}
                  </h3>
                  <span className="text-xs text-text-muted">
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
                        className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-border bg-surface-main"
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
                  <h3 className="text-sm sm:text-base font-semibold text-text-primary">
                    {t("orderDetail.sections.docsGallery")}
                  </h3>
                  <span className="text-xs text-text-muted">
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
                        className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-border bg-surface-card hover:shadow-md transition"
                      >
                        <div
                          className={`absolute top-2 left-2 text-[0.65rem] font-semibold px-2 py-0.5 rounded-full border ${
                            kind === 'pdf'
                              ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                              : 'bg-surface-main text-text-secondary border-border'
                          }`}
                        >
                          {typeLabel}
                        </div>

                        <div className="h-full w-full flex flex-col items-center justify-center px-2 text-center">
                          <div className="text-xs font-semibold text-text-secondary bg-surface-main border border-border px-2 py-1 rounded-full inline-flex">
                            {extLabel}
                          </div>
                          <div className="mt-2 text-[0.7rem] text-text-secondary truncate w-full">
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
              <p className="text-sm text-text-muted italic">
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
                      className="group bg-surface-card border border-border rounded-2xl shadow-sm hover:shadow-lg transition overflow-hidden"
                    >
                      {/* PREVIEW */}
                      <div className="relative aspect-[4/3] bg-gradient-to-br from-surface-main via-surface-card to-surface-main border-b border-border">
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
                              <div className="text-xs font-semibold text-text-secondary bg-surface-card/80 border border-border px-2 py-1 rounded-full inline-flex">
                                {extLabel}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="absolute top-3 left-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[0.7rem] font-semibold border ${
                              kind === 'image'
                                ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
                                : kind === 'pdf'
                                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                                : 'bg-surface-main text-text-secondary border-border'
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
                              className="px-2.5 py-1.5 text-[0.7rem] font-semibold bg-surface-card/90 border border-border rounded-lg hover:bg-surface-card"
                            >
                              {t("orderDetail.labels.preview")}
                            </button>
                          )}
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 text-[0.7rem] font-semibold app-btn-neutral rounded-lg"
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
                          className="text-blue-600 dark:text-blue-300 font-semibold hover:underline break-words break-all text-sm block"
                        >
                          {ev.originalName || ev.filePath}
                        </a>

                        <p className="mt-2 text-xs text-text-muted">
                          {t("orderDetail.labels.addedOn")}{' '}
                          {ev.createdAt
                            ? formatDateTime(ev.createdAt)
                            : t("common.dash")}{' '}
                          {t("orderDetail.labels.by")}{' '}
                          <strong>{formatUploader(ev.uploader)}</strong>
                        </p>

                        {ev.notes && (
                          <p className="mt-2 text-sm text-text-secondary break-words">
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
                              className="px-3 py-1.5 text-xs rounded-lg app-btn-danger"
                            >
                              {t("orderDetail.evidences.delete")}
                            </button>
                          </div>
                        )}
                        {!canAdmin && deleteInfo.allowed && deleteInfo.reason === 'within-window' && (
                          <p className="mt-2 text-[0.7rem] text-text-muted">
                            {t("orderDetail.evidences.deletePossible", {
                              time: formatRemainingMs(deleteInfo.remainingMs),
                            })}
                          </p>
                        )}
                        {!canAdmin && !deleteInfo.allowed && deleteInfo.reason === 'expired' && (
                          <p className="mt-2 text-[0.7rem] text-text-muted">
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
            className="px-4 py-2 text-sm app-btn-neutral rounded-lg shadow-sm"
          >            {t("orderDetail.actions.viewTransactions")}
          </Link>

          <Link
            to="/orders"
            className="px-4 py-2 text-sm app-btn-soft rounded-lg"
          >
            {t("orderDetail.actions.backToOrders")}
          </Link>
        </div>
      </div>

      {/* ============================================================
          Lightbox medias plein ecran.
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
          >x</button>

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
              >{"<"}</button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  nextEvidence();
                }}
                className="absolute right-4 text-white text-3xl px-3 py-2 rounded-full bg-black/50 hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
                aria-label={t("orderDetail.lightbox.next")}
              >{">"}</button>
            </>
          )}

          {/* Contenu lightbox */}
          <div
            className="bg-slate-900/95 border border-border rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border text-white text-sm">
              <div className="truncate">
                <span className="font-semibold">
                  {imageEvidences[evidenceLightbox.index].originalName ||
                    imageEvidences[evidenceLightbox.index].filePath}
                </span>
              </div>

              {imageEvidences.length > 1 && (
                <div className="text-xs text-text-muted">
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
