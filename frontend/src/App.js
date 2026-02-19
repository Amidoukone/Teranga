// ============================================================================
// App.js — Teranga Platform (Version Premium PRO 2025)
// Navigation • Routage protégé • SEO dynamique • GA4 tracking
// ✅ MASTER support (admin + geo scope) sans régression
// ✅ 2026: AdminOnboardingPage (Pays → Régions → MASTER)
// ============================================================================

import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';

import NavBar from './components/NavBar';
import Analytics from './components/Analytics';
import AnalyticsConsentBanner from './components/AnalyticsConsentBanner';
import ErrorBoundary from './components/ErrorBoundary';
import SetSeo from './components/SetSeo'; // ✅ Source unique SEO
import ToastProvider from './components/ToastProvider';
import ConfirmProvider from './components/ConfirmProvider';
import { GeoProvider } from './contexts/GeoContext';
import { getAnalyticsConsent, loadAnalytics } from './utils/analytics';
import { installGlobalErrorHandlers } from './utils/errorReporter';

// 🌐 Pages publiques
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProductCatalogPage from './pages/ProductCatalogPage';
import ProductDetailPage from './pages/ProductDetailPage';

// 🧾 Pages légales
import LegalPage from './pages/LegalPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';

// 👥 Utilisateurs connectés
import DashboardPage from './pages/DashboardPage';
import PropertiesPage from './pages/PropertiesPage';
import ServicesPage from './pages/ServicesPage';
import ServiceTasksPage from './pages/ServiceTasksPage';
import TasksPage from './pages/TasksPage';
import TaskEvidencesPage from './pages/TaskEvidencesPage';
import TransactionsPage from './pages/TransactionsPage';
import FinanceDashboardPage from './pages/FinanceDashboardPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import NotificationsPage from './pages/NotificationsPage';
import ActivityCenterPage from './pages/ActivityCenterPage';

// 🧱 Projets
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';

// 👨‍💼 Agents
import AgentServicesPage from './pages/AgentServicesPage';

// 👑 Admin
import AdminAgentsPage from './pages/AdminAgentsPage';
import AdminServicesPage from './pages/AdminServicesPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminPropertiesPage from './pages/AdminPropertiesPage';
import AdminProjectsPage from './pages/AdminProjectsPage';
import AdminCategoriesPage from './pages/AdminCategoriesPage';
import AdminProductsPage from './pages/AdminProductsPage';
import AdminMetricsPage from './pages/AdminMetricsPage';

// ✅ NEW: Onboarding Pays → Régions → MASTER
import AdminOnboardingPage from './pages/AdminOnboardingPage';

// 🧾 Commerce
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import OrderTransactionsPage from './pages/OrderTransactionsPage';

// 🔐 Auth
import { getToken, getLocalUser, me } from './services/auth';
import { normalizeRole } from './utils/role'; // ✅ ensure roles are canonical (admin/agent/client)

const AUTH_STORAGE_MODE = (process.env.REACT_APP_AUTH_STORAGE || 'localstorage')
  .toLowerCase()
  .trim();
const USES_COOKIE_AUTH = AUTH_STORAGE_MODE === 'cookie';

// ============================================================================
// 🧭 Scroll automatique
// ============================================================================
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  return null;
}

// ============================================================================
// 🔐 Helpers Auth / Role (MASTER safe)
// - IMPORTANT: "master" n'est pas un rôle backend.
//   Un MASTER = admin + (countryId || regionId)
// - Donc côté routes : on garde allow=['admin'] pour les écrans admin.
// ============================================================================
function getSession() {
  const token = getToken();
  const user = getLocalUser();

  // Rétro-compat: certains fronts stockent user mais pas token (ou inverse)
  const hasSession = USES_COOKIE_AUTH ? Boolean(user) : Boolean(token);

  const role = normalizeRole(user?.role);
  const isAdmin = role === 'admin';
  const isAgent = role === 'agent';
  const isClient = role === 'client';

  const isMaster = Boolean(isAdmin && (user?.countryId || user?.regionId));

  return { token, user, hasSession, role, isAdmin, isAgent, isClient, isMaster };
}

// ============================================================================
// 🔐 Auth Guards
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
 * - compare avec role normalisé (admin/agent/client)
 * - IMPORTANT: un MASTER doit passer comme "admin"
 *   => allow=['admin'] reste correct
 */
function RequireRole({ allow = [], children }) {
  const location = useLocation();
  const { hasSession, role } = getSession();

  if (!hasSession) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Si allow vide => aucune restriction spécifique
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
// 🧩 App (Final)
// ============================================================================
export default function App() {
  const trackingId = 'G-5JVYGYHZ7Y';
  const { t } = useTranslation();
  const [analyticsConsent, setAnalyticsConsent] = useState(() =>
    getAnalyticsConsent()
  );

  useEffect(() => {
    if (analyticsConsent === 'granted') {
      loadAnalytics(trackingId);
    }
  }, [analyticsConsent, trackingId]);

  useEffect(() => {
    installGlobalErrorHandlers();
  }, []);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>
          <GeoProvider>
            <div className="min-h-screen flex flex-col bg-surface-main text-text-primary">
              <ScrollToTop />
              <NavBar />

          {/* 📈 Google Analytics v4 — tracking automatique */}
          <Analytics trackingId={trackingId} enabled={analyticsConsent === 'granted'} />
          <AnalyticsConsentBanner
            trackingId={trackingId}
            consent={analyticsConsent}
            onConsentChange={setAnalyticsConsent}
          />

          <main className="flex-1 w-full">
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
              <Routes>
            {/* ============================= */}
            {/* 🌐 PAGES PUBLIQUES           */}
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
            {/* 📄 PAGES LÉGALES             */}
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

            {/* ❗ PrivacyPage et TermsPage gèrent déjà SetSeo en interne → pas ici */}
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />

            {/* ============================= */}
            {/* 🔐 AUTH PUBLIQUE             */}
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
                        errorMsg:
                          "Mot de passe oublie ? Contactez l'admin ou le master de votre pays/region pour reinitialiser. Ensuite, vous pourrez le modifier dans votre compte.",
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
                        errorMsg:
                          "Mot de passe oublie ? Contactez l'admin ou le master de votre pays/region pour reinitialiser. Ensuite, vous pourrez le modifier dans votre compte.",
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
                        errorMsg:
                          "Mot de passe oublie ? Contactez l'admin ou le master de votre pays/region pour reinitialiser. Ensuite, vous pourrez le modifier dans votre compte.",
                      }}
                    />
                  </>
                </PublicOnly>
              }
            />

            {/* ============================= */}
            {/* 👥 UTILISATEURS CONNECTÉS    */}
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
            {/* 🧾 COMMERCE — COMMANDES      */}
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
            {/* ⚙️ AGENTS                   */}
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
            {/* 👑 ADMIN (inclut MASTER)     */}
            {/* ============================= */}

            {/* ✅ NEW: Onboarding Pays → Régions → MASTER */}
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
            {/* 🚧 ROUTE PAR DÉFAUT         */}
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
            </div>
          </main>

          {/* FOOTER */}
          <footer className="bg-gray-100 border-t border-gray-200 py-4 text-center text-sm text-gray-600">
            <Trans
              i18nKey="footer.copyright"
              values={{ year: new Date().getFullYear() }}
              components={{ brand: <span className="font-semibold text-blue-600" /> }}
            />
          </footer>
            </div>
          </GeoProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
