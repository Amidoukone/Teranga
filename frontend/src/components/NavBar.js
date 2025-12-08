// ============================================================================
// NavBar.jsx — Version Ultra-Premium PRO 2025 (A1 – Option C)
// Bottom Navigation Premium • Mobile-first • Desktop Navigation
// Desktop: Logout Button • Panel Plus visible & accessible
// Optimisée avec React.memo, useCallback, aria-*
// ============================================================================

import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  memo,
} from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { me, logout, getLocalUser } from "../services/auth";

import {
  X,
  LogOut,
  Home,
  FolderKanban,
  Wrench,
  ReceiptEuro,
  CreditCard,
  MoreHorizontal,
  BarChart3,
} from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

/* ============================================================================ */
/* ROLE */
/* ============================================================================ */
function normalizeRole(raw) {
  if (!raw) return "client";
  const r = raw.toLowerCase();
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

/* ============================================================================ */
/* LINKS */
/* ============================================================================ */
const COMMON_COMMERCE = [
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
    ...COMMON_COMMERCE,
  ],
  agent: [
    { path: "/dashboard", label: "📊 Dashboard" },
    { path: "/projects", label: "📁 Projets assignés" },
    { path: "/agent/services", label: "⚙️ Services assignés" },
    { path: "/tasks", label: "📋 Tâches" },
    { path: "/transactions", label: "💰 Transactions" },
    { path: "/finance", label: "📈 Finances" },
    ...COMMON_COMMERCE,
  ],
  admin: [
    { path: "/dashboard", label: "📊 Dashboard" },
    { path: "/projects", label: "📁 Projets" },
    { path: "/admin/projects", label: "🧩 Gestion des projets" },
    { path: "/services", label: "🧾 Services" },
    { path: "/tasks", label: "📋 Tâches" },
    { path: "/admin/services", label: "🧩 Gestion services" },
    { path: "/admin/agents", label: "👥 Agents" },
    { path: "/admin/users", label: "👤 Utilisateurs" },
    { path: "/admin/properties", label: "🏡 Biens clients" },
    { path: "/transactions", label: "💰 Transactions" },
    { path: "/finance", label: "📈 Finances" },
    ...COMMON_COMMERCE,
    { path: "/admin/catalog/categories", label: "🗂️ Catégories" },
    { path: "/admin/catalog/products", label: "📦 Produits" },
  ],
};

const BOTTOM_LINKS = {
  client: [
    { key: "dashboard", path: "/dashboard", label: "Accueil", icon: Home },
    { key: "projects", path: "/projects", label: "Projets", icon: FolderKanban },
    { key: "services", path: "/services", label: "Services", icon: Wrench },
    { key: "transactions", path: "/transactions", label: "Flux", icon: ReceiptEuro },
  ],
  agent: [
    { key: "dashboard", path: "/dashboard", label: "Accueil", icon: Home },
    { key: "projects", path: "/projects", label: "Projets", icon: FolderKanban },
    { key: "agentServices", path: "/agent/services", label: "Services", icon: Wrench },
    { key: "transactions", path: "/transactions", label: "Flux", icon: ReceiptEuro },
  ],
  admin: [
    { key: "dashboard", path: "/dashboard", label: "Accueil", icon: Home },
    { key: "adminProjects", path: "/admin/projects", label: "Projets", icon: BarChart3 },
    { key: "adminServices", path: "/admin/services", label: "Services", icon: Wrench },
    { key: "finance", path: "/finance", label: "Finances", icon: CreditCard },
  ],
};

/* ============================================================================ */
/* COMPONENT */
/* ============================================================================ */
function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(() => getLocalUser());
  const [loading, setLoading] = useState(() => !getLocalUser());
  const [openMore, setOpenMore] = useState(false);

  /* LOAD USER */
  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await me();
        if (active) setUser(res?.user || null);
      } catch {
        if (active) setUser((u) => u || null);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [location.pathname]);

  /* CLOSE PANEL ON NAVIGATION */
  useEffect(() => {
    setOpenMore(false);
  }, [location.pathname]);

  const handleLogout = useCallback(async () => {
    setOpenMore(false);
    await delay(120);
    logout();
    navigate("/login");
  }, [navigate]);

  /* HELPERS */
  const PUBLIC = ["/", "/login", "/register", "/shop", "/products"];

  // ❌ plus de useMemo ici → plus de warning eslint
  const isPublic = PUBLIC.some((p) => location.pathname.startsWith(p));

  const role = normalizeRole(user?.role);

  const links = useMemo(() => ROLE_LINKS[role] || [], [role]);
  const bottomLinks = useMemo(() => BOTTOM_LINKS[role] || [], [role]);

  const isActive = useCallback(
    (path) => {
      if (!path) return false;
      if (path === "/") return location.pathname === "/";
      return (
        location.pathname === path ||
        location.pathname.startsWith(path + "/")
      );
    },
    [location.pathname]
  );

  const Logo = (
    <img
      src="/logo_180x180.png"
      alt="Teranga"
      className="w-7 h-7 object-contain"
    />
  );

  if (!user && loading) return null;

  // ============================================================================  
  // PUBLIC NAVBAR  
  // ============================================================================  
  if (!user && isPublic) {
    return (
      <nav
        className="bg-slate-900/90 backdrop-blur-md text-white shadow-md px-5 py-4 sticky top-0 z-50"
        role="navigation"
        aria-label="Navigation publique"
      >
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link
            to="/"
            className="flex items-center gap-2 text-cyan-400 font-bold text-lg"
            aria-label="Retour à la page d’accueil"
          >
            {Logo}
            Teranga
          </Link>

          <div className="flex gap-3 text-sm">
            <Link to="/login" className="hover:text-cyan-400">
              Connexion
            </Link>
            <Link
              to="/register"
              className="px-4 py-1.5 bg-cyan-500 rounded-md font-semibold hover:bg-cyan-600"
            >
              Inscription
            </Link>
          </div>
        </div>
      </nav>
    );
  }

  // ============================================================================  
  // AUTH NAVBAR (desktop + mobile header)
  // ============================================================================  
  return (
    <>
      {/* ======================================================================== */}
      {/* TOP BAR — Desktop & Mobile */}
      {/* ======================================================================== */}
      <nav
        className="bg-slate-900/95 backdrop-blur-xl text-white border-b border-slate-800 shadow-lg sticky top-0 z-50"
        role="navigation"
        aria-label="Navigation principale"
      >
        {/* TOP BAR CONTENT */}
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between py-2">
          {/* LOGO → Homepage */}
          <Link
            to="/"
            className="flex items-center gap-2 text-cyan-400 font-bold text-lg"
            aria-label="Retour à la page d’accueil"
          >
            {Logo}
            Teranga
          </Link>

          {/* ROLE LABEL (desktop only) */}
          <span className="hidden md:inline bg-slate-800 px-3 py-0.5 rounded-full text-[0.75rem] uppercase text-gray-300">
            {prettyRoleLabel(user?.role)}
          </span>

          {/* DESKTOP LOGOUT BUTTON */}
          <button
            onClick={handleLogout}
            className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-semibold"
            aria-label="Se déconnecter"
          >
            <LogOut size={16} />
            Déconnexion
          </button>
        </div>

        {/* DESKTOP NAVIGATION LINKS */}
        <div className="hidden md:flex items-center gap-8 max-w-7xl mx-auto px-6 py-3">
          <ul className="flex-1 flex justify-center gap-6">
            {links.map((l) => (
              <Link
                key={l.path}
                to={l.path}
                aria-current={isActive(l.path) ? "page" : undefined}
                className={`text-sm transition relative
                  ${
                    isActive(l.path)
                      ? "text-cyan-400"
                      : "text-gray-300 hover:text-white"
                  }
                `}
              >
                {l.label}
                {isActive(l.path) && (
                  <span className="absolute left-0 -bottom-1 w-full h-[2px] bg-cyan-400 rounded-full" />
                )}
              </Link>
            ))}
          </ul>
        </div>
      </nav>

      {/* ======================================================================== */}
      {/* BOTTOM NAV — Mobile only */}
      {/* ======================================================================== */}
      <nav
        className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-transparent"
        role="navigation"
        aria-label="Navigation principale mobile"
      >
        <div className="mx-auto w-full flex justify-center">
          <div className="w-full max-w-sm px-2 pb-3">
            <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-xl flex px-1 py-1">
              {bottomLinks.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);

                return (
                  <Link
                    key={item.key}
                    to={item.path}
                    aria-current={active ? "page" : undefined}
                    className={`flex-1 flex flex-col items-center py-1.5 rounded-xl text-[0.75rem]
                      ${
                        active
                          ? "bg-slate-800 text-cyan-300 shadow-[0_0_12px_rgba(56,189,248,0.35)]"
                          : "text-gray-300 hover:bg-slate-800/50"
                      }`}
                  >
                    <Icon
                      size={18}
                      className={active ? "text-cyan-300" : "text-gray-300"}
                    />
                    {item.label}
                  </Link>
                );
              })}

              {/* BUTTON "PLUS" */}
              <button
                type="button"
                onClick={() => setOpenMore((v) => !v)}
                aria-label={openMore ? "Fermer le menu Plus" : "Ouvrir le menu Plus"}
                aria-expanded={openMore}
                aria-controls="panel-plus"
                className={`flex-1 flex flex-col items-center py-1.5 rounded-xl text-[0.75rem]
                  ${
                    openMore
                      ? "bg-slate-800 text-cyan-300 shadow-[0_0_12px_rgba(56,189,248,0.35)]"
                      : "text-gray-300 hover:bg-slate-800/50"
                  }`}
              >
                <MoreHorizontal size={18} />
                Plus
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ======================================================================== */}
      {/* PANEL "PLUS" — Desktop + Mobile (IMPROVED DESIGN + ACCESSIBLE) */}
      {/* ======================================================================== */}
      <AnimatePresence>
        {openMore && (
          <>
            {/* OVERLAY */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.65 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 z-40"
              onClick={() => setOpenMore(false)}
              aria-hidden="true"
            />

            {/* PANEL */}
            <motion.div
              id="panel-plus"
              initial={{ opacity: 0, y: 80 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 80 }}
              transition={{ duration: 0.28 }}
              className="fixed bottom-24 inset-x-0 z-50 flex justify-center px-4"
              role="dialog"
              aria-modal="true"
              aria-label="Menu de navigation complémentaire"
            >
              <div
                className="
                  w-full max-w-sm
                  bg-slate-900/95
                  backdrop-blur-2xl
                  border border-slate-600/70
                  rounded-2xl
                  shadow-2xl
                  overflow-hidden
                "
              >
                {/* HEADER */}
                <div className="px-4 py-3 border-b border-slate-700/60 flex justify-between items-center bg-slate-800/60 backdrop-blur-xl">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 bg-cyan-500 rounded-full flex items-center justify-center text-white font-bold">
                      {user?.firstName?.[0] || user?.email?.[0] || "?"}
                    </div>

                    <div>
                      <div className="text-white text-sm font-semibold">
                        {user?.firstName || user?.email || "Utilisateur"}
                      </div>
                      <div className="text-gray-400 text-[0.7rem] uppercase tracking-wide">
                        {prettyRoleLabel(user?.role)}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setOpenMore(false)}
                    aria-label="Fermer le menu"
                    className="p-1.5 rounded-full bg-slate-800/70 hover:bg-slate-700 text-gray-300"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* LINKS */}
                <div className="max-h-64 overflow-y-auto">
                  {links.map((l) => (
                    <Link
                      key={l.path}
                      to={l.path}
                      onClick={() => setOpenMore(false)}
                      aria-current={isActive(l.path) ? "page" : undefined}
                      className={`block px-5 py-3 text-sm transition
                        ${
                          isActive(l.path)
                            ? "bg-slate-800 text-cyan-300 font-semibold"
                            : "text-gray-200 hover:bg-slate-800/70 hover:text-white"
                        }`}
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>

                {/* LOGOUT */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex justify-center gap-2 py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold"
                  aria-label="Se déconnecter"
                >
                  <LogOut size={14} />
                  Déconnexion
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default memo(NavBar);
