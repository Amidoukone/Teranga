import { useEffect, useMemo, useState } from 'react';
import { getTransactions } from '../services/transactions';
import { me } from '../services/auth';
import {
  PieChart,
  Pie,
  Tooltip,
  Cell,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function FinanceDashboardPage() {
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

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

  // 🚀 Initialisation
  useEffect(() => {
    async function init() {
      try {
        const u = await me();
        setUser(u.user);

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
    if (filters.role) {
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
  }, [transactions, filters]);

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

  // Format monétaire local (XOF, etc.)
  const formatCurrency = (v) =>
    new Intl.NumberFormat('fr-FR', {
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
        <p className="text-gray-600 text-lg animate-pulse">Chargement…</p>
      </div>
    );
  }

  if (!user || !summary) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
        <p className="text-gray-600">Aucune donnée disponible.</p>
      </div>
    );
  }

  // 🎨 Données pour le graphique (vue filtrée)
  const COLORS = ['#34C759', '#FF3B30', '#0A84FF', '#AF52DE']; // Apple-like palette
  const chartData = [
    { name: 'Revenus', value: summary.revenues },
    { name: 'Dépenses', value: summary.expenses },
    { name: 'Commissions', value: summary.commissions },
    { name: 'Ajustements', value: summary.adjustments },
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
              <span>Tableau de bord financier</span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 break-words">
              {user.role === 'admin'
                ? 'Vue globale sur les flux financiers (tous rôles confondus).'
                : user.role === 'agent'
                ? 'Vue de vos transactions liées à vos services et tâches.'
                : 'Vue de vos transactions personnelles.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:justify-end">
            <button
              onClick={() => setShowChart((s) => !s)}
              className="w-full sm:w-auto px-4 py-2 text-xs sm:text-sm font-medium rounded-full shadow-sm bg-[#111827] text-white hover:bg-black transition-transform transform hover:-translate-y-0.5 active:translate-y-0"
            >
              {showChart ? 'Masquer le graphique' : 'Afficher le graphique 📈'}
            </button>
            <button
              onClick={exportCSV}
              className="w-full sm:w-auto px-4 py-2 text-xs sm:text-sm font-medium rounded-full shadow-sm border border-[#d1d5db] bg-white text-gray-800 hover:bg-[#f5f5f7] transition-transform transform hover:-translate-y-0.5 active:translate-y-0"
            >
              ⬇️ Export CSV
            </button>
          </div>
        </div>

        {/* 🎛️ Filtres premium + responsive */}
        <div className="mb-6 bg-[#f9fafb] border border-[#e5e7eb] rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
            {/* Recherche texte */}
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-medium text-gray-500 mb-1 uppercase tracking-wide">
                Recherche
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                  🔍
                </span>
                <input
                  placeholder="Description, paiement, service/tâche, email…"
                  value={filters.q}
                  onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                  className="w-full border border-[#e5e7eb] rounded-2xl pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-[#0a84ff] focus:border-[#0a84ff] bg-white transition"
                />
              </div>
            </div>

            {/* Type */}
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1 uppercase tracking-wide">
                Type
              </label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="w-full border border-[#e5e7eb] rounded-2xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#0a84ff] focus:border-[#0a84ff] bg-white transition"
              >
                <option value="">— Tous —</option>
                <option value="revenue">Revenu</option>
                <option value="expense">Dépense</option>
                <option value="commission">Commission</option>
                <option value="adjustment">Ajustement</option>
              </select>
            </div>

            {/* Rôle (surtout admin) */}
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1 uppercase tracking-wide">
                Rôle
              </label>
              <select
                value={filters.role}
                onChange={(e) => setFilters({ ...filters, role: e.target.value })}
                className="w-full border border-[#e5e7eb] rounded-2xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#0a84ff] focus:border-[#0a84ff] bg-white transition"
              >
                <option value="">— Tous —</option>
                <option value="client">Client</option>
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {/* Date du */}
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1 uppercase tracking-wide">
                Du
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
                Au
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
                Tri
              </label>
              <select
                value={filters.sort}
                onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
                className="w-full border border-[#e5e7eb] rounded-2xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#0a84ff] focus:border-[#0a84ff] bg-white transition"
              >
                <option value="-createdAt">Plus récents</option>
                <option value="createdAt">Plus anciens</option>
                <option value="-amount">Montant ↓</option>
                <option value="amount">Montant ↑</option>
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
                <span>Seulement liées à un service / tâche</span>
              </label>

              {/* Raccourcis de période */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => quickRange(7)}
                  className="text-[11px] px-3 py-1.5 rounded-full bg-white border border-[#e5e7eb] hover:bg-[#f3f4f6] font-medium transition"
                >
                  7 jours
                </button>
                <button
                  type="button"
                  onClick={() => quickRange(30)}
                  className="text-[11px] px-3 py-1.5 rounded-full bg-white border border-[#e5e7eb] hover:bg-[#f3f4f6] font-medium transition"
                >
                  30 jours
                </button>
                <button
                  type="button"
                  onClick={() => quickRange(90)}
                  className="text-[11px] px-3 py-1.5 rounded-full bg-white border border-[#e5e7eb] hover:bg-[#f3f4f6] font-medium transition"
                >
                  90 jours
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2">
              <div className="text-[11px] text-gray-500">
                {filtered.length} transaction(s)
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="text-[11px] px-3 py-1.5 rounded-full bg-white border border-[#e5e7eb] hover:bg-[#f3f4f6] font-medium transition"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </div>

        {/* Solde & Graphique */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
          <h2
            className={`text-xl sm:text-2xl font-semibold break-words ${
              summary.balance >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'
            }`}
          >
            Solde actuel : {formatCurrency(summary.balance)} XOF
          </h2>
        </div>

        {showChart && (
          <div className="w-full h-72 sm:h-80 mt-2 mb-6 bg-white border border-[#e5e7eb] rounded-2xl shadow-sm px-2 sm:px-4 py-3 transition-transform transform hover:-translate-y-0.5">
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

        {/* 👑 Admin : breakdown par rôle (vue filtrée) */}
        {user.role === 'admin' && (
          <div className="mt-4 mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
              👥 Détails par rôle
            </h3>
            <RoleBreakdown transactions={filtered} />
          </div>
        )}

        {/* 📘 Détails globaux (vue filtrée) */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="💰 Revenus"
            value={`${formatCurrency(summary.revenues)} XOF`}
          />
          <StatCard
            label="💸 Dépenses"
            value={`${formatCurrency(summary.expenses)} XOF`}
          />
          <StatCard
            label="🏢 Commissions"
            value={`${formatCurrency(summary.commissions)} XOF`}
          />
          <StatCard
            label="⚙️ Ajustements"
            value={`${formatCurrency(summary.adjustments)} XOF`}
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

/**
 * 👑 Composant pour l’admin — affiche les sous-totaux séparés par rôle
 * (reçoit déjà la liste filtrée)
 */
function RoleBreakdown({ transactions }) {
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
        <div>Revenus : {sum(list, 'revenue').toFixed(2)} XOF</div>
        <div>Dépenses : {sum(list, 'expense').toFixed(2)} XOF</div>
        <div>Commissions : {sum(list, 'commission').toFixed(2)} XOF</div>
        {showAdjustments && (
          <div className="sm:col-span-3">
            Ajustements : {sum(list, 'adjustment').toFixed(2)} XOF
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <Block title="👤 Clients" list={grouped.client} />
      <Block title="🧑‍🔧 Agents" list={grouped.agent} />
      <Block title="👑 Admins" list={grouped.admin} />
      {grouped.autres.length > 0 && (
        <Block
          title="⚙️ Autres / Ajustements internes"
          list={grouped.autres}
          showAdjustments
        />
      )}
    </div>
  );
}
