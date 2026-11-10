// ============================================================================
// Le centre ouvre le travail courant ; Gestion regroupe les outils administratifs.
// Ordre identique sur ordinateur et téléphone, droits de chaque route conservés.
// ============================================================================

import { useEffect, useRef, useState, useCallback, useMemo, memo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { me, logout, getLocalUser, getToken, hasSessionHint } from "../services/auth";
import { normalizeRole } from "../utils/roles";
import { useTranslation } from "react-i18next";
import {
  getNotificationSummary,
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
  Banknote,
  Briefcase,
  AlertTriangle,
  CarFront,
  CirclePlus,
  ListChecks,
  Bell,
  MapPin,
} from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";
import GeoSelector from "./GeoSelector";
import LanguageSwitcher from "./LanguageSwitcher";
import TopbarAccountMenu from "./TopbarAccountMenu";
import { preloadRoute } from "../utils/routePreload";
import { buildAuthFeedbackState } from "../utils/authFeedback";
import useFocusTrap from "../hooks/useFocusTrap";

const delay = (ms) => new Promise((res) => setTimeout(res, ms));
const AUTH_STORAGE_MODE = (process.env.REACT_APP_AUTH_STORAGE || "localstorage")
  .toLowerCase()
  .trim();
const USES_COOKIE_AUTH = AUTH_STORAGE_MODE === "cookie";
const NOTIFICATION_SUMMARY_POLL_MS = (() => {
  const raw = Number.parseInt(
    String(process.env.REACT_APP_NOTIFICATION_SUMMARY_POLL_MS || ""),
    10
  );
  if (!Number.isFinite(raw) || raw < 15000) return 60000;
  return raw;
})();

function isDocumentVisible() {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

/* ============================================================================ */
/* LINKS */
/* ============================================================================ */

const COMMON_COMMERCE = [
  { path: "/shop", labelKey: "nav.products" },
  { path: "/orders", labelKey: "nav.orders" },
];

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
    { path: "/operations", labelKey: "nav.home" },
    { path: "/dossiers", labelKey: "dossierHub.title" },
    { path: "/demandes/nouvelle", labelKey: "nav.newRequest" },
    { path: "/demandes", labelKey: "nav.myRequests", exact: true },
    { path: "/properties", labelKey: "propertySimple.mine" },
    { path: "/tasks", labelKey: "nav.interventions" },
    { path: "/transactions", labelKey: "clientHome.payments" },
    { path: "/shop", labelKey: "nav.products" },
    SETTINGS_LINK,
    ACCOUNT_SECURITY_LINK,
    HELP_SUPPORT_LINK,
    PRIVACY_LINK,
    TERMS_LINK,
    LEGAL_LINK,
  ],
  agent: [
    { path: "/operations", labelKey: "nav.home" },
    { path: "/projects", labelKey: "nav.projects" },
    { path: "/agent/services", labelKey: "roleViews.agentServices" },
    { path: "/missions/mine", labelKey: "roleViews.supervised" },
    { path: "/tasks", labelKey: "nav.interventions" },
    { path: "/transactions", labelKey: "financialWorkspace.title" },
    ...COMMON_COMMERCE,
    SETTINGS_LINK,
    ACCOUNT_SECURITY_LINK,
    HELP_SUPPORT_LINK,
    PRIVACY_LINK,
    TERMS_LINK,
    LEGAL_LINK,
  ],
  provider: [
    { path: "/operations", labelKey: "nav.home" },
    { path: "/prestataire/interventions", labelKey: "providerWorkspace.title" },
    SETTINGS_LINK,
    ACCOUNT_SECURITY_LINK,
    HELP_SUPPORT_LINK,
    PRIVACY_LINK,
    TERMS_LINK,
    LEGAL_LINK,
  ],
  admin: [
    { path: "/operations", labelKey: "nav.home" },
    { path: "/gestion", labelKey: "nav.management" },
    SETTINGS_LINK, ACCOUNT_SECURITY_LINK, HELP_SUPPORT_LINK, PRIVACY_LINK, TERMS_LINK, LEGAL_LINK,
  ],
};

/* ============================================================================ */
/* BOTTOM LINKS - MOBILE ONLY (COMPACT) */
/* ============================================================================ */

const BOTTOM_LINKS = {
  client: [
    { key: "operations", path: "/operations", labelKey: "nav.home", icon: ListChecks },
    { key: "requests", path: "/demandes", labelKey: "nav.myRequests", icon: ListChecks, exact: true },
    { key: "newRequest", path: "/demandes/nouvelle", labelKey: "nav.newRequest", icon: CirclePlus },
  ],
  agent: [
    { key: "operations", path: "/operations", labelKey: "nav.home", icon: ListChecks },
    { key: "agentServices", path: "/agent/services", labelKey: "roleViews.agentServices", icon: Wrench },
  ],
  provider: [
    { key: "operations", path: "/operations", labelKey: "nav.home", icon: ListChecks },
    { key: "interventions", path: "/prestataire/interventions", labelKey: "providerWorkspace.title", icon: Wrench },
  ],
  admin: [
    { key: "operations", path: "/operations", labelKey: "nav.home", icon: ListChecks },
    { key: "management", path: "/gestion", labelKey: "nav.management", icon: LayoutDashboard },
  ],
};

/* ============================================================================ */
/* ICON MAP (just UI, no functional impact) */
/* ============================================================================ */

const ICON_BY_PATH_PREFIX = [
  { prefix: "/prestataire/interventions", icon: Wrench },
  { prefix: "/gestion", icon: LayoutDashboard },
  { prefix: "/operations", icon: ListChecks },
  { prefix: "/projects", icon: FolderKanban },
  { prefix: "/dossiers", icon: FolderKanban },
  { prefix: "/properties", icon: Building2 },
  { prefix: "/demandes/nouvelle", icon: CirclePlus },
  { prefix: "/demandes", icon: ListChecks },
  { prefix: "/courses", icon: CarFront },
  { prefix: "/chauffeur/courses", icon: CarFront },
  { prefix: "/livraisons", icon: Package },
  { prefix: "/livreur/livraisons", icon: Package },
  { prefix: "/services", icon: Wrench },
  { prefix: "/agent/services", icon: Wrench },
  { prefix: "/missions/mine", icon: Briefcase },
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
  { prefix: "/admin/taxi-dispatch", icon: CarFront },
  { prefix: "/admin/livraisons", icon: Package },
  { prefix: "/admin/metrics", icon: BarChart3 },
  { prefix: "/admin/agents", icon: Users },
  { prefix: "/admin/providers", icon: Briefcase },
  { prefix: "/admin/disputes", icon: AlertTriangle },
  { prefix: "/admin/property-listings", icon: Home },
  { prefix: "/admin/trade-categories", icon: Wrench },
  { prefix: "/admin/users", icon: UserCog },
  { prefix: "/admin/properties", icon: Building2 },
  { prefix: "/admin/onboarding", icon: ShieldCheck },
  { prefix: "/admin/mission-pricing", icon: Banknote },

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
/* GROUPING - Enterprise information architecture (UI only) */
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

  if (role === "admin") {
    pushSection(t("nav.sections.operations"), [
      byPath("/gestion"),
      byPath("/operations"),
      byPath("/admin/services"),
      byPath("/admin/taxi-dispatch"),
      byPath("/admin/livraisons"),
      byPath("/projects"),
      byPath("/admin/projects"),
      byPath("/tasks"),
    ]);
    pushSection(t("nav.sections.network"), [
      byPath("/admin/agents"),
      byPath("/admin/providers"),
      byPath("/admin/users"),
      byPath("/admin/properties"),
    ]);
    pushSection(t("nav.sections.catalog"), [
      byPath("/admin/trade-categories"),
      byPath("/admin/property-listings"),
      byPath("/admin/catalog/categories"),
      byPath("/admin/catalog/products"),
      byPath("/shop"),
      byPath("/orders"),
    ]);
    pushSection(t("nav.sections.quality"), [
      byPath("/admin/metrics"),
      byPath("/admin/disputes"),
    ]);
    pushSection(t("nav.sections.finance"), [
      byPath("/transactions"),
      byPath("/finance"),
    ]);
    pushSection(t("nav.sections.configuration"), [
      byPath("/admin/mission-pricing"),
      byPath("/admin/onboarding"),
    ]);
  } else {
    pushSection(t("nav.sections.activity"), [
      byPath("/operations"),
    ]);

    pushSection(t("nav.sections.mobility"), [
      ...byPrefix("/demandes"),
      ...byPrefix("/courses"),
      ...byPrefix("/chauffeur/courses"),
      ...byPrefix("/livraisons"),
      ...byPrefix("/livreur/livraisons"),
      ...byPrefix("/prestataire/services"),
      ...byPrefix("/agent/services"),
      ...byPrefix("/services"),
    ]);

    pushSection(t("nav.sections.work"), [
      ...byPrefix("/prestataire/interventions"),
      ...byPrefix("/dossiers"),
      ...byPrefix("/projects"),
      ...byPrefix("/properties"),
      ...byPrefix("/tasks"),
      ...(role === "agent" ? byPrefix("/missions/mine") : []),
    ]);

    pushSection(t("nav.sections.finance"), [
      ...byPrefix("/transactions"),
      ...byPrefix("/finance"),
    ]);

    pushSection(t("nav.sections.shop"), [...byPrefix("/shop"), ...byPrefix("/orders")]);
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
  "inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

const clsTabInactive =
  "text-text-secondary hover:text-text-primary hover:bg-surface-main";

const clsTabActive =
  "bg-primary/10 text-primary";

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
  const [mobileSelectActive, setMobileSelectActive] = useState(false);

  // Desktop dropdowns
  const [openDesktopMore, setOpenDesktopMore] = useState(false);
  const [openUserMenu, setOpenUserMenu] = useState(false);
  const [openTerritory, setOpenTerritory] = useState(false);

  // Piège de focus clavier (Tab reste dans le menu ouvert, focus initial sur le
  // premier item, focus restauré au déclencheur à la fermeture) — un par menu.
  const desktopMoreMenuRef = useRef(null);
  const userMenuRef = useRef(null);
  const mobileMorePanelRef = useRef(null);
  const territoryPanelRef = useRef(null);
  useFocusTrap({ active: openTerritory, containerRef: territoryPanelRef, onEscape: () => setOpenTerritory(false) });
  useFocusTrap({
    active: openDesktopMore,
    containerRef: desktopMoreMenuRef,
    onEscape: () => setOpenDesktopMore(false),
  });
  useFocusTrap({
    active: openUserMenu,
    containerRef: userMenuRef,
    onEscape: () => setOpenUserMenu(false),
  });
  useFocusTrap({
    active: openMore,
    containerRef: mobileMorePanelRef,
    onEscape: () => setOpenMore(false),
  });
  const [notificationSummary, setNotificationSummary] = useState({
    unread: 0,
    byProgress: {},
  });
  const notificationRequestId = useRef(0);
  const notificationMounted = useRef(false);
  const unreadCount = notificationSummary?.unread || 0;

  const loadNotificationSummary = useCallback(async (options = {}) => {
    const requestId = ++notificationRequestId.current;
    const hasSession = USES_COOKIE_AUTH
      ? Boolean(getLocalUser()) || hasSessionHint()
      : Boolean(getToken());
    if (!user || !hasSession) {
      if (notificationMounted.current) setNotificationSummary({ unread: 0, byProgress: {} });
      return;
    }
    try {
      const data = await getNotificationSummary(options);
      if (!notificationMounted.current || requestId !== notificationRequestId.current) return;
      setNotificationSummary({
        unread: data?.unread ?? 0,
        byProgress: data?.byProgress || {},
      });
    } catch (e) {
      const status = e?.response?.status;
      const isTimeout = e?.code === "ECONNABORTED";
      const isNetwork = !e?.response;
      if (status !== 401 && !isTimeout && !isNetwork) {
        console.error("NavBar notifications summary error:", e);
      }
      if (notificationMounted.current && requestId === notificationRequestId.current) {
        setNotificationSummary((prev) => prev || { unread: 0, byProgress: {} });
      }
    }
  }, [user]);

  useEffect(() => {
    notificationMounted.current = true;
    return () => {
      notificationMounted.current = false;
      notificationRequestId.current += 1;
    };
  }, []);

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
    function refreshIfVisible() {
      if (!isDocumentVisible()) return;
      loadNotificationSummary();
    }

    const interval = setInterval(refreshIfVisible, NOTIFICATION_SUMMARY_POLL_MS);

    if (typeof window !== "undefined") {
      window.addEventListener("focus", refreshIfVisible);
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", refreshIfVisible);
    }

    return () => {
      clearInterval(interval);
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", refreshIfVisible);
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", refreshIfVisible);
      }
    };
  }, [user, loadNotificationSummary]);

  useEffect(() => {
    function onRefresh() {
      loadNotificationSummary({ force: true });
    }
    window.addEventListener("notifications:refresh", onRefresh);
    return () => window.removeEventListener("notifications:refresh", onRefresh);
  }, [loadNotificationSummary]);

  // Close panels on route change
  useEffect(() => {
    setOpenMore(false);
    setOpenDesktopMore(false);
    setOpenUserMenu(false);
    setOpenTerritory(false);
  }, [location.pathname, location.search, user?.id]);

  useEffect(() => {
    if (!openMore && !openDesktopMore && !openUserMenu && !openTerritory) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [openMore, openDesktopMore, openUserMenu, openTerritory]);

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return undefined;
    }

    if (typeof window.matchMedia !== "function") {
      setMobileSelectActive(false);
      return undefined;
    }

    const media = window.matchMedia("(max-width: 767px)");

    const syncMobileSelectState = () => {
      if (!media.matches) {
        setMobileSelectActive(false);
        return;
      }

      const activeEl = document.activeElement;
      setMobileSelectActive(activeEl instanceof HTMLSelectElement);
    };

    const handleFocusIn = () => syncMobileSelectState();
    const handleViewportChange = () => {
      if (media.matches) setOpenDesktopMore(false);
      else setOpenMore(false);
      syncMobileSelectState();
    };
    const handleFocusOut = () => {
      window.setTimeout(syncMobileSelectState, 0);
    };

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleViewportChange);
    } else {
      media.addListener(handleViewportChange);
    }

    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      if (typeof media.removeEventListener === "function") {
        media.removeEventListener("change", handleViewportChange);
      } else {
        media.removeListener(handleViewportChange);
      }
    };
  }, []);

  const handleLogout = useCallback(async () => {
    setOpenMore(false);
    setOpenDesktopMore(false);
    setOpenUserMenu(false);
    setOpenTerritory(false);
    await delay(100);
    await logout();
    navigate("/login", {
      replace: true,
      state: buildAuthFeedbackState(t("auth.login.logoutSuccess"), "success"),
    });
  }, [navigate, t]);

  const PUBLIC = [
    "/",
    "/login",
    "/register",
    "/shop",
    "/products",
  ];
  const isPublic = PUBLIC.some((p) => location.pathname.startsWith(p));

  const role = normalizeRole(user?.role);

 // Detection ADMIN GLOBAL vs MASTER (admin scope)
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
    if (role === "provider") return t("roles.provider");
    return t("roles.client");
  }, [user, isAdmin, isGlobalAdmin, role, t]);


 // Accès de navigation propres au rôle.
  const links = useMemo(() => {
    const base = ROLE_LINKS[role] || [];
    return base.map((item) => ({ ...item, label: t(item.labelKey) }));
  }, [role, t]);

  const bottomLinks = useMemo(() => {
    const base = BOTTOM_LINKS[role] || [];
    return base.map((item) => ({
      ...item,
      label: t(item.labelKey),
    }));
  }, [role, t]);

  const isActive = useCallback(
    (path, exact = false) => {
      if (!path) return false;
      if (path === "/" || exact) return location.pathname === path;
      return location.pathname === path || location.pathname.startsWith(path + "/");
    },
    [location.pathname]
  );

  const isLoginRoute = isActive("/login");
  const isRegisterRoute = isActive("/register");
  const warmRoute = useCallback((path) => {
    if (!path) return;
    preloadRoute(path);
  }, []);
  const withRouteWarmup = useCallback(
    (path, handlers = {}) => ({
      ...handlers,
      onMouseEnter: (event) => {
        handlers.onMouseEnter?.(event);
        warmRoute(path);
      },
      onFocus: (event) => {
        handlers.onFocus?.(event);
        warmRoute(path);
      },
      onTouchStart: (event) => {
        handlers.onTouchStart?.(event);
        warmRoute(path);
      },
    }),
    [warmRoute]
  );

  const sections = useMemo(() => buildSections(role, links, t), [role, links, t]);
  const mobileSections = useMemo(
    () => {
      const primaryPaths = new Set(bottomLinks.map((item) => item.path));
      return (
      sections
        .map((sec) => ({
          ...sec,
          items: sec.items.filter(
            (it) => !ACCOUNT_LINK_PATHS.has(it.path) && !primaryPaths.has(it.path)
          ),
        }))
        .filter((sec) => sec.items.length > 0)
      );
    },
    [bottomLinks, sections]
  );

  const desktopPrimaryTabs = bottomLinks;

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

  const mobileMoreIsActive = useMemo(
    () => mobileSections.some((section) => section.items.some((item) => isActive(item.path, item.exact))),
    [isActive, mobileSections]
  );
  const desktopMoreIsActive = useMemo(
    () => desktopMoreItems.some((item) => isActive(item.path, item.exact)),
    [desktopMoreItems, isActive]
  );

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
    return full || user?.phone || user?.email || t("nav.userFallback");
  }, [user?.email, user?.firstName, user?.lastName, user?.phone, t]);

  const userInitial = useMemo(() => {
    const first = (user?.firstName || "").trim();
    const last = (user?.lastName || "").trim();
    const base = first || last || user?.phone || user?.email || "?";
    const initial = String(base).trim().charAt(0);
    return (initial || "?").toUpperCase();
  }, [user?.email, user?.firstName, user?.lastName, user?.phone]);

  const NotificationBell = (
    <Link
      to="/operations?vue=a-lire"
      {...withRouteWarmup("/operations")}
      className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-surface-main focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      aria-label={t("workspaceQueue.information")}
      aria-describedby={unreadCount ? 'topbar-unread' : undefined}
      title={t("workspaceQueue.information")}
    >
      <Bell size={20} aria-hidden="true" />
      {unreadCount > 0 && (
        <span aria-hidden="true" className="absolute right-0 top-0 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[0.65rem] font-semibold flex items-center justify-center">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
      {unreadCount > 0 && <span id="topbar-unread" className="sr-only">{t('topBar.unread', { count: unreadCount })}</span>}
    </Link>
  );

  if (!user && loading) return null;

  /* ============================================================================ */
  /* PUBLIC NAVBAR */
  /* ============================================================================ */
  if (!user && isPublic) {
    return (
      <nav aria-label={t("nav.mainNavigation")} className="sticky top-0 z-[60] border-b border-border bg-surface-card">
        <div className="max-w-7xl mx-auto h-16 px-3 sm:px-5 flex items-center justify-between gap-2 sm:gap-3">
          <Link
            to="/"
            {...withRouteWarmup("/")}
            className="min-w-0 shrink flex items-center gap-2 text-primary font-semibold tracking-wide text-[1.05rem]"
          >
            {Logo}
            <span className="truncate max-[440px]:hidden">Teranga</span>
          </Link>

          <div className="shrink-0 flex items-center justify-end gap-2 sm:gap-3 text-xs sm:text-sm">
            <LanguageSwitcher compact className="shrink-0" />
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                {...withRouteWarmup("/login")}
                className={[
                  "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl border px-2.5 text-xs font-semibold transition-colors sm:px-4 sm:text-sm",
                  isLoginRoute
                    ? "border-primary bg-primary text-white shadow-sm shadow-primary/20"
                    : "border-border/80 bg-surface-main/70 text-text-primary hover:border-primary/30 hover:bg-surface-main/95",
                ].join(" ")}
                aria-current={isLoginRoute ? "page" : undefined}
              >
                {t("nav.login")}
              </Link>
              <Link
                to="/register"
                {...withRouteWarmup("/register")}
                className={[
                  "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl border px-2.5 text-xs font-semibold transition-colors sm:px-4 sm:text-sm",
                  isRegisterRoute
                    ? "border-primary bg-primary text-white shadow-sm shadow-primary/20"
                    : isLoginRoute
                    ? "border-border/80 bg-surface-main/55 text-text-secondary hover:bg-surface-main/80 hover:text-text-primary"
                    : "border-primary/20 bg-primary text-white shadow-sm shadow-primary/15 hover:bg-primary/90",
                ].join(" ")}
                aria-current={isRegisterRoute ? "page" : undefined}
              >
                {t("nav.register")}
              </Link>
            </div>
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
      <nav aria-label={t("nav.mainNavigation")} className="sticky top-0 z-[60] border-b border-border bg-surface-card">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:gap-4 sm:px-5">
          <Link to="/operations" aria-label={t("topBar.home")} {...withRouteWarmup("/operations")}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg text-lg font-semibold tracking-tight text-primary">
            {Logo}<span className="md:hidden lg:inline">Teranga</span>
          </Link>
          <div className="hidden min-w-0 flex-1 items-center gap-1 md:flex">
            {desktopPrimaryTabs.map((link) => <Link key={link.path} to={link.path} {...withRouteWarmup(link.path)}
              className={[clsTabBase, isActive(link.path, link.exact) ? clsTabActive : clsTabInactive].join(" ")}
              aria-current={isActive(link.path, link.exact) ? "page" : undefined}>{link.label}</Link>)}
            {/* Desktop More */}
            {desktopMoreItems.length > 0 && <div className="relative">
              <button
                onClick={() => { setOpenUserMenu(false); setOpenTerritory(false); setOpenMore(false); setOpenDesktopMore((v) => !v); }}
                className={[
                  clsTabBase,
                  openDesktopMore || desktopMoreIsActive ? clsTabActive : clsTabInactive,
                  "relative z-50 inline-flex items-center gap-1.5",
                ].join(" ")}
                aria-expanded={openDesktopMore}
                aria-controls="desktop-more-menu"
                aria-current={desktopMoreIsActive ? "page" : undefined}
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
                      className="fixed inset-0 z-40 bg-black/10"
                      onClick={() => setOpenDesktopMore(false)}
                      aria-hidden="true"
                    />
                    <motion.div
                      ref={desktopMoreMenuRef}
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
                      <div className="max-h-[420px] overflow-y-auto py-2">
                        {desktopMoreSections.map((sec) => (
                          <div key={sec.title} className={clsPanelSectionCard}>
                            <div className={clsPanelSectionTitle}>
                              {sec.title}
                            </div>

                            {sec.items.map((l) => {
                              const active = isActive(l.path, l.exact);
                              const Icon = iconForPath(l.path);

                              return (
                                <Link
                                  key={l.path}
                                  to={l.path}
                                  {...withRouteWarmup(l.path, {
                                    onClick: () => setOpenDesktopMore(false),
                                  })}
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
                                      <Icon size={16} aria-hidden="true" />
                                    </span>
                                  ) : null}
                                  <span className="flex-1">{l.label}</span>
                                  {active ? (
                                    <Check size={16} className="text-primary" aria-hidden="true" />
                                  ) : (
                                    <ChevronRight
                                      size={15}
                                      className="text-text-muted transition-transform duration-150 group-hover:translate-x-0.5"
                                      aria-hidden="true"
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
            </div>}

          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <div className="relative">
              <button type="button" aria-label={t('topBar.territory')} title={t('topBar.territory')} aria-haspopup="dialog" aria-expanded={openTerritory} aria-controls="topbar-territory"
                onClick={() => { setOpenUserMenu(false); setOpenDesktopMore(false); setOpenMore(false); setOpenTerritory(value => !value); }}
                className="relative z-50 inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-2 text-sm text-text-secondary transition-colors hover:bg-surface-main focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                <MapPin size={19} aria-hidden="true" /><span className="hidden max-w-[9rem] text-left xl:block"><GeoSelector summaryOnly /></span><ChevronDown size={13} className="hidden xl:block" aria-hidden="true" />
              </button>
              <AnimatePresence>{openTerritory && <>
                <div className="fixed inset-0 z-40 bg-black/10" onClick={() => setOpenTerritory(false)} aria-hidden="true" />
                <motion.div ref={territoryPanelRef} id="topbar-territory" role="dialog" aria-modal="true" aria-label={t('topBar.territory')}
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
                  className="fixed inset-x-3 top-[4.5rem] z-50 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl border border-border bg-surface-card p-4 shadow-xl md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-3 md:w-80">
                  <h2 className="mb-3 text-sm font-semibold text-text-primary">{t('topBar.territory')}</h2>
                  <GeoSelector stacked idPrefix="topbar-geo" />
                  <p className="mt-3 text-xs leading-relaxed text-text-secondary">{t('topBar.territoryHint')}</p>
                  <button type="button" onClick={() => setOpenTerritory(false)} className="mt-3 min-h-11 w-full rounded-xl border border-border text-sm font-medium">{t('nav.closeMenu')}</button>
                </motion.div>
              </>}</AnimatePresence>
            </div>
            {NotificationBell}
            <TopbarAccountMenu user={user} display={userDisplay} initial={userInitial} roleLabel={roleLabel} open={openUserMenu}
              onToggle={() => { setOpenTerritory(false); setOpenDesktopMore(false); setOpenMore(false); setOpenUserMenu(value => !value); }}
              onClose={() => setOpenUserMenu(false)} onLogout={handleLogout} panelRef={userMenuRef} warmup={withRouteWarmup} />
          </div>
        </div>
      </nav>

      {/* ======================================================================== */}
 {/* BOTTOM NAV - MOBILE ONLY (COMPACT) */}
      {/* ======================================================================== */}
      <nav
        className={[
          "fixed bottom-0 inset-x-0 z-50 md:hidden bg-transparent transition-all duration-200",
          mobileSelectActive ? "pointer-events-none translate-y-3 opacity-0" : "pointer-events-auto opacity-100",
        ].join(" ")}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)" }}
        aria-label={t("nav.bottomNavigation")}
        aria-hidden={mobileSelectActive}
      >
        <div className="mx-auto w-full flex justify-center">
          <div className="w-full max-w-sm px-2 pb-2">
            <div className="bg-gradient-to-r from-surface-card/95 via-surface-card/90 to-surface-main/90 backdrop-blur-2xl border border-border/70 rounded-2xl shadow-[0_12px_35px_-25px_rgba(15,23,42,0.6)] flex px-1 py-1 gap-1">
              {bottomLinks.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path, item.exact);

                return (
                  <Link
                    key={item.key}
                    to={item.path}
                    {...withRouteWarmup(item.path)}
                    className={[
                      "flex-1 flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-center text-[0.7rem] font-medium leading-tight transition touch-manipulation",
                      "focus:outline-none focus:ring-4 focus:ring-primary/10",
                      active
                        ? "bg-primary/10 text-primary border border-border shadow-sm"
                        : "text-text-secondary hover:bg-surface-main/70 hover:text-text-primary",
                    ].join(" ")}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon size={19} className={active ? "text-primary" : "text-text-secondary"} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              {/* BUTTON PLUS */}
              <button
                onClick={() => { setOpenUserMenu(false); setOpenDesktopMore(false); setOpenTerritory(false); setOpenMore((v) => !v); }}
                className={[
                  "flex-1 flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-center text-[0.7rem] font-medium leading-tight transition touch-manipulation",
                  "focus:outline-none focus:ring-4 focus:ring-primary/10",
                  openMore || mobileMoreIsActive
                    ? "bg-primary/10 text-primary border border-border shadow-sm"
                    : "text-text-secondary hover:bg-surface-main/70 hover:text-text-primary",
                ].join(" ")}
                aria-expanded={openMore}
                aria-controls="navbar-more-panel"
                aria-label={t("nav.openMoreMenu")}
                aria-current={mobileMoreIsActive ? "page" : undefined}
              >
                <MoreHorizontal size={19} aria-hidden="true" />
                <span>{t("nav.more")}</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ======================================================================== */}
 {/* PANEL PLUS - MOBILE (Organise par sections) */}
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
              ref={mobileMorePanelRef}
              id="navbar-more-panel"
              initial={{ opacity: 0, y: 80 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 80 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="fixed bottom-24 inset-x-0 z-50 flex justify-center px-4"
              style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.75rem)" }}
              role="dialog"
              aria-modal="true"
              aria-label={t("nav.menu")}
            >
              <div className="flex max-h-[calc(100dvh-7rem-env(safe-area-inset-bottom,0px))] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-border/70 bg-surface-card/95 shadow-2xl backdrop-blur-2xl">
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
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2">
                  {mobileSections.map((sec) => (
                    <div key={sec.title} className={clsPanelSectionCard}>
                      <div className={clsPanelSectionTitle}>
                        {sec.title}
                      </div>

                      {sec.items.map((l) => {
                        const active = isActive(l.path, l.exact);
                        const Icon = iconForPath(l.path);

                        return (
                          <Link
                            key={l.path}
                            to={l.path}
                            {...withRouteWarmup(l.path, {
                              onClick: () => setOpenMore(false),
                            })}
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
                                <Icon size={16} aria-hidden="true" />
                              </span>
                            ) : null}
                            <span className="flex-1">{l.label}</span>
                            {active ? (
                              <Check size={16} className="text-primary" aria-hidden="true" />
                            ) : (
                              <ChevronRight
                                size={15}
                                className="text-text-muted transition-transform duration-150 group-hover:translate-x-0.5"
                                aria-hidden="true"
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
                      {...withRouteWarmup("/settings", {
                        onClick: () => setOpenMore(false),
                      })}
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
                        <ChevronRight size={15} aria-hidden="true" />
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
                        <LogOut size={15} aria-hidden="true" />
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
                        <ChevronRight size={15} aria-hidden="true" />
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
