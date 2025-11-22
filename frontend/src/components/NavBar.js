// ============================================================================
// NavBar.jsx — Version Ultra-Premium 2025
// Responsive • Accessible • Rapide • Production Ready
// ============================================================================
import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { me, logout } from '../services/auth';
import { Menu, X, LogOut, Home } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// 🧠 Helper — Ajoute une latence minimaliste pour fluidifier UX
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function NavBar() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  /* ============================================================
     🔐 Chargement utilisateur (optimisé)
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
    return () => (active = false);
  }, [location.pathname]);

/* ============================================================
   ✨ Fermer menu mobile automatiquement (ESLint safe)
============================================================ */
useEffect(() => {
  setOpen(false);
}, [location.pathname]);

  /* ============================================================
     🚪 Déconnexion + feedback UX instantané
  ============================================================ */
  const handleLogout = useCallback(async () => {
    setOpen(false);
    await delay(80);
    logout();
    navigate('/login');
  }, [navigate]);

  if (loading) return null;

  /* ============================================================
     🌍 Mode PUBLIC (non connecté)
  ============================================================ */
  const publicRoutes = ['/', '/login', '/register', '/shop'];
  const isPublic = publicRoutes.some((p) =>
    location.pathname.startsWith(p)
  );

  if (!user && isPublic) {
    return (
      <nav
        className="bg-slate-900/90 backdrop-blur-md text-white px-5 py-4
                   shadow-md sticky top-0 z-[60] border-b border-slate-800"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-cyan-400 font-bold text-lg"
          >
            <Home size={20} />
            Teranga
          </Link>

          <div className="flex items-center gap-5 text-sm">
            <Link
              to="/login"
              className="hover:text-cyan-400 transition"
            >
              Connexion
            </Link>

            <Link
              to="/register"
              className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-600
                         rounded-md text-white font-semibold shadow-sm transition"
            >
              Inscription
            </Link>
          </div>
        </div>
      </nav>
    );
  }

  /* ============================================================
     🔗 Liens premium selon rôle
  ============================================================ */
  const commerceLinksCommon = [
    { path: '/shop', label: '🛍️ Produits' },
    { path: '/orders', label: '🧾 Commandes' },
  ];

  const roleLinks = {
    client: [
      { path: '/dashboard', label: '📊 Dashboard' },
      { path: '/projects', label: '📁 Projets' },
      { path: '/properties', label: '🏡 Biens' },
      { path: '/services', label: '🧾 Services' },
      { path: '/tasks', label: '📋 Tâches' },
      { path: '/transactions', label: '💰 Transactions' },
      { path: '/finance', label: '📈 Finances' },
      ...commerceLinksCommon,
    ],
    agent: [
      { path: '/dashboard', label: '📊 Dashboard' },
      { path: '/projects', label: '📁 Projets assignés' },
      { path: '/agent/services', label: '⚙️ Services assignés' },
      { path: '/tasks', label: '📋 Tâches' },
      { path: '/transactions', label: '💰 Transactions' },
      { path: '/finance', label: '📈 Finances' },
      ...commerceLinksCommon,
    ],
    admin: [
      { path: '/dashboard', label: '📊 Dashboard' },
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
      { path: '/admin/catalog/categories', label: '🗂️ Catégories' },
      { path: '/admin/catalog/products', label: '📦 Produits' },
    ],
  };

  const links = roleLinks[user?.role] || [];

  const isActive = (path) =>
    location.pathname === path ||
    location.pathname.startsWith(path + '/');

  /* ============================================================
     🧭 NavBar Premium Responsive
  ============================================================ */
  return (
    <nav
      className="
        bg-slate-900/95 backdrop-blur-xl
        text-white shadow-xl border-b border-slate-800
        sticky top-0 z-[70]
      "
      aria-label="Navigation principale"
    >
      <div className="max-w-7xl mx-auto px-6">
        {/* Header principal */}
        <div className="flex items-center justify-between py-3">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 font-bold text-lg text-cyan-400"
          >
            <Home size={20} />
            Teranga
          </Link>

          {/* Bouton mobile */}
          <button
            aria-label="Ouvrir le menu"
            aria-controls="mobile-menu"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="md:hidden text-gray-300 hover:text-white transition p-2"
          >
            {open ? <X size={26} /> : <Menu size={26} />}
          </button>

          {/* Liens desktop */}
          <ul className="hidden md:flex items-center gap-6">
            {links.map((l) => (
              <li key={l.path}>
                <Link
                  to={l.path}
                  className={`text-[0.9rem] transition font-medium relative 
                    ${
                      isActive(l.path)
                        ? 'text-cyan-400'
                        : 'text-gray-300 hover:text-white'
                    }`}
                >
                  {l.label}

                  {isActive(l.path) && (
                    <span className="absolute left-0 -bottom-1 h-0.5 w-full bg-cyan-400 rounded-full" />
                  )}
                </Link>
              </li>
            ))}

            {/* Profil desktop */}
            <li>
              <div className="flex items-center gap-3 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700">
                <div className="flex flex-col text-right">
                  <span className="text-sm font-semibold text-white">
                    {user.firstName || user.email}
                  </span>
                  <span className="text-xs text-gray-400 uppercase tracking-wide">
                    {user.role}
                  </span>
                </div>
                <div className="w-9 h-9 rounded-full bg-cyan-500 text-white flex items-center justify-center font-bold text-sm uppercase">
                  {user.firstName?.[0] || user.email?.[0] || '?'}
                </div>
                <button
                  onClick={handleLogout}
                  className="ml-2 flex items-center gap-1 bg-red-500 hover:bg-red-600 px-3 py-1.5 text-xs rounded-md transition"
                >
                  <LogOut size={14} /> Déconnexion
                </button>
              </div>
            </li>
          </ul>
        </div>
      </div>

      {/* MENU MOBILE */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="md:hidden bg-slate-800 border-t border-slate-700 px-6 py-4 space-y-2 overflow-hidden"
          >
            {links.map((l) => (
              <Link
                key={l.path}
                to={l.path}
                onClick={() => setOpen(false)}
                className={`block text-sm py-2 px-3 rounded-md transition
                  ${
                    isActive(l.path)
                      ? 'bg-cyan-600 text-white font-semibold'
                      : 'text-gray-300 hover:bg-slate-700 hover:text-white'
                  }`}
              >
                {l.label}
              </Link>
            ))}

            <hr className="border-slate-700 my-3" />

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-xs px-3 py-2 rounded-md font-semibold transition"
            >
              <LogOut size={14} /> Déconnexion
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
