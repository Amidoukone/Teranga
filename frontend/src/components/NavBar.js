import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { me, logout } from '../services/auth';
import { Menu, X, LogOut, Home, ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ============================================================
 * 🧭 NavBar — version mise à jour complète
 * ============================================================
 * - Gère tous les rôles : admin, agent, client
 * - Intègre les nouvelles routes :
 *    • /shop → Catalogue produits
 *    • /orders → Commandes
 *    • /admin/catalog/categories
 *    • /admin/catalog/products
 * - Cohérente avec App.js et les pages commerce
 * ============================================================
 */

export default function NavBar() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const menuId = 'mobile-menu';

  /* ============================================================
     🔹 Chargement utilisateur
  ============================================================ */
  useEffect(() => {
    let active = true;
    async function fetchUser() {
      try {
        const res = await me();
        if (active) setUser(res.user || null);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchUser();
    return () => {
      active = false;
    };
  }, [location.pathname]);

  // Ferme le menu mobile à chaque changement de route
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  function handleLogout() {
    logout();
    setUser(null);
    setOpen(false);
    navigate('/login');
  }

  if (loading) return null;

  /* ============================================================
     🌍 Mode PUBLIC (non connecté)
  ============================================================ */
  const publicPaths = ['/', '/login', '/register', '/shop', '/products'];
  const isPublic = publicPaths.some(
    (p) => location.pathname === p || location.pathname.startsWith(p + '/')
  );

  if (!user && isPublic) {
    const isActive = (path) =>
      location.pathname === path || location.pathname.startsWith(path + '/');

    return (
      <nav className="bg-slate-900/90 backdrop-blur-md text-white px-6 py-4 shadow-md sticky top-0 z-50 flex justify-between items-center border-b border-slate-800">
        <Link
          to="/"
          className="flex items-center gap-2 font-bold text-lg text-cyan-400 hover:text-cyan-300 transition-all"
          aria-label="Accueil Teranga"
        >
          <Home size={22} className="text-cyan-400" />
          <span className="font-semibold">Teranga</span>
        </Link>

        <div className="flex items-center gap-5">
          <Link
            to="/shop"
            className={`flex items-center gap-1 text-sm hover:text-cyan-400 transition ${
              isActive('/shop') ? 'text-cyan-400' : ''
            }`}
          >
            <ShoppingBag size={16} /> Produits
          </Link>
          <Link
            to="/login"
            className={`hover:text-cyan-400 transition font-medium text-sm ${
              isActive('/login') ? 'text-cyan-400' : ''
            }`}
          >
            Connexion
          </Link>
          <Link
            to="/register"
            className="px-4 py-1.5 rounded-md bg-cyan-500 text-white font-semibold hover:bg-cyan-600 transition text-sm shadow-sm"
          >
            Inscription
          </Link>
        </div>
      </nav>
    );
  }

  /* ============================================================
     🔒 Liens selon le rôle utilisateur
  ============================================================ */
  const commerceLinksCommon = [
    { path: '/shop', label: '🛍️ Produits' },
    { path: '/orders', label: '🧾 Commandes' },
  ];

  const roleLinks = {
    client: [
      { path: '/dashboard', label: '📊 Tableau de bord' },
      { path: '/projects', label: '📁 Mes projets' },
      { path: '/properties', label: '🏡 Biens' },
      { path: '/services', label: '🧾 Services' },
      { path: '/tasks', label: '📋 Tâches' },
      { path: '/transactions', label: '💰 Transactions' },
      { path: '/finance', label: '📈 Finances' },
      ...commerceLinksCommon,
    ],
    agent: [
      { path: '/dashboard', label: '📊 Tableau de bord' },
      { path: '/projects', label: '📁 Projets assignés' },
      { path: '/agent/services', label: '⚙️ Services assignés' },
      { path: '/tasks', label: '📋 Tâches' },
      { path: '/transactions', label: '💰 Transactions' },
      { path: '/finance', label: '📈 Finances' },
      ...commerceLinksCommon,
    ],
    admin: [
      { path: '/dashboard', label: '📊 Tableau de bord' },
      { path: '/projects', label: '📁 Projets' },
      { path: '/admin/projects', label: '🧩 Gestion des projets' },
      { path: '/services', label: '🧾 Services' },
      { path: '/tasks', label: '📋 Tâches' },
      { path: '/admin/services', label: '🧩 Gestion des services' },
      { path: '/admin/agents', label: '👥 Agents' },
      { path: '/admin/users', label: '📁 Utilisateurs' },
      { path: '/admin/properties', label: '🏡 Biens clients' },
      { path: '/transactions', label: '💰 Transactions' },
      { path: '/finance', label: '📈 Finances' },
      ...commerceLinksCommon,
      { path: '/admin/catalog/categories', label: '🗂️ Catégories (admin)' },
      { path: '/admin/catalog/products', label: '📦 Produits (admin)' },
    ],
  };

  const links = roleLinks[user?.role] || [];

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  /* ============================================================
     ✨ Rendu principal
  ============================================================ */
  return (
    <motion.nav
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35 }}
      className="bg-slate-900/95 backdrop-blur-md text-white shadow-xl sticky top-0 z-50 border-b border-slate-800"
    >
      <div className="max-w-7xl mx-auto px-6">
        {/* Barre principale */}
        <div className="flex justify-between items-center py-3">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 font-bold text-lg text-cyan-400 hover:text-cyan-300 transition"
          >
            <Home size={22} className="text-cyan-400" />
            <span>Teranga</span>
          </Link>

          {/* Menu mobile */}
          <button
            type="button"
            className="md:hidden text-gray-300 hover:text-white p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
            onClick={() => setOpen((v) => !v)}
            aria-controls={menuId}
            aria-expanded={open}
          >
            {open ? <X size={26} /> : <Menu size={26} />}
          </button>

          {/* Liens Desktop */}
          <div className="hidden md:flex items-center justify-center flex-wrap gap-x-6 gap-y-2">
            {links.map((l) => (
              <Link
                key={l.path}
                to={l.path}
                className={`relative py-1 text-[0.9rem] font-medium transition-all ${
                  isActive(l.path)
                    ? 'text-cyan-400'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                {l.label}
                {isActive(l.path) && (
                  <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-cyan-400 rounded-full" />
                )}
              </Link>
            ))}
          </div>

          {/* Profil Desktop */}
          {user && (
            <div className="hidden md:flex items-center gap-4 ml-4">
              <div className="flex items-center gap-3 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700">
                <div className="text-right">
                  <div className="text-sm font-semibold leading-tight text-white">
                    {user.firstName || user.email}
                  </div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1">
                    {user.role}
                    <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                  </div>
                </div>
                <div className="w-9 h-9 flex items-center justify-center rounded-full bg-cyan-500 text-white font-bold uppercase shadow">
                  {user.firstName?.[0] || user.email?.[0] || '?'}
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center gap-1 bg-red-500 hover:bg-red-600 text-xs px-3 py-1.5 rounded-md font-semibold transition"
              >
                <LogOut size={14} /> Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Menu mobile */}
      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="md:hidden bg-slate-800 border-t border-slate-700 px-6 py-4 space-y-2"
          >
            {links.map((l) => (
              <Link
                key={l.path}
                to={l.path}
                onClick={() => setOpen(false)}
                className={`block text-sm py-2 px-3 rounded-md transition ${
                  isActive(l.path)
                    ? 'bg-cyan-600 text-white font-semibold'
                    : 'text-gray-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {l.label}
              </Link>
            ))}

            <Link
              to="/"
              onClick={() => setOpen(false)}
              className="block text-sm py-2 px-3 rounded-md text-gray-300 hover:bg-slate-700 hover:text-white mt-4 border-t border-slate-700 pt-3"
            >
              🌍 Retour au site vitrine
            </Link>

            {user && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-xs px-3 py-2 rounded-md font-semibold w-fit mt-3 transition"
              >
                <LogOut size={14} /> Déconnexion
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
