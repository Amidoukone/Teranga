// ============================================================================
// App.js — Teranga Platform (Version Premium PRO 2025)
// Navigation • Routage protégé • SEO dynamique • GA4 tracking
// ============================================================================

import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

import NavBar from './components/NavBar';
import Analytics from './utils/analytics';

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

// 🧾 Commerce
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import OrderTransactionsPage from './pages/OrderTransactionsPage';

// 🔐 Auth
import { getToken, getLocalUser } from './services/auth';

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
// 🧠 SEO Dynamique — Titre + descriptions OG/Twitter
// ============================================================================
const DEFAULT_TITLE =
  'Teranga : La plateforme qui rapproche la diaspora de son pays. Gérez vos biens et services même quand vous êtes loin.';

const DEFAULT_DESCRIPTION =
  "Teranga — Plateforme moderne qui connecte la diaspora africaine à ses biens, projets et services au pays, avec transparence, preuves et agents certifiés.";

function setOrCreateMeta(selector, attr, value) {
  if (!value) return;

  let tag = document.querySelector(selector);

  if (!tag) {
    const match = selector.match(/meta\[(name|property)="([^"]+)"\]/);
    if (match) {
      const [, key, val] = match;
      tag = document.createElement('meta');
      tag.setAttribute(key, val);
      document.head.appendChild(tag);
    }
  }

  if (tag) tag.setAttribute(attr, value);
}

function SetSeo({ title, description }) {
  useEffect(() => {
    const finalTitle = title ? `${title} – Teranga` : DEFAULT_TITLE;
    const finalDescription = description || DEFAULT_DESCRIPTION;

    document.title = finalTitle;

    setOrCreateMeta('meta[name="description"]', 'content', finalDescription);
    setOrCreateMeta('meta[property="og:title"]', 'content', finalTitle);
    setOrCreateMeta('meta[property="og:description"]', 'content', finalDescription);
    setOrCreateMeta('meta[name="twitter:title"]', 'content', finalTitle);
    setOrCreateMeta('meta[name="twitter:description"]', 'content', finalDescription);
  }, [title, description]);

  return null;
}

// ============================================================================
// 🔐 Auth Guards
// ============================================================================
function RequireAuth({ children }) {
  const location = useLocation();
  const token = getToken();
  const user = getLocalUser();

  if (!token && !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

function RequireRole({ allow = [], children }) {
  const location = useLocation();
  const user = getLocalUser();
  const token = getToken();

  if (!user && !token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allow.length === 0 || allow.includes(user?.role)) {
    return children;
  }

  return <Navigate to="/dashboard" replace />;
}

function PublicOnly({ children }) {
  const token = getToken();
  const user = getLocalUser();

  if (token || user) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

// ============================================================================
// 🧩 App (Final)
// ============================================================================
export default function App() {
  return (
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
        title="La plateforme qui rapproche la diaspora de son pays. Gérez vos biens et services même quand vous êtes loin."
        description="Teranga est la plateforme moderne qui permet à la diaspora africaine de gérer ses biens, services et projets au pays, avec transparence totale, preuves à chaque étape et agents certifiés."
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

          <Route
            path="/privacy"
            element={
              <>
                <SetSeo title="Confidentialité" />
                <PrivacyPage />
              </>
            }
          />

          <Route
            path="/terms"
            element={
              <>
                <SetSeo title="Conditions d'utilisation" />
                <TermsPage />
              </>
            }
          />

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
          {/* 👑 ADMIN                   */}
          {/* ============================= */}
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
        <span className="font-semibold text-blue-600">Teranga</span> — Tous droits réservés.
      </footer>
    </div>
  );
}
