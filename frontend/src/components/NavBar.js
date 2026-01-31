// ============================================================================
// NavBar.jsx — Enterprise SaaS (Stripe/Revolut/Notion vibe)
// - Même structure/logic routes/roles (zéro régression)
// - Desktop: Tabs principaux + menu "Plus" + User menu (avatar dropdown)
// - Mobile: Bottom nav compact + "Plus" panel (organisé par sections)
// - Admin Onboarding visible uniquement ADMIN GLOBAL (pas Master)
// ============================================================================
//
// ✅ Fix 2026-01:
// - Lisibilité renforcée dans tous les états (avant hover / hover / actif / focus)
// - Email utilisateur non affiché (nom uniquement)
// - Aucune fonctionnalité supprimée
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
  LayoutDashboard,
  FolderKanban,
  Building2,
  ClipboardList,
  Users,
  UserCog,
  Package,
  ShoppingBag,
  Shapes,
  ShieldCheck,
  ChevronDown,
  Check,
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

// ✅ Admin-only onboarding link (GLOBAL ADMIN ONLY)
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
    { path: "/agent/services", label: "Services assignés" },
    { path: "/tasks", label: "Tâches" },
    { path: "/transactions", label: "Transactions" },
    { path: "/finance", label: "Finances" },
    ...COMMON_COMMERCE,
  ],
  admin: [
    { path: "/dashboard", label: "Dashboard" },
    { path: "/projects", label: "Projets" },
    { path: "/admin/projects", label: "Gestion projets" },

    // Onboarding injecté dynamiquement uniquement admin global

    { path: "/services", label: "Services" },
    { path: "/tasks", label: "Tâches" },
    { path: "/admin/services", label: "Gestion services" },
    { path: "/admin/metrics", label: "Monitoring" },
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
/* ICON MAP (just UI, no functional impact) */
/* ============================================================================ */

const ICON_BY_PATH_PREFIX = [
  { prefix: "/dashboard", icon: LayoutDashboard },
  { prefix: "/projects", icon: FolderKanban },
  { prefix: "/properties", icon: Building2 },
  { prefix: "/services", icon: Wrench },
  { prefix: "/agent/services", icon: Wrench },
  { prefix: "/tasks", icon: ClipboardList },
  { prefix: "/transactions", icon: ReceiptEuro },
  { prefix: "/finance", icon: CreditCard },

  // Admin
  { prefix: "/admin/projects", icon: FolderKanban },
  { prefix: "/admin/services", icon: BarChart3 },
  { prefix: "/admin/metrics", icon: BarChart3 },
  { prefix: "/admin/agents", icon: Users },
  { prefix: "/admin/users", icon: UserCog },
  { prefix: "/admin/properties", icon: Building2 },
  { prefix: "/admin/onboarding", icon: ShieldCheck },

  // Catalog / commerce
  { prefix: "/admin/catalog/categories", icon: Shapes },
  { prefix: "/admin/catalog/products", icon: Package },
  { prefix: "/shop", icon: ShoppingBag },
  { prefix: "/orders", icon: Package },
];

function iconForPath(path) {
  const found = ICON_BY_PATH_PREFIX.find(
    (x) => path === x.prefix || path.startsWith(x.prefix + "/")
  );
  return found?.icon || MoreHorizontal;
}

/* ============================================================================ */
/* GROUPING — Enterprise information architecture (UI only) */
/* ============================================================================ */

function buildSections(role, links) {
  const sections = [];

  const pushSection = (title, items) => {
    const clean = items.filter(Boolean);
    if (clean.length) sections.push({ title, items: clean });
  };

  const byPath = (p) => links.find((x) => x.path === p);
  const byPrefix = (prefix) =>
    links.filter((x) => x.path === prefix || x.path.startsWith(prefix + "/"));

  pushSection("Essentiel", [
    byPath("/dashboard"),
    ...byPrefix("/projects"),
    ...byPrefix("/properties"),
    ...byPrefix("/services"),
    ...byPrefix("/tasks"),
  ]);

  pushSection("Finance", [...byPrefix("/transactions"), ...byPrefix("/finance")]);

  pushSection("Boutique", [...byPrefix("/shop"), ...byPrefix("/orders")]);

  if (role === "admin") {
    pushSection("Administration", [
      byPath("/admin/projects"),
      byPath("/admin/onboarding"),
      byPath("/admin/services"),
      byPath("/admin/metrics"),
      byPath("/admin/agents"),
      byPath("/admin/users"),
      byPath("/admin/properties"),
      byPath("/admin/catalog/categories"),
      byPath("/admin/catalog/products"),
    ]);
  }

  const seen = new Set();
  for (const sec of sections) {
    sec.items = sec.items.filter((it) => {
      if (!it?.path) return false;
      if (seen.has(it.path)) return false;
      seen.add(it.path);
      return true;
    });
  }

  return sections;
}

/* ============================================================================ */
/* COMPONENT */
/* ============================================================================ */

function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(getLocalUser());
  const [loading, setLoading] = useState(!getLocalUser());

  // Mobile "Plus"
  const [openMore, setOpenMore] = useState(false);

  // Desktop dropdowns
  const [openDesktopMore, setOpenDesktopMore] = useState(false);
  const [openUserMenu, setOpenUserMenu] = useState(false);

  /* LOAD USER (unchanged logic) */
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

  // Close panels on route change
  useEffect(() => {
    setOpenMore(false);
    setOpenDesktopMore(false);
    setOpenUserMenu(false);
  }, [location.pathname]);

  // ESC closes dropdowns (pro UX)
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") {
        setOpenMore(false);
        setOpenDesktopMore(false);
        setOpenUserMenu(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleLogout = useCallback(async () => {
    setOpenMore(false);
    setOpenDesktopMore(false);
    setOpenUserMenu(false);
    await delay(100);
    logout();
    navigate("/login");
  }, [navigate]);

  const PUBLIC = ["/", "/login", "/register", "/shop", "/products"];
  const isPublic = PUBLIC.some((p) => location.pathname.startsWith(p));

  const role = normalizeRole(user?.role);

  // ✅ Détection ADMIN GLOBAL vs MASTER (admin scopé)
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
      return (
        location.pathname === path || location.pathname.startsWith(path + "/")
      );
    },
    [location.pathname]
  );

  const activeLabel = useMemo(() => {
    const current = links.find((l) => isActive(l.path));
    return current?.label || "";
  }, [links, isActive]);

  const sections = useMemo(() => buildSections(role, links), [role, links]);

  // Desktop: tabs primaires (calme). Le reste -> Plus.
  const desktopPrimaryTabs = useMemo(() => {
    const candidates = [
      "/dashboard",
      "/projects",
      role === "admin"
        ? "/admin/services"
        : role === "agent"
        ? "/agent/services"
        : "/services",
      "/tasks",
    ];

    const tabs = [];
    for (const p of candidates) {
      const item =
        links.find((x) => x.path === p) ||
        links.find((x) => x.path.startsWith(p + "/"));

      if (item && !tabs.some((t) => t.path === item.path)) tabs.push(item);
    }

    if (!tabs.length) return links.slice(0, 4);
    return tabs.slice(0, 4);
  }, [links, role]);

  const desktopMoreItems = useMemo(() => {
    const primaryPaths = new Set(desktopPrimaryTabs.map((x) => x.path));
    return links.filter((l) => !primaryPaths.has(l.path));
  }, [links, desktopPrimaryTabs]);

  const Logo = (
    <img
      src="/logo_180x180.png"
      alt="Teranga"
      className="w-7 h-7 object-contain"
    />
  );

  const userInitial = (user?.firstName?.[0] || user?.email?.[0] || "?").toUpperCase();
  const userDisplay = user?.firstName || user?.email || "Utilisateur";

  if (!user && loading) return null;

  /* ============================================================================ */
  /* PUBLIC NAVBAR */
  /* ============================================================================ */
  if (!user && isPublic) {
    return (
      <nav className="bg-[#0E1628]/92 backdrop-blur-xl text-white border-b border-[#1E2A45] shadow-[0_10px_35px_rgba(0,0,0,0.35)] px-5 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link
            to="/"
            className="flex items-center gap-2 text-[#00C2FF] font-semibold tracking-wide text-[1.05rem]"
          >
            {Logo} Teranga
          </Link>

          <div className="flex gap-3 text-sm">
            <Link
              to="/login"
              className="transition-colors duration-200 text-slate-200 hover:text-white"
            >
              Connexion
            </Link>
            <Link
              to="/register"
              className="px-4 py-1.5 bg-[#00C2FF] rounded-md font-semibold transition-colors duration-200 hover:bg-[#00B0E6] text-[#0E1628]"
            >
              Inscription
            </Link>
          </div>
        </div>
      </nav>
    );
  }

  /* ============================================================================ */
  /* AUTH NAVBAR (Enterprise) */
  /* ============================================================================ */
  return (
    <>
      {/* TOP BAR */}
      <nav className="bg-[#0E1628]/92 backdrop-blur-xl text-white border-b border-[#1E2A45] shadow-[0_10px_35px_rgba(0,0,0,0.35)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          {/* LEFT: Logo + Context */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/"
              className="flex items-center gap-2 text-[#00C2FF] font-semibold tracking-wide text-[1.05rem] shrink-0"
            >
              {Logo} Teranga
            </Link>

            {/* Page context (desktop) */}
            <div className="hidden md:flex flex-col min-w-0">
              <div className="text-sm font-semibold text-white/95 truncate">
                {activeLabel || "Tableau de bord"}
              </div>

              {/* ✅ Lisibilité renforcée */}
              <div className="text-[0.72rem] text-slate-200/90 truncate">
                {prettyRoleLabel(user)}
              </div>
            </div>
          </div>

          {/* CENTER: Desktop nav tabs */}
          <div className="hidden md:flex items-center gap-1">
            {desktopPrimaryTabs.map((l) => {
              const active = isActive(l.path);
              return (
                <Link
                  key={l.path}
                  to={l.path}
                  className={[
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition",
                    "focus:outline-none focus:ring-4 focus:ring-blue-100/20",
                    active
                      ? "bg-[#111A2E] text-[#00C2FF] shadow-[0_0_18px_rgba(0,194,255,0.14)]"
                      : "text-slate-200 hover:text-white hover:bg-[#111A2E]/70",
                  ].join(" ")}
                  aria-current={active ? "page" : undefined}
                >
                  {l.label}
                </Link>
              );
            })}

            {/* Desktop More */}
            <div className="relative">
              <button
                onClick={() => setOpenDesktopMore((v) => !v)}
                className={[
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition inline-flex items-center gap-1.5",
                  "focus:outline-none focus:ring-4 focus:ring-blue-100/20",
                  openDesktopMore
                    ? "bg-[#111A2E] text-[#00C2FF]"
                    : "text-slate-200 hover:text-white hover:bg-[#111A2E]/70",
                ].join(" ")}
                aria-expanded={openDesktopMore}
                aria-controls="desktop-more-menu"
              >
                Plus{" "}
                <ChevronDown
                  size={16}
                  className={openDesktopMore ? "opacity-100" : "opacity-90"}
                />
              </button>

              <AnimatePresence>
                {openDesktopMore && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.55 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-40"
                      onClick={() => setOpenDesktopMore(false)}
                      aria-hidden="true"
                    />
                    <motion.div
                      id="desktop-more-menu"
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ duration: 0.16 }}
                      className="absolute right-0 mt-2 z-50 w-[320px] overflow-hidden rounded-2xl border border-[#1E2A45] bg-[#0E1628]/95 backdrop-blur-2xl shadow-2xl"
                      role="menu"
                      aria-label="Menu Plus"
                    >
                      {/* Quick Scope */}
                      <div className="px-4 py-3 border-b border-[#1E2A45] bg-[#111A2E]">
                        <div className="text-[0.72rem] text-slate-200/90 mb-1">
                          Périmètre
                        </div>
                        <GeoSelector />
                      </div>

                      <div className="max-h-[420px] overflow-y-auto py-2">
                        {sections.map((sec) => (
                          <div key={sec.title} className="py-1">
                            {/* ✅ Titre section lisible */}
                            <div className="px-4 py-1.5 text-[0.65rem] uppercase tracking-widest text-slate-300/80">
                              {sec.title}
                            </div>

                            {sec.items
                              .filter(
                                (it) =>
                                  desktopMoreItems.some((x) => x.path === it.path) ||
                                  !desktopPrimaryTabs.some((x) => x.path === it.path)
                              )
                              .map((l) => {
                                if (desktopPrimaryTabs.some((t) => t.path === l.path))
                                  return null;

                                const active = isActive(l.path);
                                const Icon = iconForPath(l.path);

                                return (
                                  <Link
                                    key={l.path}
                                    to={l.path}
                                    onClick={() => setOpenDesktopMore(false)}
                                    className={[
                                      "mx-2 my-1 flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                                      "focus:outline-none focus:ring-4 focus:ring-blue-100/20",
                                      active
                                        ? "bg-[#111A2E] text-[#00C2FF] font-semibold"
                                        : "text-slate-200 hover:bg-[#111A2E]/70 hover:text-white",
                                    ].join(" ")}
                                    aria-current={active ? "page" : undefined}
                                    role="menuitem"
                                  >
                                    <span
                                      className={
                                        active ? "text-[#00C2FF]" : "text-slate-200"
                                      }
                                    >
                                      <Icon size={16} />
                                    </span>
                                    <span className="flex-1">{l.label}</span>
                                    {active ? (
                                      <Check size={16} className="text-[#00C2FF]" />
                                    ) : null}
                                  </Link>
                                );
                              })}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* RIGHT: Geo (desktop) + User menu */}
          <div className="hidden md:flex items-center gap-3">
            {/* keep GeoSelector here for enterprise */}
            <div className="hidden lg:flex items-center">
              <GeoSelector />
            </div>

            {/* Role badge (more readable) */}
            <span className="hidden lg:inline bg-[#111A2E] border border-[#1E2A45] px-3 py-1 rounded-full text-[0.7rem] uppercase tracking-wide text-slate-200">
              {prettyRoleLabel(user)}
            </span>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setOpenUserMenu((v) => !v)}
                className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-[#111A2E]/70 transition focus:outline-none focus:ring-4 focus:ring-blue-100/20"
                aria-expanded={openUserMenu}
                aria-controls="user-menu"
                aria-label="Menu utilisateur"
              >
                <div className="relative">
                  <div className="w-9 h-9 bg-gradient-to-br from-[#00C2FF] to-[#0099CC] rounded-full flex items-center justify-center text-white font-semibold">
                    {userInitial}
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-[#0E1628]" />
                </div>

                {/* ✅ Email supprimé: nom uniquement */}
                <div className="hidden lg:flex items-center">
                  <div className="text-sm font-semibold text-slate-200 max-w-[180px] truncate">
                    {userDisplay}
                  </div>
                </div>

                <ChevronDown
                  size={16}
                  className={openUserMenu ? "text-[#00C2FF]" : "text-slate-200"}
                />
              </button>

              <AnimatePresence>
                {openUserMenu && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.55 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-40"
                      onClick={() => setOpenUserMenu(false)}
                      aria-hidden="true"
                    />
                    <motion.div
                      id="user-menu"
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ duration: 0.16 }}
                      className="absolute right-0 mt-2 z-50 w-[280px] overflow-hidden rounded-2xl border border-[#1E2A45] bg-[#0E1628]/95 backdrop-blur-2xl shadow-2xl"
                      role="menu"
                      aria-label="Menu utilisateur"
                    >
                      <div className="px-4 py-3 border-b border-[#1E2A45] bg-[#111A2E]">
                        <div className="text-white text-sm font-semibold tracking-wide truncate">
                          {userDisplay}
                        </div>
                        <div className="text-slate-200/90 text-[0.75rem] truncate">
                          {prettyRoleLabel(user)}
                        </div>
                      </div>

                      <div className="py-2">
                        <button
                          type="button"
                          className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-[#111A2E]/70 hover:text-white transition"
                          disabled
                          aria-disabled="true"
                          title="Bientôt disponible"
                        >
                          Paramètres (bientôt)
                        </button>
                        <button
                          type="button"
                          className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-[#111A2E]/70 hover:text-white transition"
                          disabled
                          aria-disabled="true"
                          title="Bientôt disponible"
                        >
                          Aide & Support (bientôt)
                        </button>
                      </div>

                      <div className="border-t border-[#1E2A45]" />

                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-red-600 text-white text-sm font-semibold transition-colors duration-200 hover:bg-red-700"
                        aria-label="Déconnexion"
                      >
                        <LogOut size={16} />
                        Déconnexion
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* MOBILE: top button */}
          <button
            onClick={() => setOpenMore((v) => !v)}
            className="md:hidden inline-flex items-center justify-center rounded-xl px-3 py-2 border border-[#1E2A45] bg-[#111A2E]/70 text-slate-200 hover:text-white hover:bg-[#111A2E] transition focus:outline-none focus:ring-4 focus:ring-blue-100/20"
            aria-expanded={openMore}
            aria-controls="navbar-more-panel"
            aria-label="Ouvrir le menu"
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
      </nav>

      {/* ======================================================================== */}
      {/* BOTTOM NAV — MOBILE ONLY (COMPACT) */}
      {/* ======================================================================== */}
      <nav
        className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-transparent"
        aria-label="Navigation basse"
      >
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
                    className={[
                      "flex-1 flex flex-col items-center py-1 rounded-lg text-[0.7rem] transition",
                      "focus:outline-none focus:ring-4 focus:ring-blue-100/20",
                      active
                        ? "bg-[#111A2E] text-[#00C2FF] shadow-[0_0_14px_rgba(0,194,255,0.22)] scale-[1.02]"
                        : "text-slate-200 hover:bg-[#111A2E]/60 hover:text-white",
                    ].join(" ")}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon
                      size={17}
                      className={active ? "text-[#00C2FF]" : "text-slate-200"}
                    />
                    {item.label}
                  </Link>
                );
              })}

              {/* BUTTON PLUS */}
              <button
                onClick={() => setOpenMore((v) => !v)}
                className={[
                  "flex-1 flex flex-col items-center py-1 rounded-lg text-[0.7rem] transition",
                  "focus:outline-none focus:ring-4 focus:ring-blue-100/20",
                  openMore
                    ? "bg-[#111A2E] text-[#00C2FF] shadow-[0_0_14px_rgba(0,194,255,0.22)]"
                    : "text-slate-200 hover:bg-[#111A2E]/60 hover:text-white",
                ].join(" ")}
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
      {/* PANEL PLUS — MOBILE (Organisé par sections) */}
      {/* ======================================================================== */}
      <AnimatePresence>
        {openMore && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.65 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 z-40"
              onClick={() => setOpenMore(false)}
              aria-hidden="true"
            />

            <motion.div
              id="navbar-more-panel"
              initial={{ opacity: 0, y: 80 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 80 }}
              transition={{ duration: 0.24 }}
              className="fixed bottom-24 inset-x-0 z-50 flex justify-center px-4"
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
            >
              <div className="w-full max-w-sm bg-[#0E1628]/95 backdrop-blur-2xl border border-[#1E2A45] rounded-2xl shadow-2xl overflow-hidden">
                {/* HEADER */}
                <div className="px-4 py-3 border-b border-[#1E2A45] flex justify-between items-center bg-[#111A2E]">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="relative">
                      <div className="w-9 h-9 bg-gradient-to-br from-[#00C2FF] to-[#0099CC] rounded-full flex items-center justify-center text-white font-semibold">
                        {userInitial}
                      </div>
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-[#0E1628]" />
                    </div>

                    <div className="min-w-0">
                      <div className="text-white text-sm font-semibold tracking-wide truncate">
                        {userDisplay}
                      </div>
                      <div className="text-slate-200/90 text-[0.7rem] uppercase tracking-wide truncate">
                        {prettyRoleLabel(user)}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setOpenMore(false)}
                    className="p-1.5 rounded-full bg-[#111A2E] text-slate-200 transition-colors duration-200 hover:bg-[#1E2A45] focus:outline-none focus:ring-4 focus:ring-blue-100/20"
                    aria-label="Fermer le menu"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* GEO SELECTOR */}
                <div className="px-4 py-3 border-b border-[#1E2A45]">
                  <div className="text-xs text-slate-200/90 mb-2">Périmètre</div>
                  <GeoSelector />
                </div>

                {/* LINKS (grouped) */}
                <div className="max-h-72 overflow-y-auto py-2">
                  {sections.map((sec) => (
                    <div key={sec.title} className="py-1">
                      <div className="px-4 py-2 text-[0.65rem] uppercase tracking-widest text-slate-300/80">
                        {sec.title}
                      </div>

                      {sec.items.map((l) => {
                        const active = isActive(l.path);
                        const Icon = iconForPath(l.path);

                        return (
                          <Link
                            key={l.path}
                            to={l.path}
                            onClick={() => setOpenMore(false)}
                            className={[
                              "mx-2 my-1 flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                              "focus:outline-none focus:ring-4 focus:ring-blue-100/20",
                              active
                                ? "bg-[#111A2E] text-[#00C2FF] font-semibold"
                                : "text-slate-200 hover:bg-[#111A2E]/70 hover:text-white",
                            ].join(" ")}
                            aria-current={active ? "page" : undefined}
                          >
                            <span className={active ? "text-[#00C2FF]" : "text-slate-200"}>
                              <Icon size={16} />
                            </span>
                            <span className="flex-1">{l.label}</span>
                            {active ? <Check size={16} className="text-[#00C2FF]" /> : null}
                          </Link>
                        );
                      })}
                    </div>
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
