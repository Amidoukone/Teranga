// ============================================================================
// App.js — Teranga Platform (Version Premium PRO 2025)
// Navigation • Routage protégé • SEO dynamique • GA4 tracking
// ✅ MASTER support (admin + geo scope) sans régression
// ✅ 2026: AdminOnboardingPage (Pays → Régions → MASTER)
// ============================================================================

import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

import NavBar from './components/NavBar';
import Analytics from './components/Analytics';
import SetSeo from './components/SetSeo'; // ✅ Source unique SEO
import { GeoProvider } from './contexts/GeoContext';

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

// ✅ NEW: Onboarding Pays → Régions → MASTER
import AdminOnboardingPage from './pages/AdminOnboardingPage';

// 🧾 Commerce
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import OrderTransactionsPage from './pages/OrderTransactionsPage';

// 🔐 Auth
import { getToken, getLocalUser } from './services/auth';
import { normalizeRole } from './utils/role'; // ✅ ensure roles are canonical (admin/agent/client)

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
  const hasSession = Boolean(token || user);

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
  const { hasSession } = getSession();
  if (hasSession) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

// ============================================================================
// 🧩 App (Final)
// ============================================================================
export default function App() {
  return (
    <GeoProvider>
      <div className="min-h-screen flex flex-col bg-gray-50 text-gray-800">
        <ScrollToTop />
        <NavBar />

        {/* 📈 Google Analytics v4 — tracking automatique */}
        <Analytics trackingId="G-5JVYGYHZ7Y" />

        <main className="flex-1 container mx-auto px-4 py-6">
          <Routes>
            {/* ============================= */}
            {/* 🌐 PAGES PUBLIQUES           */}
            {/* ============================= */}
            <Route
              path="/"
              element={
                <>
                  <SetSeo
                    title="Teranga – Gestion de biens & services pour la diaspora"
                    description="Teranga est la plateforme moderne qui permet à la diaspora africaine de gérer biens, projets et services à distance, avec transparence et preuves à chaque étape."
                  />
                  <HomePage />
                </>
              }
            />

            <Route
              path="/shop"
              element={
                <>
                  <SetSeo title="Produits & Services" />
                  <ProductCatalogPage />
                </>
              }
            />

            <Route
              path="/products/:id"
              element={
                <>
                  <SetSeo title="Détail produit" />
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
                  <SetSeo title="Mentions légales" />
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
                    <SetSeo title="Connexion" />
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
                    <SetSeo title="Inscription" />
                    <RegisterPage />
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
                    <SetSeo title="Tableau de bord" />
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
                    <SetSeo title="Mes biens" />
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
                    <SetSeo title="Mes projets" />
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
                    <SetSeo title="Détail projet" />
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
                    <SetSeo title="Services" />
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
                    <SetSeo title="Tâches du service" />
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
                    <SetSeo title="Tâches" />
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
                    <SetSeo title="Preuves" />
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
                    <SetSeo title="Transactions" />
                    <TransactionsPage />
                  </>
                </RequireAuth>
              }
            />

            <Route
              path="/finance"
              element={
                <RequireAuth>
                  <>
                    <SetSeo title="Finances" />
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
                    <SetSeo title="Commandes" />
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
                    <SetSeo title="Détail commande" />
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
                    <SetSeo title="Transactions commande" />
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
                      <SetSeo title="Services assignés" />
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
                      <SetSeo title="Onboarding Pays & MASTER" />
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
                      <SetSeo title="Gestion des projets" />
                      <AdminProjectsPage />
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
                      <SetSeo title="Agents" />
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
                      <SetSeo title="Gestion des services" />
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
                      <SetSeo title="Utilisateurs" />
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
                      <SetSeo title="Biens clients" />
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
                      <SetSeo title="Catégories" />
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
                      <SetSeo title="Produits (admin)" />
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
                  <SetSeo title="Accueil" />
                  <HomePage />
                </>
              }
            />
          </Routes>
        </main>

        {/* FOOTER */}
        <footer className="bg-gray-100 border-t border-gray-200 py-4 text-center text-sm text-gray-600">
          © {new Date().getFullYear()}{' '}
          <span className="font-semibold text-blue-600">Teranga</span> — Tous
          droits réservés.
        </footer>
      </div>
    </GeoProvider>
  );
}
