// frontend/src/pages/DashboardPage.jsx
// ============================================================================
// DashboardPage — Version Premium Évoluée (Responsive + UI moderne)
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

// Petite fonction utilitaire pour formater les montants
function formatAmount(value) {
  return Number(value || 0).toLocaleString('fr-FR');
}

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

  useEffect(() => {
    async function init() {
      try {
        const { user } = await me();
        setUser(user);
        await loadStats(user);
      } catch (err) {
        console.error('❌ Erreur Dashboard init:', err);
        // on ne redirige pas ici pour ne pas casser la logique globale,
        // c'est géré ailleurs dans l'app.
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function loadStats(u) {
    try {
      let services = [];
      let transactions = [];
      let financialSummary = null;

      // 🔹 SERVICES selon rôle
      if (u.role === 'admin') {
        const adminServices = await getAllServicesAdmin();
        services = adminServices || [];
      } else if (u.role === 'agent') {
        const agentServices = await getAgentServices();
        services = agentServices || [];
      } else {
        const clientServices = await getMyServices();
        services = clientServices || [];
      }

      // 🔹 TRANSACTIONS (ACL côté backend)
      transactions = await getTransactions();

      // 🔹 Résumé financier (admin uniquement si dispo)
      if (u.role === 'admin') {
        financialSummary = await getFinancialSummary();
      }

      // 🔹 Calculs statistiques
      const activeServices = services.filter(
        (s) => s.status !== 'completed' && s.status !== 'validated'
      ).length;

      const totalRevenue =
        financialSummary?.revenues ??
        transactions
          .filter((t) => t.type === 'revenue')
          .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      const totalExpense =
        financialSummary?.expenses ??
        transactions
          .filter((t) =>
            ['expense', 'commission', 'adjustment'].includes(t.type)
          )
          .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      const balance =
        financialSummary?.balance !== undefined
          ? financialSummary.balance
          : totalRevenue - totalExpense;

      setStats({
        servicesCount: services.length,
        activeServices,
        transactionsCount: transactions.length,
        totalRevenue,
        totalExpense,
        balance,
      });
    } catch (e) {
      console.error('❌ Erreur chargement statistiques Dashboard:', e);
    }
  }

  // Écrans de chargement / fallback
  if (loading || !user) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4">
        <p className="text-gray-600 text-lg animate-pulse text-center">
          Chargement du tableau de bord…
        </p>
      </div>
    );
  }

  const isPositiveBalance = stats.balance >= 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-3 sm:px-4 lg:px-6 py-8 lg:py-10">
      <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-2xl border border-gray-100 px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

        {/* =================================================================== */}
        {/* 🧭 En-tête Premium                                                  */}
        {/* =================================================================== */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6 mb-8">
          <div className="flex items-center gap-3">
            {/* Avatar simple basé sur les initiales */}
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-600 text-white font-semibold text-lg shadow-sm">
              {getInitials(user)}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 truncate">
                Bonjour, {user.firstName || user.email} 👋
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Bienvenue sur votre tableau de bord&nbsp;
                <span className="font-semibold text-blue-600 uppercase tracking-wide">
                  {user.role}
                </span>
              </p>
            </div>
          </div>

          {/* Badge rôle + mini résumé solde */}
          <div className="flex flex-col items-start md:items-end gap-2">
            <span
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold
                         bg-blue-50 text-blue-700 border border-blue-100"
            >
              Rôle : {user.role.toUpperCase()}
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

        {/* =================================================================== */}
        {/* 📊 Statistiques dynamiques                                         */}
        {/* =================================================================== */}
        <section className="mb-10">
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Services totaux"
              value={formatAmount(stats.servicesCount)}
              icon="📦"
            />
            <StatCard
              label="Services actifs"
              value={formatAmount(stats.activeServices)}
              icon="✅"
            />
            <StatCard
              label="Transactions"
              value={formatAmount(stats.transactionsCount)}
              icon="💳"
            />
            <StatCard
              label="Solde actuel"
              value={`${formatAmount(stats.balance)} XOF`}
              highlight={isPositiveBalance}
              icon={isPositiveBalance ? '📈' : '📉'}
            />
          </div>
        </section>

        {/* =================================================================== */}
        {/* 💰 Bloc Financier (FinanceWidget)                                  */}
        {/* =================================================================== */}
        <section className="mb-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {/* Widget principal sur 2/3 sur desktop */}
            <div className="lg:col-span-2">
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 sm:p-5 lg:p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900 flex items-center gap-2">
                    💰 Vue détaillée des finances
                  </h2>
                  <span className="hidden sm:inline-flex px-2.5 py-1 text-xs rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                    Mis à jour en temps réel
                  </span>
                </div>

                <FinanceWidget role={user.role} />
              </div>
            </div>

            {/* Résumé compact à droite sur desktop */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">
                  Synthèse rapide
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Un aperçu condensé de votre activité financière&nbsp;:
                </p>

                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-center justify-between">
                    <span>Revenus totaux</span>
                    <span className="font-semibold text-emerald-600">
                      {formatAmount(stats.totalRevenue)} XOF
                    </span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Dépenses + frais</span>
                    <span className="font-semibold text-red-600">
                      {formatAmount(stats.totalExpense)} XOF
                    </span>
                  </li>
                  <li className="flex items-center justify-between border-t border-dashed border-gray-200 pt-2 mt-2">
                    <span>Solde net</span>
                    <span
                      className={`font-bold ${
                        isPositiveBalance
                          ? 'text-emerald-600'
                          : 'text-red-600'
                      }`}
                    >
                      {formatAmount(stats.balance)} XOF
                    </span>
                  </li>
                </ul>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
                Pour plus de détails, consultez le{' '}
                <span className="font-semibold text-blue-600">
                  Tableau de bord financier
                </span>{' '}
                dans vos liens rapides.
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* 🔗 Liens rapides selon rôle                                        */}
        {/* =================================================================== */}
        <section>
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">
            🚀 Accès rapides
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {user.role === 'admin' && (
              <>
                <QuickLink
                  to="/services"
                  label="Mes services (clients)"
                  icon="🧾"
                />
                <QuickLink
                  to="/admin/services"
                  label="Gestion des services"
                  icon="🧩"
                />
                <QuickLink
                  to="/admin/users"
                  label="Utilisateurs"
                  icon="👥"
                />
                <QuickLink
                  to="/admin/agents"
                  label="Agents"
                  icon="🧑‍🔧"
                />
                <QuickLink
                  to="/transactions"
                  label="Transactions"
                  icon="💰"
                />
                <QuickLink
                  to="/finance"
                  label="Tableau financier"
                  icon="📊"
                />
              </>
            )}

            {user.role === 'client' && (
              <>
                <QuickLink
                  to="/services"
                  label="Mes services"
                  icon="🧾"
                />
                <QuickLink
                  to="/properties"
                  label="Mes biens"
                  icon="🏡"
                />
                <QuickLink
                  to="/transactions"
                  label="Mes transactions"
                  icon="💰"
                />
                <QuickLink
                  to="/finance"
                  label="Mes finances"
                  icon="📊"
                />
              </>
            )}

            {user.role === 'agent' && (
              <>
                <QuickLink
                  to="/agent/services"
                  label="Services assignés"
                  icon="⚙️"
                />
                <QuickLink
                  to="/transactions"
                  label="Mes transactions"
                  icon="💰"
                />
                <QuickLink
                  to="/finance"
                  label="Mes finances"
                  icon="📊"
                />
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ============================================================================ */
/* ✅ Composants réutilisables Premium                                         */
/* ============================================================================ */

function StatCard({ label, value, highlight = false, icon }) {
  return (
    <div
      className="
        relative overflow-hidden
        bg-gradient-to-br from-blue-50 via-white to-blue-50
        border border-blue-100 rounded-2xl
        px-4 py-4 sm:px-5 sm:py-5
        shadow-sm hover:shadow-md transition-shadow
      "
    >
      {/* Badge icône */}
      {icon && (
        <div className="absolute -top-2 -right-2 text-3xl opacity-20">
          {icon}
        </div>
      )}

      <div className="text-xs font-medium text-gray-500 mb-1">{label}</div>
      <div
        className={`text-lg sm:text-xl font-bold ${
          highlight ? 'text-emerald-700' : 'text-blue-800'
        }`}
      >
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
        rounded-xl px-4 py-3
        bg-slate-900 text-white
        shadow-sm hover:shadow-md
        transition
      "
    >
      <div className="flex items-center gap-3">
        <div
          className="
            flex items-center justify-center h-9 w-9 rounded-full
            bg-slate-800 group-hover:bg-slate-700
            text-lg
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

/** 🧩 Helper pour avatar : initiales à partir du user */
function getInitials(user) {
  if (!user) return '?';
  const first = user.firstName || '';
  const last = user.lastName || '';
  const email = user.email || '';

  const fromNames = (first[0] || '') + (last[0] || '');
  if (fromNames.trim()) return fromNames.toUpperCase();

  // fallback sur email
  const firstChar = email[0] || '?';
  return firstChar.toUpperCase();
}
