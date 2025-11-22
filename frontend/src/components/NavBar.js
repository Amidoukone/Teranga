// ============================================================================
// NavBar.jsx — Version Ultra-Premium PRO 2025 (avec LOGO TERANGA)
// Design moderne • Mobile-first • Accessible • Ultra-stable
// ============================================================================

import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { me, logout } from '../services/auth';
import { Menu, X, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Petite latence douce UX
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

export default function NavBar() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // ============================================================================
  // 🔐 Chargement utilisateur
  // ============================================================================
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

  // ============================================================================
  // ✨ Fermeture automatique du menu mobile après navigation
  // ============================================================================
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // ============================================================================
  // 🚪 Déconnexion
  // ============================================================================
  const handleLogout = useCallback(async () => {
    setOpen(false);
    await delay(80);
    logout();
    navigate('/login');
  }, [navigate]);

  if (loading) return null;

  // ============================================================================
  // 🌍 Mode public (non connecté)
  // ============================================================================
  const publicRoutes = ['/', '/login', '/register', '/shop'];
  const isPublic = publicRoutes.some((p) => location.pathname.startsWith(p));

  // LOGO Teranga (depuis /public)
  const Logo = (
    <img
      src="/logo_180x180.png"
      alt="Teranga"
      className="w-7 h-7 object-contain drop-shadow-md"
    />
  );

  if (!user && isPublic) {
    return (
      <nav
        className="
          bg-slate-900/90 backdrop-blur-md text-white
          px-5 py-4 shadow-md sticky top-0 z-[90] border-b border-slate-800
        "
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* LOGO + NOM */}
          <Link
            to="/"
            className="flex items-center gap-2 text-cyan-400 font-bold text-lg"
          >
            {Logo}
            <span>Teranga</span>
          </Link>

          <div className="flex items-center gap-5 text-sm">
            <Link
              to="/login"
              className="hover:text-cyan-400 transition font-medium"
            >
              Connexion
            </Link>

            <Link
              to="/register"
              className="
                px-4 py-1.5 bg-cyan-500 hover:bg-cyan-600
                rounded-md text-white font-semibold shadow-sm transition
              "
            >
              Inscription
            </Link>
          </div>
        </div>
      </nav>
    );
  }

  // ============================================================================
  // 🔗 Liens premium selon rôle
  // ============================================================================
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
    location.pathname === path || location.pathname.startsWith(path + '/');

  // ============================================================================
  // 🧭 NavBar Premium Responsive
  // ============================================================================
  return (
    <nav
      className="
        bg-slate-900/95 backdrop-blur-xl text-white
        shadow-xl border-b border-slate-800 sticky top-0 z-[90]
      "
      aria-label="Navigation principale"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* ===================================================================== */}
        {/* HEADER MOBILE (xs - md)                                              */}
        {/* ===================================================================== */}
        <div className="flex items-center justify-between py-3 md:hidden">
          {/* Logo Teranga */}
          <Link
            to="/"
            className="flex items-center gap-2 font-bold text-lg text-cyan-400"
          >
            {Logo}
            <span>Teranga</span>
          </Link>

          {/* Bouton menu mobile */}
          <button
            aria-label="Menu mobile"
            aria-controls="mobile-menu"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="
              md:hidden text-gray-300 hover:text-white
              transition p-2 focus:outline-none focus:ring-2 focus:ring-cyan-500
            "
          >
            {open ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>

        {/* ===================================================================== */}
        {/* HEADER DESKTOP (>= md)                                                */}
        {/* ===================================================================== */}
        <div className="hidden md:flex items-center gap-6 py-3">
          {/* Colonne gauche : Logo (fixe) */}
          <Link
            to="/"
            className="flex items-center gap-2 font-bold text-lg text-cyan-400 whitespace-nowrap"
          >
            {Logo}
            <span>Teranga</span>
          </Link>

          {/* Colonne centrale : Liens (flex-wrap + multi-ligne possible) */}
          <ul
            className="
              flex-1 flex flex-wrap
              gap-x-4 lg:gap-x-6 gap-y-1
              justify-center
            "
          >
            {links.map((l) => (
              <li key={l.path} className="whitespace-nowrap">
                <Link
                  to={l.path}
                  className={`
                    text-[0.9rem] font-medium transition relative
                    ${
                      isActive(l.path)
                        ? 'text-cyan-400'
                        : 'text-gray-300 hover:text-white'
                    }
                  `}
                >
                  {l.label}
                  {isActive(l.path) && (
                    <span className="absolute left-0 -bottom-1 h-0.5 w-full bg-cyan-400 rounded-full" />
                  )}
                </Link>
              </li>
            ))}
          </ul>

          {/* Colonne droite : Profil Desktop */}
          <div
            className="
              flex items-center gap-3 bg-slate-800/50 px-3 py-1.5
              rounded-lg border border-slate-700 max-w-xs lg:max-w-sm
            "
          >
            <div className="flex flex-col text-right truncate">
              <div className="flex items-center justify-end gap-1">
                <span className="text-sm font-semibold text-white truncate">
                  {user.firstName || user.email}
                </span>
                {/* Petit point vert (statut en ligne) */}
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shadow" />
              </div>
              <span className="text-xs text-gray-400 uppercase tracking-wide">
                {user.role}
              </span>
            </div>

            <div
              className="
                w-9 h-9 rounded-full bg-cyan-500 text-white flex
                items-center justify-center font-bold uppercase shadow shrink-0
              "
            >
              {user.firstName?.[0] || user.email?.[0] || '?'}
            </div>

            <button
              onClick={handleLogout}
              className="
                ml-1 flex items-center gap-1 bg-red-500 hover:bg-red-600
                px-3 py-1.5 text-xs rounded-md font-semibold transition shrink-0
              "
            >
              <LogOut size={14} /> Déconnexion
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* MENU MOBILE ANIMÉ (sous le header mobile)                              */}
      {/* ======================================================================= */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="
              md:hidden bg-slate-800 border-t border-slate-700
              px-6 py-4 space-y-2 overflow-hidden
            "
          >
            {/* Liens navigation mobile */}
            {links.map((l) => (
              <Link
                key={l.path}
                to={l.path}
                onClick={() => setOpen(false)}
                className={`
                  block text-sm py-2 px-3 rounded-md transition
                  ${
                    isActive(l.path)
                      ? 'bg-cyan-600 text-white font-semibold'
                      : 'text-gray-300 hover:bg-slate-700 hover:text-white'
                  }
                `}
              >
                {l.label}
              </Link>
            ))}

            <hr className="border-slate-700 my-3" />

            {/* Déconnexion mobile */}
            <button
              onClick={handleLogout}
              className="
                flex items-center gap-2 bg-red-500 hover:bg-red-600
                text-xs px-3 py-2 rounded-md font-semibold transition
              "
            >
              <LogOut size={14} /> Déconnexion
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
