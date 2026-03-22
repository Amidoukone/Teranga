// ============================================================================
// App.js Teranga Platform (Version Premium PRO 2025)
// Contexte: routage et gardes d'acces.
// ============================================================================

import { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';

import NavBar from './components/NavBar';
import Analytics from './components/Analytics';
import AnalyticsConsentBanner from './components/AnalyticsConsentBanner';
import ErrorBoundary from './components/ErrorBoundary';
import SetSeo from './components/SetSeo'; // SEO centralise.
import ToastProvider from './components/ToastProvider';
import ConfirmProvider from './components/ConfirmProvider';
import { GeoProvider } from './contexts/GeoContext';
import { getAnalyticsConsent, loadAnalytics } from './utils/analytics';
import { installGlobalErrorHandlers } from './utils/errorReporter';
import { scheduleIdleRoutePreload } from './utils/routePreload';
import { getToken, getLocalUser, hasSessionHint, me } from './services/auth';
import { GEO_SELECTION_CHANGED_EVENT } from './services/geo';
import { normalizeRole } from './utils/role'; // ensure roles are canonical (admin/agent/client)

// Contexte: routage et guardes d'acces.
const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ProductCatalogPage = lazy(() => import('./pages/ProductCatalogPage'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'));

// Contexte: routage et guardes d'acces.
const LegalPage = lazy(() => import('./pages/LegalPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const HelpSupportPage = lazy(() => import('./pages/HelpSupportPage'));

// Contexte: routage et guardes d'acces.
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const PropertiesPage = lazy(() => import('./pages/PropertiesPage'));
const ServicesPage = lazy(() => import('./pages/ServicesPage'));
const ServiceTasksPage = lazy(() => import('./pages/ServiceTasksPage'));
const ServiceTransactionsPage = lazy(() => import('./pages/ServiceTransactionsPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const TaskEvidencesPage = lazy(() => import('./pages/TaskEvidencesPage'));
const TransactionsPage = lazy(() => import('./pages/TransactionsPage'));
const FinanceDashboardPage = lazy(() => import('./pages/FinanceDashboardPage'));
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const ActivityCenterPage = lazy(() => import('./pages/ActivityCenterPage'));

// Contexte: routage et guardes d'acces.
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage'));

// Contexte: routage et guardes d'acces.
const AgentServicesPage = lazy(() => import('./pages/AgentServicesPage'));

// Contexte: routage et guardes d'acces.
const AdminAgentsPage = lazy(() => import('./pages/AdminAgentsPage'));
const AdminServicesPage = lazy(() => import('./pages/AdminServicesPage'));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'));
const AdminPropertiesPage = lazy(() => import('./pages/AdminPropertiesPage'));
const AdminProjectsPage = lazy(() => import('./pages/AdminProjectsPage'));
const AdminCategoriesPage = lazy(() => import('./pages/AdminCategoriesPage'));
const AdminProductsPage = lazy(() => import('./pages/AdminProductsPage'));
const AdminMetricsPage = lazy(() => import('./pages/AdminMetricsPage'));

// Contexte: routage et guardes d'acces.
const AdminOnboardingPage = lazy(() => import('./pages/AdminOnboardingPage'));

// Contexte: routage et guardes d'acces.
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const OrderDetailPage = lazy(() => import('./pages/OrderDetailPage'));
const OrderTransactionsPage = lazy(() => import('./pages/OrderTransactionsPage'));

// Contexte: routage et guardes d'acces.

const AUTH_STORAGE_MODE = (process.env.REACT_APP_AUTH_STORAGE || 'localstorage')
  .toLowerCase()
  .trim();
const USES_COOKIE_AUTH = AUTH_STORAGE_MODE === 'cookie';

// ============================================================================
// Contexte: routage et guardes d'acces.
// ============================================================================
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    } catch {
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  return null;
}

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-text-secondary">
      Chargement...
    </div>
  );
}

function getLikelyNextPaths(pathname, hasSession, role) {
  const currentPath = String(pathname || '').trim() || '/';

  if (!hasSession) {
    if (currentPath === '/login') {
      return ['/dashboard', '/register'];
    }
    if (currentPath === '/register') {
      return ['/login', '/dashboard'];
    }
    if (
      currentPath === '/' ||
      currentPath === '/shop' ||
      currentPath === '/help-support' ||
      currentPath === '/legal' ||
      currentPath === '/privacy' ||
      currentPath === '/terms'
    ) {
      return ['/login', '/register'];
    }
    return ['/login'];
  }

  if (role === 'admin') {
    return [
      '/dashboard',
      '/services',
      '/notifications',
      '/settings',
      '/admin/services',
      '/admin/users',
      '/admin/properties',
    ];
  }

  if (role === 'agent') {
    return [
      '/agent/services',
      '/services',
      '/notifications',
      '/activities',
      '/settings',
    ];
  }

  return [
    '/dashboard',
    '/services',
    '/tasks',
    '/projects',
    '/orders',
    '/notifications',
    '/settings',
  ];
}

// ============================================================================
// Contexte: routage et guardes d'acces.
// Contexte: routage et guardes d'acces.
//   Un MASTER = admin + (countryId || regionId)
// Contexte: routage et guardes d'acces.
// ============================================================================
function getSession() {
  const token = getToken();
  const user = getLocalUser();

 // Contexte: routage et guardes d'acces.
  const hasSession = USES_COOKIE_AUTH
    ? Boolean(user) || hasSessionHint()
    : Boolean(token);

  const role = normalizeRole(user?.role);
  const isAdmin = role === 'admin';
  const isAgent = role === 'agent';
  const isClient = role === 'client';

  const isMaster = Boolean(isAdmin && (user?.countryId || user?.regionId));

  return { token, user, hasSession, role, isAdmin, isAgent, isClient, isMaster };
}

// ============================================================================
// Contexte: routage et guardes d'acces.
// ============================================================================
function RequireAuth({ children }) {
  const location = useLocation();
  const { hasSession } = getSession();

  if (!hasSession) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

/**
 * RequireRole:
 * Contexte: routage et guardes d'acces.
 * - IMPORTANT: un MASTER doit passer comme "admin"
 *   => allow=['admin'] reste correct
 */
function RequireRole({ allow = [], children }) {
  const location = useLocation();
  const { hasSession, role } = getSession();

  if (!hasSession) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

 // Contexte: routage et guardes d'acces.
  if (allow.length === 0) return children;

  const normalizedAllow = Array.isArray(allow)
    ? allow.map((r) => normalizeRole(r))
    : [];

  if (normalizedAllow.includes(role)) {
    return children;
  }

  return <Navigate to="/dashboard" replace />;
}

function PublicOnly({ children }) {
  const { token, user, hasSession } = getSession();
  const userKey = user?.id || user?.email || '';
  const sessionKey = USES_COOKIE_AUTH ? (userKey || 'cookie') : (token || '');
  const [checked, setChecked] = useState(() => !hasSession);
  const [allow, setAllow] = useState(() => !hasSession);

  useEffect(() => {
    let active = true;

    async function check() {
      if (!sessionKey) {
        if (active) {
          setAllow(true);
          setChecked(true);
        }
        return;
      }

      try {
        const res = await me();
        if (!active) return;
        const isAuthed = Boolean(res?.user) && !res?.offline;
        setAllow(!isAuthed);
      } catch {
        if (active) setAllow(true);
      } finally {
        if (active) setChecked(true);
      }
    }

    check();
    return () => {
      active = false;
    };
  }, [sessionKey]);

  if (!checked) return null;
  if (!allow) return <Navigate to="/dashboard" replace />;
  return children;
}

// ============================================================================
// Contexte: routage et guardes d'acces.
// ============================================================================
export default function App() {
  const trackingId = 'G-5JVYGYHZ7Y';
  const { t } = useTranslation();
  const location = useLocation();
  const [geoRefreshKey, setGeoRefreshKey] = useState(0);
  const [analyticsConsent, setAnalyticsConsent] = useState(() =>
    getAnalyticsConsent()
  );
  const { hasSession, role } = getSession();

  useEffect(() => {
    if (analyticsConsent === 'granted') {
      loadAnalytics(trackingId);
    }
  }, [analyticsConsent, trackingId]);

  useEffect(() => {
    installGlobalErrorHandlers();
  }, []);

  useEffect(() => {
    function onGeoChanged() {
      setGeoRefreshKey((k) => k + 1);
    }

    if (typeof window === 'undefined') return () => {};

    window.addEventListener(GEO_SELECTION_CHANGED_EVENT, onGeoChanged);
    return () => window.removeEventListener(GEO_SELECTION_CHANGED_EVENT, onGeoChanged);
  }, []);

  useEffect(() => {
    const candidatePaths = getLikelyNextPaths(location.pathname, hasSession, role)
      .filter((path) => path && path !== location.pathname);

    if (candidatePaths.length === 0) return undefined;

    return scheduleIdleRoutePreload(candidatePaths);
  }, [hasSession, role, location.pathname]);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>
          <GeoProvider>
            <div className="min-h-screen flex flex-col bg-surface-main text-text-primary">
              <ScrollToTop />
              <NavBar />

 {/* Contexte: routage et guardes d'acces. */}
          <Analytics trackingId={trackingId} enabled={analyticsConsent === 'granted'} />
          <AnalyticsConsentBanner
            trackingId={trackingId}
            consent={analyticsConsent}
            onConsentChange={setAnalyticsConsent}
          />

          <main className="flex-1 w-full">
            <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
              <Suspense fallback={<RouteLoadingFallback />}>
                <Routes key={`geo-${geoRefreshKey}`}>
            {/* ============================= */}
 {/* Contexte: routage et guardes d'acces. */}
            {/* ============================= */}
            <Route
              path="/"
              element={
                <>
                  <SetSeo
                    title={t('seo.pages.home.title')}
                    description={t('seo.pages.home.description')}
                  />
                  <HomePage />
                </>
              }
            />

            <Route
              path="/shop"
              element={
                <>
                  <SetSeo title={t('seo.pages.shop.title')} />
                  <ProductCatalogPage />
                </>
              }
            />

            <Route
              path="/products/:id"
              element={
                <>
                  <SetSeo title={t('seo.pages.productDetail.title')} />
                  <ProductDetailPage />
                </>
              }
            />

            {/* ============================= */}
 {/* Contexte: routage et guardes d'acces. */}
            {/* ============================= */}
            <Route
              path="/legal"
              element={
                <>
                  <SetSeo title={t('seo.pages.legal.title')} />
                  <LegalPage />
                </>
              }
            />

            {/* PrivacyPage et TermsPage gerent deja SetSeo en interne: pas ici */}
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route
              path="/help-support"
              element={<HelpSupportPage />}
            />

            {/* ============================= */}
            {/* AUTH PUBLIQUE */}
            {/* ============================= */}
            <Route
              path="/login"
              element={
                <PublicOnly>
                  <>
                    <SetSeo title={t('seo.pages.login.title')} />
                    <LoginPage />
                  </>
                </PublicOnly>
              }
            />

            <Route
              path="/register"
              element={
                <PublicOnly>
                  <>
                    <SetSeo title={t('seo.pages.register.title')} />
                    <RegisterPage />
                  </>
                </PublicOnly>
              }
            />

            <Route
              path="/forgot-password"
              element={
                <PublicOnly>
                  <>
                    <SetSeo title={t('seo.pages.forgotPassword.title')} />
                    <Navigate
                      to="/login"
                      replace
                      state={{
                        errorMsg: t("auth.login.forgotInfo", {
                          defaultValue:
                            "Mot de passe oubli\u00E9 ? Contactez l'admin ou le master de votre pays/r\u00E9gion pour le r\u00E9initialiser. Ensuite, vous pourrez le modifier dans votre compte.",
                        }),
                      }}
                    />
                  </>
                </PublicOnly>
              }
            />

            <Route
              path="/reset-password"
              element={
                <PublicOnly>
                  <>
                    <SetSeo title={t('seo.pages.resetPassword.title')} />
                    <Navigate
                      to="/login"
                      replace
                      state={{
                        errorMsg: t("auth.login.forgotInfo", {
                          defaultValue:
                            "Mot de passe oubli\u00E9 ? Contactez l'admin ou le master de votre pays/r\u00E9gion pour le r\u00E9initialiser. Ensuite, vous pourrez le modifier dans votre compte.",
                        }),
                      }}
                    />
                  </>
                </PublicOnly>
              }
            />

            <Route
              path="/reset-password/code"
              element={
                <PublicOnly>
                  <>
                    <SetSeo title={t('seo.pages.resetPassword.title')} />
                    <Navigate
                      to="/login"
                      replace
                      state={{
                        errorMsg: t("auth.login.forgotInfo", {
                          defaultValue:
                            "Mot de passe oubli\u00E9 ? Contactez l'admin ou le master de votre pays/r\u00E9gion pour le r\u00E9initialiser. Ensuite, vous pourrez le modifier dans votre compte.",
                        }),
                      }}
                    />
                  </>
                </PublicOnly>
              }
            />

            {/* ============================= */}
 {/* Contexte: routage et guardes d'acces. */}
            {/* ============================= */}
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <>
                    <SetSeo title={t('seo.pages.dashboard.title')} />
                    <DashboardPage />
                  </>
                </RequireAuth>
              }
            />

            <Route
              path="/properties"
              element={
                <RequireAuth>
                  <>
                    <SetSeo title={t('seo.pages.properties.title')} />
                    <PropertiesPage />
                  </>
                </RequireAuth>
              }
            />

            <Route
              path="/projects"
              element={
                <RequireAuth>
                  <>
                    <SetSeo title={t('seo.pages.projects.title')} />
                    <ProjectsPage />
                  </>
                </RequireAuth>
              }
            />

            <Route
              path="/projects/:id"
              element={
                <RequireAuth>
                  <>
                    <SetSeo title={t('seo.pages.projectDetail.title')} />
                    <ProjectDetailPage />
                  </>
                </RequireAuth>
              }
            />

            <Route
              path="/services"
              element={
                <RequireAuth>
                  <>
                    <SetSeo title={t('seo.pages.services.title')} />
                    <ServicesPage />
                  </>
                </RequireAuth>
              }
            />

            <Route
              path="/services/:id/tasks"
              element={
                <RequireAuth>
                  <>
                    <SetSeo title={t('seo.pages.serviceTasks.title')} />
                    <ServiceTasksPage />
                  </>
                </RequireAuth>
              }
            />

            <Route
              path="/services/:id/transactions"
              element={
                <RequireAuth>
                  <>
                    <SetSeo title={t('seo.pages.transactions.title')} />
                    <ServiceTransactionsPage />
                  </>
                </RequireAuth>
              }
            />

            <Route
              path="/tasks"
              element={
                <RequireAuth>
                  <>
                    <SetSeo title={t('seo.pages.tasks.title')} />
                    <TasksPage />
                  </>
                </RequireAuth>
              }
            />

            <Route
              path="/tasks/:id/evidences"
              element={
                <RequireAuth>
                  <>
                    <SetSeo title={t('seo.pages.taskEvidences.title')} />
                    <TaskEvidencesPage />
                  </>
                </RequireAuth>
              }
            />

            <Route
              path="/transactions"
              element={
                <RequireAuth>
                  <>
                    <SetSeo title={t('seo.pages.transactions.title')} />
                    <TransactionsPage />
                  </>
                </RequireAuth>
              }
            />

            <Route
              path="/account/security"
              element={
                <RequireAuth>
                  <>
                    <SetSeo title={t('seo.pages.accountSecurity.title')} />
                    <ChangePasswordPage />
                  </>
                </RequireAuth>
              }
            />

            <Route
              path="/notifications"
              element={
                <RequireAuth>
                  <>
                    <SetSeo title={t('seo.pages.notifications.title')} />
                    <NotificationsPage />
                  </>
                </RequireAuth>
              }
            />

            <Route
              path="/settings"
              element={
                <RequireAuth>
                  <>
                    <SetSeo title={t('seo.pages.settings.title')} />
                    <SettingsPage />
                  </>
                </RequireAuth>
              }
            />

            <Route
              path="/activities"
              element={
                <RequireAuth>
                  <>
                    <SetSeo title={t('seo.pages.activities.title')} />
                    <ActivityCenterPage />
                  </>
                </RequireAuth>
              }
            />

            <Route
              path="/finance"
              element={
                <RequireAuth>
                  <>
                    <SetSeo title={t('seo.pages.finance.title')} />
                    <FinanceDashboardPage />
                  </>
                </RequireAuth>
              }
            />

            {/* ============================= */}
 {/* Contexte: routage et guardes d'acces. */}
            {/* ============================= */}
            <Route
              path="/orders"
              element={
                <RequireAuth>
                  <>
                    <SetSeo title={t('seo.pages.orders.title')} />
                    <OrdersPage />
                  </>
                </RequireAuth>
              }
            />

            <Route
              path="/orders/:id"
              element={
                <RequireAuth>
                  <>
                    <SetSeo title={t('seo.pages.orderDetail.title')} />
                    <OrderDetailPage />
                  </>
                </RequireAuth>
              }
            />

            <Route
              path="/orders/:id/transactions"
              element={
                <RequireAuth>
                  <>
                    <SetSeo title={t('seo.pages.orderTransactions.title')} />
                    <OrderTransactionsPage />
                  </>
                </RequireAuth>
              }
            />

            {/* ============================= */}
 {/* Contexte: routage et guardes d'acces. */}
            {/* ============================= */}
            <Route
              path="/agent/services"
              element={
                <RequireAuth>
                  <RequireRole allow={['agent', 'admin']}>
                    <>
                      <SetSeo title={t('seo.pages.agentServices.title')} />
                      <AgentServicesPage />
                    </>
                  </RequireRole>
                </RequireAuth>
              }
            />

            {/* ============================= */}
 {/* Contexte: routage et guardes d'acces. */}
            {/* ============================= */}

 {/* Contexte: routage et guardes d'acces. */}
            <Route
              path="/admin/onboarding"
              element={
                <RequireAuth>
                  <RequireRole allow={['admin']}>
                    <>
                      <SetSeo title={t('seo.pages.adminOnboarding.title')} />
                      <AdminOnboardingPage />
                    </>
                  </RequireRole>
                </RequireAuth>
              }
            />

            <Route
              path="/admin/projects"
              element={
                <RequireAuth>
                  <RequireRole allow={['admin']}>
                    <>
                      <SetSeo title={t('seo.pages.adminProjects.title')} />
                      <AdminProjectsPage />
                    </>
                  </RequireRole>
                </RequireAuth>
              }
            />

            <Route
              path="/admin/metrics"
              element={
                <RequireAuth>
                  <RequireRole allow={['admin']}>
                    <>
                      <SetSeo title={t('seo.pages.adminMetrics.title')} />
                      <AdminMetricsPage />
                    </>
                  </RequireRole>
                </RequireAuth>
              }
            />

            <Route
              path="/admin/agents"
              element={
                <RequireAuth>
                  <RequireRole allow={['admin']}>
                    <>
                      <SetSeo title={t('seo.pages.adminAgents.title')} />
                      <AdminAgentsPage />
                    </>
                  </RequireRole>
                </RequireAuth>
              }
            />

            <Route
              path="/admin/services"
              element={
                <RequireAuth>
                  <RequireRole allow={['admin']}>
                    <>
                      <SetSeo title={t('seo.pages.adminServices.title')} />
                      <AdminServicesPage />
                    </>
                  </RequireRole>
                </RequireAuth>
              }
            />

            <Route
              path="/admin/users"
              element={
                <RequireAuth>
                  <RequireRole allow={['admin']}>
                    <>
                      <SetSeo title={t('seo.pages.adminUsers.title')} />
                      <AdminUsersPage />
                    </>
                  </RequireRole>
                </RequireAuth>
              }
            />

            <Route
              path="/admin/properties"
              element={
                <RequireAuth>
                  <RequireRole allow={['admin']}>
                    <>
                      <SetSeo title={t('seo.pages.adminProperties.title')} />
                      <AdminPropertiesPage />
                    </>
                  </RequireRole>
                </RequireAuth>
              }
            />

            <Route
              path="/admin/catalog/categories"
              element={
                <RequireAuth>
                  <RequireRole allow={['admin']}>
                    <>
                      <SetSeo title={t('seo.pages.adminCategories.title')} />
                      <AdminCategoriesPage />
                    </>
                  </RequireRole>
                </RequireAuth>
              }
            />

            <Route
              path="/admin/catalog/products"
              element={
                <RequireAuth>
                  <RequireRole allow={['admin']}>
                    <>
                      <SetSeo title={t('seo.pages.adminProducts.title')} />
                      <AdminProductsPage />
                    </>
                  </RequireRole>
                </RequireAuth>
              }
            />

            {/* ============================= */}
 {/* Contexte: routage et guardes d'acces. */}
            {/* ============================= */}
            <Route
              path="*"
              element={
                <>
                  <SetSeo title={t('seo.pages.fallback.title')} />
                  <HomePage />
                </>
              }
            />
                </Routes>
              </Suspense>
            </div>
          </main>

          {/* FOOTER */}
          <footer className="border-t border-border/80 bg-surface-card/70 py-4 text-center text-sm text-text-secondary backdrop-blur">
            <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-4">
              <div className="flex flex-wrap items-center justify-center gap-4 text-xs sm:text-sm">
                <Link to="/help-support" className="text-text-secondary hover:text-text-primary">
                  {t('footer.links.helpSupport')}
                </Link>
                <Link to="/privacy" className="text-text-secondary hover:text-text-primary">
                  {t('footer.links.privacy')}
                </Link>
                <Link to="/terms" className="text-text-secondary hover:text-text-primary">
                  {t('footer.links.terms')}
                </Link>
                <Link to="/legal" className="text-text-secondary hover:text-text-primary">
                  {t('footer.links.legal')}
                </Link>
              </div>
              <p className="max-w-full whitespace-nowrap text-xs sm:text-sm leading-none">
                <Trans
                  i18nKey="footer.copyright"
                  values={{ year: new Date().getFullYear() }}
                  components={{ brand: <span className="font-semibold text-primary" /> }}
                />
              </p>
            </div>
          </footer>
            </div>
          </GeoProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
