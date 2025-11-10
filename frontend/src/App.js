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

// 🧱 Module Projets
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';

// 👨‍💼 Agents
import AgentServicesPage from './pages/AgentServicesPage';

// 👑 Admins
import AdminAgentsPage from './pages/AdminAgentsPage';
import AdminServicesPage from './pages/AdminServicesPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminPropertiesPage from './pages/AdminPropertiesPage';
import AdminProjectsPage from './pages/AdminProjectsPage';
import AdminCategoriesPage from './pages/AdminCategoriesPage';
import AdminProductsPage from './pages/AdminProductsPage';

// 🧾 Commerce (Commandes)
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import OrderTransactionsPage from './pages/OrderTransactionsPage';

// Auth helpers
import { getToken, getLocalUser } from './services/auth';

/* ============================================================
   🧭 Scroll automatique haut de page
============================================================ */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    } catch {
      window.scrollTo(0, 0);
    }
  }, [pathname]);
  return null;
}

/* ============================================================
   🔐 Garde d’authentification
============================================================ */
function RequireAuth({ children }) {
  const location = useLocation();
  const token = getToken();
  const cachedUser = getLocalUser();

  if (!token && !cachedUser) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

/* ============================================================
   🛡️ Garde de rôle (admin / agent / client)
============================================================ */
function RequireRole({ allow = [], children }) {
  const location = useLocation();
  const user = getLocalUser();

  if (!user) {
    const token = getToken();
    if (!token) {
      return <Navigate to="/login" replace state={{ from: location }} />;
    }
    return children;
  }

  if (allow.length === 0 || allow.includes(user.role)) {
    return children;
  }
  return <Navigate to="/dashboard" replace />;
}

/* ============================================================
   🚪 Routes publiques seulement si non connecté
============================================================ */
function PublicOnly({ children }) {
  const token = getToken();
  const cachedUser = getLocalUser();
  if (token || cachedUser) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

/* ============================================================
   🧩 Application principale
============================================================ */
export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-800">
      <ScrollToTop />
      <NavBar />

      <main className="flex-1 container mx-auto px-4 py-6">
        <Routes>
          {/* --- 🌐 PAGES PUBLIQUES --- */}
          <Route path="/" element={<HomePage />} />
          <Route path="/shop" element={<ProductCatalogPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route
            path="/login"
            element={
              <PublicOnly>
                <LoginPage />
              </PublicOnly>
            }
          />
          <Route
            path="/register"
            element={
              <PublicOnly>
                <RegisterPage />
              </PublicOnly>
            }
          />

          {/* --- 👥 UTILISATEURS CONNECTÉS --- */}
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/properties"
            element={
              <RequireAuth>
                <PropertiesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/projects"
            element={
              <RequireAuth>
                <ProjectsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/projects/:id"
            element={
              <RequireAuth>
                <ProjectDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="/services"
            element={
              <RequireAuth>
                <ServicesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/services/:id/tasks"
            element={
              <RequireAuth>
                <ServiceTasksPage />
              </RequireAuth>
            }
          />
          <Route
            path="/tasks"
            element={
              <RequireAuth>
                <TasksPage />
              </RequireAuth>
            }
          />
          <Route
            path="/tasks/:id/evidences"
            element={
              <RequireAuth>
                <TaskEvidencesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/transactions"
            element={
              <RequireAuth>
                <TransactionsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/finance"
            element={
              <RequireAuth>
                <FinanceDashboardPage />
              </RequireAuth>
            }
          />

          {/* --- 🧾 COMMERCE : COMMANDES --- */}
          <Route
            path="/orders"
            element={
              <RequireAuth>
                <OrdersPage />
              </RequireAuth>
            }
          />
          <Route
            path="/orders/:id"
            element={
              <RequireAuth>
                <OrderDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="/orders/:id/transactions"
            element={
              <RequireAuth>
                <OrderTransactionsPage />
              </RequireAuth>
            }
          />

          {/* --- ⚙️ AGENTS --- */}
          <Route
            path="/agent/services"
            element={
              <RequireAuth>
                <RequireRole allow={['agent', 'admin']}>
                  <AgentServicesPage />
                </RequireRole>
              </RequireAuth>
            }
          />

          {/* --- 👑 ADMIN --- */}
          <Route
            path="/admin/projects"
            element={
              <RequireAuth>
                <RequireRole allow={['admin']}>
                  <AdminProjectsPage />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/agents"
            element={
              <RequireAuth>
                <RequireRole allow={['admin']}>
                  <AdminAgentsPage />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/services"
            element={
              <RequireAuth>
                <RequireRole allow={['admin']}>
                  <AdminServicesPage />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/users"
            element={
              <RequireAuth>
                <RequireRole allow={['admin']}>
                  <AdminUsersPage />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/properties"
            element={
              <RequireAuth>
                <RequireRole allow={['admin']}>
                  <AdminPropertiesPage />
                </RequireRole>
              </RequireAuth>
            }
          />

          {/* --- 🏷️ ADMIN CATALOGUE --- */}
          <Route
            path="/admin/catalog/categories"
            element={
              <RequireAuth>
                <RequireRole allow={['admin']}>
                  <AdminCategoriesPage />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/catalog/products"
            element={
              <RequireAuth>
                <RequireRole allow={['admin']}>
                  <AdminProductsPage />
                </RequireRole>
              </RequireAuth>
            }
          />

          {/* --- 🚧 ROUTE PAR DÉFAUT --- */}
          <Route path="*" element={<HomePage />} />
        </Routes>
      </main>

      {/* ✅ Pied de page */}
      <footer className="bg-gray-100 border-t border-gray-200 py-4 text-center text-sm text-gray-600">
        © {new Date().getFullYear()}{' '}
        <span className="font-semibold text-blue-600">Teranga</span> — Tous droits réservés.
      </footer>
    </div>
  );
}
