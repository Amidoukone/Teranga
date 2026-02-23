// frontend/src/pages/DashboardPage.jsx
// ============================================================================
// DashboardPage ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Version Premium ÃƒÆ’Ã¢â‚¬Â°voluÃƒÆ’Ã‚Â©e 2025
// (Responsive + UI moderne + rÃƒÆ’Ã‚Â´le normalisÃƒÆ’Ã‚Â© + typographies optimisÃƒÆ’Ã‚Â©es)
// ============================================================================

import { useEffect, useState } from 'react';
import {
  BarChart3,
  Building2,
  ClipboardList,
  FolderKanban,
  HandCoins,
  Landmark,
  Layers,
  ShieldPlus,
  Users,
  UserCog,
  Briefcase,
  Receipt,
  Rocket,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Wrench,
  Zap,
} from 'lucide-react';
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
   UTILITAIRES
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

  // Stats dÃƒÆ’Ã‚Â©taillÃƒÆ’Ã‚Â©es modules
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
  /* INITIALISATION                                                       */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    async function init() {
      try {
        const res = await me();
        const u = res.user;
        if (!u) {
          window.location.href = '/login';
          return;
        }
        setUser(u);
        await loadStats(u);
      } catch (err) {
        console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erreur Dashboard init:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  /* ---------------------------------------------------------------------- */
  /* CHARGEMENT DES STATISTIQUES                                          */
  /* ---------------------------------------------------------------------- */
  async function loadStats(u) {
    try {
      let services = [];
      let transactions = [];
      let financialSummary = null;

      const role = normalizeRole(u.role);
      const showPropertiesModule = role !== 'agent';

      // SERVICES selon rÃƒÆ’Ã‚Â´le
      if (role === 'admin') {
        services = await getAllServicesAdmin();
      } else if (role === 'agent') {
        services = await getAgentServices();
      } else {
        services = await getMyServices();
      }

      // TRANSACTIONS
      transactions = await getTransactions();

      // RÃƒÆ’Ã‚Â©sumÃƒÆ’Ã‚Â© financier (admin only)
      if (role === 'admin') {
        financialSummary = await getFinancialSummary();
      }

      // ========= NOUVELLES DONNÃƒÆ’Ã¢â‚¬Â°ES : BIENS / TÃƒÆ’Ã¢â‚¬Å¡CHES / PROJETS / COMMANDES =========
      const geoParams = getGeoParams();
      const [propsRes, tasksRes, projectsRes, ordersRes] = await Promise.all([
        showPropertiesModule
          ? api
              .get('/properties', { params: geoParams })
              .catch((err) => {
                console.error('ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Erreur chargement biens Dashboard:', err);
                return { data: {} };
              })
          : Promise.resolve({ data: { properties: [] } }),
        api
          .get('/tasks', { params: geoParams })
          .catch((err) => {
            console.error('ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Erreur chargement tÃƒÆ’Ã‚Â¢ches Dashboard:', err);
            return { data: {} };
          }),
        api
          .get('/projects', { params: geoParams })
          .catch((err) => {
            console.error('ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Erreur chargement projets Dashboard:', err);
            return { data: {} };
          }),
        api
          .get('/orders', { params: geoParams })
          .catch((err) => {
            console.error('ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Erreur chargement commandes Dashboard:', err);
            return { data: {} };
          }),
      ]);

      const properties = propsRes.data?.properties || [];
      const tasks = tasksRes.data?.tasks || [];
      const projects = projectsRes.data?.projects || [];
      const orders = ordersRes.data?.orders || ordersRes.data?.items || [];

      // ========= Calculs existants =========
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

      // ========= NOUVEAUX CALCULS DÃƒÆ’Ã¢â‚¬Â°TAILLÃƒÆ’Ã¢â‚¬Â°S =========

      // Biens
      const propertiesTotal = properties.length;
      const propertiesActive = properties.filter(
        (p) => p.status === 'active'
      ).length;

      // TÃƒÆ’Ã‚Â¢ches
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

      // Projets
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

      // Commandes
      const ordersTotal = orders.length;
      const ordersPaid = orders.filter(
        (o) => o.paymentStatus === 'paid'
      ).length;
      // "open" = non livrÃƒÆ’Ã‚Â©es / non annulÃƒÆ’Ã‚Â©es
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
      console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erreur chargement stats Dashboard:', err);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* ÃƒÆ’Ã¢â‚¬Â°TAT CHARGEMENT                                                       */
  /* ---------------------------------------------------------------------- */
  if (loading || !user) {
    return (
      <div className="app-page-wrap flex min-h-screen items-center justify-center px-4">
        <p className="text-lg font-medium animate-pulse text-center text-text-secondary sm:text-xl">
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
  /* ============================================================================
     UI PRINCIPALE ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â VERSION RÃƒÆ’Ã¢â‚¬Â°ORGANISÃƒÆ’Ã¢â‚¬Â°E & PLUS LISIBLE / ÃƒÆ’Ã¢â‚¬Â°LÃƒÆ’Ã¢â‚¬Â°GANTE
  =========================================================================== */
  return (
    <div className="app-page-wrap">
      <div className="mx-auto max-w-7xl rounded-3xl border border-border/70 bg-surface-card/92 px-4 py-6 shadow-2xl shadow-slate-300/20 dark:shadow-black/30 sm:px-6 sm:py-8 lg:px-8 space-y-8">

        {/* ------------------------------------------------------------------ */}
        {/* HEADER PREMIUM                                                    */}
        {/* ------------------------------------------------------------------ */}
        <header className="flex flex-col gap-6 border-b border-border/70 pb-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white font-semibold text-xl shadow-md">
              {getInitials(user)}
              <span className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full h-3 w-3 border border-surface-card shadow-sm" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold leading-snug text-text-primary truncate sm:text-3xl">
                {t("dashboard.greeting", { name: user.firstName || user.email })}
              </h1>
              {/* ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Message EXACT, personnalisÃƒÆ’Ã‚Â© par le prÃƒÆ’Ã‚Â©nom */}
              <p className="mt-2 text-sm text-text-secondary sm:text-base">
                <span className="font-semibold text-blue-700 dark:text-blue-300">
                  {t("dashboard.careLine", { firstName: shortName })}
                </span>
              </p>
            </div>
          </div>

          {/* Solde global */}
          <div className="flex flex-col items-start md:items-end gap-3">
            <div className="w-full sm:min-w-[200px] rounded-2xl border border-border/80 bg-surface-card/80 px-4 py-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-medium text-text-secondary sm:text-sm">
                  {balanceLabel}
                </div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[0.75rem] sm:text-xs font-semibold ${
                    isPositiveBalance
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {isPositiveBalance
                    ? t("dashboard.balance.positive")
                    : t("dashboard.balance.negative")}
                </span>
              </div>
              <div
                className={`mt-1 text-xl sm:text-2xl font-bold tracking-tight ${
                  isPositiveBalance
                    ? 'text-emerald-600 dark:text-emerald-300'
                    : 'text-red-600 dark:text-rose-300'
                }`}
              >
                {formatNumber(stats.balance)} XOF
              </div>
              <p className="mt-2 text-[0.75rem] leading-snug text-text-muted sm:text-xs">
                {balanceDescription}
              </p>
            </div>
          </div>
        </header>

        {/* ------------------------------------------------------------------ */}
        {/* VUE RAPIDE ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â STATISTIQUES GÃƒÆ’Ã¢â‚¬Â°NÃƒÆ’Ã¢â‚¬Â°RALES                               */}
        {/* ------------------------------------------------------------------ */}
        <section className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-text-primary sm:text-xl">
                {t("dashboard.quickView.title")}
              </h2>
              <p className="text-sm text-text-secondary">
                {t("dashboard.quickView.subtitle")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard label={t("dashboard.stats.totalServices")} value={stats.servicesCount} icon={Wrench} />
            <StatCard label={t("dashboard.stats.activeServices")} value={stats.activeServices} icon={Zap} />
            <StatCard label={t("dashboard.stats.transactions")} value={stats.transactionsCount} icon={Receipt} />
            <StatCard
              label={t("dashboard.stats.currentBalance")}
              value={`${formatNumber(stats.balance)} XOF`}
              highlight={isPositiveBalance}
              icon={isPositiveBalance ? TrendingUp : TrendingDown}
            />
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* BLOC CENTRAL ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â FINANCES & VUE GLOBALE DES MODULES                 */}
        {/* ------------------------------------------------------------------ */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-6 xl:items-start">
          {/* Colonne gauche : finances dÃƒÆ’Ã‚Â©taillÃƒÆ’Ã‚Â©es + modules */}
          <div className="xl:col-span-2 space-y-6">
            {/* Finances dÃƒÆ’Ã‚Â©taillÃƒÆ’Ã‚Â©es */}
            <div className="rounded-2xl border border-border/70 bg-surface-card/90 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-text-primary sm:text-xl">
                    <Landmark size={18} className="text-text-muted" />
                    {t("dashboard.finance.title")}
                  </h2>
                  <p className="mt-1 text-xs text-text-secondary sm:text-sm">
                    {t("dashboard.finance.subtitle")}
                  </p>
                </div>
              </div>
              <FinanceWidget role={roleKey} />
            </div>

            {/* Vue globale des modules */}
            <div className="rounded-2xl border border-border/70 bg-surface-card/90 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-text-primary sm:text-xl">
                    <Layers size={18} className="text-text-muted" />
                    {t("dashboard.modules.title")}
                  </h2>
                  <p className="mt-1 text-xs text-text-secondary sm:text-sm">
                    {t("dashboard.modules.subtitle")}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* BIENS */}
                {roleKey !== 'agent' && (
                  <ModuleCard
                    title={t("dashboard.modules.properties")}
                    icon={Building2}
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
                )}

                {/* TÃƒÆ’Ã¢â‚¬Å¡CHES */}
                <ModuleCard
                  title={t("dashboard.modules.tasks")}
                  icon={ClipboardList}
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
                  icon={FolderKanban}
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
                  icon={ShoppingBag}
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

          {/* Colonne droite : synthÃƒÆ’Ã‚Â¨se et accÃƒÆ’Ã‚Â¨s rapides */}
          <div className="space-y-6">
            {/* SynthÃƒÆ’Ã‚Â¨se rapide finances */}
            <div className="flex flex-col justify-between rounded-2xl border border-border/70 bg-surface-card/90 p-5 shadow-sm">
              <div>
                <h3 className="mb-4 text-lg font-semibold tracking-tight text-text-primary sm:text-xl">
                  {t("dashboard.summary.title")}
                </h3>
                <ul className="space-y-2 text-sm text-text-secondary sm:text-base">
                  <li className="flex justify-between">
                    <span>{t("dashboard.summary.revenue")}</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-300">
                      {formatNumber(stats.totalRevenue)} XOF
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>{t("dashboard.summary.expense")}</span>
                    <span className="font-semibold text-red-600 dark:text-rose-300">
                      {formatNumber(stats.totalExpense)} XOF
                    </span>
                  </li>
                  <li className="flex justify-between border-t border-dashed border-border pt-3 mt-2">
                    <span>{t("dashboard.summary.net")}</span>
                    <span
                      className={`font-bold ${
                        isPositiveBalance
                          ? 'text-emerald-600 dark:text-emerald-300'
                          : 'text-red-600 dark:text-rose-300'
                      }`}
                    >
                      {formatNumber(stats.balance)} XOF
                    </span>
                  </li>
                </ul>
              </div>
              <p className="mt-4 border-t border-border/60 pt-4 text-xs leading-snug text-text-muted sm:text-sm">
                {t("dashboard.summary.note")}
              </p>
            </div>

            {/* AccÃƒÆ’Ã‚Â¨s rapides */}
            <div className="rounded-2xl border border-border/70 bg-surface-card/90 p-5 text-text-primary shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold tracking-tight text-text-primary sm:text-xl">
                <Rocket size={18} className="text-text-muted" />
                {t("dashboard.quickAccess.title")}
              </h3>
              <p className="mb-4 text-xs leading-relaxed text-text-secondary sm:text-sm">
                {t("dashboard.quickAccess.subtitle")}
              </p>

              <div className="grid grid-cols-1 gap-3">

                {/* ADMIN */}
                {roleKey === 'admin' && (
                  <>
                    <QuickLink
                      to="/services"
                      label={t("dashboard.quickAccess.admin.services")}
                      icon={Wrench}
                    />
                    <QuickLink
                      to="/admin/services"
                      label={t("dashboard.quickAccess.admin.adminServices")}
                      icon={ShieldPlus}
                    />
                    <QuickLink
                      to="/admin/users"
                      label={t("dashboard.quickAccess.admin.users")}
                      icon={Users}
                    />
                    <QuickLink
                      to="/admin/agents"
                      label={t("dashboard.quickAccess.admin.agents")}
                      icon={UserCog}
                    />
                    <QuickLink
                      to="/properties"
                      label={t("dashboard.quickAccess.admin.properties")}
                      icon={Building2}
                    />
                    <QuickLink
                      to="/projects"
                      label={t("dashboard.quickAccess.admin.projects")}
                      icon={FolderKanban}
                    />
                    <QuickLink
                      to="/orders"
                      label={t("dashboard.quickAccess.admin.orders")}
                      icon={ShoppingBag}
                    />
                    <QuickLink
                      to="/transactions"
                      label={t("dashboard.quickAccess.admin.transactions")}
                      icon={HandCoins}
                    />
                    <QuickLink
                      to="/finance"
                      label={t("dashboard.quickAccess.admin.finance")}
                      icon={BarChart3}
                    />
                  </>
                )}

                {/* CLIENT */}
                {roleKey === 'client' && (
                  <>
                    <QuickLink
                      to="/services"
                      label={t("dashboard.quickAccess.client.services")}
                      icon={Wrench}
                    />
                    <QuickLink
                      to="/properties"
                      label={t("dashboard.quickAccess.client.properties")}
                      icon={Building2}
                    />
                    <QuickLink
                      to="/projects"
                      label={t("dashboard.quickAccess.client.projects")}
                      icon={FolderKanban}
                    />
                    <QuickLink
                      to="/orders"
                      label={t("dashboard.quickAccess.client.orders")}
                      icon={ShoppingBag}
                    />
                    <QuickLink
                      to="/transactions"
                      label={t("dashboard.quickAccess.client.transactions")}
                      icon={HandCoins}
                    />
                    <QuickLink
                      to="/finance"
                      label={t("dashboard.quickAccess.client.finance")}
                      icon={BarChart3}
                    />
                  </>
                )}

                {/* AGENT */}
                {roleKey === 'agent' && (
                  <>
                    <QuickLink
                      to="/agent/services"
                      label={t("dashboard.quickAccess.agent.assignedServices")}
                      icon={Briefcase}
                    />
                    <QuickLink
                      to="/tasks"
                      label={t("dashboard.quickAccess.agent.tasks")}
                      icon={ClipboardList}
                    />
                    <QuickLink
                      to="/transactions"
                      label={t("dashboard.quickAccess.agent.transactions")}
                      icon={HandCoins}
                    />
                    <QuickLink
                      to="/finance"
                      label={t("dashboard.quickAccess.agent.finance")}
                      icon={BarChart3}
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
   COMPOSANTS RÃƒÆ’Ã¢â‚¬Â°UTILISABLES PREMIUM
=========================================================================== */

function StatCard({ label, value, highlight = false, icon: Icon }) {
  return (
    <div
      className="
        group relative overflow-hidden
        rounded-2xl border border-border/70
        bg-surface-card/90 backdrop-blur
        px-4 py-4 sm:px-5 sm:py-5
        shadow-[0_12px_30px_-22px_rgba(15,23,42,0.45)]
        transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-24px_rgba(15,23,42,0.6)]
      "
    >
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-surface-card/30 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
      {Icon ? (
        <div className="absolute top-2 right-2 text-2xl opacity-20 pointer-events-none">
          <Icon size={20} className="text-text-muted" />
        </div>
      ) : null}
      <div className="relative mb-1 text-[0.75rem] font-semibold uppercase tracking-wide text-text-muted sm:text-xs">
        {label}
      </div>
      <div
        className={`relative text-lg sm:text-xl font-bold tracking-tight ${
          highlight ? 'text-emerald-700 dark:text-emerald-300' : 'text-text-primary'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function QuickLink({ to, label, icon: Icon }) {
  return (
    <Link
      to={to}
      className="
        group flex items-center justify-between
        px-3 py-2.5 rounded-xl
        border border-border/70
        bg-surface-card/85 text-text-primary
        shadow-[0_10px_25px_-22px_rgba(15,23,42,0.35)]
        hover:bg-surface-main hover:border-border dark:hover:border-blue-400/30 dark:hover:bg-blue-500/5
        transition-all duration-200 hover:-translate-y-0.5
      "
    >
      <div className="flex items-center gap-3">
        <div
          className="
            flex items-center justify-center h-9 w-9 rounded-full
            bg-surface-main/80 group-hover:bg-surface-main
            text-text-secondary text-lg transition
          "
        >
          {Icon ? <Icon size={18} className="text-text-secondary" /> : null}
        </div>
        <span className="text-sm font-semibold text-text-primary">{label}</span>
      </div>
      <span className="text-xs text-text-muted group-hover:translate-x-0.5 transition-transform">
        {">"}
      </span>
    </Link>
  );
}

function ModuleCard({ title, icon: Icon, main, items = [], link }) {
  const { t } = useTranslation();
  const cardContent = (
    <div
      className="
        h-full
        bg-surface-card/90 border border-border/70 rounded-2xl
        px-4 py-4 sm:px-5 sm:py-5
        shadow-[0_12px_30px_-22px_rgba(15,23,42,0.45)]
        hover:shadow-[0_20px_40px_-24px_rgba(15,23,42,0.6)]
        transition-all duration-200 hover:-translate-y-0.5
        flex flex-col justify-between
      "
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center h-9 w-9 rounded-full bg-surface-main/80 text-lg">
              {Icon ? <Icon size={18} className="text-text-secondary" /> : null}
            </span>
            <h3 className="text-sm sm:text-base font-semibold text-text-primary tracking-tight">
              {title}
            </h3>
          </div>
        </div>
        <div className="text-lg sm:text-xl font-bold text-text-primary mb-2">
          {main}
        </div>
        <ul className="space-y-1 text-xs sm:text-sm text-text-secondary">
          {items.map((it, idx) => (
            <li key={idx} className="flex justify-between">
              <span>{it.label}</span>
              <span className="font-semibold text-text-primary">{it.value}</span>
            </li>
          ))}
        </ul>
      </div>
      {link && (
        <div className="mt-4 pt-2 border-t border-border/60 text-right">
          <span className="inline-flex items-center text-xs text-text-secondary font-medium">
            {t("common.viewDetails")}
            <span className="ml-1">{">"}</span>
          </span>
        </div>
      )}
    </div>
  );

  return link ? <Link to={link}>{cardContent}</Link> : cardContent;
}




