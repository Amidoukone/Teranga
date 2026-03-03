// ============================================================
// OrderTransactionsPage.jsx Aaa Teranga PRODUCTION READY (Option B2-A)
// Clean Shop Premium + FILE_BASE + toAbsUrl + Optimisations visuelles
// Contexte: transactions de commande.
// Contexte: transactions de commande.
// Contexte: transactions de commande.
// ============================================================

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getOrderTransactions,
  createOrderTransaction,
} from '../services/transactions';
import { me } from '../services/auth';
import { getCountries } from '../services/countries';
import { getRegions } from '../services/regions';
import {
  applyLabels,
  TRANSACTION_TYPES,
  CURRENCY_LABELS,
  TRANSACTION_STATUSES,
} from '../utils/labels';
import { isGlobalAdminUser } from '../utils/role';
import { useLocale } from '../i18n/useLocale';
import { useTranslation } from 'react-i18next';
import { notify } from '../utils/notify';

/* ============================================================
   Module: transactions liees aux commandes.
   Compatible Render + Netlify, aucun localhost
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
  return FILE_BASE.replace(/\/$/, '') + norm;
}

/* ============================================================
   Helpers (display + proof url)
============================================================ */
function getUserDisplay(u) {
  if (!u) return "-";
  const first = u.firstName ?? u.firstname ?? '';
  const last = u.lastName ?? u.lastname ?? '';
  const full = `${first} ${last}`.trim();
  if (full) return full;
  if (u.name) return u.name;
  if (u.email) return u.email;
  return '-';
}

/**
 * Contexte: transactions de commande.
 * Contexte: transactions de commande.
 * - { url, fileId, originalName, mimeType, size }
 * - { path } (legacy)
 * - { filePath } (legacy)
 * - string url/path
 */
function getProofHref(t) {
  const pf = t?.proofFile;
  if (!pf) return '';

  if (typeof pf === 'string') {
 // Contexte: transactions de commande.
    return toAbsUrl(pf);
  }

  const url =
    pf.url ||
    pf.path ||
    pf.filePath ||
    pf.file_url ||
    pf.file ||
    pf.location ||
    '';

  return url ? toAbsUrl(url) : '';
}

function stripUrlParams(url = '') {
  return String(url || '').split('?')[0].split('#')[0];
}

function inferProofKind(pf, proofHref = '') {
  const mime = (pf?.mimeType || '').toLowerCase();
  const name = pf?.originalName || pf?.fileName || pf?.name || '';
  const cleanUrl = stripUrlParams(proofHref);

  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';

  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name) || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(cleanUrl)) {
    return 'image';
  }
  if (/\.pdf$/i.test(name) || /\.pdf$/i.test(cleanUrl)) return 'pdf';
  return 'other';
}

function getProofExtLabel(pf, proofHref = '', fallback = 'FILE') {
  const name = pf?.originalName || pf?.fileName || pf?.name || '';
  const cleanUrl = stripUrlParams(proofHref);
  const candidate = name || (cleanUrl.split('/').pop() || '');
  if (!candidate) return fallback;
  const parts = candidate.split('.');
  if (parts.length < 2) return fallback;
  const ext = parts[parts.length - 1].slice(0, 6).toUpperCase();
  return ext || fallback;
}


/* ============================================================
   Sous-composant formulaire.
============================================================ */
export default function OrderTransactionsPage() {
  const { formatNumber, formatDate, formatTime } = useLocale();
  const { t } = useTranslation();
  const { id } = useParams(); // orderId
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [countries, setCountries] = useState([]);
  const [regions, setRegions] = useState([]);

  // Liste
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false); // chargement liste
  const [creating, setCreating] = useState(false); // Etat creation (verrou formulaire).

  // UI
  const [showForm, setShowForm] = useState(() => {
    const saved = localStorage.getItem('teranga_orderTransactions_showForm');
    return saved === null ? true : saved === '1';
  });

  // Form
  const [form, setForm] = useState({
    type: 'revenue',
    amount: '',
    currency: 'XOF',
    paymentMethod: '',
    description: '',
    proofFile: null,
  });

  // Filtres
  const [filters, setFilters] = useState({
    q: '',
    type: '',
    payment: '',
    sort: '-createdAt',
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

  const orderGeoLabel = useMemo(() => {
    const source = transactions?.[0]?.order || transactions?.[0] || null;
    return getGeoLabel(source);
  }, [transactions, getGeoLabel]);

  /* ============================================================
      Chargement transactions (robuste: array vs {transactions})
  ============================================================ */
  const loadTransactions = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    try {
      const data = await getOrderTransactions(id);

 // Contexte: transactions de commande.
      const arr = Array.isArray(data) ? data : data?.transactions || [];

      const labeled = (arr || []).map((t) => applyLabels(t, 'transaction'));
      setTransactions(labeled);
    } catch (err) {
      console.error("Erreur chargement transactions commande:", err);
      notify(t("orderTransactions.alerts.loadError"));
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  /* ============================================================
      Init user + data
  ============================================================ */
  useEffect(() => {
    (async () => {
      try {
        const userData = await me();
        const current = userData?.user;
        if (!current) {
          window.location.href = '/login';
          return;
        }
        setUser(current);
        await loadTransactions();
      } catch (err) {
        console.error("Erreur init OrderTransactionsPage:", err);
        if (err?.response?.status === 401) {
          localStorage.removeItem('teranga_token');
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
      }
    })();
  }, [loadTransactions]);

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

  // Persistance affichage formulaire
  useEffect(() => {
    localStorage.setItem(
      'teranga_orderTransactions_showForm',
      showForm ? '1' : '0'
    );
  }, [showForm]);

  /* ============================================================
      Contexte: transactions liees aux commandes.
      Soumission protegee (anti double-clic).
  ============================================================ */
  async function handleSubmit(e) {
    e.preventDefault();

 // Contexte: transactions de commande.
    if (creating) return;

    if (!form.amount || isNaN(parseFloat(form.amount))) {
      return notify(t("orderTransactions.alerts.invalidAmount"));
    }

    try {
      setCreating(true); // Active le verrou de creation.

 // Contexte: transactions de commande.
      const payload = {
        ...form,
        amount: parseFloat(form.amount),
      };

      await createOrderTransaction(id, payload);

      notify(t("orderTransactions.alerts.createSuccess"));
      resetForm();
      await loadTransactions();
    } catch (err) {
      console.error("Erreur ajout transaction:", err);
      notify(t("orderTransactions.alerts.createError"));
    } finally {
      setCreating(false); // Desactive le verrou apres reponse API.
    }
  }

  function resetForm() {
    setForm({
      type: 'revenue',
      amount: '',
      currency: 'XOF',
      paymentMethod: '',
      description: '',
      proofFile: null,
    });
  }

  /* ============================================================
      Filtrage et tri cote interface utilisateur.
  ============================================================ */
  const filteredTransactions = useMemo(() => {
    let arr = [...(transactions || [])];

    if (filters.q.trim()) {
      const q = filters.q.trim().toLowerCase();
      arr = arr.filter((t) =>
        [
          t.typeLabel,
          t.statusLabel,
          t.description,
          t.paymentMethod,
          getUserDisplay(t.user),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }

    if (filters.type) {
      arr = arr.filter((t) => t.type === filters.type);
    }

    if (filters.payment) {
      const pay = filters.payment.toLowerCase();
      arr = arr.filter((t) =>
        (t.paymentMethod || '').toLowerCase().includes(pay)
      );
    }

    const by = filters.sort || '-createdAt';
    arr.sort((a, b) => {
      const sign = by.startsWith('-') ? -1 : 1;
      const key = by.replace(/^-/, '');

      let va;
      let vb;

      if (key === 'createdAt') {
        va = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
        vb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      } else if (key === 'amount') {
        va = Number(a?.amount ?? 0);
        vb = Number(b?.amount ?? 0);
      } else {
        va = a?.[key];
        vb = b?.[key];
      }

      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      return 0;
    });

    return arr;
  }, [transactions, filters]);

  /* ============================================================
      Filtrage et tri cote interface utilisateur.
  ============================================================ */
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-main">
        <p className="text-text-secondary text-lg animate-pulse">
          {t("common.loading")}
        </p>
      </div>
    );
  }

 // Contexte: transactions de commande.
  const canCreate = ['admin', 'agent', 'master'].includes(user.role);

  /* ============================================================
      Rendu principal
  ============================================================ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-3 sm:px-4 py-8 sm:py-10">
      <div className="max-w-6xl mx-auto bg-surface-card/95 backdrop-blur-sm shadow-xl rounded-2xl p-4 sm:p-8 border border-border/70 transition-all duration-150 ease-out">

 {/* HEADER Aaa 100% responsive mobile / tablette / desktop */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6 sm:mb-8">
          {/* Bloc titre */}
          <div className="max-w-full break-words">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary flex items-center gap-2">              <span>{t("orderTransactions.title", { id })}</span>
            </h1>
            <p className="text-sm text-text-secondary mt-1 break-words">
              {t("orderTransactions.subtitle")}
            </p>
            {isGlobalAdmin && (
              <p className="text-xs text-text-muted mt-1 break-words">
                <span className="font-semibold text-text-secondary">
                  {t("common.locationLabel")}:
                </span>{' '}
                {orderGeoLabel || t("common.dash")}
              </p>
            )}
          </div>

          {/* Boutons actions (stack sur mobile, inline sur desktop) */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full sm:w-auto sm:justify-end">
            {canCreate && (
              <button
                onClick={() => setShowForm((v) => !v)}
                className="w-full sm:w-auto px-4 py-2 text-sm font-semibold rounded-lg shadow-sm app-btn-neutral transition-all duration-150 text-center"
              >
                {showForm
                  ? `- ${t("orderTransactions.buttons.hideForm")}`
                  : `+ ${t("orderTransactions.buttons.newTransaction")}`}
              </button>
            )}

            <button
              onClick={loadTransactions}
              disabled={loading}
              className={`w-full sm:w-auto px-4 py-2 text-sm font-semibold rounded-lg shadow-sm text-center transition-all duration-150 ${
                loading
                  ? 'bg-blue-300 cursor-not-allowed text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {loading
                ? t("orderTransactions.buttons.refreshLoading")
                : `${t("orderTransactions.buttons.refresh")}`}
            </button>

            <button
              onClick={() => navigate(`/orders/${id}`)}
              className="w-full sm:w-auto px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-surface-main/80 hover:bg-surface-main text-center transition-all duration-150"
            >
              {t("orderTransactions.buttons.back")}
            </button>

            <button
              onClick={() => navigate('/orders')}
              className="w-full sm:w-auto px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-surface-main/80 hover:bg-surface-main text-center transition-all duration-150"
            >
              {t("common.backToOrders")}
            </button>
          </div>
        </div>

        {/* FILTRES */}
        <TransactionFilters
          filters={filters}
          setFilters={setFilters}
          count={filteredTransactions.length}
        />

        {/* FORMULAIRE */}
        {canCreate && showForm && (
          <TransactionForm
            form={form}
            setForm={setForm}
            handleSubmit={handleSubmit}
            loading={loading}
            creating={creating} // Passe l'etat de creation au formulaire.
          />
        )}

        {/* LISTE */}
        <TransactionList
          transactions={filteredTransactions}
          loading={loading}
          getProofHref={getProofHref}
          formatNumber={formatNumber}
          formatDate={formatDate}
          formatTime={formatTime}
        />
      </div>
    </div>
  );
}

/* ============================================================
   Filtrage et tri cote interface utilisateur.
============================================================ */

function TransactionFilters({ filters, setFilters, count }) {
  const { t } = useTranslation();
  return (
    <div className="mb-8 bg-surface-main border border-border rounded-xl p-4 sm:p-5 shadow-sm">
 {/* Ligne recherche seule Aaa pleine largeur, plus respirable */}
      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        <input
          placeholder={t("orderTransactions.filters.searchPlaceholder")}
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          className="w-full border border-border rounded-lg px-3 sm:px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-surface-card shadow-sm break-words transition-all duration-150"
        />
      </div>

      {/* Ligne filtres compactes mais fluides */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Type */}
        <select
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-surface-card w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-150"
        >
          <option value="">{t("orderTransactions.filters.typeAll")}</option>
          {Object.keys(TRANSACTION_TYPES).map((key) => (
            <option key={key} value={key}>
              {t(`transactions.type.${key}`)}
            </option>
          ))}
        </select>

 {/* Contexte: transactions de commande. */}
        <input
          placeholder={t("orderTransactions.filters.paymentPlaceholder")}
          value={filters.payment}
          onChange={(e) => setFilters({ ...filters, payment: e.target.value })}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-surface-card w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-150"
        />

 {/* Contexte: transactions de commande. */}
        <select
          value={filters.sort}
          onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-surface-card w-full sm:col-span-2 lg:col-span-4 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-150"
        >
          <option value="-createdAt">
            {t("orderTransactions.filters.sortNewest")}
          </option>
          <option value="createdAt">
            {t("orderTransactions.filters.sortOldest")}
          </option>
          <option value="amount">
            {t("orderTransactions.filters.sortAmountAsc")}
          </option>
          <option value="-amount">
            {t("orderTransactions.filters.sortAmountDesc")}
          </option>
        </select>
      </div>

      {/* Bas de bloc : compteur + reset (stack sur mobile) */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-text-muted">
        <div className="inline-flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400/80" />
          <span>{t("orderTransactions.filters.foundCount", { count })}</span>
        </div>

        <button
          onClick={() => setFilters({ q: '', type: '', payment: '', sort: '-createdAt' })}
          className="w-full sm:w-auto px-3 py-1.5 bg-surface-main/80 rounded-md hover:bg-surface-main font-medium text-center transition-all duration-150"
        >
          {t("orderTransactions.filters.reset")}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   FORMULAIRE
============================================================ */
function TransactionForm({ form, setForm, handleSubmit, loading, creating }) {
  const isSubmitting = loading || creating;
  const { t } = useTranslation();

  return (
    <div className="mb-10">
      <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">        <span>{t("orderTransactions.form.title")}</span>
      </h2>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-surface-main p-4 sm:p-5 rounded-xl border border-border shadow-sm"
      >
        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            {t("orderTransactions.form.typeLabel")}
          </label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-surface-card focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-150"
          >
            {Object.keys(TRANSACTION_TYPES).map((key) => (
              <option key={key} value={key}>
                {t(`transactions.type.${key}`)}
              </option>
            ))}
          </select>
        </div>

        {/* Montant */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            {t("orderTransactions.form.amountLabel")}
          </label>
          <input
            type="number"
            step="0.01"
            placeholder={t("orderTransactions.form.amountPlaceholder")}
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
            className="w-full border rounded-lg px-3 py-2 text-sm bg-surface-card focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-150"
          />
        </div>

        {/* Devise */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            {t("orderTransactions.form.currencyLabel")}
          </label>
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-surface-card focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-150"
          >
            {Object.keys(CURRENCY_LABELS).map((key) => (
              <option key={key} value={key}>
                {t(`currency.${key}`)}
              </option>
            ))}
          </select>
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            {t("orderTransactions.form.paymentMethodLabel")}
          </label>
          <input
            placeholder={t("orderTransactions.form.paymentMethodPlaceholder")}
            value={form.paymentMethod}
            onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-surface-card focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-150"
          />
        </div>

        {/* Description */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-text-secondary mb-1">
            {t("orderTransactions.form.descriptionLabel")}
          </label>
          <textarea
            rows={3}
            placeholder={t("orderTransactions.form.descriptionPlaceholder")}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-surface-card focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-150"
          />
        </div>

        {/* File */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-text-secondary mb-1">
            {t("orderTransactions.form.attachmentLabel")}
          </label>
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx"
            onChange={(e) => setForm({ ...form, proofFile: e.target.files?.[0] || null })}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-surface-card focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-150"
          />
        </div>

        {/* Submit */}
        <div className="sm:col-span-2 text-right">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full sm:w-auto px-5 py-2.5 text-sm font-semibold rounded-lg shadow-sm transition-all duration-150 ${
              isSubmitting
                ? 'bg-blue-300 cursor-not-allowed text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isSubmitting
              ? t("orderTransactions.form.submitting")
              : `${t("orderTransactions.form.submit")}`}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ============================================================
   Contexte: transactions liees aux commandes.
   Sous-composant liste/historique.
============================================================ */

function TransactionList({
  transactions,
  loading,
  getProofHref,
  formatNumber,
  formatDate,
  formatTime,
}) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <p className="text-text-muted italic text-center py-6">
        {t("orderTransactions.list.loading")}
      </p>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <p className="text-text-muted italic text-center py-6">
        {t("orderTransactions.list.empty")}
      </p>
    );
  }

  return (
    <div className="grid gap-6">
      {transactions.map((tx) => {
        const userDisplay = tx.user
          ? getUserDisplay(tx.user)
          : t("orderTransactions.systemUser");
        const currencyCode = tx.currency || 'XOF';
        const currencyLabel =
          CURRENCY_LABELS[currencyCode] || currencyCode;
        const typeLabel =
          TRANSACTION_TYPES[tx.type] || tx.type;
        const statusLabel = tx.status
          ? TRANSACTION_STATUSES[tx.status] ||
            tx.status
          : undefined;

 // Contexte: transactions de commande.
        let accentClass = 'border-l-4 border-l-slate-200';
        if (tx.type === 'revenue') accentClass = 'border-l-4 border-l-emerald-400/80';
        else if (tx.type === 'expense') accentClass = 'border-l-4 border-l-rose-400/80';
        else if (tx.type === 'commission') accentClass = 'border-l-4 border-l-amber-400/80';
        else if (tx.type === 'adjustment') accentClass = 'border-l-4 border-l-blue-400/80';

 // Contexte: transactions de commande.
        let typeBadge =
          'bg-surface-main/80 text-text-secondary border border-border';
        if (tx.type === 'revenue')
          typeBadge = 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30';
        else if (tx.type === 'expense')
          typeBadge = 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30';
        else if (tx.type === 'commission')
          typeBadge = 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30';
        else if (tx.type === 'adjustment')
          typeBadge = 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30';

        const proofHref = getProofHref ? getProofHref(tx) : '';
        const proofKind = inferProofKind(tx?.proofFile, proofHref);
        const proofLabel =
          tx?.proofFile?.originalName ||
          tx?.proofFile?.fileName ||
          tx?.proofFile?.name ||
          '';
        const proofExt = getProofExtLabel(
          tx?.proofFile,
          proofHref,
          proofKind === 'pdf'
            ? t("orderDetail.labels.pdf")
            : t("orderDetail.labels.file")
        );


        return (
          <div
            key={tx.id}
            className={`bg-surface-card border border-border rounded-xl shadow-sm p-5 hover:shadow-md hover:-translate-y-[1px] transition-all duration-150 ease-out ${accentClass}`}
          >
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
              {/* Bloc gauche */}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex px-2 py-0.5 text-xs rounded-full ${typeBadge}`}
                  >
                    {typeLabel}
                  </span>

                  {statusLabel && (
                    <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      {statusLabel}
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-semibold text-text-primary mt-2 break-words">
                  {formatNumber(tx.amount || 0)} {currencyLabel}
                </h3>

                <p className="text-sm text-text-secondary mt-1 break-words">
                  {tx.description || t("orderTransactions.list.descriptionFallback")}
                </p>

                {tx.paymentMethod && (
                  <p className="text-xs text-text-muted mt-1 break-words">
                    {t("orderTransactions.list.methodLabel")}{' '}
                    <span className="font-medium">{tx.paymentMethod}</span>
                  </p>
                )}
              </div>

              {/* Bloc droit */}
              <div className="text-xs text-text-muted text-right mt-1 sm:mt-0 whitespace-nowrap">
                <div>
                  {t("orderTransactions.list.createdAt")}{' '}
                  <strong>
                    {tx.createdAt
                      ? formatDate(tx.createdAt)
                      : t("orderTransactions.list.createdAtDash")}
                  </strong>
                </div>
                <div>
                  {t("orderTransactions.list.createdTime")}{' '}
                  <strong>
                    {tx.createdAt
                      ? formatTime(tx.createdAt)
                      : t("orderTransactions.list.createdAtDash")}
                  </strong>
                </div>
              </div>
            </div>

            {proofHref && (
              <div className="mt-4 flex flex-col sm:flex-row gap-3 bg-surface-main border border-border rounded-xl p-3">
                <a
                  href={proofHref}
                  target="_blank"
                  rel="noreferrer"
                  className="relative w-full sm:w-36 aspect-[4/3] rounded-lg overflow-hidden border border-border bg-surface-card flex items-center justify-center"
                >
                  {proofKind === 'image' ? (
                    <img
                      src={proofHref}
                      alt="Preuve"
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center">
                      <div className="text-[0.65rem] font-semibold text-text-secondary bg-surface-card/80 border border-border px-2 py-0.5 rounded-full inline-flex">
                        {proofExt}
                      </div>
                    </div>
                  )}

                  <span
                    className={`absolute top-2 left-2 text-[0.65rem] font-semibold px-2 py-0.5 rounded-full border ${
                      proofKind === 'image'
                        ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
                        : proofKind === 'pdf'
                        ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                        : 'bg-surface-main text-text-secondary border-border'
                    }`}
                  >
                    {proofKind === 'image'
                      ? t("orderDetail.labels.image")
                      : proofKind === 'pdf'
                      ? t("orderDetail.labels.pdf")
                      : t("orderDetail.labels.file")}
                  </span>
                </a>

                <div className="flex-1 min-w-0">
                  <div className="text-xs text-text-muted">
                    {t("orderTransactions.list.proofLabel")}
                  </div>
                  <a
                    href={proofHref}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline break-all"
                  >
                    {proofLabel || t("orderTransactions.list.proofAttachment")}
                  </a>
                  <div className="text-[0.7rem] text-text-muted mt-1">
                    {proofKind === 'image'
                      ? t("orderTransactions.list.proofPreview")
                      : t("orderTransactions.list.proofFormat", {
                          ext: proofExt,
                        })}
                  </div>
                </div>
              </div>
            )}

            {/* Footer carte */}

            <div className="mt-3 flex flex-col sm:flex-row justify-between text-sm gap-1 sm:gap-0">
              <div className="text-xs text-text-muted">
                {t("orderTransactions.list.enteredBy")}{' '}
                <strong>{userDisplay}</strong>
              </div>

              {proofHref && (
                <a
                  href={proofHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >                  {t("orderTransactions.list.viewAttachment")}
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}





