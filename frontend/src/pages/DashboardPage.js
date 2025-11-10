import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { me } from '../services/auth';
import { getMyServices, getAllServicesAdmin, getAgentServices } from '../services/services';
import { getTransactions, getFinancialSummary } from '../services/transactions';
import FinanceWidget from '../components/FinanceWidget';

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

      // 🔹 TRANSACTIONS
      transactions = await getTransactions();

      // 🔹 Résumé financier (admin uniquement)
      if (u.role === 'admin') {
        financialSummary = await getFinancialSummary();
      }

      // 🔹 Calculs statistiques
      const activeServices = services.filter(
        (s) => s.status !== 'completed' && s.status !== 'validated'
      ).length;

      const totalRevenue =
        financialSummary?.revenues ||
        transactions
          .filter((t) => t.type === 'revenue')
          .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      const totalExpense =
        financialSummary?.expenses ||
        transactions
          .filter((t) => ['expense', 'commission', 'adjustment'].includes(t.type))
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

  if (loading || !user) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <p className="text-gray-500 text-lg animate-pulse">
          Chargement du tableau de bord…
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-6 py-10">
      <div className="max-w-6xl mx-auto bg-white shadow-lg rounded-2xl p-8 border border-gray-100">
        {/* 🧑 En-tête */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Bonjour, {user.firstName || user.email} 👋
          </h1>
          <p className="text-gray-500 mt-2">
            Bienvenue sur votre tableau de bord{' '}
            <span className="font-semibold text-blue-600">
              {user.role.toUpperCase()}
            </span>
          </p>
        </div>

        {/* 📊 Statistiques dynamiques */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-10">
          <StatCard label="Services totaux" value={stats.servicesCount} />
          <StatCard label="Services actifs" value={stats.activeServices} />
          <StatCard label="Transactions" value={stats.transactionsCount} />
          <StatCard
            label="Solde actuel"
            value={`${stats.balance.toLocaleString()} XOF`}
            highlight={stats.balance >= 0}
          />
        </div>

        {/* 💰 Widget financier */}
        <FinanceWidget role={user.role} />

        {/* 🔗 Liens rapides selon rôle */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
              <QuickLink to="/admin/users" label="Utilisateurs" icon="👥" />
              <QuickLink to="/admin/agents" label="Agents" icon="🧑‍🔧" />
              <QuickLink to="/transactions" label="Transactions" icon="💰" />
              <QuickLink to="/finance" label="Tableau financier" icon="📊" />
            </>
          )}

          {user.role === 'client' && (
            <>
              <QuickLink to="/services" label="Mes services" icon="🧾" />
              <QuickLink to="/properties" label="Mes biens" icon="🏡" />
              <QuickLink to="/transactions" label="Mes transactions" icon="💰" />
              <QuickLink to="/finance" label="Mes finances" icon="📊" />
            </>
          )}

          {user.role === 'agent' && (
            <>
              <QuickLink
                to="/agent/services"
                label="Services assignés"
                icon="⚙️"
              />
              <QuickLink to="/transactions" label="Mes transactions" icon="💰" />
              <QuickLink to="/finance" label="Mes finances" icon="📊" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ✅ Composants réutilisables */
function StatCard({ label, value, highlight = false }) {
  return (
    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center shadow-sm">
      <div
        className={`text-2xl font-bold ${
          highlight ? 'text-green-700' : 'text-blue-700'
        }`}
      >
        {value}
      </div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );
}

function QuickLink({ to, label, icon }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg 
                 font-semibold hover:bg-blue-700 active:bg-blue-800 transition shadow-sm hover:shadow-md"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
