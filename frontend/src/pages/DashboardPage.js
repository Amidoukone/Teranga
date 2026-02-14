// frontend/src/pages/DashboardPage.jsx
// ============================================================================
// DashboardPage — Version Premium Évoluée 2025
// (Responsive + UI moderne + rôle normalisé + typographies optimisées)
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
import api from '../services/api';
import { getGeoParams } from '../services/geo';
import {
  isGlobalAdminUser,
  isMasterUser,
  normalizeRole,
} from '../utils/role';
import { useLocale } from '../i18n/useLocale';
import { useTranslation } from 'react-i18next';

/* ============================================================================
   🔧 UTILITAIRES
=========================================================================== */

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
  const { formatNumber } = useLocale();
  const { t } = useTranslation();
  const [user, setUser] = useState(null);

  const [stats, setStats] = useState({
    servicesCount: 0,
    activeServices: 0,
    transactionsCount: 0,
    totalRevenue: 0,
    totalExpense: 0,
    balance: 0,
  });

  // 🔎 Stats détaillées modules
  const [detailStats, setDetailStats] = useState({
    properties: {
      total: 0,
      active: 0,
    },
    tasks: {
      total: 0,
      created: 0,
      inProgress: 0,
      completed: 0,
      validated: 0,
    },
    projects: {
      total: 0,
      created: 0,
      inProgress: 0,
      completed: 0,
      validated: 0,
    },
    orders: {
      total: 0,
      open: 0,
      paid: 0,
    },
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

      // ========= 📦 NOUVELLES DONNÉES : BIENS / TÂCHES / PROJETS / COMMANDES =========
      const geoParams = getGeoParams();
      const [propsRes, tasksRes, projectsRes, ordersRes] = await Promise.all([
        api
          .get('/properties', { params: geoParams })
          .catch((err) => {
            console.error('⚠️ Erreur chargement biens Dashboard:', err);
            return { data: {} };
          }),
        api
          .get('/tasks', { params: geoParams })
          .catch((err) => {
            console.error('⚠️ Erreur chargement tâches Dashboard:', err);
            return { data: {} };
          }),
        api
          .get('/projects', { params: geoParams })
          .catch((err) => {
            console.error('⚠️ Erreur chargement projets Dashboard:', err);
            return { data: {} };
          }),
        api
          .get('/orders', { params: geoParams })
          .catch((err) => {
            console.error('⚠️ Erreur chargement commandes Dashboard:', err);
            return { data: {} };
          }),
      ]);

      const properties = propsRes.data?.properties || [];
      const tasks = tasksRes.data?.tasks || [];
      const projects = projectsRes.data?.projects || [];
      const orders = ordersRes.data?.orders || ordersRes.data?.items || [];

      // ========= 🧮 Calculs existants =========
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

      // ========= 🧮 NOUVEAUX CALCULS DÉTAILLÉS =========

      // 🏡 Biens
      const propertiesTotal = properties.length;
      const propertiesActive = properties.filter(
        (p) => p.status === 'active'
      ).length;

      // ✅ Tâches
      const tasksTotal = tasks.length;
      const tasksCreated = tasks.filter((t) => t.status === 'created').length;
      const tasksInProgress = tasks.filter(
        (t) => t.status === 'in_progress'
      ).length;
      const tasksCompleted = tasks.filter(
        (t) => t.status === 'completed'
      ).length;
      const tasksValidated = tasks.filter(
        (t) => t.status === 'validated'
      ).length;

      // 📂 Projets
      const projectsTotal = projects.length;
      const projectsCreated = projects.filter(
        (p) => p.status === 'created'
      ).length;
      const projectsInProgress = projects.filter(
        (p) => p.status === 'in_progress'
      ).length;
      const projectsCompleted = projects.filter(
        (p) => p.status === 'completed'
      ).length;
      const projectsValidated = projects.filter(
        (p) => p.status === 'validated'
      ).length;

      // 🛒 Commandes
      const ordersTotal = orders.length;
      const ordersPaid = orders.filter(
        (o) => o.paymentStatus === 'paid'
      ).length;
      // "open" = non livrées / non annulées
      const ordersOpen = orders.filter(
        (o) =>
          !['delivered', 'cancelled', 'refunded'].includes(
            String(o.status || '').toLowerCase()
          )
      ).length;

      setDetailStats({
        properties: {
          total: propertiesTotal,
          active: propertiesActive,
        },
        tasks: {
          total: tasksTotal,
          created: tasksCreated,
          inProgress: tasksInProgress,
          completed: tasksCompleted,
          validated: tasksValidated,
        },
        projects: {
          total: projectsTotal,
          created: projectsCreated,
          inProgress: projectsInProgress,
          completed: projectsCompleted,
          validated: projectsValidated,
        },
        orders: {
          total: ordersTotal,
          open: ordersOpen,
          paid: ordersPaid,
        },
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
        <p className="text-gray-700 text-lg sm:text-xl font-medium animate-pulse text-center">
          {t("dashboard.loading")}
        </p>
      </div>
    );
  }

  const roleKey = normalizeRole(user.role);
  const isGlobalAdmin = isGlobalAdminUser(user);
  const isMaster = isMasterUser(user);
  const isPositiveBalance = stats.balance >= 0;
  const balanceLabel =
    roleKey === 'admin'
      ? isGlobalAdmin
        ? t("dashboard.balance.global")
        : t("dashboard.balance.scope")
      : t("dashboard.balance.global");
  const balanceDescription =
    roleKey === 'admin' && isMaster
      ? t("dashboard.balance.descScope")
      : t("dashboard.balance.descGlobal");

  const firstName = user.firstName || user.email || '';
  const shortName =
    (firstName.split(' ')[0] || '').trim() || t("dashboard.careFallbackName");
  const roleLabel =
    isMaster
      ? t("roles.master")
      : roleKey === 'admin'
      ? t("roles.admin")
      : roleKey === 'agent'
      ? t("roles.agent")
      : t("roles.client");

  /* ============================================================================
     🎨 UI PRINCIPALE — VERSION RÉORGANISÉE & PLUS LISIBLE / ÉLÉGANTE
  =========================================================================== */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-3 sm:px-4 lg:px-6 py-8 lg:py-10">
      <div className="max-w-6xl mx-auto bg-white/95 shadow-2xl rounded-3xl border border-gray-100 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-10">

        {/* ------------------------------------------------------------------ */}
        {/* 🧭 HEADER PREMIUM                                                  */}
        {/* ------------------------------------------------------------------ */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 md:gap-6 pb-5 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="relative flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white font-semibold text-xl shadow-md">
              {getInitials(user)}
              <span className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full h-3 w-3 border border-white shadow-sm" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-snug truncate">
                {t("dashboard.greeting", { name: user.firstName || user.email })} 👋
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">
                {t("dashboard.roleLabel")}{' '}
                <span className="font-semibold text-blue-700 uppercase ml-1">
                  {roleLabel}
                </span>
              </p>
              {/* ✅ Message EXACT, personnalisé par le prénom */}
              <p className="text-sm sm:text-base text-gray-800 mt-2">
                <span className="font-semibold text-blue-700">
                  {t("dashboard.careLine", { firstName: shortName })}
                </span>
              </p>
            </div>
          </div>

          {/* Badge rôle + solde global */}
          <div className="flex flex-col items-start md:items-end gap-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs sm:text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-100">
              {roleLabel}
            </span>

            <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 shadow-sm min-w-[200px]">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs sm:text-sm text-gray-600 font-medium">
                  {balanceLabel}
                </div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[0.7rem] sm:text-xs font-semibold ${
                    isPositiveBalance
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      : 'bg-red-50 text-red-600 border border-red-100'
                  }`}
                >
                  {isPositiveBalance
                    ? t("dashboard.balance.positive")
                    : t("dashboard.balance.negative")}
                </span>
              </div>
              <div
                className={`mt-1 text-xl sm:text-2xl font-bold tracking-tight ${
                  isPositiveBalance ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {formatNumber(stats.balance)} XOF
              </div>
              <p className="text-[0.75rem] sm:text-xs text-gray-500 mt-2 leading-snug">
                {balanceDescription}
              </p>
            </div>
          </div>
        </header>

        {/* ------------------------------------------------------------------ */}
        {/* 📊 VUE RAPIDE — STATISTIQUES GÉNÉRALES                             */}
        {/* ------------------------------------------------------------------ */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                {t("dashboard.quickView.title")}
              </h2>
              <p className="text-sm text-gray-600">
                {t("dashboard.quickView.subtitle")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label={t("dashboard.stats.totalServices")} value={stats.servicesCount} icon="📦" />
            <StatCard label={t("dashboard.stats.activeServices")} value={stats.activeServices} icon="⚡" />
            <StatCard label={t("dashboard.stats.transactions")} value={stats.transactionsCount} icon="💳" />
            <StatCard
              label={t("dashboard.stats.currentBalance")}
              value={`${formatNumber(stats.balance)} XOF`}
              highlight={isPositiveBalance}
              icon={isPositiveBalance ? '📈' : '📉'}
            />
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* 🧮 BLOC CENTRAL — FINANCES & VUE GLOBALE DES MODULES               */}
        {/* ------------------------------------------------------------------ */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-6 xl:items-start">
          {/* Colonne gauche : finances détaillées + modules */}
          <div className="xl:col-span-2 space-y-6">
            {/* 💰 Finances détaillées */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                    💰 {t("dashboard.finance.title")}
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">
                    {t("dashboard.finance.subtitle")}
                  </p>
                </div>
              </div>
              <FinanceWidget role={roleKey} />
            </div>

            {/* 📦 Vue globale des modules */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                    📦 {t("dashboard.modules.title")}
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">
                    {t("dashboard.modules.subtitle")}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* BIENS */}
                <ModuleCard
                  title={t("dashboard.modules.properties")}
                  icon="🏡"
                  main={t("dashboard.modules.counts.property", {
                    count: detailStats.properties.total,
                  })}
                  items={[
                    {
                      label: t("dashboard.modules.items.active"),
                      value: detailStats.properties.active,
                    },
                  ]}
                  link={
                    roleKey === 'client' || roleKey === 'admin'
                      ? '/properties'
                      : undefined
                  }
                />

                {/* TÂCHES */}
                <ModuleCard
                  title={t("dashboard.modules.tasks")}
                  icon="📝"
                  main={t("dashboard.modules.counts.task", {
                    count: detailStats.tasks.total,
                  })}
                  items={[
                    {
                      label: t("dashboard.modules.items.created"),
                      value: detailStats.tasks.created,
                    },
                    {
                      label: t("dashboard.modules.items.inProgress"),
                      value: detailStats.tasks.inProgress,
                    },
                    {
                      label: t("dashboard.modules.items.completed"),
                      value: detailStats.tasks.completed,
                    },
                    {
                      label: t("dashboard.modules.items.validated"),
                      value: detailStats.tasks.validated,
                    },
                  ]}
                  link="/tasks"
                />

                {/* PROJETS */}
                <ModuleCard
                  title={t("dashboard.modules.projects")}
                  icon="📂"
                  main={t("dashboard.modules.counts.project", {
                    count: detailStats.projects.total,
                  })}
                  items={[
                    {
                      label: t("dashboard.modules.items.created"),
                      value: detailStats.projects.created,
                    },
                    {
                      label: t("dashboard.modules.items.inProgress"),
                      value: detailStats.projects.inProgress,
                    },
                    {
                      label: t("dashboard.modules.items.completed"),
                      value: detailStats.projects.completed,
                    },
                    {
                      label: t("dashboard.modules.items.validated"),
                      value: detailStats.projects.validated,
                    },
                  ]}
                  link="/projects"
                />

                {/* COMMANDES */}
                <ModuleCard
                  title={t("dashboard.modules.orders")}
                  icon="🛒"
                  main={t("dashboard.modules.counts.order", {
                    count: detailStats.orders.total,
                  })}
                  items={[
                    {
                      label: t("dashboard.modules.items.open"),
                      value: detailStats.orders.open,
                    },
                    {
                      label: t("dashboard.modules.items.paid"),
                      value: detailStats.orders.paid,
                    },
                  ]}
                  link="/orders"
                />
              </div>
            </div>
          </div>

          {/* Colonne droite : synthèse et accès rapides */}
          <div className="space-y-6">
            {/* Synthèse rapide finances */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">
                  {t("dashboard.summary.title")}
                </h3>
                <ul className="space-y-2 text-sm sm:text-base text-gray-800">
                  <li className="flex justify-between">
                    <span>{t("dashboard.summary.revenue")}</span>
                    <span className="font-semibold text-emerald-600">
                      {formatNumber(stats.totalRevenue)} XOF
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>{t("dashboard.summary.expense")}</span>
                    <span className="font-semibold text-red-600">
                      {formatNumber(stats.totalExpense)} XOF
                    </span>
                  </li>
                  <li className="flex justify-between border-t border-dashed border-gray-200 pt-3 mt-2">
                    <span>{t("dashboard.summary.net")}</span>
                    <span
                      className={`font-bold ${
                        isPositiveBalance ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {formatNumber(stats.balance)} XOF
                    </span>
                  </li>
                </ul>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 border-t border-gray-100 mt-4 pt-3 leading-snug">
                {t("dashboard.summary.note")}
              </p>
            </div>

            {/* Accès rapides */}
            <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-md">
              <h3 className="text-base sm:text-lg font-semibold mb-2 flex items-center gap-2">
                🚀 {t("dashboard.quickAccess.title")}
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 mb-4 leading-relaxed">
                {t("dashboard.quickAccess.subtitle")}
              </p>

              <div className="grid grid-cols-1 gap-3">

                {/* ADMIN */}
                {roleKey === 'admin' && (
                  <>
                    <QuickLink
                      to="/services"
                      label={t("dashboard.quickAccess.admin.services")}
                      icon="🧾"
                    />
                    <QuickLink
                      to="/admin/services"
                      label={t("dashboard.quickAccess.admin.adminServices")}
                      icon="🧩"
                    />
                    <QuickLink
                      to="/admin/users"
                      label={t("dashboard.quickAccess.admin.users")}
                      icon="👥"
                    />
                    <QuickLink
                      to="/admin/agents"
                      label={t("dashboard.quickAccess.admin.agents")}
                      icon="🧑‍🔧"
                    />
                    <QuickLink
                      to="/properties"
                      label={t("dashboard.quickAccess.admin.properties")}
                      icon="🏡"
                    />
                    <QuickLink
                      to="/projects"
                      label={t("dashboard.quickAccess.admin.projects")}
                      icon="📂"
                    />
                    <QuickLink
                      to="/orders"
                      label={t("dashboard.quickAccess.admin.orders")}
                      icon="🛒"
                    />
                    <QuickLink
                      to="/transactions"
                      label={t("dashboard.quickAccess.admin.transactions")}
                      icon="💰"
                    />
                    <QuickLink
                      to="/finance"
                      label={t("dashboard.quickAccess.admin.finance")}
                      icon="📊"
                    />
                  </>
                )}

                {/* CLIENT */}
                {roleKey === 'client' && (
                  <>
                    <QuickLink
                      to="/services"
                      label={t("dashboard.quickAccess.client.services")}
                      icon="🧾"
                    />
                    <QuickLink
                      to="/properties"
                      label={t("dashboard.quickAccess.client.properties")}
                      icon="🏡"
                    />
                    <QuickLink
                      to="/projects"
                      label={t("dashboard.quickAccess.client.projects")}
                      icon="📂"
                    />
                    <QuickLink
                      to="/orders"
                      label={t("dashboard.quickAccess.client.orders")}
                      icon="🛒"
                    />
                    <QuickLink
                      to="/transactions"
                      label={t("dashboard.quickAccess.client.transactions")}
                      icon="💰"
                    />
                    <QuickLink
                      to="/finance"
                      label={t("dashboard.quickAccess.client.finance")}
                      icon="📊"
                    />
                  </>
                )}

                {/* AGENT */}
                {roleKey === 'agent' && (
                  <>
                    <QuickLink
                      to="/agent/services"
                      label={t("dashboard.quickAccess.agent.assignedServices")}
                      icon="⚙️"
                    />
                    <QuickLink
                      to="/tasks"
                      label={t("dashboard.quickAccess.agent.tasks")}
                      icon="📝"
                    />
                    <QuickLink
                      to="/transactions"
                      label={t("dashboard.quickAccess.agent.transactions")}
                      icon="💰"
                    />
                    <QuickLink
                      to="/finance"
                      label={t("dashboard.quickAccess.agent.finance")}
                      icon="📊"
                    />
                  </>
                )}
              </div>
            </div>
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
      {icon && (
        <div className="absolute -top-1 -right-1 text-3xl opacity-20">
          {icon}
        </div>
      )}
      <div className="text-xs sm:text-sm font-medium text-gray-500 mb-1">
        {label}
      </div>
      <div
        className={`text-lg sm:text-xl font-bold tracking-tight ${
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
        px-3 py-2.5 rounded-xl
        bg-slate-800/80 text-white shadow-sm
        hover:bg-slate-700 hover:shadow-md transition
      "
    >
      <div className="flex items-center gap-3">
        <div
          className="
            flex items-center justify-center h-9 w-9 rounded-full
            bg-slate-900/80 group-hover:bg-slate-900
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

function ModuleCard({ title, icon, main, items = [], link }) {
  const { t } = useTranslation();
  const cardContent = (
    <div
      className="
        h-full
        bg-white border border-gray-200 rounded-2xl
        px-4 py-4 sm:px-5 sm:py-5
        shadow-sm hover:shadow-md transition
        flex flex-col justify-between
      "
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-50 text-lg">
              {icon}
            </span>
            <h3 className="text-sm sm:text-base font-semibold text-gray-900">
              {title}
            </h3>
          </div>
        </div>
        <div className="text-lg sm:text-xl font-bold text-blue-700 mb-2">
          {main}
        </div>
        <ul className="space-y-1 text-xs sm:text-sm text-gray-700">
          {items.map((it, idx) => (
            <li key={idx} className="flex justify-between">
              <span>{it.label}</span>
              <span className="font-semibold text-gray-900">{it.value}</span>
            </li>
          ))}
        </ul>
      </div>
      {link && (
        <div className="mt-4 pt-2 border-t border-gray-100 text-right">
          <span className="inline-flex items-center text-xs text-blue-600 font-medium">
            {t("common.viewDetails")}
            <span className="ml-1">↗</span>
          </span>
        </div>
      )}
    </div>
  );

  return link ? <Link to={link}>{cardContent}</Link> : cardContent;
}

