// ============================================================================
// NavBar.jsx — Version Ultra-Premium PRO 2025 (A1 – Option C Compact)
// Bottom Navigation Premium • Mobile-first • Desktop Navigation
// BottomBar compact • Onglet "Projets" déplacé dans le menu Plus
// Desktop: Logout Button • Panel Plus visible & accessible
// Optimisée avec React.memo, aria-* et BottomBar alignée avec pages
//
// ✅ 2026 Update:
// - Intégration AdminOnboardingPage (admins only) : /admin/onboarding
// - ✅ Restriction: SEUL ADMIN GLOBAL voit le lien onboarding
//   -> Un MASTER (admin scopé countryId/regionId) ne doit pas voir onboarding
// ============================================================================

import { useEffect, useState, useCallback, useMemo, memo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { me, logout, getLocalUser } from "../services/auth";
import { normalizeRole, prettyRoleLabel } from "../utils/roles";

import {
  X,
  LogOut,
  Home,
  Wrench,
  ReceiptEuro,
  CreditCard,
  MoreHorizontal,
  BarChart3,
} from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";
import GeoSelector from "./GeoSelector";

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

/* ============================================================================ */
/* LINKS */
/* ============================================================================ */

const COMMON_COMMERCE = [
  { path: "/shop", label: "Produits" },
  { path: "/orders", label: "Commandes" },
];

// ✅ Admin-only onboarding link (Pays → Régions → MASTER) — GLOBAL ADMIN ONLY
const ADMIN_ONBOARDING_LINK = {
  path: "/admin/onboarding",
  label: "Master",
};

const ROLE_LINKS = {
  client: [
    { path: "/dashboard", label: "Dashboard" },
    { path: "/projects", label: "Projets" },
    { path: "/properties", label: "Biens" },
    { path: "/services", label: "Services" },
    { path: "/tasks", label: "Tâches" },
    { path: "/transactions", label: "Transactions" },
    { path: "/finance", label: "Finances" },
    ...COMMON_COMMERCE,
  ],
  agent: [
    { path: "/dashboard", label: "Dashboard" },
    { path: "/projects", label: "Projets assignés" },
    { path: "/agent/services", label: "⚙️ Services assignés" },
    { path: "/tasks", label: "Tâches" },
    { path: "/transactions", label: "Transactions" },
    { path: "/finance", label: "Finances" },
    ...COMMON_COMMERCE,
  ],
  admin: [
    { path: "/dashboard", label: "Dashboard" },
    { path: "/projects", label: "Projets" },
    { path: "/admin/projects", label: "Gestion projets" },

    // ✅ Onboarding: injecté dynamiquement uniquement pour ADMIN GLOBAL (voir plus bas)

    { path: "/services", label: "Services" },
    { path: "/tasks", label: "Tâches" },
    { path: "/admin/services", label: "Gestion services" },
    { path: "/admin/agents", label: "Agents" },
    { path: "/admin/users", label: "Utilisateurs" },
    { path: "/admin/properties", label: "Biens clients" },
    { path: "/transactions", label: "Transactions" },
    { path: "/finance", label: "Finances" },
    ...COMMON_COMMERCE,
    { path: "/admin/catalog/categories", label: "Catégories" },
    { path: "/admin/catalog/products", label: "Produits" },
  ],
};

/* ============================================================================ */
/* BOTTOM LINKS — MOBILE ONLY (COMPACT) */
/* ============================================================================ */

const BOTTOM_LINKS = {
  client: [
    { key: "dashboard", path: "/dashboard", label: "Accueil", icon: Home },
    { key: "services", path: "/services", label: "Services", icon: Wrench },
    { key: "transactions", path: "/transactions", label: "Flux", icon: ReceiptEuro },
  ],
  agent: [
    { key: "dashboard", path: "/dashboard", label: "Accueil", icon: Home },
    { key: "agentServices", path: "/agent/services", label: "Services", icon: Wrench },
    { key: "transactions", path: "/transactions", label: "Flux", icon: ReceiptEuro },
  ],
  admin: [
    { key: "dashboard", path: "/dashboard", label: "Accueil", icon: Home },
    { key: "adminServices", path: "/admin/services", label: "Services", icon: BarChart3 },
    { key: "finance", path: "/finance", label: "Finances", icon: CreditCard },
  ],
};

/* ============================================================================ */
/* COMPONENT */
/* ============================================================================ */

function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(getLocalUser());
  const [loading, setLoading] = useState(!getLocalUser());
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

  useEffect(() => setOpenMore(false), [location.pathname]);

  const handleLogout = useCallback(async () => {
    setOpenMore(false);
    await delay(120);
    logout();
    navigate("/login");
  }, [navigate]);

  const PUBLIC = ["/", "/login", "/register", "/shop", "/products"];
  const isPublic = PUBLIC.some((p) => location.pathname.startsWith(p));

  const role = normalizeRole(user?.role);

  // ✅ Détection ADMIN GLOBAL vs MASTER (admin scopé)
  // - ADMIN GLOBAL => pas de countryId ET pas de regionId
  // - MASTER => admin + countryId/regionId
  const isAdmin = role === "admin";
  const isGlobalAdmin = useMemo(() => {
    if (!isAdmin) return false;
    const hasCountryScope = Boolean(user?.countryId);
    const hasRegionScope = Boolean(user?.regionId);
    return !hasCountryScope && !hasRegionScope;
  }, [isAdmin, user?.countryId, user?.regionId]);

  // ✅ Links de rôle (inject onboarding uniquement pour admin global)
  const links = useMemo(() => {
    const base = ROLE_LINKS[role] || [];

    if (role !== "admin") return base;

    // Inject onboarding juste après "Gestion des projets" (position stable)
    if (!isGlobalAdmin) return base;

    const already = base.some((x) => x.path === ADMIN_ONBOARDING_LINK.path);
    if (already) return base;

    const out = [...base];
    const insertAfterPath = "/admin/projects";
    const idx = out.findIndex((x) => x.path === insertAfterPath);

    if (idx >= 0) out.splice(idx + 1, 0, ADMIN_ONBOARDING_LINK);
    else out.unshift(ADMIN_ONBOARDING_LINK);

    return out;
  }, [role, isGlobalAdmin]);

  const bottomLinks = useMemo(() => BOTTOM_LINKS[role] || [], [role]);

  const isActive = useCallback(
    (path) => {
      if (!path) return false;
      if (path === "/") return location.pathname === "/";
      return location.pathname === path || location.pathname.startsWith(path + "/");
    },
    [location.pathname]
  );

  const Logo = (
    <img src="/logo_180x180.png" alt="Teranga" className="w-7 h-7 object-contain" />
  );

  if (!user && loading) return null;

  /* ============================================================================ */
  /* PUBLIC NAVBAR */
  /* ============================================================================ */
  if (!user && isPublic) {
    return (
      <nav className="bg-[#0E1628]/95 backdrop-blur-xl text-white border-b border-[#1E2A45] shadow-[0_8px_30px_rgba(0,0,0,0.35)] px-5 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link
            to="/"
            className="flex items-center gap-2 text-[#00C2FF] font-semibold tracking-wide text-[1.05rem]"
          >
            {Logo} Teranga
          </Link>

          <div className="flex gap-3 text-sm">
            <Link to="/login" className="transition-colors duration-200 hover:text-[#00C2FF]">
              Connexion
            </Link>
            <Link
              to="/register"
              className="px-4 py-1.5 bg-[#00C2FF] rounded-md font-semibold transition-colors duration-200 hover:bg-[#00B0E6]"
            >
              Inscription
            </Link>
          </div>
        </div>
      </nav>
    );
  }

  /* ============================================================================ */
  /* AUTH NAVBAR */
  /* ============================================================================ */
  return (
    <>
      {/* TOP BAR */}
      <nav className="bg-[#0E1628]/95 backdrop-blur-xl text-white border-b border-[#1E2A45] shadow-[0_8px_30px_rgba(0,0,0,0.35)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between py-2">
          {/* LOGO */}
          <Link
            to="/"
            className="flex items-center gap-2 text-[#00C2FF] font-semibold tracking-wide text-[1.05rem]"
          >
            {Logo} Teranga
          </Link>

          <span className="hidden md:inline bg-[#111A2E] border border-[#1E2A45] px-3 py-0.5 rounded-full text-xs uppercase tracking-wide text-[#B6C2E2]">
            {prettyRoleLabel(user)}
          </span>

          {/* ✅ GEO SELECTOR (DESKTOP ONLY) */}
          <div className="hidden md:flex items-center">
            <GeoSelector />
          </div>

          {/* DESKTOP LOGOUT */}
          <button
            onClick={handleLogout}
            className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-red-600 text-white rounded-md text-sm font-semibold transition-colors duration-200 hover:bg-red-700"
            aria-label="Déconnexion"
          >
            <LogOut size={16} />
            Déconnexion
          </button>
        </div>

        {/* DESKTOP NAV LINKS */}
        <div className="hidden md:flex items-center gap-8 max-w-7xl mx-auto px-6 py-3">
          <ul className="flex-1 flex justify-center gap-6">
            {links.map((l) => (
              <Link
                key={l.path}
                to={l.path}
                className={`text-sm relative transition-colors duration-200 ${
                  isActive(l.path)
                    ? "text-[#00C2FF]"
                    : "text-[#B6C2E2] hover:text-white hover:after:scale-x-100"
                }`}
                aria-current={isActive(l.path) ? "page" : undefined}
              >
                {l.label}
                <span
                  className={`absolute left-0 -bottom-1 w-full h-[1.5px] bg-[#00C2FF]/90 rounded-full origin-left transition-transform duration-200 ${
                    isActive(l.path) ? "scale-x-100" : "scale-x-0"
                  }`}
                />
              </Link>
            ))}
          </ul>
        </div>
      </nav>

      {/* ======================================================================== */}
      {/* BOTTOM NAV — MOBILE ONLY (COMPACT VERSION) */}
      {/* ======================================================================== */}
      <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-transparent" aria-label="Navigation basse">
        <div className="mx-auto w-full flex justify-center">
          <div className="w-full max-w-xs px-2 pb-2">
            <div className="bg-[#0E1628]/95 backdrop-blur-xl border border-[#1E2A45] rounded-xl shadow-[0_12px_30px_rgba(0,0,0,0.45)] flex px-1 py-1 gap-1">
              {bottomLinks.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);

                return (
                  <Link
                    key={item.key}
                    to={item.path}
                    className={`flex-1 flex flex-col items-center py-1 rounded-lg text-[0.7rem]
                      ${
                        active
                          ? "bg-[#111A2E] text-[#00C2FF] shadow-[0_0_14px_rgba(0,194,255,0.28)]"
                          : "text-[#B6C2E2] hover:bg-[#111A2E]/60"
                      }`}
                      aria-current={active ? "page" : undefined}
                  >
                    <Icon size={17} className={active ? "text-[#00C2FF]" : "text-[#B6C2E2]"} />
                    {item.label}
                  </Link>
                );
              })}

              {/* BUTTON PLUS */}
              <button
                onClick={() => setOpenMore((v) => !v)}
                className={`flex-1 flex flex-col items-center py-1 rounded-lg text-[0.7rem]
                  ${
                    openMore
                      ? "bg-[#111A2E] text-[#00C2FF] shadow-[0_0_14px_rgba(0,194,255,0.28)]"
                      : "text-[#B6C2E2] hover:bg-[#111A2E]/60"
                  }`}
                aria-expanded={openMore}
                aria-controls="navbar-more-panel"
                aria-label="Ouvrir le menu Plus"
              >
                <MoreHorizontal size={17} />
                Plus
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ======================================================================== */}
      {/* PANEL PLUS */}
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
              id="navbar-more-panel"
              initial={{ opacity: 0, y: 80 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 80 }}
              transition={{ duration: 0.28 }}
              className="fixed bottom-24 inset-x-0 z-50 flex justify-center px-4"
              role="dialog"
              aria-modal="true"
              aria-label="Menu Plus"
            >
              <div className="w-full max-w-sm bg-[#0E1628]/95 backdrop-blur-2xl border border-[#1E2A45] rounded-2xl shadow-2xl overflow-hidden">
                {/* HEADER */}
                <div className="px-4 py-3 border-b border-[#1E2A45] flex justify-between items-center bg-[#111A2E]">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 bg-gradient-to-br from-[#00C2FF] to-[#0099CC] rounded-full flex items-center justify-center text-white font-semibold">
                      {user?.firstName?.[0] || user?.email?.[0] || "?"}
                    </div>

                    <div>
                      <div className="text-white text-sm font-semibold tracking-wide">
                        {user?.firstName || user?.email}
                      </div>
                      <div className="text-[#B6C2E2] text-[0.7rem] uppercase tracking-wide">
                        {prettyRoleLabel(user)}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setOpenMore(false)}
                    className="p-1.5 rounded-full bg-[#111A2E] text-[#B6C2E2] transition-colors duration-200 hover:bg-[#1E2A45]"
                    aria-label="Fermer le menu Plus"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* ✅ GEO SELECTOR (MOBILE INSIDE PLUS) */}
                <div className="px-4 py-3 border-b border-[#1E2A45]">
                  <div className="text-xs text-[#B6C2E2] mb-2">Périmètre</div>
                  <GeoSelector />
                </div>

                {/* LINKS */}
                <div className="max-h-64 overflow-y-auto">
                  {links.map((l) => (
                    <Link
                      key={l.path}
                      to={l.path}
                      onClick={() => setOpenMore(false)}
                      className={`block px-5 py-3 text-sm ${
                        isActive(l.path)
                          ? "bg-[#111A2E] text-[#00C2FF] font-semibold"
                          : "text-[#B6C2E2] transition-colors duration-200 hover:bg-[#111A2E]/70 hover:text-white"
                      }`}
                      aria-current={isActive(l.path) ? "page" : undefined}
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>

                {/* LOGOUT */}
                <button
                  onClick={handleLogout}
                  className="w-full flex justify-center gap-2 py-3 bg-red-600 text-white text-sm font-semibold transition-colors duration-200 hover:bg-red-700"
                  aria-label="Déconnexion"
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
