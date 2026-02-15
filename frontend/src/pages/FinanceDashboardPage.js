import { useEffect, useMemo, useState } from 'react';
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
  return parts.join(' • ');
}

export default function FinanceDashboardPage() {
  const { locale, formatDate } = useLocale();
  const { t } = useTranslation();
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

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

  // 🆕 Filtres & UI
  const [filters, setFilters] = useState({
    q: '',
    type: '', // '', 'revenue', 'expense', 'commission', 'adjustment'
    role: '', // '', 'client', 'agent', 'admin'
    dateFrom: '',
    dateTo: '',
    onlyLinked: false, // uniquement celles liées à un service/tâche
    sort: '-createdAt', // -createdAt, createdAt, amount, -amount
  });

  const [showChart, setShowChart] = useState(() => {
    const saved = localStorage.getItem('teranga_finance_showChart');
    return saved === null ? true : saved === '1';
  });

  // 🔄 Persistance de l’état du graphique
  useEffect(() => {
    localStorage.setItem('teranga_finance_showChart', showChart ? '1' : '0');
  }, [showChart]);

  useEffect(() => {
    if (filters.role && !roleFilterOptions.includes(filters.role)) {
      setFilters((prev) => ({ ...prev, role: '' }));
    }
  }, [filters.role, roleFilterOptions]);

  // 🚀 Initialisation
  useEffect(() => {
    async function init() {
      try {
        const u = await me();
        const current = u?.user;
        if (!current) {
          window.location.href = '/login';
          return;
        }
        setUser(current);

        const txs = await getTransactions(); // ACL côté backend
        setTransactions(txs || []);
      } catch (err) {
        console.error('❌ Erreur chargement FinanceDashboard:', err);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  // 🧮 Transactions filtrées côté client (non destructif)
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

    // Rôle (utile surtout pour admin)
    if (filters.role && roleFilterOptions.includes(filters.role)) {
      arr = arr.filter((t) => (t.user?.role || '') === filters.role);
    }

    // Période
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

    // Liées à un service/tâche
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

  // 🔢 Calcul des totaux selon la vue filtrée
  const computedSummary = useMemo(() => {
    const totals = {
      revenues: 0,
      expenses: 0,
      commissions: 0,
      adjustments: 0,
    };

    for (const t of filtered) {
      if (t.type === 'revenue') totals.revenues += Number(t.amount || 0);
      if (t.type === 'expense') totals.expenses += Number(t.amount || 0);
      if (t.type === 'commission') totals.commissions += Number(t.amount || 0);
      if (t.type === 'adjustment') totals.adjustments += Number(t.amount || 0);
    }

    const balance =
      totals.revenues - (totals.expenses + totals.commissions + totals.adjustments);

    return { ...totals, balance };
  }, [filtered]);

  // Conserver summary pour compatibilité (basé sur computedSummary)
  useEffect(() => {
    setSummary(computedSummary);
  }, [computedSummary]);

  const totalIn = summary?.revenues || 0;
  const totalOut =
    (summary?.expenses || 0) +
    (summary?.commissions || 0) +
    (summary?.adjustments || 0);
  const totalCount = filtered.length;
  const totalVolume = filtered.reduce((acc, t) => acc + toNumber(t.amount), 0);
  const avgAmount = totalCount > 0 ? totalVolume / totalCount : 0;
  const linkedCount = filtered.filter(
    (t) => t.service || t.task || t.order || t.project
  ).length;
  const linkedRatio =
    totalCount > 0 ? Math.round((linkedCount / totalCount) * 100) : 0;

  const largestTx = filtered.reduce((best, t) => {
    if (!best) return t;
    return toNumber(t.amount) > toNumber(best.amount) ? t : best;
  }, null);

  const lastActivity = filtered.reduce((latest, t) => {
    const ts = t?.createdAt ? new Date(t.createdAt).getTime() : 0;
    return ts > latest ? ts : latest;
  }, 0);

  const uniqueCounts = useMemo(() => {
    const services = new Set();
    const tasks = new Set();
    const projects = new Set();
    const orders = new Set();

    for (const t of filtered) {
      if (t.service?.id) services.add(t.service.id);
      if (t.task?.id) tasks.add(t.task.id);
      if (t.project?.id) projects.add(t.project.id);
      if (t.order?.id) orders.add(t.order.id);
    }

    return {
      services: services.size,
      tasks: tasks.size,
      projects: projects.size,
      orders: orders.size,
    };
  }, [filtered]);

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

  // Format monétaire local (XOF, etc.)
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

  // Export CSV simple de la vue filtrée
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

  // États transitoires
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
        <p className="text-gray-600 text-lg animate-pulse">
          {t('financeDashboardPage.loading.page')}
        </p>
      </div>
    );
  }

  if (!user || !summary) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
        <p className="text-gray-600">
          {t('financeDashboardPage.empty.noData')}
        </p>
      </div>
    );
  }

  // 🎨 Données pour le graphique (vue filtrée)
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
  // 🖥️ UI principale — Apple Light, sobre & premium
  // ============================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f5f5f7] via-[#f5f5f7] to-[#e5e5ea] px-3 py-8 sm:px-4 sm:py-10">
      <div className="max-w-6xl mx-auto bg-white/90 backdrop-blur-sm shadow-[0_18px_45px_rgba(0,0,0,0.06)] rounded-3xl border border-[#e5e5ea] px-4 py-5 sm:px-8 sm:py-7">
        {/* 🧭 En-tête responsive */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#111827] tracking-tight break-words flex items-center gap-2">
              <span className="text-xl">📊</span>
              <span>{t('financeDashboardPage.title')}</span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 break-words">
              {isGlobalAdmin
                ? t('financeDashboardPage.descriptions.admin')
                : isMaster
                ? t('financeDashboardPage.descriptions.master')
                : isAgent
                ? t('financeDashboardPage.descriptions.agent')
                : t('financeDashboardPage.descriptions.client')}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-wide uppercase text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">
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
              className="w-full sm:w-auto px-4 py-2 text-xs sm:text-sm font-medium rounded-full shadow-sm bg-[#111827] text-white hover:bg-black transition-transform transform hover:-translate-y-0.5 active:translate-y-0"
            >
              {showChart
                ? t('financeDashboardPage.buttons.hideChart')
                : t('financeDashboardPage.buttons.showChart')}
            </button>
            <button
              onClick={exportCSV}
              className="w-full sm:w-auto px-4 py-2 text-xs sm:text-sm font-medium rounded-full shadow-sm border border-[#d1d5db] bg-white text-gray-800 hover:bg-[#f5f5f7] transition-transform transform hover:-translate-y-0.5 active:translate-y-0"
            >
              {t('financeDashboardPage.buttons.exportCsv')}
            </button>
          </div>
        </div>

        {/* 🎛️ Filtres premium + responsive */}
        <div className="mb-6 bg-[#f9fafb] border border-[#e5e7eb] rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
            {/* Recherche texte */}
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-medium text-gray-500 mb-1 uppercase tracking-wide">
                {t('financeDashboardPage.filters.searchLabel')}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                  🔍
                </span>
                <input
                  placeholder={t('financeDashboardPage.filters.searchPlaceholder')}
                  value={filters.q}
                  onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                  className="w-full border border-[#e5e7eb] rounded-2xl pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-[#0a84ff] focus:border-[#0a84ff] bg-white transition"
                />
              </div>
            </div>

            {/* Type */}
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1 uppercase tracking-wide">
                {t('financeDashboardPage.filters.typeLabel')}
              </label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="w-full border border-[#e5e7eb] rounded-2xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#0a84ff] focus:border-[#0a84ff] bg-white transition"
              >
                <option value="">{t('financeDashboardPage.filters.allOption')}</option>
                <option value="revenue">{t('transactions.type.revenue')}</option>
                <option value="expense">{t('transactions.type.expense')}</option>
                <option value="commission">{t('transactions.type.commission')}</option>
                <option value="adjustment">{t('transactions.type.adjustment')}</option>
              </select>
            </div>

            {/* Rôle (admin global / master) */}
            {roleFilterOptions.length > 0 && (
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1 uppercase tracking-wide">
                  {t('financeDashboardPage.filters.roleLabel')}
                  <span className="text-[10px] font-normal text-gray-400 normal-case ml-1">
                    {t('financeDashboardPage.filters.roleHint')}
                  </span>
                </label>
                <select
                  value={filters.role}
                  onChange={(e) =>
                    setFilters({ ...filters, role: e.target.value })
                  }
                  className="w-full border border-[#e5e7eb] rounded-2xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#0a84ff] focus:border-[#0a84ff] bg-white transition"
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
              <label className="block text-[11px] font-medium text-gray-500 mb-1 uppercase tracking-wide">
                {t('financeDashboardPage.filters.fromLabel')}
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) =>
                  setFilters({ ...filters, dateFrom: e.target.value })
                }
                className="w-full border border-[#e5e7eb] rounded-2xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#0a84ff] focus:border-[#0a84ff] bg-white transition"
              />
            </div>

            {/* Date au */}
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1 uppercase tracking-wide">
                {t('financeDashboardPage.filters.toLabel')}
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-full border border-[#e5e7eb] rounded-2xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#0a84ff] focus:border-[#0a84ff] bg-white transition"
              />
            </div>

            {/* Tri */}
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1 uppercase tracking-wide">
                {t('financeDashboardPage.filters.sortLabel')}
              </label>
              <select
                value={filters.sort}
                onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
                className="w-full border border-[#e5e7eb] rounded-2xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#0a84ff] focus:border-[#0a84ff] bg-white transition"
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
              <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={filters.onlyLinked}
                  onChange={(e) =>
                    setFilters({ ...filters, onlyLinked: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300 text-[#0a84ff] focus:ring-[#0a84ff]"
                />
                <span>{t('financeDashboardPage.filters.onlyLinked')}</span>
              </label>

              {/* Raccourcis de période */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => quickRange(7)}
                  className="text-[11px] px-3 py-1.5 rounded-full bg-white border border-[#e5e7eb] hover:bg-[#f3f4f6] font-medium transition"
                >
                  {t('financeDashboardPage.filters.quickRanges.last7')}
                </button>
                <button
                  type="button"
                  onClick={() => quickRange(30)}
                  className="text-[11px] px-3 py-1.5 rounded-full bg-white border border-[#e5e7eb] hover:bg-[#f3f4f6] font-medium transition"
                >
                  {t('financeDashboardPage.filters.quickRanges.last30')}
                </button>
                <button
                  type="button"
                  onClick={() => quickRange(90)}
                  className="text-[11px] px-3 py-1.5 rounded-full bg-white border border-[#e5e7eb] hover:bg-[#f3f4f6] font-medium transition"
                >
                  {t('financeDashboardPage.filters.quickRanges.last90')}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2">
              <div className="text-[11px] text-gray-500">
                {t('financeDashboardPage.counts.transactions', {
                  count: filtered.length,
                })}
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="text-[11px] px-3 py-1.5 rounded-full bg-white border border-[#e5e7eb] hover:bg-[#f3f4f6] font-medium transition"
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
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
            {t('financeDashboardPage.sections.highlights')}
          </h3>
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

        {showChart && (
          <div className="w-full h-72 sm:h-80 mt-6 mb-6 bg-white border border-[#e5e7eb] rounded-2xl shadow-sm px-2 sm:px-4 py-3 transition-transform transform hover:-translate-y-0.5">
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
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
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

        {/* 👑 Admin : breakdown par rôle (vue filtrée) */}
        {isAdmin && (
          <div className="mt-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
              {t('financeDashboardPage.sections.roleDetails')}
            </h3>
            <RoleBreakdown
              transactions={filtered}
              formatCurrency={formatCurrency}
            />
          </div>
        )}

        {/* 🎯 Snapshot d'activité (agent / client) */}
        {(isAgent || isClient) && (
          <div className="mt-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
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

        {/* 🧭 Top entités */}
        <div className="mt-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
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

        {/* 📘 Détails globaux (vue filtrée) */}
        <div className="mt-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
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

        {/* 🕘 Récents */}
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

/** 📦 Petite carte statistique */
function StatCard({ label, value }) {
  return (
    <div className="bg-white border border-[#e5e7eb] rounded-2xl p-4 shadow-sm transition-transform transform hover:-translate-y-0.5 hover:shadow-md">
      <div className="text-xs text-gray-500 break-words">{label}</div>
      <div className="text-lg sm:text-xl font-semibold text-gray-900 mt-1 break-words">
        {value}
      </div>
    </div>
  );
}

function InsightCard({ label, value, hint }) {
  return (
    <div className="bg-white border border-[#e5e7eb] rounded-2xl p-4 shadow-sm">
      <div className="text-xs text-gray-500 break-words">{label}</div>
      <div className="text-base sm:text-lg font-semibold text-gray-900 mt-1 break-words">
        {value}
      </div>
      {hint && (
        <div className="text-[11px] text-gray-400 mt-1 break-words">{hint}</div>
      )}
    </div>
  );
}

function TopEntitiesCard({ title, items, formatCurrency, emptyLabel }) {
  return (
    <div className="bg-white border border-[#e5e7eb] rounded-2xl p-4 shadow-sm">
      <h4 className="text-sm font-semibold text-gray-900 mb-2 break-words">
        {title}
      </h4>
      {items.length === 0 ? (
        <div className="text-xs text-gray-400">{emptyLabel}</div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3">
              <div className="text-xs sm:text-sm text-gray-700 break-words line-clamp-2">
                {item.label}
              </div>
              <div className="text-xs sm:text-sm font-semibold text-gray-900 whitespace-nowrap">
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
    <div className="bg-white border border-[#e5e7eb] rounded-2xl p-4 shadow-sm">
      <h4 className="text-sm font-semibold text-gray-900 mb-3 break-words">
        {t('financeDashboardPage.sections.recent')}
      </h4>
      {items.length === 0 ? (
        <div className="text-xs text-gray-400">
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
                <div className="text-xs sm:text-sm font-semibold text-gray-900 break-words line-clamp-1">
                  {formatCurrency(trx.amount)} XOF
                </div>
                <div className="text-[11px] text-gray-500 break-words line-clamp-1">
                  {getTransactionEntityLabel(trx, t)}
                </div>
              </div>
              <div className="text-[11px] text-gray-400 whitespace-nowrap">
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
 * 👑 Composant pour l’admin — affiche les sous-totaux séparés par rôle
 * (reçoit déjà la liste filtrée)
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
    <div className="border border-[#e5e7eb] rounded-2xl p-4 mb-3 bg-white shadow-sm">
      <h4 className="font-semibold text-gray-900 mb-2 break-words text-sm sm:text-base">
        {title}
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs sm:text-sm text-gray-700">
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

