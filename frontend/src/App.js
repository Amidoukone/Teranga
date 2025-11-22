// ============================================================================
// App.js — Teranga Platform (Version Premium PRO 2025)
// Navigation • Routage protégé • SEO dynamique • Responsive
// ============================================================================

import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

import NavBar from './components/NavBar';

// 🌐 Pages publiques
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProductCatalogPage from './pages/ProductCatalogPage';
import ProductDetailPage from './pages/ProductDetailPage';

// 👥 Pages utilisateurs connectés
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

// 🧾 Commerce — Commandes
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import OrderTransactionsPage from './pages/OrderTransactionsPage';

// 🔐 Auth
import { getToken, getLocalUser } from './services/auth';

// ============================================================================
// 🧭 Scroll automatique lors d’un changement de route
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
// 🧠 SEO Dynamique — Change automatiquement le titre de la page
// ============================================================================
function SetTitle({ title }) {
  useEffect(() => {
    document.title = title
      ? `${title} – Teranga`
      : 'Teranga – Diaspora & Services';
  }, [title]);

  return null;
}

// ============================================================================
// 🔐 Protection d’accès (auth obligatoire)
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

// ============================================================================
// 🛡️ Restriction selon rôle
// ============================================================================
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

// ============================================================================
// 🚪 Pages accessibles seulement si NON connecté
// ============================================================================
function PublicOnly({ children }) {
  const token = getToken();
  const user = getLocalUser();

  if (token || user) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

// ============================================================================
// 🧩 Application principale
// ============================================================================
export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-800">
      <ScrollToTop />
      <NavBar />

      <main className="flex-1 container mx-auto px-4 py-6">

        <Routes>
          {/* =============================
              🌐 PAGES PUBLIQUES
          ============================== */}
          <Route path="/" element={
            <>
              <SetTitle title="Accueil" />
              <HomePage />
            </>
          } />

          <Route path="/shop" element={
            <>
              <SetTitle title="Produits" />
              <ProductCatalogPage />
            </>
          } />

          <Route path="/products/:id" element={
            <>
              <SetTitle title="Détail produit" />
              <ProductDetailPage />
            </>
          } />

          <Route path="/login" element={
            <PublicOnly>
              <>
                <SetTitle title="Connexion" />
                <LoginPage />
              </>
            </PublicOnly>
          } />

          <Route path="/register" element={
            <PublicOnly>
              <>
                <SetTitle title="Inscription" />
                <RegisterPage />
              </>
            </PublicOnly>
          } />


          {/* =============================
              👥 UTILISATEURS CONNECTÉS
          ============================== */}
          <Route path="/dashboard" element={
            <RequireAuth>
              <>
                <SetTitle title="Tableau de bord" />
                <DashboardPage />
              </>
            </RequireAuth>
          } />

          <Route path="/properties" element={
            <RequireAuth>
              <>
                <SetTitle title="Mes biens" />
                <PropertiesPage />
              </>
            </RequireAuth>
          } />

          <Route path="/projects" element={
            <RequireAuth>
              <>
                <SetTitle title="Mes projets" />
                <ProjectsPage />
              </>
            </RequireAuth>
          } />

          <Route path="/projects/:id" element={
            <RequireAuth>
              <>
                <SetTitle title="Détail projet" />
                <ProjectDetailPage />
              </>
            </RequireAuth>
          } />

          <Route path="/services" element={
            <RequireAuth>
              <>
                <SetTitle title="Services" />
                <ServicesPage />
              </>
            </RequireAuth>
          } />

          <Route path="/services/:id/tasks" element={
            <RequireAuth>
              <>
                <SetTitle title="Tâches du service" />
                <ServiceTasksPage />
              </>
            </RequireAuth>
          } />

          <Route path="/tasks" element={
            <RequireAuth>
              <>
                <SetTitle title="Tâches" />
                <TasksPage />
              </>
            </RequireAuth>
          } />

          <Route path="/tasks/:id/evidences" element={
            <RequireAuth>
              <>
                <SetTitle title="Preuves" />
                <TaskEvidencesPage />
              </>
            </RequireAuth>
          } />

          <Route path="/transactions" element={
            <RequireAuth>
              <>
                <SetTitle title="Transactions" />
                <TransactionsPage />
              </>
            </RequireAuth>
          } />

          <Route path="/finance" element={
            <RequireAuth>
              <>
                <SetTitle title="Finances" />
                <FinanceDashboardPage />
              </>
            </RequireAuth>
          } />


          {/* =============================
              🧾 COMMERCE — COMMANDES
          ============================== */}
          <Route path="/orders" element={
            <RequireAuth>
              <>
                <SetTitle title="Commandes" />
                <OrdersPage />
              </>
            </RequireAuth>
          } />

          <Route path="/orders/:id" element={
            <RequireAuth>
              <>
                <SetTitle title="Détail commande" />
                <OrderDetailPage />
              </>
            </RequireAuth>
          } />

          <Route path="/orders/:id/transactions" element={
            <RequireAuth>
              <>
                <SetTitle title="Transactions commande" />
                <OrderTransactionsPage />
              </>
            </RequireAuth>
          } />


          {/* =============================
              ⚙️ AGENTS
          ============================== */}
          <Route path="/agent/services" element={
            <RequireAuth>
              <RequireRole allow={['agent', 'admin']}>
                <>
                  <SetTitle title="Services assignés" />
                  <AgentServicesPage />
                </>
              </RequireRole>
            </RequireAuth>
          } />


          {/* =============================
              👑 ADMIN
          ============================== */}
          <Route path="/admin/projects" element={
            <RequireAuth>
              <RequireRole allow={['admin']}>
                <>
                  <SetTitle title="Gestion des projets" />
                  <AdminProjectsPage />
                </>
              </RequireRole>
            </RequireAuth>
          } />

          <Route path="/admin/agents" element={
            <RequireAuth>
              <RequireRole allow={['admin']}>
                <>
                  <SetTitle title="Agents" />
                  <AdminAgentsPage />
                </>
              </RequireRole>
            </RequireAuth>
          } />

          <Route path="/admin/services" element={
            <RequireAuth>
              <RequireRole allow={['admin']}>
                <>
                  <SetTitle title="Gestion des services" />
                  <AdminServicesPage />
                </>
              </RequireRole>
            </RequireAuth>
          } />

          <Route path="/admin/users" element={
            <RequireAuth>
              <RequireRole allow={['admin']}>
                <>
                  <SetTitle title="Utilisateurs" />
                  <AdminUsersPage />
                </>
              </RequireRole>
            </RequireAuth>
          } />

          <Route path="/admin/properties" element={
            <RequireAuth>
              <RequireRole allow={['admin']}>
                <>
                  <SetTitle title="Biens clients" />
                  <AdminPropertiesPage />
                </>
              </RequireRole>
            </RequireAuth>
          } />

          <Route path="/admin/catalog/categories" element={
            <RequireAuth>
              <RequireRole allow={['admin']}>
                <>
                  <SetTitle title="Catégories" />
                  <AdminCategoriesPage />
                </>
              </RequireRole>
            </RequireAuth>
          } />

          <Route path="/admin/catalog/products" element={
            <RequireAuth>
              <RequireRole allow={['admin']}>
                <>
                  <SetTitle title="Produits (admin)" />
                  <AdminProductsPage />
                </>
              </RequireRole>
            </RequireAuth>
          } />

          {/* =============================
              🚧 ROUTE PAR DÉFAUT
          ============================== */}
          <Route path="*" element={
            <>
              <SetTitle title="Accueil" />
              <HomePage />
            </>
          } />

        </Routes>
      </main>

      {/* FOOTER */}
      <footer className="bg-gray-100 border-t border-gray-200 py-4 text-center text-sm text-gray-600">
        © {new Date().getFullYear()} <span className="font-semibold text-blue-600">Teranga</span> — Tous droits réservés.
      </footer>
    </div>
  );
}
