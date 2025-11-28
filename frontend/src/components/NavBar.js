// ============================================================================
// NavBar.jsx — Version Ultra-Premium PRO 2025 (avec LOGO TERANGA)
// Design moderne • Mobile-first • Accessible • Ultra-stable
// ============================================================================

import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { me, logout, getLocalUser } from "../services/auth";
import { Menu, X, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Petite latence douce UX
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

/* ============================================================================
   🔧 Normalisation du rôle (alignée avec Dashboard)
============================================================================ */
function normalizeRole(rawRole) {
  if (!rawRole) return "client";
  const r = String(rawRole).toLowerCase();

  if (r.includes("admin")) return "admin";
  if (r.includes("agent")) return "agent";
  return "client";
}

function prettyRoleLabel(role) {
  const r = normalizeRole(role);
  if (r === "admin") return "ADMINISTRATEUR";
  if (r === "agent") return "AGENT";
  return "CLIENT";
}

/* ============================================================================
   🔗 Liens statiques par rôle (hors composant pour éviter les warnings ESLint)
============================================================================ */
const commerceLinksCommon = [
  { path: "/shop", label: "🛍️ Produits" },
  { path: "/orders", label: "🧾 Commandes" },
];

const ROLE_LINKS = {
  client: [
    { path: "/dashboard", label: "📊 Dashboard" },
    { path: "/projects", label: "📁 Projets" },
    { path: "/properties", label: "🏡 Biens" },
    { path: "/services", label: "🧾 Services" },
    { path: "/tasks", label: "📋 Tâches" },
    { path: "/transactions", label: "💰 Transactions" },
    { path: "/finance", label: "📈 Finances" },
    ...commerceLinksCommon,
  ],

  agent: [
    { path: "/dashboard", label: "📊 Dashboard" },
    { path: "/projects", label: "📁 Projets assignés" },
    { path: "/agent/services", label: "⚙️ Services assignés" },
    { path: "/tasks", label: "📋 Tâches" },
    { path: "/transactions", label: "💰 Transactions" },
    { path: "/finance", label: "📈 Finances" },
    ...commerceLinksCommon,
  ],

  admin: [
    { path: "/dashboard", label: "📊 Dashboard" },
    { path: "/projects", label: "📁 Projets" },
    { path: "/admin/projects", label: "🧩 Gestion des projets" },
    { path: "/services", label: "🧾 Services" },
    { path: "/tasks", label: "📋 Tâches" },
    { path: "/admin/services", label: "🧩 Gestion des services" },
    { path: "/admin/agents", label: "👥 Agents" },
    { path: "/admin/users", label: "📁 Utilisateurs" },
    { path: "/admin/properties", label: "🏡 Biens clients" },
    { path: "/transactions", label: "💰 Transactions" },
    { path: "/finance", label: "📈 Finances" },
    ...commerceLinksCommon,
    { path: "/admin/catalog/categories", label: "🗂️ Catégories" },
    { path: "/admin/catalog/products", label: "📦 Produits" },
  ],
};

export default function NavBar() {
  // ⚡ Chargement instantané via cache local
  const [user, setUser] = useState(() => getLocalUser() || null);
  const [loading, setLoading] = useState(() => !getLocalUser());
  const [open, setOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  /* ============================================================================
     🔐 Synchronisation utilisateur (cache → puis /auth/me)
  ============================================================================ */
  useEffect(() => {
    let active = true;

    async function fetchUser() {
      try {
        const res = await me();
        if (!active) return;
        setUser(res.user || null);
      } catch {
        if (!active) return;
        setUser((prev) => prev || null);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchUser();
    return () => {
      active = false;
    };
  }, [location.pathname]);

  /* ============================================================================
     ✨ Fermeture automatique du menu mobile après navigation
  ============================================================================ */
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  /* ============================================================================
     🚪 Déconnexion
  ============================================================================ */
  const handleLogout = useCallback(async () => {
    setOpen(false);
    await delay(80);
    logout();
    setUser(null);
    navigate("/login");
  }, [navigate]);

  /* ============================================================================
     🌐 Détection pages publiques
  ============================================================================ */
  const publicRoutes = [
    "/",
    "/login",
    "/register",
    "/shop",
    "/products",
    "/legal",
    "/privacy",
    "/terms",
  ];

  const isPublic = publicRoutes.some((p) =>
    location.pathname.startsWith(p)
  );

  /* ============================================================================
     🔧 Préparation des liens selon rôle (toujours exécuté → ok hooks)
  ============================================================================ */
  const roleKey = normalizeRole(user?.role);
  const links = useMemo(() => ROLE_LINKS[roleKey] || [], [roleKey]);

  const isActive = (path) =>
    location.pathname === path ||
    location.pathname.startsWith(path + "/");

  /* ============================================================================
     🎨 Logo
  ============================================================================ */
  const Logo = (
    <img
      src="/logo_180x180.png"
      alt="Teranga"
      className="w-7 h-7 object-contain drop-shadow-md"
    />
  );

  /* ============================================================================
     ⏳ État de chargement initial (évite flash)
  ============================================================================ */
  if (!user && loading) return null;

  /* ============================================================================
     🌍 NavBar publique
  ============================================================================ */
  if (!user && isPublic) {
    return (
      <nav className="bg-slate-900/90 backdrop-blur-md text-white px-5 py-4 shadow-md sticky top-0 z-[90] border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-cyan-400 font-bold text-lg">
            {Logo}
            <span>Teranga</span>
          </Link>

          <div className="flex items-center gap-5 text-sm">
            <Link to="/login" className="hover:text-cyan-400 transition font-medium">
              Connexion
            </Link>

            <Link
              to="/register"
              className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-600 rounded-md text-white font-semibold shadow-sm transition"
            >
              Inscription
            </Link>
          </div>
        </div>
      </nav>
    );
  }

  /* ============================================================================
     🧭 NavBar authentifiée
  ============================================================================ */
  return (
    <nav className="bg-slate-900/95 backdrop-blur-xl text-white shadow-xl border-b border-slate-800 sticky top-0 z-[90]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">

        {/* MOBILE HEADER */}
        <div className="flex items-center justify-between py-3 md:hidden">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg text-cyan-400">
            {Logo}
            <span>Teranga</span>
          </Link>

          <button
            aria-label="Menu mobile"
            aria-controls="mobile-menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="md:hidden text-gray-300 hover:text-white transition p-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            {open ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>

        {/* DESKTOP HEADER */}
        <div className="hidden md:flex items-center gap-6 py-3">
          {/* LOGO */}
          <Link
            to="/"
            className="flex items-center gap-2 font-bold text-lg text-cyan-400 whitespace-nowrap"
          >
            {Logo}
            <span>Teranga</span>
          </Link>

          {/* LIENS */}
          <ul className="flex-1 flex flex-wrap gap-x-4 lg:gap-x-6 gap-y-1 justify-center">
            {links.map((l) => (
              <li key={l.path} className="whitespace-nowrap">
                <Link
                  to={l.path}
                  aria-current={isActive(l.path) ? "page" : undefined}
                  className={`
                    text-[0.9rem] font-medium transition relative
                    ${
                      isActive(l.path)
                        ? "text-cyan-400"
                        : "text-gray-300 hover:text-white"
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

          {/* PROFIL */}
          <div className="flex items-center gap-3 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700 max-w-xs lg:max-w-sm">
            <div className="flex flex-col text-right truncate">
              <div className="flex items-center justify-end gap-1">
                <span className="text-sm font-semibold text-white truncate">
                  {user?.firstName || user?.email || "Utilisateur"}
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shadow" />
              </div>
              <span className="text-xs text-gray-400 uppercase tracking-wide">
                {prettyRoleLabel(user?.role)}
              </span>
            </div>

            <div className="w-9 h-9 rounded-full bg-cyan-500 text-white flex items-center justify-center font-bold uppercase shadow shrink-0">
              {user?.firstName?.[0] || user?.email?.[0] || "?"}
            </div>

            <button
              onClick={handleLogout}
              className="ml-1 flex items-center gap-1 bg-red-500 hover:bg-red-600 px-3 py-1.5 text-xs rounded-md font-semibold transition shrink-0"
            >
              <LogOut size={14} /> Déconnexion
            </button>
          </div>
        </div>
      </div>

      {/* MENU MOBILE */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="md:hidden bg-slate-800 border-t border-slate-700 px-6 py-4 space-y-2 overflow-hidden"
          >
            {links.map((l) => (
              <Link
                key={l.path}
                to={l.path}
                onClick={() => setOpen(false)}
                aria-current={isActive(l.path) ? "page" : undefined}
                className={`
                  block text-sm py-2 px-3 rounded-md transition
                  ${
                    isActive(l.path)
                      ? "bg-cyan-600 text-white font-semibold"
                      : "text-gray-300 hover:bg-slate-700 hover:text-white"
                  }
                `}
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
