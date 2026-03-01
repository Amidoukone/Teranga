// ============================================================================
// TransactionsPage.jsx AAAasAAaA VERSION PREMIUM 2025 (TERANGA)
// Master / Multi-pays READY AAAasAAaA ZERO rAAAgression
// ============================================================================

import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { getTransactions, createTransaction } from '../services/transactions';
import { me } from '../services/auth';
import {
  getMyServices,
  getAgentServices,
  getAllServicesAdmin,
} from '../services/services';
import api from '../services/api';
import { useLocale } from '../i18n/useLocale';
import { notify } from '../utils/notify';

import {
  applyLabels,
  CURRENCY_LABELS,
  TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
} from '../utils/labels';

const TRANSACTION_TYPE_VALUES = ['expense', 'revenue', 'commission', 'adjustment'];
const CURRENCY_CODES = Object.keys(CURRENCY_LABELS);

// ============================================================================
// AAA...A A...aTMAA FILE_BASE AAAasAAaA Standard Teranga (Render / Netlify / CDN safe)
// ============================================================================
const FILE_BASE =
  (typeof window !== 'undefined' && window.__TERANGA_FILE_BASE_URL) ||
  (typeof window !== 'undefined' && window.__TERANGA_API_BASE_URL
    ? window.__TERANGA_API_BASE_URL.replace(/\/api\/?$/, '')
    : '');

// Normalisation URL fichier
function toAbsUrl(path = '') {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${FILE_BASE}${clean}`.replace(/([^:]\/)\/+/g, '$1');
}

function normalizeProofFile(rawProofFile) {
  if (!rawProofFile) return null;
  if (typeof rawProofFile === 'object') return rawProofFile;
  if (typeof rawProofFile !== 'string') return null;

  const trimmed = rawProofFile.trim();
  if (!trimmed) return null;

  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (_err) {
      // Legacy rows can contain non-JSON strings; ignore and fallback below.
    }
  }

  return { url: trimmed };
}

function getProofHrefFromProofFile(rawProofFile) {
  const pf = normalizeProofFile(rawProofFile);
  if (!pf) return '';

  const directUrl =
    pf.url ||
    pf.path ||
    pf.filePath ||
    pf.file_url ||
    pf.location ||
    pf.secure_url ||
    (typeof pf.file === 'string' ? pf.file : '');

  if (directUrl) return toAbsUrl(directUrl);

  const nestedFile = pf.file && typeof pf.file === 'object' ? pf.file : null;
  if (!nestedFile) return '';

  return toAbsUrl(
    nestedFile.url || nestedFile.path || nestedFile.filePath || ''
  );
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

// AAA...A AaAAaA PAGE PRINCIPALE
// ============================================================================
export default function TransactionsPage() {
  const { formatNumber, formatDate } = useLocale();
  const { t } = useTranslation();
  const tRef = useRef(t);
  const [user, setUser] = useState(null);
  const debug =
    typeof window !== 'undefined' &&
    window.location &&
    window.location.search.includes('debug=1');

  const [transactions, setTransactions] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);

  const [services, setServices] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [selectedService, setSelectedService] = useState('');

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState('');

  const [showForm, setShowForm] = useState(() => {
    const saved = localStorage.getItem('teranga_transactions_showForm');
    return saved === null ? true : saved === '1';
  });

  // --------------------------------------------------------------------------
  // FORM STATE
  // --------------------------------------------------------------------------
  const [form, setForm] = useState({
    type: 'expense',
    amount: '',
    currency: 'XOF',
    paymentMethod: '',
    description: '',
    serviceId: '',
    taskId: '',
    orderId: '',
    projectId: '',
    proofFile: null,
  });

  // --------------------------------------------------------------------------
  // FILTER STATE
  // --------------------------------------------------------------------------
  const [filters, setFilters] = useState({
    q: '',
    type: '',
    payment: '',
    service: '',
    order: '',
    project: '',
    sort: '-createdAt',
  });
  const initStartedRef = useRef(false);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    localStorage.setItem(
      'teranga_transactions_showForm',
      showForm ? '1' : '0'
    );
  }, [showForm]);

  // ========================================================================
 // AAA...A AaAAA1 SERVICES SELON RAAaALE (client / agent / admin / master)
  // ========================================================================
  const loadServicesByRole = useCallback(async (u) => {
    try {
      if (debug) console.warn('[TransactionsPage] loadServicesByRole start', u?.role);
      let servs = [];

      if (u.role === 'client') {
        servs = await getMyServices();
      } else if (u.role === 'agent') {
        servs = await getAgentServices();
      } else if (u.role === 'admin' || u.role === 'master') {
        servs = await getAllServicesAdmin();
      }

      setServices(servs || []);
      if (debug) console.warn('[TransactionsPage] loadServicesByRole done', (servs || []).length);
    } catch (e) {
      console.error('Erreur services:', e);
      setServices([]);
      if (debug) console.warn('[TransactionsPage] loadServicesByRole error', e);
    }
  }, [debug]);

  // ========================================================================
 // AAA...A AaAAA1 TRANSACTIONS
  // ========================================================================
  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      if (debug) console.warn('[TransactionsPage] loadTransactions start');
      const data = await getTransactions();
      const arr = Array.isArray(data) ? data : data?.transactions || [];
      setTransactions(arr);
      if (debug) console.warn('[TransactionsPage] loadTransactions done', arr.length);
    } catch (e) {
      console.error('Erreur loadTransactions:', e);
      notify(tRef.current('transactionsPage.alerts.loadError'));
      setTransactions([]);
      if (debug) console.warn('[TransactionsPage] loadTransactions error', e);
    } finally {
      setLoading(false);
    }
  }, [debug]);
  // ========================================================================
 // AAA...A AaAAA INIT USER + DATA
  // ========================================================================
  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;
    let active = true;

    async function init() {
      try {
        if (active) {
          setBooting(true);
          setBootError('');
          if (debug) console.warn('[TransactionsPage] init start');
        }
        const userData = await me();
        if (!active) return;
        const current = userData?.user;
        if (!current) {
          setBootError(tRef.current('transactionsPage.alerts.authRequired', {
            defaultValue: 'Session expirée. Redirection vers la connexion...',
          }));
          window.location.href = '/login';
          return;
        }
        setUser(current);
        // On sort du boot UI dès que l'auth est validée.
        if (active) setBooting(false);
        if (debug) console.warn('[TransactionsPage] init user ok', current?.id);

        // Ne bloque pas le rendu UI sur des requetes potentiellement lentes.
        // Les etats `loading`/`services` gerent deja l'affichage interne.
        Promise.allSettled([
          loadServicesByRole(current),
          loadTransactions(),
        ]).catch(() => {
          // no-op: chaque loader gere deja ses erreurs
        });
      } catch (err) {
        console.error('Erreur init TransactionsPage:', err);
        if (debug) console.warn('[TransactionsPage] init error', err);
        if (err?.response?.status === 401) {
          localStorage.removeItem('teranga_token');
          localStorage.removeItem('token');
          setBootError(tRef.current('transactionsPage.alerts.authRequired', {
            defaultValue: 'Session expirée. Redirection vers la connexion...',
          }));
          window.location.href = '/login';
          return;
        }
        if (active) {
          setBootError(
            tRef.current('transactionsPage.alerts.initError', {
              defaultValue:
                "Impossible d'initialiser la page Transactions. Rechargez la page.",
            })
          );
        }
      } finally {
        if (active) setBooting(false);
        if (debug) console.warn('[TransactionsPage] init finally booting=false');
      }
    }

    init();
    return () => {
      active = false;
      initStartedRef.current = false;
    };
  }, [loadServicesByRole, loadTransactions, t, debug]);

  // ========================================================================
 // AAA...A AaAAA1 SERVICE AAAaA Aaa TASKS
  // ========================================================================
  async function handleServiceChange(e) {
    const serviceId = e.target.value;
    setSelectedService(serviceId);

    setForm((f) => ({
      ...f,
      serviceId,
      taskId: '',
    }));

    if (!serviceId) {
      setTasks([]);
      return;
    }

    try {
      const { data } = await api.get(`/tasks/service/${serviceId}`);
      setTasks(data.tasks || []);
    } catch (e) {
      console.error('Erreur load tasks:', e);
      setTasks([]);
    }
  }

  // ========================================================================
 // AAA...A AaAAA1 SUBMIT TRANSACTION (ANTI DOUBLE-SUBMIT)
  // ========================================================================
  async function handleSubmit(e) {
    e.preventDefault();
    if (creating) return;

    try {
      setCreating(true);

      const normalizedAmount = form.amount
        ? String(form.amount).trim().replace(',', '.')
        : '';
      const parsedAmount = normalizedAmount ? Number(normalizedAmount) : undefined;

      if (!normalizedAmount || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        notify(t('transactionsPage.alerts.invalidAmount'));
        return;
      }

      if (form.serviceId) {
        const serviceExists = services.some(
          (s) => String(s.id) === String(form.serviceId)
        );
        if (!serviceExists) {
          notify(t('transactionsPage.alerts.createError'));
          return;
        }
      }

      if (form.taskId) {
        const taskExists = tasks.some((x) => String(x.id) === String(form.taskId));
        if (!taskExists) {
          notify(t('transactionsPage.alerts.createError'));
          return;
        }
      }

      const payload = {
        ...form,
        amount: normalizedAmount,
        serviceId: form.serviceId ? Number(form.serviceId) : undefined,
        taskId: form.taskId ? Number(form.taskId) : undefined,
        orderId: form.orderId ? Number(form.orderId) : undefined,
        projectId: form.projectId ? Number(form.projectId) : undefined,
      };

 // Transaction indAAApendante AAAaA Aaa completed
      if (!payload.orderId && !payload.projectId) {
        payload.status = 'completed';
      }

      const created = await createTransaction(payload);
      const labeled = applyLabels(created, 'transaction');

      setTransactions((prev) => [labeled, ...prev]);

      notify(t('transactionsPage.alerts.createSuccess'));
      resetForm();
    } catch (e) {
      console.error('Erreur createTransaction:', e);
      notify(
        e?.response?.data?.error ||
          e?.message ||
          t('transactionsPage.alerts.createError')
      );
    } finally {
      setCreating(false);
    }
  }

  function resetForm() {
    setForm({
      type: 'expense',
      amount: '',
      currency: 'XOF',
      paymentMethod: '',
      description: '',
      serviceId: '',
      taskId: '',
      orderId: '',
      projectId: '',
      proofFile: null,
    });
    setTasks([]);
    setSelectedService('');
  }

  // ========================================================================
 // AAA...A AaAAA1 USER DISPLAY
  // ========================================================================
  const getUserDisplayName = useCallback((u) => {
    if (!u) return t('common.dash');
    const full = `${u.firstName || u.firstname || ''} ${
      u.lastName || u.lastname || ''
    }`.trim();
    return full || u.name || u.email || t('common.dash');
  }, [t]);

  // ========================================================================
 // AAA...A AaAAA FILTERING & SORTING
  // ========================================================================
  useEffect(() => {
    let arr = [...transactions];
    const q = filters.q.trim().toLowerCase();

    if (q) {
      arr = arr.filter((t) =>
        [
          t.typeLabel,
          t.statusLabel,
          t.description,
          t.paymentMethod,
          getUserDisplayName(t.user),
          t.service?.title,
          t.task?.title,
          t.order?.code || (t.order ? `#${t.order.id}` : ''),
          t.project?.title || (t.project ? `#${t.project.id}` : ''),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }

    if (filters.type) arr = arr.filter((t) => t.type === filters.type);
    if (filters.payment)
      arr = arr.filter((t) =>
        (t.paymentMethod || '').toLowerCase().includes(filters.payment)
      );
    if (filters.service)
      arr = arr.filter((t) => t.service?.id === Number(filters.service));
    if (filters.order)
      arr = arr.filter((t) => t.order?.id === Number(filters.order));
    if (filters.project)
      arr = arr.filter((t) => t.project?.id === Number(filters.project));

    const by = filters.sort || '-createdAt';
    arr.sort((a, b) => {
      const sign = by.startsWith('-') ? -1 : 1;
      const key = by.replace(/^-/, '');

      let va = a[key];
      let vb = b[key];

      if (key === 'createdAt') {
        va = new Date(a.createdAt).getTime();
        vb = new Date(b.createdAt).getTime();
      } else if (key === 'amount') {
        va = Number(a.amount);
        vb = Number(b.amount);
      }

      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      return 0;
    });

    setFiltered(arr);
  }, [transactions, filters, getUserDisplayName]);

  useEffect(() => {
    setPage(1);
  }, [
    filters.q,
    filters.type,
    filters.payment,
    filters.service,
    filters.order,
    filters.project,
    filters.sort,
    pageSize,
  ]);

  useEffect(() => {
    const total = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (page > total) setPage(total);
  }, [filtered.length, pageSize, page]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filtered.length);
  const pagedTransactions = filtered.slice(startIndex, endIndex);

  // ========================================================================
 // AAAAAA3 LOADING
  // ========================================================================
  if (booting) {
    return (
      <div className="app-page-wrap flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg animate-pulse text-text-secondary">
            {t('transactionsPage.loading')}
          </p>
          {debug && (
            <div className="mt-4 text-left text-xs text-text-secondary">
              <div>debug: booting=true</div>
              <div>loading={String(loading)}</div>
              <div>user={user ? 'yes' : 'no'}</div>
              <div>transactions={transactions.length}</div>
              <div>services={services.length}</div>
              <div>tasks={tasks.length}</div>
              <div>filters.q="{filters.q}"</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-page-wrap flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-border/70 bg-surface-card p-5 text-center">
          <p className="text-sm text-text-secondary">
            {bootError ||
              t('transactionsPage.alerts.authRequired', {
                defaultValue: 'Session invalide. Veuillez vous reconnecter.',
              })}
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="app-btn-neutral"
            >
              {t('common.retry', { defaultValue: 'Réessayer' })}
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.href = '/login';
              }}
              className="app-btn-primary"
            >
              {t('common.login', { defaultValue: 'Connexion' })}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ========================================================================
 // AAA...A AaaAAAA AA AA UI PRINCIPALE
  // ========================================================================
  return (
    <div className="app-page-wrap">
      <div className="app-page-shell max-w-6xl space-y-8 p-5 sm:p-8 lg:p-10">
        {debug && (
          <div className="rounded-xl border border-border/70 bg-surface-card/80 px-4 py-3 text-xs text-text-secondary">
            <div>debug: booting={String(booting)}</div>
            <div>loading={String(loading)}</div>
            <div>user={user ? 'yes' : 'no'}</div>
            <div>transactions={transactions.length}</div>
            <div>services={services.length}</div>
            <div>tasks={tasks.length}</div>
            <div>filtered={filtered.length}</div>
            <div>page={page} pageSize={pageSize}</div>
          </div>
        )}

        {/* HEADER */}
        <div className="flex flex-col gap-4 border-b border-border/70 pb-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <h1 className="app-page-headline flex items-center gap-2">
              {t('transactionsPage.header.title')}
            </h1>
            <p className="app-page-subtitle">
              {t('transactionsPage.header.subtitle')}
            </p>
            <span className="app-toolbar-pill mt-2 inline-flex items-center gap-2">
              <span className="app-status-dot-success" />
              {t('transactionsPage.header.count', { count: transactions.length })}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              onClick={() => setShowForm((v) => !v)}
              className="app-btn-neutral w-full sm:w-auto"
            >
              {showForm
                ? t('transactionsPage.buttons.hideForm')
                : t('transactionsPage.buttons.newTransaction')}
            </button>

            <button
              onClick={loadTransactions}
              disabled={loading}
              className="app-btn-primary w-full sm:w-auto rounded-lg px-4 py-2.5 text-sm"
            >
              {loading
                ? t('transactionsPage.buttons.refreshLoading')
                : t('transactionsPage.buttons.refresh')}
            </button>
          </div>
        </div>

        {/* FILTRES */}
        <TransactionFilters
          filters={filters}
          setFilters={setFilters}
          services={services}
          filteredCount={filtered.length}
        />

        {/* FORMULAIRE */}
        {showForm && (
          <TransactionForm
            form={form}
            setForm={setForm}
            selectedService={selectedService}
            handleServiceChange={handleServiceChange}
            tasks={tasks}
            services={services}
            handleSubmit={handleSubmit}
            loading={loading}
            creating={creating}
            user={user}
          />
        )}

        {/* LISTE */}
        <TransactionList
          transactions={pagedTransactions}
          loading={loading}
          getUserDisplayName={getUserDisplayName}
          formatNumber={formatNumber}
          formatDate={formatDate}
        />

        {filtered.length > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filtered.length}
            startIndex={startIndex}
            endIndex={endIndex}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// AAA...A AaAAA FILTRES
// ============================================================================
function TransactionFilters({ filters, setFilters, services, filteredCount }) {
  const { t } = useTranslation();

  return (
    <div className="mb-8 rounded-2xl border border-border/70 bg-surface-main/55 p-4 sm:p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            {t('transactionsPage.filters.searchLabel')}
          </label>
          <input
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            placeholder={t('transactionsPage.filters.searchPlaceholder')}
            className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            {t('transactionsPage.filters.typeLabel')}
          </label>
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
          >
            <option value="">{t('transactionsPage.filters.typeAll')}</option>
            {TRANSACTION_TYPE_VALUES.map((value) => (
              <option key={value} value={value}>
                {t(`transactions.type.${value}`, { defaultValue: value })}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            {t('transactionsPage.filters.paymentLabel')}
          </label>
          <input
            value={filters.payment}
            onChange={(e) => setFilters({ ...filters, payment: e.target.value })}
            placeholder={t('transactionsPage.filters.paymentPlaceholder')}
            className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            {t('transactionsPage.filters.serviceLabel')}
          </label>
          <select
            value={filters.service}
            onChange={(e) => setFilters({ ...filters, service: e.target.value })}
            className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
          >
            <option value="">{t('transactionsPage.filters.serviceAll')}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            {t('transactionsPage.filters.sortLabel')}
          </label>
          <select
            value={filters.sort}
            onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
            className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
          >
            <option value="-createdAt">
              {t('transactionsPage.filters.sortNewest')}
            </option>
            <option value="createdAt">
              {t('transactionsPage.filters.sortOldest')}
            </option>
            <option value="-amount">
              {t('transactionsPage.filters.sortAmountDesc')}
            </option>
            <option value="amount">
              {t('transactionsPage.filters.sortAmountAsc')}
            </option>
          </select>
        </div>
      </div>

      <div className="mt-4 flex justify-between text-xs text-text-secondary">
        <span>
          {t('transactionsPage.filters.results', { count: filteredCount })}
        </span>
        <button
          onClick={() =>
            setFilters({
              q: '',
              type: '',
              payment: '',
              service: '',
              order: '',
              project: '',
              sort: '-createdAt',
            })
          }
          className="app-btn-soft"
        >
          {t('transactionsPage.filters.reset')}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// AAA...A AAAA34 FORMULAIRE
// ============================================================================
function TransactionForm({
  form,
  setForm,
  selectedService,
  handleServiceChange,
  tasks,
  services,
  handleSubmit,
  creating,
  user,
}) {
  const { t } = useTranslation();

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-4 rounded-2xl border border-border/70 bg-surface-main/55 p-5 sm:grid-cols-2"
    >
      {/* Type */}
      <select
        value={form.type}
        onChange={(e) => setForm({ ...form, type: e.target.value })}
        className="rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-text-primary"
      >
        {TRANSACTION_TYPE_VALUES.map((value) => (
          <option key={value} value={value}>
            {t(`transactions.type.${value}`, { defaultValue: value })}
          </option>
        ))}
      </select>

      {/* Montant */}
      <input
        type="number"
        value={form.amount}
        onChange={(e) => setForm({ ...form, amount: e.target.value })}
        placeholder={t('transactionsPage.form.amountPlaceholder')}
        required
        className="rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-text-primary"
      />

      {/* Devise */}
      <select
        value={form.currency}
        onChange={(e) => setForm({ ...form, currency: e.target.value })}
        className="rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-text-primary"
      >
        {CURRENCY_CODES.map((code) => (
          <option key={code} value={code}>
            {t(`currency.${code}`, { defaultValue: code })}
          </option>
        ))}
      </select>

      {/* Paiement */}
      <input
        value={form.paymentMethod}
        onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
        placeholder={t('transactionsPage.form.paymentPlaceholder')}
        className="rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-text-primary"
      />

      {/* Service */}
      <select
        value={selectedService}
        onChange={handleServiceChange}
        className="rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-text-primary sm:col-span-2"
      >
        <option value="">{t('transactionsPage.form.servicePlaceholder')}</option>
        {services.map((s) => (
          <option key={s.id} value={s.id}>{s.title}</option>
        ))}
      </select>

      {/* Task */}
      {tasks.length > 0 && (
        <select
          value={form.taskId}
          onChange={(e) => setForm({ ...form, taskId: e.target.value })}
          className="rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-text-primary sm:col-span-2"
        >
          <option value="">{t('transactionsPage.form.taskPlaceholder')}</option>
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title ||
                t('transactionsPage.form.taskFallback', { id: task.id })}
            </option>
          ))}
        </select>
      )}

      {/* Projet / Commande */}
      {(user.role === 'admin' || user.role === 'agent' || user.role === 'master') && (
        <>
          <input
            type="number"
            placeholder={t('transactionsPage.form.projectIdPlaceholder')}
            value={form.projectId}
            onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            className="rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-text-primary"
          />
          <input
            type="number"
            placeholder={t('transactionsPage.form.orderIdPlaceholder')}
            value={form.orderId}
            onChange={(e) => setForm({ ...form, orderId: e.target.value })}
            className="rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-text-primary"
          />
        </>
      )}

      {/* Description */}
      <textarea
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        placeholder={t('transactionsPage.form.descriptionPlaceholder')}
        className="rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-text-primary sm:col-span-2"
      />

      {/* File */}
      <input
        type="file"
        onChange={(e) =>
          setForm({ ...form, proofFile: e.target.files?.[0] || null })
        }
        className="sm:col-span-2 rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-text-primary"
      />

      <div className="sm:col-span-2 text-right">
        <button
          disabled={creating}
          className="app-btn-primary rounded-lg px-5 py-2 text-white"
        >
          {creating
            ? t('transactionsPage.form.saving')
            : t('transactionsPage.form.save')}
        </button>
      </div>
    </form>
  );
}

// ============================================================================
// AAA...A AaAAaA1 LISTE
// ============================================================================
function TransactionList({
  transactions,
  loading,
  getUserDisplayName,
  formatNumber,
  formatDate,
}) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <p className="rounded-2xl border border-border/70 bg-surface-card/70 py-6 text-center text-text-secondary">
        {t('transactionsPage.list.loading')}
      </p>
    );
  }

  if (!transactions.length) {
    return (
      <p className="rounded-2xl border border-border/70 bg-surface-card/70 py-6 text-center text-text-secondary">
        {t('transactionsPage.list.empty')}
      </p>
    );
  }

  return (
    <div className="[column-width:260px] md:[column-width:300px] [column-gap:1rem]">
      {transactions.map((trx) => {
        const proofMeta = normalizeProofFile(trx?.proofFile);
        const proof = getProofHrefFromProofFile(proofMeta);
        const proofKind = inferProofKind(proofMeta, proof);
        const proofLabel =
          proofMeta?.originalName || proofMeta?.fileName || proofMeta?.name || '';
        const proofExt = getProofExtLabel(
          proofMeta,
          proof,
          proofKind === 'pdf'
            ? t('transactionsPage.list.pdfLabel')
            : t('transactionsPage.list.fileLabel')
        );

        const typeLabel = trx.type
          ? TRANSACTION_TYPES[trx.type] || trx.type
          : t('common.dash');
        const statusLabel = trx.status
          ? TRANSACTION_STATUSES[trx.status] || trx.status
          : t('common.dash');
        const currencyLabel = trx.currency
          ? CURRENCY_LABELS[trx.currency] || trx.currency
          : t('common.dash');
        const descriptionLabel =
          trx.description || t('transactionsPage.list.descriptionFallback');
        const createdAtLabel = trx.createdAt
          ? formatDate(trx.createdAt)
          : t('common.dash');

        return (
          <div
            key={trx.id}
            className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-border/70 bg-surface-card shadow-sm min-w-0 flex flex-col"
          >
            {proof && (
              <a
                href={proof}
                target="_blank"
                rel="noreferrer"
                className="relative block aspect-[4/3] border-b border-border/70 bg-gradient-to-br from-surface-main via-surface-card to-surface-main"
              >
                {proofKind === 'image' ? (
                  <img
                    src={proof}
                    alt={t('transactionsPage.list.proofAlt')}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="inline-flex rounded-full border border-border/80 bg-surface-card/80 px-2 py-1 text-xs font-semibold text-text-secondary">
                        {proofExt}
                      </div>
                    </div>
                  </div>
                )}

                <span
                  className={`absolute top-3 left-3 text-[0.75rem] font-semibold px-2.5 py-1 rounded-full border ${
                    proofKind === 'image'
                      ? 'app-badge app-badge-info'
                      : proofKind === 'pdf'
                      ? 'app-badge app-badge-error'
                      : 'bg-surface-main text-text-secondary border-border'
                  }`}
                >
                  {proofKind === 'image'
                    ? t('transactionsPage.list.proofImage')
                    : proofKind === 'pdf'
                    ? t('transactionsPage.list.proofPdf')
                    : t('transactionsPage.list.proofFile')}
                </span>
              </a>
            )}

            <div className="p-4 min-w-0 flex flex-col flex-1">
              <div className="font-bold">
                {formatNumber(trx.amount || 0)} {currencyLabel}
              </div>

              <div className="mt-1 text-xs text-text-secondary break-words line-clamp-1">
                {typeLabel} - {statusLabel}
              </div>

              <p className="text-sm mt-2 break-words line-clamp-3">
                {descriptionLabel}
              </p>

              {trx.paymentMethod && (
                <div className="mt-2 text-xs text-text-secondary break-words line-clamp-2">
                  {t('transactionsPage.list.paymentLabel')}: {trx.paymentMethod}
                </div>
              )}

              {trx.order && (
                <Link
                  to={`/orders/${trx.order.id}`}
                  className="app-link-primary text-sm break-words line-clamp-2"
                >
                  {t('transactionsPage.list.orderLabel', {
                    code:
                      trx.order.code ||
                      t('transactionsPage.list.orderFallbackId', {
                        id: trx.order.id,
                      }),
                  })}
                </Link>
              )}

              {trx.project && (
                <Link
                  to={`/projects/${trx.project.id}`}
                  className="app-link-primary text-sm break-words line-clamp-2"
                >
                  {t('transactionsPage.list.projectLabel', {
                    title:
                      trx.project.title ||
                      t('transactionsPage.list.projectFallbackId', {
                        id: trx.project.id,
                      }),
                  })}
                </Link>
              )}

              {proof && (
                <a
                  href={proof}
                  target="_blank"
                  rel="noreferrer"
                  className="app-link-primary inline-flex items-center text-sm font-semibold mt-2 break-words line-clamp-1"
                >
                  {proofLabel || t('transactionsPage.list.attachmentFallback')}
                </a>
              )}

              <div className="mt-auto pt-3 text-xs text-text-muted break-words line-clamp-1">
                {t('transactionsPage.list.byLine', {
                  name: getUserDisplayName(trx.user),
                  date: createdAtLabel,
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// AAA...A AaAAA PAGINATION
// ============================================================================
function buildPageItems(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = new Set([1, total, current, current - 1, current + 1]);

  if (current <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (current >= total - 2) {
    pages.add(total - 1);
    pages.add(total - 2);
    pages.add(total - 3);
  }

  const sorted = Array.from(pages)
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b);

  const items = [];
  for (let i = 0; i < sorted.length; i += 1) {
    items.push(sorted[i]);
    if (i < sorted.length - 1 && sorted[i + 1] - sorted[i] > 1) {
      items.push('...');
    }
  }
  return items;
}

function Pagination({
  page,
  totalPages,
  pageSize,
  totalItems,
  startIndex,
  endIndex,
  onPageChange,
  onPageSizeChange,
}) {
  const { t } = useTranslation();
  const items = buildPageItems(page, totalPages);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-surface-card/80 px-3 py-3 pt-2 md:flex-row md:items-center md:justify-between sm:px-4">
      <div className="text-xs text-text-secondary">
        {t('transactionsPage.pagination.showing', {
          from: totalItems === 0 ? 0 : startIndex + 1,
          to: endIndex,
          total: totalItems,
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className={`rounded-lg border px-3 py-1.5 text-xs ${
            page <= 1
              ? 'cursor-not-allowed border-border/80 text-text-muted'
              : 'border-border/80 text-text-primary hover:bg-surface-main/70'
          }`}
        >
          {t('transactionsPage.pagination.prev')}
        </button>

        {items.map((item, idx) =>
          item === '...' ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-text-muted">
              ...
            </span>
          ) : (
            <button
              key={`page-${item}`}
              onClick={() => onPageChange(item)}
              className={`rounded-lg border px-3 py-1.5 text-xs ${
                item === page
                  ? 'border-primary bg-primary text-white'
                  : 'border-border/80 text-text-primary hover:bg-surface-main/70'
              }`}
            >
              {item}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className={`rounded-lg border px-3 py-1.5 text-xs ${
            page >= totalPages
              ? 'cursor-not-allowed border-border/80 text-text-muted'
              : 'border-border/80 text-text-primary hover:bg-surface-main/70'
          }`}
        >
          {t('transactionsPage.pagination.next')}
        </button>

        <div className="ml-2 flex items-center gap-2">
          <span className="text-xs text-text-secondary">
            {t('transactionsPage.pagination.perPage')}
          </span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-lg border border-border/80 bg-surface-card px-2 py-1 text-xs text-text-primary"
          >
            {[9, 12, 18, 24].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
