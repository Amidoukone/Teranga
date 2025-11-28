// frontend/src/pages/DashboardPage.jsx
// ============================================================================
// DashboardPage — Version Premium Évoluée 2025 (Responsive + UI moderne + rôle normalisé)
// ============================================================================

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { me } from '../services/auth';
import {
  getMyServices,
  getAllServicesAdmin,
  getAgentServices,
} from '../services/services';
import {
  getTransactions,
  getFinancialSummary,
} from '../services/transactions';
import FinanceWidget from '../components/FinanceWidget';

/* ============================================================================
   🔧 UTILITAIRES
=========================================================================== */

// Normalisation rôle (comme dans NavBar)
function normalizeRole(rawRole) {
  if (!rawRole) return 'client';
  const r = String(rawRole).toLowerCase();

  if (r.includes('admin')) return 'admin';
  if (r.includes('agent')) return 'agent';
  return 'client';
}

function prettyRoleLabel(role) {
  const r = normalizeRole(role);
  if (r === 'admin') return 'ADMINISTRATEUR';
  if (r === 'agent') return 'AGENT';
  return 'CLIENT';
}

function formatAmount(value) {
  return Number(value || 0).toLocaleString('fr-FR');
}

function getInitials(user) {
  if (!user) return '?';
  const first = user.firstName || '';
  const last = user.lastName || '';
  const initials = (first[0] || '') + (last[0] || '');
  if (initials.trim()) return initials.toUpperCase();
  return (user.email?.[0] || '?').toUpperCase();
}

/* ============================================================================
   PAGE PRINCIPALE
=========================================================================== */
export default function DashboardPage() {
  const [user, setUser] = useState(null);

  const [stats, setStats] = useState({
    servicesCount: 0,
    activeServices: 0,
    transactionsCount: 0,
    totalRevenue: 0,
    totalExpense: 0,
    balance: 0,
  });

  const [loading, setLoading] = useState(true);

  /* ---------------------------------------------------------------------- */
  /* 🔄 INITIALISATION                                                     */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    async function init() {
      try {
        const res = await me();
        const u = res.user;
        setUser(u);
        await loadStats(u);
      } catch (err) {
        console.error('❌ Erreur Dashboard init:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  /* ---------------------------------------------------------------------- */
  /* 📊 CHARGEMENT DES STATISTIQUES                                        */
  /* ---------------------------------------------------------------------- */
  async function loadStats(u) {
    try {
      let services = [];
      let transactions = [];
      let financialSummary = null;

      const role = normalizeRole(u.role);

      // SERVICES selon rôle
      if (role === 'admin') {
        services = await getAllServicesAdmin();
      } else if (role === 'agent') {
        services = await getAgentServices();
      } else {
        services = await getMyServices();
      }

      // TRANSACTIONS
      transactions = await getTransactions();

      // Résumé financier (admin only)
      if (role === 'admin') {
        financialSummary = await getFinancialSummary();
      }

      // Calculs
      const activeServices = (services || []).filter(
        (s) => s.status !== 'completed' && s.status !== 'validated'
      ).length;

      const totalRevenue =
        financialSummary?.revenues ??
        transactions
          .filter((t) => t.type === 'revenue')
          .reduce((n, t) => n + Number(t.amount || 0), 0);

      const totalExpense =
        financialSummary?.expenses ??
        transactions
          .filter((t) =>
            ['expense', 'commission', 'adjustment'].includes(t.type)
          )
          .reduce((n, t) => n + Number(t.amount || 0), 0);

      const balance =
        financialSummary?.balance ?? totalRevenue - totalExpense;

      setStats({
        servicesCount: services.length,
        activeServices,
        transactionsCount: transactions.length,
        totalRevenue,
        totalExpense,
        balance,
      });
    } catch (err) {
      console.error('❌ Erreur chargement stats Dashboard:', err);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* 🌀 ÉTAT CHARGEMENT                                                     */
  /* ---------------------------------------------------------------------- */
  if (loading || !user) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4">
        <p className="text-gray-600 text-lg animate-pulse text-center">
          Chargement du tableau de bord…
        </p>
      </div>
    );
  }

  const roleKey = normalizeRole(user.role);
  const isPositiveBalance = stats.balance >= 0;

  /* ============================================================================
     🎨 UI PRINCIPALE
  =========================================================================== */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-3 sm:px-4 lg:px-6 py-8 lg:py-10">
      <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-2xl border border-gray-100 px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

        {/* ------------------------------------------------------------------ */}
        {/* 🧭 HEADER PREMIUM                                                  */}
        {/* ------------------------------------------------------------------ */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6 mb-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-600 text-white font-semibold text-lg shadow-sm">
              {getInitials(user)}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 truncate">
                Bonjour, {user.firstName || user.email} 👋
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Bienvenue sur votre espace Teranga — rôle :
                <span className="font-semibold text-blue-600 uppercase ml-1">
                  {prettyRoleLabel(user.role)}
                </span>
              </p>
            </div>
          </div>

          {/* Badge rôle + solde */}
          <div className="flex flex-col items-start md:items-end gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
              {prettyRoleLabel(user.role)}
            </span>

            <div className="text-right">
              <div className="text-xs text-gray-500">Solde global</div>
              <div
                className={`text-lg font-bold ${
                  isPositiveBalance ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {formatAmount(stats.balance)} XOF
              </div>
            </div>
          </div>
        </header>

        {/* ------------------------------------------------------------------ */}
        {/* 📊 STATISTIQUES                                                   */}
        {/* ------------------------------------------------------------------ */}
        <section className="mb-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Services totaux" value={stats.servicesCount} icon="📦" />
            <StatCard label="Services actifs" value={stats.activeServices} icon="⚡" />
            <StatCard label="Transactions" value={stats.transactionsCount} icon="💳" />
            <StatCard
              label="Solde actuel"
              value={`${formatAmount(stats.balance)} XOF`}
              highlight={isPositiveBalance}
              icon={isPositiveBalance ? '📈' : '📉'}
            />
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* 💰 FINANCES (WIDGET + SYNTHÈSE)                                   */}
        {/* ------------------------------------------------------------------ */}
        <section className="mb-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900 flex items-center gap-2">
                    💰 Vue détaillée des finances
                  </h2>
                </div>
                <FinanceWidget role={roleKey} />
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">
                  Synthèse rapide
                </h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex justify-between">
                    <span>Revenus</span>
                    <span className="font-semibold text-emerald-600">
                      {formatAmount(stats.totalRevenue)} XOF
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>Dépenses</span>
                    <span className="font-semibold text-red-600">
                      {formatAmount(stats.totalExpense)} XOF
                    </span>
                  </li>
                  <li className="flex justify-between border-t border-dashed border-gray-200 pt-2 mt-2">
                    <span>Solde net</span>
                    <span
                      className={`font-bold ${
                        isPositiveBalance ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {formatAmount(stats.balance)} XOF
                    </span>
                  </li>
                </ul>
              </div>
              <p className="text-xs text-gray-500 border-t border-gray-100 mt-4 pt-3">
                Pour plus de détails, consultez le tableau financier.
              </p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* 🚀 LIENS RAPIDES                                                  */}
        {/* ------------------------------------------------------------------ */}
        <section>
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">
            🚀 Accès rapides
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">

            {/* ADMIN */}
            {roleKey === 'admin' && (
              <>
                <QuickLink to="/services" label="Services clients" icon="🧾" />
                <QuickLink to="/admin/services" label="Gestion services" icon="🧩" />
                <QuickLink to="/admin/users" label="Utilisateurs" icon="👥" />
                <QuickLink to="/admin/agents" label="Agents" icon="🧑‍🔧" />
                <QuickLink to="/transactions" label="Transactions" icon="💰" />
                <QuickLink to="/finance" label="Finances" icon="📊" />
              </>
            )}

            {/* CLIENT */}
            {roleKey === 'client' && (
              <>
                <QuickLink to="/services" label="Mes services" icon="🧾" />
                <QuickLink to="/properties" label="Mes biens" icon="🏡" />
                <QuickLink to="/transactions" label="Mes transactions" icon="💰" />
                <QuickLink to="/finance" label="Mes finances" icon="📊" />
              </>
            )}

            {/* AGENT */}
            {roleKey === 'agent' && (
              <>
                <QuickLink to="/agent/services" label="Services assignés" icon="⚙️" />
                <QuickLink to="/transactions" label="Mes transactions" icon="💰" />
                <QuickLink to="/finance" label="Mes finances" icon="📊" />
              </>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}

/* ============================================================================
   COMPOSANTS RÉUTILISABLES PREMIUM
=========================================================================== */

function StatCard({ label, value, highlight = false, icon }) {
  return (
    <div
      className="
        relative overflow-hidden
        bg-gradient-to-br from-blue-50 via-white to-blue-50
        border border-blue-100 rounded-2xl
        px-4 py-4 sm:px-5 sm:py-5
        shadow-sm hover:shadow-md transition
      "
    >
      {icon && <div className="absolute -top-2 -right-2 text-3xl opacity-20">{icon}</div>}
      <div className="text-xs font-medium text-gray-500 mb-1">{label}</div>
      <div className={`text-lg sm:text-xl font-bold ${highlight ? 'text-emerald-700' : 'text-blue-800'}`}>
        {value}
      </div>
    </div>
  );
}

function QuickLink({ to, label, icon }) {
  return (
    <Link
      to={to}
      className="
        group flex items-center justify-between
        px-4 py-3 rounded-xl
        bg-slate-900 text-white shadow-sm
        hover:shadow-md transition
      "
    >
      <div className="flex items-center gap-3">
        <div
          className="
            flex items-center justify-center h-9 w-9 rounded-full
            bg-slate-800 group-hover:bg-slate-700
            text-lg transition
          "
        >
          {icon}
        </div>
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <span className="text-xs opacity-70 group-hover:translate-x-0.5 transition-transform">
        ↗
      </span>
    </Link>
  );
}
