import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getTransactions } from '../services/transactions';
import { me } from '../services/auth';
import { useLocale } from '../i18n/useLocale';
import { useTranslation } from 'react-i18next';
import {
  normalizeRole,
  isMasterUser,
  isGlobalAdminUser,
  prettyRoleLabel,
} from '../utils/role';
import {
  PieChart,
  Pie,
  Tooltip,
  Cell,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const MAX_TOP_ENTITIES = 3;
const EMPTY_SUMMARY = {
  revenues: 0,
  expenses: 0,
  commissions: 0,
  adjustments: 0,
  balance: 0,
};

function toNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function buildTopEntities(list, pickEntity, makeLabel, limit = MAX_TOP_ENTITIES) {
  const map = new Map();

  for (const t of list) {
    const entity = pickEntity(t);
    const id = entity?.id;
    if (!id) continue;

    const key = String(id);
    const existing = map.get(key) || {
      id,
      label: makeLabel(entity, id),
      total: 0,
      count: 0,
    };

    existing.total += toNumber(t.amount);
    existing.count += 1;
    if (!existing.label) existing.label = makeLabel(entity, id);

    map.set(key, existing);
  }

  return Array.from(map.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

function getTransactionEntityLabel(trx, t) {
  if (trx?.project) {
    return t('financeDashboardPage.entities.projectLabel', {
      title: trx.project.title || `#${trx.project.id}`,
    });
  }
  if (trx?.order) {
    return t('financeDashboardPage.entities.orderLabel', {
      code: trx.order.code || `#${trx.order.id}`,
    });
  }
  if (trx?.service) {
    return t('financeDashboardPage.entities.serviceLabel', {
      title: trx.service.title || `#${trx.service.id}`,
    });
  }
  if (trx?.task) {
    return t('financeDashboardPage.entities.taskLabel', {
      title: trx.task.title || `#${trx.task.id}`,
    });
  }
  return t('financeDashboardPage.entities.unlinked');
}

function getScopeLabel(user, t) {
  const parts = [];
  const country =
    user?.country?.name ||
    user?.country?.label ||
    user?.countryName ||
    (user?.countryId ? `${t('financeDashboardPage.scope.country')} #${user.countryId}` : '');
  const region =
    user?.region?.name ||
    user?.region?.label ||
    user?.regionName ||
    (user?.regionId ? `${t('financeDashboardPage.scope.region')} #${user.regionId}` : '');

  if (country) parts.push(country);
  if (region) parts.push(region);

  if (!parts.length) return t('financeDashboardPage.scope.global');
  return parts.join(' - ');
}

export default function FinanceDashboardPage() {
  const { locale, formatDate } = useLocale();
  const { t } = useTranslation();
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState('');
  const initStartedRef = useRef(false);

  const roleKey = normalizeRole(user?.role);
  const isAdmin = roleKey === 'admin';
  const isAgent = roleKey === 'agent';
  const isClient = roleKey === 'client';
  const isMaster = isMasterUser(user);
  const isGlobalAdmin = isGlobalAdminUser(user);

  const roleFilterOptions = useMemo(() => {
    if (isGlobalAdmin) return ['client', 'agent', 'admin'];
    if (isMaster) return ['client', 'agent'];
    return [];
  }, [isGlobalAdmin, isMaster]);

 // AA a a Filtres & UI
  const [filters, setFilters] = useState({
    q: '',
    type: '', // '', 'revenue', 'expense', 'commission', 'adjustment'
    role: '', // '', 'client', 'agent', 'admin'
    dateFrom: '',
    dateTo: '',
    onlyLinked: false, // uniquement celles liÃƒÂ©es ÃƒÂ  un service/tÃƒÂ¢che
    sort: '-createdAt', // -createdAt, createdAt, amount, -amount
  });

  const [showChart, setShowChart] = useState(() => {
    const saved = localStorage.getItem('teranga_finance_showChart');
    return saved === null ? true : saved === '1';
  });

 // AA aaz Persistance de lAaaAAtat du graphique
  useEffect(() => {
    localStorage.setItem('teranga_finance_showChart', showChart ? '1' : '0');
  }, [showChart]);

  useEffect(() => {
    if (filters.role && !roleFilterOptions.includes(filters.role)) {
      setFilters((prev) => ({ ...prev, role: '' }));
    }
  }, [filters.role, roleFilterOptions]);

  const loadTransactionsData = useCallback(async () => {
    try {
      setLoadingTransactions(true);
      const data = await getTransactions();
      const txs = Array.isArray(data) ? data : data?.transactions || [];
      setTransactions(txs);
    } catch (err) {
      console.error('Erreur chargement FinanceDashboard:', err);
      setTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  }, []);

 // AA Aa Initialisation
  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;
    let active = true;
    async function init() {
      try {
        if (active) {
          setBooting(true);
          setBootError('');
        }
        const u = await me();
        if (!active) return;
        const current = u?.user;
        if (!current) {
          setBootError(
            t('financeDashboardPage.errors.authRequired', {
              defaultValue: 'Session expirée. Redirection vers la connexion...',
            })
          );
          window.location.href = '/login';
          return;
        }
        setUser(current);
        if (active) setBooting(false);

      } catch (err) {
        console.error('Erreur chargement FinanceDashboard:', err);
        if (err?.response?.status === 401) {
          localStorage.removeItem('teranga_token');
          localStorage.removeItem('token');
          if (active) {
            setBootError(
              t('financeDashboardPage.errors.authRequired', {
                defaultValue:
                  'Session expirée. Redirection vers la connexion...',
              })
            );
          }
          window.location.href = '/login';
          return;
        }
        if (active) {
          setBootError(
            t('financeDashboardPage.errors.initFailed', {
              defaultValue:
                "Impossible d'initialiser le dashboard financier. Rechargez la page.",
            })
          );
        }
      } finally {
        if (active) {
          setLoading(false);
          setBooting(false);
        }
      }
    }

    init();
    return () => {
      active = false;
      initStartedRef.current = false;
    };
  }, [t]);

  useEffect(() => {
    if (!user) return;
    loadTransactionsData();
  }, [user, loadTransactionsData]);

 // AA AA Transactions filtrAAes cAA tAA client (non destructif)
  const filtered = useMemo(() => {
    let arr = [...(transactions || [])];

    // Texte libre
    if (filters.q.trim()) {
      const q = filters.q.trim().toLowerCase();
      arr = arr.filter((t) =>
        [
          t.description,
          t.paymentMethod,
          t.currency,
          t?.service?.title,
          t?.task?.title,
          t?.user?.email,
          t?.user?.firstName,
          t?.user?.lastName,
          t.type,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }

    // Type
    if (filters.type) {
      arr = arr.filter((t) => t.type === filters.type);
    }

 // RAA le (utile surtout pour admin)
    if (filters.role && roleFilterOptions.includes(filters.role)) {
      arr = arr.filter((t) => (t.user?.role || '') === filters.role);
    }

 // PAAriode
    if (filters.dateFrom) {
      const tsFrom = new Date(filters.dateFrom).setHours(0, 0, 0, 0);
      arr = arr.filter((t) => {
        if (!t.createdAt) return false;
        return new Date(t.createdAt).getTime() >= tsFrom;
      });
    }

    if (filters.dateTo) {
      const tsTo = new Date(filters.dateTo).setHours(23, 59, 59, 999);
      arr = arr.filter((t) => {
        if (!t.createdAt) return false;
        return new Date(t.createdAt).getTime() <= tsTo;
      });
    }

 // LiAAes AA un service/tAAche
    if (filters.onlyLinked) {
      arr = arr.filter((t) => t.service || t.task);
    }

    // Tri
    const by = filters.sort || '-createdAt';
    arr.sort((a, b) => {
      const sign = by.startsWith('-') ? -1 : 1;
      const key = by.replace(/^-/, '');
      let va;
      let vb;

      if (key === 'createdAt') {
        va = new Date(a.createdAt || 0).getTime();
        vb = new Date(b.createdAt || 0).getTime();
      } else if (key === 'amount') {
        va = Number(a.amount || 0);
        vb = Number(b.amount || 0);
      } else {
        va = a[key];
        vb = b[key];
      }

      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      return 0;
    });

    return arr;
  }, [transactions, filters, roleFilterOptions]);

  const derivedStats = useMemo(() => {
    const totals = {
      revenues: 0,
      expenses: 0,
      commissions: 0,
      adjustments: 0,
    };
    const services = new Set();
    const tasks = new Set();
    const projects = new Set();
    const orders = new Set();
    let totalVolume = 0;
    let linkedCount = 0;
    let largestTx = null;
    let lastActivity = 0;

    for (const trx of filtered) {
      const amount = toNumber(trx.amount);
      totalVolume += amount;

      if (trx.type === 'revenue') totals.revenues += amount;
      if (trx.type === 'expense') totals.expenses += amount;
      if (trx.type === 'commission') totals.commissions += amount;
      if (trx.type === 'adjustment') totals.adjustments += amount;

      if (trx.service?.id) services.add(trx.service.id);
      if (trx.task?.id) tasks.add(trx.task.id);
      if (trx.project?.id) projects.add(trx.project.id);
      if (trx.order?.id) orders.add(trx.order.id);

      if (trx.service || trx.task || trx.order || trx.project) linkedCount += 1;
      if (!largestTx || amount > toNumber(largestTx.amount)) largestTx = trx;

      const createdTs = trx?.createdAt ? new Date(trx.createdAt).getTime() : 0;
      if (createdTs > lastActivity) lastActivity = createdTs;
    }

    const summary = {
      ...totals,
      balance:
        totals.revenues -
        (totals.expenses + totals.commissions + totals.adjustments),
    };
    const totalCount = filtered.length;

    return {
      summary,
      totalIn: summary.revenues || 0,
      totalOut:
        (summary.expenses || 0) +
        (summary.commissions || 0) +
        (summary.adjustments || 0),
      totalCount,
      totalVolume,
      avgAmount: totalCount > 0 ? totalVolume / totalCount : 0,
      linkedCount,
      largestTx,
      lastActivity,
      uniqueCounts: {
        services: services.size,
        tasks: tasks.size,
        projects: projects.size,
        orders: orders.size,
      },
    };
  }, [filtered]);

  const summary = derivedStats.summary || EMPTY_SUMMARY;
  const totalIn = derivedStats.totalIn || 0;
  const totalOut = derivedStats.totalOut || 0;
  const totalCount = derivedStats.totalCount || 0;
  const avgAmount = derivedStats.avgAmount || 0;
  const linkedCount = derivedStats.linkedCount || 0;
  const largestTx = derivedStats.largestTx || null;
  const lastActivity = derivedStats.lastActivity || 0;
  const uniqueCounts = derivedStats.uniqueCounts || {
    services: 0,
    tasks: 0,
    projects: 0,
    orders: 0,
  };

  const topEntities = useMemo(() => {
    return {
      services: buildTopEntities(
        filtered,
        (t) => t.service,
        (s, id) =>
          s?.title ||
          t('financeDashboardPage.entities.serviceFallback', { id })
      ),
      projects: buildTopEntities(
        filtered,
        (t) => t.project,
        (p, id) =>
          p?.title ||
          t('financeDashboardPage.entities.projectFallback', { id })
      ),
      orders: buildTopEntities(
        filtered,
        (t) => t.order,
        (o, id) =>
          o?.code ||
          t('financeDashboardPage.entities.orderFallback', { id })
      ),
      tasks: buildTopEntities(
        filtered,
        (t) => t.task,
        (task, id) =>
          task?.title ||
          t('financeDashboardPage.entities.taskFallback', { id })
      ),
    };
  }, [filtered, t]);

  const recentTransactions = useMemo(() => {
    return [...filtered]
      .sort((a, b) => {
        const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 6);
  }, [filtered]);

 // Format monAAtaire local (XOF, etc.)
  const formatCurrency = (v) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(v || 0));

  // Raccourcis de plage de dates
  function quickRange(days) {
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - days + 1);
    setFilters((f) => ({
      ...f,
      dateFrom: from.toISOString().slice(0, 10),
      dateTo: now.toISOString().slice(0, 10),
    }));
  }

  function resetFilters() {
    setFilters({
      q: '',
      type: '',
      role: '',
      dateFrom: '',
      dateTo: '',
      onlyLinked: false,
      sort: '-createdAt',
    });
  }

 // Export CSV simple de la vue filtrAAe
  function exportCSV() {
    const headers = [
      'id',
      'type',
      'amount',
      'currency',
      'paymentMethod',
      'description',
      'service',
      'task',
      'userEmail',
      'userRole',
      'createdAt',
    ];

    const rows = filtered.map((t) => [
      t.id,
      t.type,
      t.amount,
      t.currency || '',
      t.paymentMethod || '',
      (t.description || '').replace(/\n/g, ' '),
      t.service?.title || '',
      t.task?.title || '',
      t.user?.email || '',
      t.user?.role || '',
      t.createdAt ? new Date(t.createdAt).toISOString() : '',
    ]);

    const csv =
      headers.join(',') +
      '\n' +
      rows
        .map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_export_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

 // Aatats transitoires
  if (booting || loading) {
    return (
      <FinanceDashboardSkeleton
        loadingLabel={t('financeDashboardPage.loading.page')}
      />
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7] px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface-card p-5 text-center shadow-sm">
          <p className="text-sm text-text-secondary">
            {bootError ||
              t('financeDashboardPage.empty.noData')}
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

 // AA A12A DonnAAes pour le graphique (vue filtrAAe)
  const COLORS = ['#34C759', '#FF3B30', '#0A84FF', '#AF52DE']; // Apple-like palette
  const chartData = [
    { name: t('financeDashboardPage.chart.revenues'), value: summary.revenues },
    { name: t('financeDashboardPage.chart.expenses'), value: summary.expenses },
    {
      name: t('financeDashboardPage.chart.commissions'),
      value: summary.commissions,
    },
    {
      name: t('financeDashboardPage.chart.adjustments'),
      value: summary.adjustments,
    },
  ];

  const topCards = isAdmin
    ? [
        {
          key: 'services',
          title: t('financeDashboardPage.topEntities.services'),
          items: topEntities.services,
        },
        {
          key: 'projects',
          title: t('financeDashboardPage.topEntities.projects'),
          items: topEntities.projects,
        },
        {
          key: 'orders',
          title: t('financeDashboardPage.topEntities.orders'),
          items: topEntities.orders,
        },
        {
          key: 'tasks',
          title: t('financeDashboardPage.topEntities.tasks'),
          items: topEntities.tasks,
        },
      ]
    : isAgent
    ? [
        {
          key: 'services',
          title: t('financeDashboardPage.topEntities.services'),
          items: topEntities.services,
        },
        {
          key: 'tasks',
          title: t('financeDashboardPage.topEntities.tasks'),
          items: topEntities.tasks,
        },
        {
          key: 'orders',
          title: t('financeDashboardPage.topEntities.orders'),
          items: topEntities.orders,
        },
      ]
    : [
        {
          key: 'projects',
          title: t('financeDashboardPage.topEntities.projects'),
          items: topEntities.projects,
        },
        {
          key: 'orders',
          title: t('financeDashboardPage.topEntities.orders'),
          items: topEntities.orders,
        },
        {
          key: 'services',
          title: t('financeDashboardPage.topEntities.services'),
          items: topEntities.services,
        },
      ];

  // ============================================================
 // AA aAA A A UI principale Aaa Apple Light, sobre & premium
  // ============================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-3 py-8 sm:px-4 sm:py-10">
      <div className="max-w-6xl mx-auto bg-surface-card/90 backdrop-blur-sm shadow-[0_18px_45px_rgba(0,0,0,0.06)] rounded-3xl border border-border px-4 py-5 sm:px-8 sm:py-7">
 {/* AA AA En-tAAate responsive */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary tracking-tight break-words flex items-center gap-2">
              <span>{t('financeDashboardPage.title')}</span>
            </h1>
            <p className="text-xs sm:text-sm text-text-muted mt-1 break-words">
              {isGlobalAdmin
                ? t('financeDashboardPage.descriptions.admin')
                : isMaster
                ? t('financeDashboardPage.descriptions.master')
                : isAgent
                ? t('financeDashboardPage.descriptions.agent')
                : t('financeDashboardPage.descriptions.client')}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-wide uppercase text-text-secondary bg-surface-main/80 border border-border px-3 py-1 rounded-full">
                {t('financeDashboardPage.badges.role', {
                  role: prettyRoleLabel(user),
                })}
              </span>
              {isAdmin && (
                <span className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-wide uppercase text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full">
                  {t('financeDashboardPage.badges.scope', {
                    scope: getScopeLabel(user, t),
                  })}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:justify-end">
            <button
              onClick={() => setShowChart((s) => !s)}
              className="w-full sm:w-auto px-4 py-2 text-xs sm:text-sm font-medium rounded-full shadow-sm app-btn-neutral transition-transform transform hover:-translate-y-0.5 active:translate-y-0"
            >
              {showChart
                ? t('financeDashboardPage.buttons.hideChart')
                : t('financeDashboardPage.buttons.showChart')}
            </button>
            <button
              onClick={exportCSV}
              className="w-full sm:w-auto px-4 py-2 text-xs sm:text-sm font-medium rounded-full shadow-sm border border-border bg-surface-card text-text-primary hover:bg-surface-main transition-transform transform hover:-translate-y-0.5 active:translate-y-0"
            >
              {t('financeDashboardPage.buttons.exportCsv')}
            </button>
          </div>
        </div>

 {/* AA A12aoA A A Filtres premium + responsive */}
        <div className="mb-6 bg-surface-main border border-border rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
            {/* Recherche texte */}
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-medium text-text-muted mb-1 uppercase tracking-wide">
                {t('financeDashboardPage.filters.searchLabel')}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">/</span>
                <input
                  placeholder={t('financeDashboardPage.filters.searchPlaceholder')}
                  value={filters.q}
                  onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                  className="w-full border border-border rounded-2xl pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-surface-card transition"
                />
              </div>
            </div>

            {/* Type */}
            <div>
              <label className="block text-[11px] font-medium text-text-muted mb-1 uppercase tracking-wide">
                {t('financeDashboardPage.filters.typeLabel')}
              </label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="w-full border border-border rounded-2xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-surface-card transition"
              >
                <option value="">{t('financeDashboardPage.filters.allOption')}</option>
                <option value="revenue">{t('transactions.type.revenue')}</option>
                <option value="expense">{t('transactions.type.expense')}</option>
                <option value="commission">{t('transactions.type.commission')}</option>
                <option value="adjustment">{t('transactions.type.adjustment')}</option>
              </select>
            </div>

 {/* RAA le (admin global / master) */}
            {roleFilterOptions.length > 0 && (
              <div>
                <label className="block text-[11px] font-medium text-text-muted mb-1 uppercase tracking-wide">
                  {t('financeDashboardPage.filters.roleLabel')}
                  <span className="text-[10px] font-normal text-text-muted normal-case ml-1">
                    {t('financeDashboardPage.filters.roleHint')}
                  </span>
                </label>
                <select
                  value={filters.role}
                  onChange={(e) =>
                    setFilters({ ...filters, role: e.target.value })
                  }
                  className="w-full border border-border rounded-2xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-surface-card transition"
                >
                  <option value="">{t('financeDashboardPage.filters.allOption')}</option>
                  {roleFilterOptions.includes('client') && (
                    <option value="client">{t('roles.client')}</option>
                  )}
                  {roleFilterOptions.includes('agent') && (
                    <option value="agent">{t('roles.agent')}</option>
                  )}
                  {roleFilterOptions.includes('admin') && (
                    <option value="admin">{t('roles.admin')}</option>
                  )}
                </select>
              </div>
            )}

            {/* Date du */}
            <div>
              <label className="block text-[11px] font-medium text-text-muted mb-1 uppercase tracking-wide">
                {t('financeDashboardPage.filters.fromLabel')}
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) =>
                  setFilters({ ...filters, dateFrom: e.target.value })
                }
                className="w-full border border-border rounded-2xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-surface-card transition"
              />
            </div>

            {/* Date au */}
            <div>
              <label className="block text-[11px] font-medium text-text-muted mb-1 uppercase tracking-wide">
                {t('financeDashboardPage.filters.toLabel')}
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-full border border-border rounded-2xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-surface-card transition"
              />
            </div>

            {/* Tri */}
            <div>
              <label className="block text-[11px] font-medium text-text-muted mb-1 uppercase tracking-wide">
                {t('financeDashboardPage.filters.sortLabel')}
              </label>
              <select
                value={filters.sort}
                onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
                className="w-full border border-border rounded-2xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-surface-card transition"
              >
                <option value="-createdAt">
                  {t('financeDashboardPage.filters.sortOptions.newest')}
                </option>
                <option value="createdAt">
                  {t('financeDashboardPage.filters.sortOptions.oldest')}
                </option>
                <option value="-amount">
                  {t('financeDashboardPage.filters.sortOptions.amountDesc')}
                </option>
                <option value="amount">
                  {t('financeDashboardPage.filters.sortOptions.amountAsc')}
                </option>
              </select>
            </div>
          </div>

          {/* Ligne du bas filtres : options + reset */}
          <div className="mt-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
              <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={filters.onlyLinked}
                  onChange={(e) =>
                    setFilters({ ...filters, onlyLinked: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
                />
                <span>{t('financeDashboardPage.filters.onlyLinked')}</span>
              </label>

 {/* Raccourcis de pAAriode */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => quickRange(7)}
                  className="text-[11px] px-3 py-1.5 rounded-full bg-surface-card border border-border hover:bg-surface-main font-medium transition"
                >
                  {t('financeDashboardPage.filters.quickRanges.last7')}
                </button>
                <button
                  type="button"
                  onClick={() => quickRange(30)}
                  className="text-[11px] px-3 py-1.5 rounded-full bg-surface-card border border-border hover:bg-surface-main font-medium transition"
                >
                  {t('financeDashboardPage.filters.quickRanges.last30')}
                </button>
                <button
                  type="button"
                  onClick={() => quickRange(90)}
                  className="text-[11px] px-3 py-1.5 rounded-full bg-surface-card border border-border hover:bg-surface-main font-medium transition"
                >
                  {t('financeDashboardPage.filters.quickRanges.last90')}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2">
              <div className="text-[11px] text-text-muted">
                {t('financeDashboardPage.counts.transactions', {
                  count: filtered.length,
                })}
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="text-[11px] px-3 py-1.5 rounded-full bg-surface-card border border-border hover:bg-surface-main font-medium transition"
              >
                {t('financeDashboardPage.filters.reset')}
              </button>
            </div>
          </div>
        </div>

        {/* Solde principal */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
          <h2
            className={`text-xl sm:text-2xl font-semibold break-words ${
              summary.balance >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'
            }`}
          >
            {t('financeDashboardPage.balance', {
              amount: formatCurrency(summary.balance),
              currency: 'XOF',
            })}
          </h2>
        </div>

        {/* Highlights */}
        <div className="mt-2">
          <h3 className="text-base sm:text-lg font-semibold text-text-primary mb-2">
            {t('financeDashboardPage.sections.highlights')}
          </h3>
          {loadingTransactions && (
            <p className="mb-2 text-xs text-text-muted">
              {t('common.loading', { defaultValue: 'Chargement...' })}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label={t('financeDashboardPage.stats.totalIn')}
              value={t('financeDashboardPage.currencyValue', {
                amount: formatCurrency(totalIn),
                currency: 'XOF',
              })}
            />
            <StatCard
              label={t('financeDashboardPage.stats.totalOut')}
              value={t('financeDashboardPage.currencyValue', {
                amount: formatCurrency(totalOut),
                currency: 'XOF',
              })}
            />
            <StatCard
              label={t('financeDashboardPage.stats.balance')}
              value={t('financeDashboardPage.currencyValue', {
                amount: formatCurrency(summary.balance),
                currency: 'XOF',
              })}
            />
            <StatCard
              label={t('financeDashboardPage.stats.transactions')}
              value={t('financeDashboardPage.stats.transactionsValue', {
                count: totalCount,
              })}
            />
          </div>
        </div>

        {showChart && !loadingTransactions && (
          <div className="w-full h-72 sm:h-80 mt-6 mb-6 bg-surface-card border border-border rounded-2xl shadow-sm px-2 sm:px-4 py-3 transition-transform transform hover:-translate-y-0.5">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  dataKey="value"
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  label
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val) => `${formatCurrency(val)} XOF`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Insights */}
        <div className="mt-2">
          <h3 className="text-base sm:text-lg font-semibold text-text-primary mb-2">
            {t('financeDashboardPage.sections.insights')}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <InsightCard
              label={t('financeDashboardPage.insights.average')}
              value={t('financeDashboardPage.currencyValue', {
                amount: formatCurrency(avgAmount),
                currency: 'XOF',
              })}
            />
            <InsightCard
              label={t('financeDashboardPage.insights.largest')}
              value={
                largestTx
                  ? t('financeDashboardPage.currencyValue', {
                      amount: formatCurrency(largestTx.amount),
                      currency: 'XOF',
                    })
                  : t('common.dash')
              }
              hint={
                largestTx ? getTransactionEntityLabel(largestTx, t) : undefined
              }
            />
            <InsightCard
              label={t('financeDashboardPage.insights.linkedRatio')}
              value={t('financeDashboardPage.insights.linkedRatioValue', {
                linked: linkedCount,
                total: totalCount,
              })}
              hint={t('financeDashboardPage.insights.linkedRatioHint', {
                linked: linkedCount,
                total: totalCount,
              })}
            />
            <InsightCard
              label={t('financeDashboardPage.insights.lastActivity')}
              value={
                lastActivity
                  ? formatDate(lastActivity)
                  : t('common.dash')
              }
            />
          </div>
        </div>

 {/* AA a a Admin : breakdown par rAA le (vue filtrAAe) */}
        {isAdmin && (
          <div className="mt-6">
            <h3 className="text-base sm:text-lg font-semibold text-text-primary mb-2">
              {t('financeDashboardPage.sections.roleDetails')}
            </h3>
            <RoleBreakdown
              transactions={filtered}
              formatCurrency={formatCurrency}
            />
          </div>
        )}

 {/* AA A12A Snapshot d'activitAA (agent / client) */}
        {(isAgent || isClient) && (
          <div className="mt-6">
            <h3 className="text-base sm:text-lg font-semibold text-text-primary mb-2">
              {t('financeDashboardPage.sections.activity')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label={t('financeDashboardPage.activity.services')}
                value={t('financeDashboardPage.activity.count', {
                  count: uniqueCounts.services,
                })}
              />
              <StatCard
                label={t('financeDashboardPage.activity.tasks')}
                value={t('financeDashboardPage.activity.count', {
                  count: uniqueCounts.tasks,
                })}
              />
              <StatCard
                label={t('financeDashboardPage.activity.projects')}
                value={t('financeDashboardPage.activity.count', {
                  count: uniqueCounts.projects,
                })}
              />
              <StatCard
                label={t('financeDashboardPage.activity.orders')}
                value={t('financeDashboardPage.activity.count', {
                  count: uniqueCounts.orders,
                })}
              />
            </div>
          </div>
        )}

 {/* AA AA Top entitAAs */}
        <div className="mt-6">
          <h3 className="text-base sm:text-lg font-semibold text-text-primary mb-2">
            {t('financeDashboardPage.sections.topEntities')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {topCards.map((card) => (
              <TopEntitiesCard
                key={card.key}
                title={card.title}
                items={card.items}
                formatCurrency={formatCurrency}
                emptyLabel={t('financeDashboardPage.topEntities.empty')}
              />
            ))}
          </div>
        </div>

 {/* AA aE DAAtails globaux (vue filtrAAe) */}
        <div className="mt-6">
          <h3 className="text-base sm:text-lg font-semibold text-text-primary mb-2">
            {t('financeDashboardPage.sections.breakdown')}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label={t('financeDashboardPage.stats.revenues')}
              value={t('financeDashboardPage.currencyValue', {
                amount: formatCurrency(summary.revenues),
                currency: 'XOF',
              })}
            />
            <StatCard
              label={t('financeDashboardPage.stats.expenses')}
              value={t('financeDashboardPage.currencyValue', {
                amount: formatCurrency(summary.expenses),
                currency: 'XOF',
              })}
            />
            <StatCard
              label={t('financeDashboardPage.stats.commissions')}
              value={t('financeDashboardPage.currencyValue', {
                amount: formatCurrency(summary.commissions),
                currency: 'XOF',
              })}
            />
            <StatCard
              label={t('financeDashboardPage.stats.adjustments')}
              value={t('financeDashboardPage.currencyValue', {
                amount: formatCurrency(summary.adjustments),
                currency: 'XOF',
              })}
            />
          </div>
        </div>

 {/* AA aE RAAcents */}
        <div className="mt-6">
          <RecentTransactions
            items={recentTransactions}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            t={t}
          />
        </div>
      </div>
    </div>
  );
}

/** AA aA Petite carte statistique */
function StatCard({ label, value }) {
  return (
    <div className="bg-surface-card border border-border rounded-2xl p-4 shadow-sm transition-transform transform hover:-translate-y-0.5 hover:shadow-md">
      <div className="text-xs text-text-muted break-words">{label}</div>
      <div className="text-lg sm:text-xl font-semibold text-text-primary mt-1 break-words">
        {value}
      </div>
    </div>
  );
}

function FinanceDashboardSkeleton({ loadingLabel }) {
  const Line = ({ className = '' }) => (
    <div
      className={`animate-pulse rounded-xl bg-surface-main border border-border/40 ${className}`}
      aria-hidden="true"
    />
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-3 py-8 sm:px-4 sm:py-10">
      <div className="max-w-6xl mx-auto bg-surface-card/90 backdrop-blur-sm shadow-[0_18px_45px_rgba(0,0,0,0.06)] rounded-3xl border border-border px-4 py-5 sm:px-8 sm:py-7">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="min-w-0 flex-1">
            <Line className="h-8 w-64" />
            <Line className="h-4 w-full max-w-md mt-3" />
            <div className="mt-3 flex gap-2">
              <Line className="h-7 w-28 rounded-full" />
              <Line className="h-7 w-36 rounded-full" />
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Line className="h-10 flex-1 sm:w-36 rounded-full" />
            <Line className="h-10 flex-1 sm:w-36 rounded-full" />
          </div>
        </div>

        <div className="mb-6 bg-surface-main border border-border rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i}>
                <Line className="h-3 w-20 mb-2" />
                <Line className="h-10 w-full" />
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="flex gap-2 flex-wrap">
              <Line className="h-6 w-28 rounded-full" />
              <Line className="h-6 w-20 rounded-full" />
              <Line className="h-6 w-20 rounded-full" />
              <Line className="h-6 w-20 rounded-full" />
            </div>
            <Line className="h-6 w-36 rounded-full" />
          </div>
        </div>

        <Line className="h-8 w-80 mb-4" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={`stat-${i}`} className="bg-surface-card border border-border rounded-2xl p-4 shadow-sm">
              <Line className="h-3 w-24" />
              <Line className="h-6 w-32 mt-3" />
            </div>
          ))}
        </div>

        <div className="w-full h-72 sm:h-80 mb-6 bg-surface-card border border-border rounded-2xl shadow-sm px-4 py-3">
          <div className="h-full rounded-2xl border border-dashed border-border flex items-center justify-center">
            <p className="text-sm text-text-muted animate-pulse">{loadingLabel}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={`ins-${i}`} className="bg-surface-card border border-border rounded-2xl p-4 shadow-sm">
              <Line className="h-3 w-24" />
              <Line className="h-5 w-28 mt-3" />
              <Line className="h-3 w-20 mt-2" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={`top-${i}`} className="bg-surface-card border border-border rounded-2xl p-4 shadow-sm">
              <Line className="h-4 w-32 mb-3" />
              {Array.from({ length: 3 }).map((__, j) => (
                <div key={`row-${i}-${j}`} className="flex justify-between gap-3 mb-2 last:mb-0">
                  <Line className="h-3 flex-1" />
                  <Line className="h-3 w-20" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InsightCard({ label, value, hint }) {
  return (
    <div className="bg-surface-card border border-border rounded-2xl p-4 shadow-sm">
      <div className="text-xs text-text-muted break-words">{label}</div>
      <div className="text-base sm:text-lg font-semibold text-text-primary mt-1 break-words">
        {value}
      </div>
      {hint && (
        <div className="text-[11px] text-text-muted mt-1 break-words">{hint}</div>
      )}
    </div>
  );
}

function TopEntitiesCard({ title, items, formatCurrency, emptyLabel }) {
  return (
    <div className="bg-surface-card border border-border rounded-2xl p-4 shadow-sm">
      <h4 className="text-sm font-semibold text-text-primary mb-2 break-words">
        {title}
      </h4>
      {items.length === 0 ? (
        <div className="text-xs text-text-muted">{emptyLabel}</div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3">
              <div className="text-xs sm:text-sm text-text-secondary break-words line-clamp-2">
                {item.label}
              </div>
              <div className="text-xs sm:text-sm font-semibold text-text-primary whitespace-nowrap">
                {formatCurrency(item.total)} XOF
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecentTransactions({ items, formatCurrency, formatDate, t }) {
  return (
    <div className="bg-surface-card border border-border rounded-2xl p-4 shadow-sm">
      <h4 className="text-sm font-semibold text-text-primary mb-3 break-words">
        {t('financeDashboardPage.sections.recent')}
      </h4>
      {items.length === 0 ? (
        <div className="text-xs text-text-muted">
          {t('financeDashboardPage.recent.empty')}
        </div>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
          {items.map((trx) => (
            <div
              key={trx.id}
              className="flex items-start justify-between gap-3 border-b border-[#f1f5f9] pb-3 last:border-b-0 last:pb-0"
            >
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-semibold text-text-primary break-words line-clamp-1">
                  {formatCurrency(trx.amount)} XOF
                </div>
                <div className="text-[11px] text-text-muted break-words line-clamp-1">
                  {getTransactionEntityLabel(trx, t)}
                </div>
              </div>
              <div className="text-[11px] text-text-muted whitespace-nowrap">
                {trx.createdAt ? formatDate(trx.createdAt) : t('common.dash')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * AA a a Composant pour lAaaadmin Aaa affiche les sous-totaux sAAparAAs par rAA le
 * (reAAoit dAAjAA la liste filtrAAe)
 */
function RoleBreakdown({ transactions, formatCurrency }) {
  const { t } = useTranslation();
  const grouped = {
    client: [],
    agent: [],
    admin: [],
    autres: [],
  };

  for (const t of transactions) {
    const role = t.user?.role;
    if (role === 'client') grouped.client.push(t);
    else if (role === 'agent') grouped.agent.push(t);
    else if (role === 'admin') grouped.admin.push(t);
    else grouped.autres.push(t);
  }

  const sum = (list, type) =>
    list
      .filter((t) => t.type === type)
      .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const Block = ({ title, list, showAdjustments = false }) => (
    <div className="border border-border rounded-2xl p-4 mb-3 bg-surface-card shadow-sm">
      <h4 className="font-semibold text-text-primary mb-2 break-words text-sm sm:text-base">
        {title}
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs sm:text-sm text-text-secondary">
        <div>
          {t('financeDashboardPage.roleBreakdown.revenues', {
            amount: formatCurrency(sum(list, 'revenue')),
            currency: 'XOF',
          })}
        </div>
        <div>
          {t('financeDashboardPage.roleBreakdown.expenses', {
            amount: formatCurrency(sum(list, 'expense')),
            currency: 'XOF',
          })}
        </div>
        <div>
          {t('financeDashboardPage.roleBreakdown.commissions', {
            amount: formatCurrency(sum(list, 'commission')),
            currency: 'XOF',
          })}
        </div>
        {showAdjustments && (
          <div className="sm:col-span-3">
            {t('financeDashboardPage.roleBreakdown.adjustments', {
              amount: formatCurrency(sum(list, 'adjustment')),
              currency: 'XOF',
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <Block title={t('financeDashboardPage.roleBreakdown.clients')} list={grouped.client} />
      <Block title={t('financeDashboardPage.roleBreakdown.agents')} list={grouped.agent} />
      <Block title={t('financeDashboardPage.roleBreakdown.admins')} list={grouped.admin} />
      {grouped.autres.length > 0 && (
        <Block
          title={t('financeDashboardPage.roleBreakdown.others')}
          list={grouped.autres}
          showAdjustments
        />
      )}
    </div>
  );
}
