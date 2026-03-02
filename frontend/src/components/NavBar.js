// ============================================================================
// NavBar.jsx Aaa Enterprise SaaS (Stripe/Revolut/Notion vibe)
// - MAAame structure/logic routes/roles (zAAro rAAgression)
// - Desktop: Tabs principaux + menu "Plus" + User menu (avatar dropdown)
// - Mobile: Bottom nav compact + "Plus" panel (organisAA par sections)
// - Admin Onboarding visible uniquement ADMIN GLOBAL (pas Master)
// ============================================================================
//
// AAa Fix UI:
// - LisibilitAA renforcAAe dans tous les AAtats (idle / hover / actif / focus)
// - Suppression des couleurs hex hardcodAAes -> tokens (surface/text/border/primary)
// - Aucune fonctionnalitAA supprimAAe
// ============================================================================

import { useEffect, useState, useCallback, useMemo, memo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { me, logout, getLocalUser, getToken, hasSessionHint } from "../services/auth";
import { normalizeRole } from "../utils/roles";
import { useTranslation } from "react-i18next";
import {
  getNotificationSummary,
  markAllNotificationsRead,
} from "../services/notifications";

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
  LifeBuoy,
  Settings,
  FileText,
  BookOpenCheck,
  Lock,
  ChevronDown,
  ChevronRight,
  Check,
  Bell,
} from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";
import GeoSelector from "./GeoSelector";
import LanguageSwitcher from "./LanguageSwitcher";

const delay = (ms) => new Promise((res) => setTimeout(res, ms));
const AUTH_STORAGE_MODE = (process.env.REACT_APP_AUTH_STORAGE || "localstorage")
  .toLowerCase()
  .trim();
const USES_COOKIE_AUTH = AUTH_STORAGE_MODE === "cookie";

/* ============================================================================ */
/* LINKS */
/* ============================================================================ */

const COMMON_COMMERCE = [
  { path: "/shop", labelKey: "nav.products" },
  { path: "/orders", labelKey: "nav.orders" },
];

// AAa Admin-only onboarding link (GLOBAL ADMIN ONLY)
const ADMIN_ONBOARDING_LINK = {
  path: "/admin/onboarding",
  labelKey: "nav.master",
};

const ACCOUNT_SECURITY_LINK = {
  path: "/account/security",
  labelKey: "nav.security",
};
const SETTINGS_LINK = {
  path: "/settings",
  labelKey: "nav.settings",
};
const HELP_SUPPORT_LINK = {
  path: "/help-support",
  labelKey: "nav.helpSupport",
};
const PRIVACY_LINK = {
  path: "/privacy",
  labelKey: "nav.privacy",
};
const TERMS_LINK = {
  path: "/terms",
  labelKey: "nav.terms",
};
const LEGAL_LINK = {
  path: "/legal",
  labelKey: "nav.legal",
};
const ACCOUNT_LINK_PATHS = new Set([
  SETTINGS_LINK.path,
  ACCOUNT_SECURITY_LINK.path,
  HELP_SUPPORT_LINK.path,
  PRIVACY_LINK.path,
  TERMS_LINK.path,
  LEGAL_LINK.path,
]);

const ROLE_LINKS = {
  client: [
    { path: "/dashboard", labelKey: "nav.dashboard" },
    { path: "/notifications", labelKey: "nav.notifications" },
    { path: "/activities", labelKey: "nav.activities" },
    { path: "/projects", labelKey: "nav.projects" },
    { path: "/properties", labelKey: "nav.properties" },
    { path: "/services", labelKey: "nav.services" },
    { path: "/tasks", labelKey: "nav.tasks" },
    { path: "/transactions", labelKey: "nav.transactions" },
    { path: "/finance", labelKey: "nav.finance" },
    ...COMMON_COMMERCE,
    SETTINGS_LINK,
    ACCOUNT_SECURITY_LINK,
    HELP_SUPPORT_LINK,
    PRIVACY_LINK,
    TERMS_LINK,
    LEGAL_LINK,
  ],
  agent: [
    { path: "/dashboard", labelKey: "nav.dashboard" },
    { path: "/notifications", labelKey: "nav.notifications" },
    { path: "/activities", labelKey: "nav.activities" },
    { path: "/projects", labelKey: "nav.projects" },
    { path: "/agent/services", labelKey: "nav.services" },
    { path: "/tasks", labelKey: "nav.tasks" },
    { path: "/transactions", labelKey: "nav.transactions" },
    { path: "/finance", labelKey: "nav.finance" },
    ...COMMON_COMMERCE,
    SETTINGS_LINK,
    ACCOUNT_SECURITY_LINK,
    HELP_SUPPORT_LINK,
    PRIVACY_LINK,
    TERMS_LINK,
    LEGAL_LINK,
  ],
  admin: [
    { path: "/dashboard", labelKey: "nav.dashboard" },
    { path: "/notifications", labelKey: "nav.notifications" },
    { path: "/activities", labelKey: "nav.activities" },
    { path: "/projects", labelKey: "nav.projects" },
    { path: "/admin/projects", labelKey: "nav.adminProjects" },

 // Onboarding injectAA dynamiquement uniquement admin global

    { path: "/services", labelKey: "nav.services" },
    { path: "/tasks", labelKey: "nav.tasks" },
    { path: "/admin/services", labelKey: "nav.adminServices" },
    { path: "/admin/metrics", labelKey: "nav.metrics" },
    { path: "/admin/agents", labelKey: "nav.agents" },
    { path: "/admin/users", labelKey: "nav.users" },
    { path: "/admin/properties", labelKey: "nav.clientProperties" },
    { path: "/transactions", labelKey: "nav.transactions" },
    { path: "/finance", labelKey: "nav.finance" },
    ...COMMON_COMMERCE,
    SETTINGS_LINK,
    ACCOUNT_SECURITY_LINK,
    HELP_SUPPORT_LINK,
    PRIVACY_LINK,
    TERMS_LINK,
    LEGAL_LINK,
    { path: "/admin/catalog/categories", labelKey: "nav.categories" },
    { path: "/admin/catalog/products", labelKey: "nav.products" },
  ],
};

/* ============================================================================ */
/* BOTTOM LINKS Aaa MOBILE ONLY (COMPACT) */
/* ============================================================================ */

const BOTTOM_LINKS = {
  client: [
    { key: "dashboard", path: "/dashboard", labelKey: "nav.home", icon: Home },
    { key: "services", path: "/services", labelKey: "nav.services", icon: Wrench },
    { key: "transactions", path: "/transactions", labelKey: "nav.flow", icon: ReceiptEuro },
  ],
  agent: [
    { key: "dashboard", path: "/dashboard", labelKey: "nav.home", icon: Home },
    { key: "agentServices", path: "/agent/services", labelKey: "nav.services", icon: Wrench },
    { key: "transactions", path: "/transactions", labelKey: "nav.flow", icon: ReceiptEuro },
  ],
  admin: [
    { key: "dashboard", path: "/dashboard", labelKey: "nav.home", icon: Home },
    { key: "adminServices", path: "/admin/services", labelKey: "nav.services", icon: BarChart3 },
    { key: "finance", path: "/finance", labelKey: "nav.finance", icon: CreditCard },
  ],
};

/* ============================================================================ */
/* ICON MAP (just UI, no functional impact) */
/* ============================================================================ */

const ICON_BY_PATH_PREFIX = [
  { prefix: "/dashboard", icon: LayoutDashboard },
  { prefix: "/notifications", icon: Bell },
  { prefix: "/activities", icon: BarChart3 },
  { prefix: "/projects", icon: FolderKanban },
  { prefix: "/properties", icon: Building2 },
  { prefix: "/services", icon: Wrench },
  { prefix: "/agent/services", icon: Wrench },
  { prefix: "/tasks", icon: ClipboardList },
  { prefix: "/transactions", icon: ReceiptEuro },
  { prefix: "/finance", icon: CreditCard },
  { prefix: "/settings", icon: Settings },
  { prefix: "/account/security", icon: ShieldCheck },
  { prefix: "/help-support", icon: LifeBuoy },
  { prefix: "/privacy", icon: Lock },
  { prefix: "/terms", icon: BookOpenCheck },
  { prefix: "/legal", icon: FileText },

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

const TEXT_ONLY_PATHS = new Set(["/admin/onboarding"]);

function iconForPath(path) {
  if (TEXT_ONLY_PATHS.has(path)) return null;
  const found = ICON_BY_PATH_PREFIX.find(
    (x) => path === x.prefix || path.startsWith(x.prefix + "/")
  );
  return found?.icon || MoreHorizontal;
}

/* ============================================================================ */
/* GROUPING Aaa Enterprise information architecture (UI only) */
/* ============================================================================ */

function buildSections(role, links, t) {
  const sections = [];

  const pushSection = (title, items) => {
    const clean = items.filter(Boolean);
    if (clean.length) sections.push({ title, items: clean });
  };

  const byPath = (p) => links.find((x) => x.path === p);
  const byPrefix = (prefix) =>
    links.filter((x) => x.path === prefix || x.path.startsWith(prefix + "/"));

  pushSection(t("nav.sections.essential"), [
    byPath("/dashboard"),
    byPath("/notifications"),
    byPath("/activities"),
    ...byPrefix("/projects"),
    ...byPrefix("/properties"),
    ...byPrefix("/services"),
    ...byPrefix("/tasks"),
  ]);

  pushSection(t("nav.sections.finance"), [
    ...byPrefix("/transactions"),
    ...byPrefix("/finance"),
  ]);

  pushSection(t("nav.sections.shop"), [...byPrefix("/shop"), ...byPrefix("/orders")]);

  if (role === "admin") {
    pushSection(t("nav.sections.admin"), [
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
/* SHARED CLASS HELPERS (Enterprise states) */
/* ============================================================================ */

const clsTabBase =
  "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition " +
  "border border-transparent focus:outline-none focus:ring-4 focus:ring-primary/10";

const clsTabInactive =
  "text-text-secondary hover:text-text-primary hover:bg-surface-main/70 hover:border-border/60 hover:shadow-[0_6px_20px_-16px_rgba(15,23,42,0.35)]";

const clsTabActive =
  "bg-primary/10 text-primary border border-border shadow-sm";

const clsMenuSurface =
  "overflow-hidden rounded-2xl border border-border/70 bg-surface-card/95 backdrop-blur-2xl shadow-2xl";

const clsMenuItemBase =
  "group mx-1.5 my-1 flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm transition-all duration-150 " +
  "focus:outline-none focus:ring-4 focus:ring-primary/10";

const clsMenuItemInactive =
  "text-text-secondary hover:bg-surface-main/70 hover:text-text-primary hover:border-border/60";

const clsMenuItemActive =
  "bg-primary/10 text-primary font-semibold border border-primary/15 shadow-sm";
const clsPanelSectionCard =
  "mx-2 my-1.5 rounded-2xl border border-border/60 bg-surface-main/25 p-1.5";
const clsPanelSectionTitle =
  "px-3 pt-1.5 pb-1 text-[0.62rem] uppercase tracking-[0.18em] text-text-muted";
const clsPanelIconChip =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-surface-card/80 transition-colors duration-150";
const clsSubSectionLabel =
  "px-4 pb-1 text-[0.65rem] uppercase tracking-[0.18em] text-text-muted";
const clsAccountCard =
  "group flex items-start gap-3 rounded-xl border border-border/70 bg-surface-main/40 px-3 py-3 " +
  "text-left transition-all duration-150 hover:bg-surface-main/70 hover:border-border " +
  "hover:shadow-[0_10px_22px_-18px_rgba(15,23,42,0.45)]";
const clsSessionRow =
  "group flex w-full items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2.5 " +
  "text-left transition-all duration-150 hover:bg-red-500/10 hover:border-red-500/30 " +
  "focus:outline-none focus:ring-4 focus:ring-red-500/10";

/* ============================================================================ */
/* COMPONENT */
/* ============================================================================ */

function NavBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(() => {
    const localUser = getLocalUser();
    if (USES_COOKIE_AUTH) return localUser || null;
    return getToken() ? localUser : null;
  });
  const [loading, setLoading] = useState(() => {
    const localUser = getLocalUser();
    if (USES_COOKIE_AUTH) return !localUser && hasSessionHint();
    return getToken() ? !localUser : false;
  });

  // Mobile "Plus"
  const [openMore, setOpenMore] = useState(false);

  // Desktop dropdowns
  const [openDesktopMore, setOpenDesktopMore] = useState(false);
  const [openUserMenu, setOpenUserMenu] = useState(false);
  const [notificationSummary, setNotificationSummary] = useState({
    unread: 0,
    byProgress: {},
  });
  const unreadCount = notificationSummary?.unread || 0;

  const loadNotificationSummary = useCallback(async () => {
    const hasSession = USES_COOKIE_AUTH
      ? Boolean(getLocalUser()) || hasSessionHint()
      : Boolean(getToken());
    if (!user || !hasSession) {
      setNotificationSummary({ unread: 0, byProgress: {} });
      return;
    }
    try {
      const data = await getNotificationSummary();
      setNotificationSummary({
        unread: data?.unread ?? 0,
        byProgress: data?.byProgress || {},
      });
    } catch (e) {
      const status = e?.response?.status;
      const isTimeout = e?.code === "ECONNABORTED";
      const isNetwork = !e?.response;
      if (status !== 401 && !isTimeout && !isNetwork) {
        console.error("AAA notifications summary:", e);
      }
      setNotificationSummary((prev) => prev || { unread: 0, byProgress: {} });
    }
  }, [user]);

  const handleOpenNotifications = useCallback(async () => {
    if (!unreadCount) return;
    setNotificationSummary((prev) => ({
      ...(prev || {}),
      unread: 0,
    }));
    try {
      await markAllNotificationsRead();
    } catch (e) {
      console.error("AAA mark all notifications read:", e);
    } finally {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("notifications:refresh"));
      }
    }
  }, [unreadCount]);

  /* LOAD USER (unchanged logic) */
  useEffect(() => {
    let active = true;

    async function load() {
      const token = getToken();
      const localUser = getLocalUser();
      const hasSession = USES_COOKIE_AUTH
        ? Boolean(localUser) || hasSessionHint()
        : Boolean(token);

      if (!hasSession) {
        if (active) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const res = await me();
        if (!active) return;
        const stillHasSession = USES_COOKIE_AUTH
          ? Boolean(getLocalUser()) || hasSessionHint()
          : Boolean(getToken());

        if (res?.offline && !stillHasSession) {
          setUser(null);
        } else {
          setUser(res?.user || null);
        }
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

  useEffect(() => {
    function onAuthChanged() {
      const localUser = getLocalUser();
      const hasSession = USES_COOKIE_AUTH
        ? Boolean(localUser) || hasSessionHint()
        : Boolean(getToken());
      setUser(hasSession ? localUser || null : null);
      setLoading(false);
    }

    window.addEventListener("teranga_auth_changed", onAuthChanged);
    return () => window.removeEventListener("teranga_auth_changed", onAuthChanged);
  }, []);

  useEffect(() => {
    if (!user) return;
    loadNotificationSummary();
  }, [user, location.pathname, loadNotificationSummary]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      loadNotificationSummary();
    }, 8000);
    return () => clearInterval(interval);
  }, [user, loadNotificationSummary]);

  useEffect(() => {
    function onRefresh() {
      loadNotificationSummary();
    }
    window.addEventListener("notifications:refresh", onRefresh);
    return () => window.removeEventListener("notifications:refresh", onRefresh);
  }, [loadNotificationSummary]);

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
    await logout();
    navigate("/login", { replace: true });
  }, [navigate]);

  const PUBLIC = [
    "/",
    "/login",
    "/register",
    "/shop",
    "/products",
  ];
  const isPublic = PUBLIC.some((p) => location.pathname.startsWith(p));

  const role = normalizeRole(user?.role);

 // AAa DAAtection ADMIN GLOBAL vs MASTER (admin scopAA)
  const isAdmin = role === "admin";
  const isGlobalAdmin = useMemo(() => {
    if (!isAdmin) return false;
    const hasCountryScope = Boolean(user?.countryId);
    const hasRegionScope = Boolean(user?.regionId);
    return !hasCountryScope && !hasRegionScope;
  }, [isAdmin, user?.countryId, user?.regionId]);

  const roleLabel = useMemo(() => {
    if (!user) return "";
    if (isAdmin && !isGlobalAdmin) return t("roles.master");
    if (role === "admin") return t("roles.admin");
    if (role === "agent") return t("roles.agent");
    return t("roles.client");
  }, [user, isAdmin, isGlobalAdmin, role, t]);


 // AAa Links de rAA le (inject onboarding uniquement pour admin global)
  const links = useMemo(() => {
    const base = ROLE_LINKS[role] || [];
    let out = base;

    if (role === "admin" && isGlobalAdmin) {
      const already = base.some((x) => x.path === ADMIN_ONBOARDING_LINK.path);
      if (!already) {
        out = [...base];
        const insertAfterPath = "/admin/projects";
        const idx = out.findIndex((x) => x.path === insertAfterPath);
        if (idx >= 0) out.splice(idx + 1, 0, ADMIN_ONBOARDING_LINK);
        else out.unshift(ADMIN_ONBOARDING_LINK);
      }
    }

    if (role === "admin" && !isGlobalAdmin) {
      out = out.filter((item) => item.path !== "/admin/metrics");
    }

    return out.map((item) => ({ ...item, label: t(item.labelKey) }));
  }, [isGlobalAdmin, role, t]);

  const bottomLinks = useMemo(() => {
    let base = BOTTOM_LINKS[role] || [];

    if (role === "admin") {
      base = base.map((item) =>
        item.path === "/admin/services"
          ? {
              ...item,
              key: "services",
              path: "/services",
              labelKey: "nav.services",
              icon: Wrench,
            }
          : item
      );
    }

    return base.map((item) => ({
      ...item,
      label: t(item.labelKey),
    }));
  }, [role, t]);

  const isActive = useCallback(
    (path) => {
      if (!path) return false;
      if (path === "/") return location.pathname === "/";
      return location.pathname === path || location.pathname.startsWith(path + "/");
    },
    [location.pathname]
  );

  const activeLabel = useMemo(() => {
    const current = links.find((l) => isActive(l.path));
    return current?.label || "";
  }, [links, isActive]);

  const sections = useMemo(() => buildSections(role, links, t), [role, links, t]);
  const mobileSections = useMemo(
    () =>
      sections
        .map((sec) => ({
          ...sec,
          items: sec.items.filter((it) => !ACCOUNT_LINK_PATHS.has(it.path)),
        }))
        .filter((sec) => sec.items.length > 0),
    [sections]
  );

  const servicePrimaryPath = useMemo(() => {
    if (role === "agent") return "/agent/services";
    if (role === "admin") return "/services";
    return "/services";
  }, [role]);

  // Desktop: tabs primaires (calme). Le reste -> Plus.
  const desktopPrimaryTabs = useMemo(() => {
    const candidates =
      role === "admin" && isGlobalAdmin
        ? ["/dashboard", "/services"]
        : ["/dashboard", servicePrimaryPath, "/tasks"];

    const tabs = [];
    for (const p of candidates) {
      const item =
        links.find((x) => x.path === p) ||
        links.find((x) => x.path.startsWith(p + "/"));

      if (item && !tabs.some((t) => t.path === item.path)) tabs.push(item);
    }

    if (!tabs.length) return links.slice(0, 4);
    return tabs.slice(0, 4);
  }, [links, role, isGlobalAdmin, servicePrimaryPath]);

  const desktopMoreItems = useMemo(() => {
    const primaryPaths = new Set(desktopPrimaryTabs.map((x) => x.path));
    return links.filter(
      (l) => !primaryPaths.has(l.path) && !ACCOUNT_LINK_PATHS.has(l.path)
    );
  }, [links, desktopPrimaryTabs]);

  const desktopMoreSections = useMemo(() => {
    const allowed = new Set(desktopMoreItems.map((x) => x.path));
    return sections
      .map((sec) => ({
        ...sec,
        items: sec.items.filter((it) => allowed.has(it.path)),
      }))
      .filter((sec) => sec.items.length > 0);
  }, [sections, desktopMoreItems]);

  const Logo = (
    <img
      src="/logo_180x180.png"
      alt="Teranga"
      className="w-7 h-7 object-contain"
    />
  );

  const userDisplay = useMemo(() => {
    const first = (user?.firstName || "").trim();
    const last = (user?.lastName || "").trim();
    const full = [first, last].filter(Boolean).join(" ").trim();
    return full || user?.email || t("nav.userFallback");
  }, [user?.email, user?.firstName, user?.lastName, t]);

  const userInitial = useMemo(() => {
    const first = (user?.firstName || "").trim();
    const last = (user?.lastName || "").trim();
    const base = first || last || user?.email || "?";
    const initial = String(base).trim().charAt(0);
    return (initial || "?").toUpperCase();
  }, [user?.email, user?.firstName, user?.lastName]);

  const NotificationBell = (
    <Link
      to="/notifications"
      onClick={handleOpenNotifications}
      className="relative inline-flex items-center justify-center w-10 h-10 rounded-2xl border border-border/60 bg-surface-main/40 hover:bg-surface-main/70 transition focus:outline-none focus:ring-4 focus:ring-primary/10"
      aria-label={t("nav.notifications")}
      title={t("nav.notifications")}
    >
      <Bell size={18} className="text-text-secondary" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[0.65rem] font-semibold flex items-center justify-center">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );

  if (!user && loading) return null;

  /* ============================================================================ */
  /* PUBLIC NAVBAR */
  /* ============================================================================ */
  if (!user && isPublic) {
    return (
      <nav className="sticky top-0 z-50 border-b border-border/70 bg-gradient-to-r from-surface-card/95 via-surface-card/90 to-surface-main/90 backdrop-blur-2xl shadow-[0_10px_30px_-20px_rgba(15,23,42,0.45)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-3">
          <Link
            to="/"
            className="min-w-0 shrink flex items-center gap-2 text-primary font-semibold tracking-wide text-[1.05rem]"
          >
            {Logo}
            <span className="truncate max-[440px]:hidden">Teranga</span>
          </Link>

          <div className="shrink-0 flex items-center justify-end gap-1.5 sm:gap-3 text-xs sm:text-sm">
            <LanguageSwitcher compact className="shrink-0" />
            <Link
              to="/login"
              className="whitespace-nowrap transition-colors duration-200 text-text-secondary hover:text-text-primary"
            >
              {t("nav.login")}
            </Link>
            <Link
              to="/register"
              className="whitespace-nowrap px-2.5 py-1.5 sm:px-4 sm:py-2 bg-primary text-white rounded-lg sm:rounded-xl font-semibold transition-colors duration-200 hover:bg-primary/90"
            >
              {t("nav.register")}
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
      <nav className="sticky top-0 z-50 border-b border-border/70 bg-gradient-to-r from-surface-card/95 via-surface-card/90 to-surface-main/90 backdrop-blur-2xl shadow-[0_10px_30px_-20px_rgba(15,23,42,0.45)]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* LEFT: Logo + Context */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/"
              className="flex items-center gap-2 text-primary font-semibold tracking-wide text-[1.05rem] shrink-0"
            >
              {Logo} Teranga
            </Link>

            {/* Page context (mobile) */}
            <div className="md:hidden flex items-center min-w-0">
              <span className="px-2.5 py-1 rounded-full text-[0.65rem] font-semibold bg-surface-main/60 text-text-secondary border border-border/60 truncate">
                {activeLabel || t("nav.dashboard")}
              </span>
            </div>

            {/* Page context (desktop) */}
            {!isGlobalAdmin && (
              <div className="hidden md:flex flex-col min-w-0 flex-shrink-0">
                <div className="text-sm font-semibold text-text-primary whitespace-nowrap">
                  {activeLabel || t("nav.dashboardTitle")}
                </div>
                <div className="text-[0.72rem] text-text-muted whitespace-nowrap">
                  {roleLabel}
                </div>
              </div>
            )}
          </div>

          {/* CENTER: Desktop nav tabs */}
          <div className="hidden md:flex flex-1 items-center justify-center gap-1">
            {desktopPrimaryTabs.map((l) => {
              const active = isActive(l.path);
              return (
                <Link
                  key={l.path}
                  to={l.path}
                  className={[clsTabBase, active ? clsTabActive : clsTabInactive].join(" ")}
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
                  clsTabBase,
                  openDesktopMore ? clsTabActive : clsTabInactive,
                  "inline-flex items-center gap-1.5",
                ].join(" ")}
                aria-expanded={openDesktopMore}
                aria-controls="desktop-more-menu"
              >
                {t("nav.more")} <ChevronDown size={16} className="opacity-90" />
              </button>

              <AnimatePresence>
                {openDesktopMore && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-40 bg-black/30"
                      onClick={() => setOpenDesktopMore(false)}
                      aria-hidden="true"
                    />
                    <motion.div
                      id="desktop-more-menu"
                      initial={{ opacity: 0, y: 8, scale: 0.985 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.985 }}
                      transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                      className={[
                        "absolute right-0 mt-2 z-50 w-[356px]",
                        clsMenuSurface,
                      ].join(" ")}
                      role="menu"
                      aria-label={t("nav.menuPlus")}
                    >
                      {/* Quick Scope */}
                      <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-surface-main/60 to-surface-card/30">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="text-[0.68rem] uppercase tracking-[0.18em] text-text-muted">
                            {t("nav.perimeter")}
                          </div>
                          <span className="text-[0.68rem] text-text-muted">
                            {t("nav.menuPlus")}
                          </span>
                        </div>

 {/* Encapsulation AaAEnterprise controlAaA */}
                        <div className="rounded-xl border border-border/70 bg-surface-card/85 px-3 py-2 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.4)]">
                          <GeoSelector />
                        </div>
                      </div>

                      <div className="max-h-[420px] overflow-y-auto py-2">
                        {desktopMoreSections.map((sec) => (
                          <div key={sec.title} className={clsPanelSectionCard}>
                            <div className={clsPanelSectionTitle}>
                              {sec.title}
                            </div>

                            {sec.items.map((l) => {
                              const active = isActive(l.path);
                              const Icon = iconForPath(l.path);

                              return (
                                <Link
                                  key={l.path}
                                  to={l.path}
                                  onClick={() => setOpenDesktopMore(false)}
                                  className={[
                                    clsMenuItemBase,
                                    active ? clsMenuItemActive : clsMenuItemInactive,
                                  ].join(" ")}
                                  aria-current={active ? "page" : undefined}
                                  role="menuitem"
                                >
                                  {Icon ? (
                                    <span
                                      className={[
                                        clsPanelIconChip,
                                        active
                                          ? "border-primary/20 bg-primary/10 text-primary"
                                          : "text-text-secondary group-hover:text-text-primary",
                                      ].join(" ")}
                                    >
                                      <Icon size={16} />
                                    </span>
                                  ) : null}
                                  <span className="flex-1">{l.label}</span>
                                  {active ? (
                                    <Check size={16} className="text-primary" />
                                  ) : (
                                    <ChevronRight
                                      size={15}
                                      className="text-text-muted transition-transform duration-150 group-hover:translate-x-0.5"
                                    />
                                  )}
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
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <LanguageSwitcher compact />
            {NotificationBell}
            <div className="hidden lg:flex items-center">
                <div className="rounded-xl border border-border bg-surface-main/50 px-3 py-2">
                  <GeoSelector />
                </div>
              </div>

            {/* Role badge */}
            <span className="hidden lg:inline rounded-full border border-border bg-surface-main/50 px-3 py-1 text-[0.75rem] uppercase tracking-wide text-text-secondary">
              {roleLabel}
            </span>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setOpenUserMenu((v) => !v)}
                className="flex items-center gap-2 rounded-2xl px-2 py-1.5 border border-border/60 bg-surface-main/40 hover:bg-surface-main/70 transition focus:outline-none focus:ring-4 focus:ring-primary/10"
                aria-expanded={openUserMenu}
                aria-controls="user-menu"
                aria-label={t("nav.userMenu")}
              >
                <div className="relative">
                  <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center text-white font-semibold">
                    {userInitial}
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-surface-card" />
                </div>

                <div className="hidden lg:flex items-center">
                  <div className="text-sm font-semibold text-text-primary max-w-[180px] truncate">
                    {userDisplay}
                  </div>
                </div>

                <ChevronDown size={16} className={openUserMenu ? "text-primary" : "text-text-secondary"} />
              </button>

              <AnimatePresence>
                {openUserMenu && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-40 bg-black/30"
                      onClick={() => setOpenUserMenu(false)}
                      aria-hidden="true"
                    />
                    <motion.div
                      id="user-menu"
                      initial={{ opacity: 0, y: 8, scale: 0.985 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.985 }}
                      transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                      className={["absolute right-0 mt-2 z-50 w-[312px]", clsMenuSurface].join(" ")}
                      role="menu"
                      aria-label={t("nav.userMenu")}
                    >
                      <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-surface-main/60 to-surface-card/30">
                        <div className="flex items-start gap-3">
                          <div className="relative shrink-0">
                            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-semibold shadow-sm">
                              {userInitial}
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-surface-card" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-text-primary text-sm font-semibold tracking-wide truncate">
                              {userDisplay}
                            </div>
                            {user?.email && user?.email !== userDisplay ? (
                              <div className="text-text-muted text-[0.72rem] truncate mt-0.5">
                                {user.email}
                              </div>
                            ) : null}
                            <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-surface-card/70 px-2 py-0.5 text-[0.68rem] uppercase tracking-wide text-text-muted">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              {roleLabel}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="px-3 py-3 space-y-3">
                        <div>
                          <div className={clsSubSectionLabel}>{t("nav.sections.account")}</div>
                          <Link
                            to="/settings"
                            onClick={() => setOpenUserMenu(false)}
                            className={clsAccountCard}
                            role="menuitem"
                          >
                            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors duration-150 group-hover:bg-primary/15">
                              <Settings size={16} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-text-primary">
                                {t("nav.settings")}
                              </span>
                              <span className="mt-0.5 block text-xs text-text-muted leading-relaxed">
                                {t("nav.settingsMenuHint")}
                              </span>
                            </span>
                            <span className="mt-1 text-text-muted transition-transform duration-150 group-hover:translate-x-0.5">
                              <ChevronRight size={15} />
                            </span>
                          </Link>
                        </div>

                        <div>
                          <div className={clsSubSectionLabel}>{t("nav.sections.session")}</div>
                          <button
                            onClick={handleLogout}
                            className={clsSessionRow}
                            aria-label={t("nav.logout")}
                            role="menuitem"
                          >
                            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-300 transition-colors duration-150 group-hover:bg-red-500/15">
                              <LogOut size={16} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-text-primary">
                                {t("nav.logout")}
                              </span>
                              <span className="block text-xs text-text-muted">
                                {t("nav.userMenu")}
                              </span>
                            </span>
                            <span className="text-red-500/80 transition-transform duration-150 group-hover:translate-x-0.5">
                              <ChevronRight size={15} />
                            </span>
                          </button>
                        </div>
                      </div>

                      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.14, delay: 0.02 }}
                        className="px-4 py-2.5 text-[0.7rem] text-text-muted bg-surface-main/20"
                      >
                        {t("nav.settingsMenuHintShort")}
                      </motion.div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* MOBILE: notifications shortcut */}
          <div className="md:hidden">{NotificationBell}</div>
        </div>
      </nav>

      {/* ======================================================================== */}
 {/* BOTTOM NAV Aaa MOBILE ONLY (COMPACT) */}
      {/* ======================================================================== */}
      <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-transparent" aria-label="Navigation basse">
        <div className="mx-auto w-full flex justify-center">
          <div className="w-full max-w-xs px-2 pb-2">
            <div className="bg-gradient-to-r from-surface-card/95 via-surface-card/90 to-surface-main/90 backdrop-blur-2xl border border-border/70 rounded-2xl shadow-[0_12px_35px_-25px_rgba(15,23,42,0.6)] flex px-1 py-1 gap-1">
              {bottomLinks.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);

                return (
                  <Link
                    key={item.key}
                    to={item.path}
                    className={[
                      "flex-1 flex flex-col items-center py-1.5 rounded-xl text-[0.75rem] transition",
                      "focus:outline-none focus:ring-4 focus:ring-primary/10",
                      active
                        ? "bg-primary/10 text-primary border border-border shadow-sm"
                        : "text-text-secondary hover:bg-surface-main/70 hover:text-text-primary",
                    ].join(" ")}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon size={17} className={active ? "text-primary" : "text-text-secondary"} />
                    {item.label}
                  </Link>
                );
              })}

              {/* BUTTON PLUS */}
              <button
                onClick={() => setOpenMore((v) => !v)}
                className={[
                  "flex-1 flex flex-col items-center py-1.5 rounded-xl text-[0.75rem] transition",
                  "focus:outline-none focus:ring-4 focus:ring-primary/10",
                  openMore
                    ? "bg-primary/10 text-primary border border-border shadow-sm"
                    : "text-text-secondary hover:bg-surface-main/70 hover:text-text-primary",
                ].join(" ")}
                aria-expanded={openMore}
                aria-controls="navbar-more-panel"
                aria-label={t("nav.openMoreMenu")}
              >
                <MoreHorizontal size={17} />
                {t("nav.more")}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ======================================================================== */}
 {/* PANEL PLUS Aaa MOBILE (OrganisAA par sections) */}
      {/* ======================================================================== */}
      <AnimatePresence>
        {openMore && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setOpenMore(false)}
              aria-hidden="true"
            />

            <motion.div
              id="navbar-more-panel"
              initial={{ opacity: 0, y: 80 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 80 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="fixed bottom-24 inset-x-0 z-50 flex justify-center px-4"
              role="dialog"
              aria-modal="true"
              aria-label={t("nav.menu")}
            >
              <div className="w-full max-w-sm bg-surface-card/95 backdrop-blur-2xl border border-border/70 rounded-2xl shadow-2xl overflow-hidden">
                {/* HEADER */}
                <div className="px-4 py-3 border-b border-border flex justify-between items-center bg-gradient-to-r from-surface-main/60 to-surface-card/30">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="relative">
                      <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center text-white font-semibold">
                        {userInitial}
                      </div>
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-surface-card" />
                    </div>

                    <div className="min-w-0">
                      <div className="text-text-primary text-sm font-semibold tracking-wide truncate">
                        {userDisplay}
                      </div>
                      <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-surface-card/70 px-2 py-0.5 text-[0.68rem] uppercase tracking-wide text-text-muted">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {roleLabel}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setOpenMore(false)}
                    className="p-2 rounded-xl border border-border/70 bg-surface-card/80 text-text-secondary transition-colors duration-150 hover:bg-surface-main/70 hover:text-text-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                    aria-label={t("nav.closeMenu")}
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* GEO SELECTOR */}
                <div className="px-4 py-3 border-b border-border bg-surface-main/15">
                  <div className="text-[0.68rem] uppercase tracking-[0.18em] text-text-muted mb-2">
                    {t("nav.perimeter")}
                  </div>
                  <div className="rounded-xl border border-border/70 bg-surface-card/85 px-3 py-2 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.4)]">
                    <GeoSelector />
                  </div>
                </div>

                {/* LINKS (grouped) */}
                <div className="max-h-72 overflow-y-auto py-2">
                  {mobileSections.map((sec) => (
                    <div key={sec.title} className={clsPanelSectionCard}>
                      <div className={clsPanelSectionTitle}>
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
                              clsMenuItemBase,
                              active ? clsMenuItemActive : clsMenuItemInactive,
                            ].join(" ")}
                            aria-current={active ? "page" : undefined}
                          >
                            {Icon ? (
                              <span
                                className={[
                                  clsPanelIconChip,
                                  active
                                    ? "border-primary/20 bg-primary/10 text-primary"
                                    : "text-text-secondary group-hover:text-text-primary",
                                ].join(" ")}
                              >
                                <Icon size={16} />
                              </span>
                            ) : null}
                            <span className="flex-1">{l.label}</span>
                            {active ? (
                              <Check size={16} className="text-primary" />
                            ) : (
                              <ChevronRight
                                size={15}
                                className="text-text-muted transition-transform duration-150 group-hover:translate-x-0.5"
                              />
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                </div>

                <div className="border-t border-border bg-surface-main/30 px-4 py-3 space-y-3">
                  <div>
                    <div className={clsSubSectionLabel}>{t("nav.sections.account")}</div>
                    <Link
                      to="/settings"
                      onClick={() => setOpenMore(false)}
                      className={clsAccountCard}
                    >
                      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors duration-150 group-hover:bg-primary/15">
                        <Settings size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-text-primary">
                          {t("nav.settings")}
                        </span>
                        <span className="block text-xs text-text-muted leading-relaxed">
                          {t("nav.settingsMenuHintShort")}
                        </span>
                      </span>
                      <span className="mt-1 text-text-muted transition-transform duration-150 group-hover:translate-x-0.5">
                        <ChevronRight size={15} />
                      </span>
                    </Link>
                  </div>

                  <div>
                    <div className={clsSubSectionLabel}>{t("nav.sections.session")}</div>
                    <button
                      onClick={handleLogout}
                      className={clsSessionRow}
                      aria-label={t("nav.logout")}
                    >
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-300 transition-colors duration-150 group-hover:bg-red-500/15">
                        <LogOut size={15} />
                      </span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block text-sm font-semibold text-text-primary">
                          {t("nav.logout")}
                        </span>
                        <span className="block text-xs text-text-muted">
                          {roleLabel}
                        </span>
                      </span>
                      <span className="text-red-500/80 transition-transform duration-150 group-hover:translate-x-0.5">
                        <ChevronRight size={15} />
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default memo(NavBar);
