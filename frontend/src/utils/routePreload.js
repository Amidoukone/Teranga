const pageImporters = {
  home: () => import("../pages/HomePage"),
  login: () => import("../pages/LoginPage"),
  register: () => import("../pages/RegisterPage"),
  productCatalog: () => import("../pages/ProductCatalogPage"),
  productDetail: () => import("../pages/ProductDetailPage"),
  legal: () => import("../pages/LegalPage"),
  privacy: () => import("../pages/PrivacyPage"),
  terms: () => import("../pages/TermsPage"),
  settings: () => import("../pages/SettingsPage"),
  helpSupport: () => import("../pages/HelpSupportPage"),
  dashboard: () => import("../pages/DashboardPage"),
  properties: () => import("../pages/PropertiesPage"),
  services: () => import("../pages/ServicesPage"),
  serviceTasks: () => import("../pages/ServiceTasksPage"),
  serviceTransactions: () => import("../pages/ServiceTransactionsPage"),
  tasks: () => import("../pages/TasksPage"),
  taskEvidences: () => import("../pages/TaskEvidencesPage"),
  transactions: () => import("../pages/TransactionsPage"),
  finance: () => import("../pages/FinanceDashboardPage"),
  accountSecurity: () => import("../pages/ChangePasswordPage"),
  notifications: () => import("../pages/NotificationsPage"),
  activities: () => import("../pages/ActivityCenterPage"),
  projects: () => import("../pages/ProjectsPage"),
  projectDetail: () => import("../pages/ProjectDetailPage"),
  agentServices: () => import("../pages/AgentServicesPage"),
  adminAgents: () => import("../pages/AdminAgentsPage"),
  adminServices: () => import("../pages/AdminServicesPage"),
  adminUsers: () => import("../pages/AdminUsersPage"),
  adminProperties: () => import("../pages/AdminPropertiesPage"),
  adminProjects: () => import("../pages/AdminProjectsPage"),
  adminCategories: () => import("../pages/AdminCategoriesPage"),
  adminProducts: () => import("../pages/AdminProductsPage"),
  adminMetrics: () => import("../pages/AdminMetricsPage"),
  adminOnboarding: () => import("../pages/AdminOnboardingPage"),
  orders: () => import("../pages/OrdersPage"),
  orderDetail: () => import("../pages/OrderDetailPage"),
  orderTransactions: () => import("../pages/OrderTransactionsPage"),
};

const routeMatchers = [
  [/^\/orders\/[^/]+\/transactions\/?$/i, [pageImporters.orderTransactions]],
  [/^\/orders\/[^/]+\/?$/i, [pageImporters.orderDetail]],
  [/^\/projects\/[^/]+\/?$/i, [pageImporters.projectDetail]],
  [/^\/services\/[^/]+\/transactions\/?$/i, [pageImporters.serviceTransactions]],
  [/^\/services\/[^/]+\/tasks\/?$/i, [pageImporters.serviceTasks]],
  [/^\/tasks\/[^/]+\/evidences\/?$/i, [pageImporters.taskEvidences]],
  [/^\/products\/[^/]+\/?$/i, [pageImporters.productDetail]],
  [/^\/admin\/catalog\/products\/?$/i, [pageImporters.adminProducts]],
  [/^\/admin\/catalog\/categories\/?$/i, [pageImporters.adminCategories]],
  [/^\/admin\/properties\/?$/i, [pageImporters.adminProperties]],
  [/^\/admin\/users\/?$/i, [pageImporters.adminUsers]],
  [/^\/admin\/services\/?$/i, [pageImporters.adminServices]],
  [/^\/admin\/agents\/?$/i, [pageImporters.adminAgents]],
  [/^\/admin\/metrics\/?$/i, [pageImporters.adminMetrics]],
  [/^\/admin\/projects\/?$/i, [pageImporters.adminProjects]],
  [/^\/admin\/onboarding\/?$/i, [pageImporters.adminOnboarding]],
  [/^\/agent\/services\/?$/i, [pageImporters.agentServices]],
  [/^\/orders\/?$/i, [pageImporters.orders]],
  [/^\/finance\/?$/i, [pageImporters.finance]],
  [/^\/activities\/?$/i, [pageImporters.activities]],
  [/^\/settings\/?$/i, [pageImporters.settings]],
  [/^\/notifications\/?$/i, [pageImporters.notifications]],
  [/^\/account\/security\/?$/i, [pageImporters.accountSecurity]],
  [/^\/transactions\/?$/i, [pageImporters.transactions]],
  [/^\/tasks\/?$/i, [pageImporters.tasks]],
  [/^\/services\/?$/i, [pageImporters.services]],
  [/^\/projects\/?$/i, [pageImporters.projects]],
  [/^\/properties\/?$/i, [pageImporters.properties]],
  [/^\/dashboard\/?$/i, [pageImporters.dashboard]],
  [/^\/help-support\/?$/i, [pageImporters.helpSupport]],
  [/^\/terms\/?$/i, [pageImporters.terms]],
  [/^\/privacy\/?$/i, [pageImporters.privacy]],
  [/^\/legal\/?$/i, [pageImporters.legal]],
  [/^\/forgot-password\/?$/i, [pageImporters.login]],
  [/^\/reset-password(?:\/code)?\/?$/i, [pageImporters.login]],
  [/^\/register\/?$/i, [pageImporters.register]],
  [/^\/login\/?$/i, [pageImporters.login]],
  [/^\/shop\/?$/i, [pageImporters.productCatalog]],
  [/^\/$/i, [pageImporters.home]],
];

function normalizePath(path) {
  const raw = String(path || "").trim();
  if (!raw) return "";

  try {
    const base =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "https://teranga.local";
    const normalized = new URL(raw, base).pathname.replace(/\/+$/, "");
    return normalized || "/";
  } catch {
    const normalized = raw.split("?")[0].split("#")[0].replace(/\/+$/, "");
    return normalized || "/";
  }
}

function getImportersForPath(path) {
  const normalized = normalizePath(path);
  if (!normalized) return [];
  const match = routeMatchers.find(([regex]) => regex.test(normalized));
  return match ? match[1] : [];
}

function preloadImporters(importers) {
  const uniqueImporters = [];
  const seen = new Set();

  importers.forEach((importer) => {
    if (typeof importer !== "function" || seen.has(importer)) return;
    seen.add(importer);
    uniqueImporters.push(importer);
  });

  return Promise.allSettled(
    uniqueImporters.map((importer) => {
      try {
        return importer();
      } catch (error) {
        return Promise.reject(error);
      }
    })
  );
}

export function preloadRoute(path) {
  return preloadImporters(getImportersForPath(path));
}

export function preloadRoutes(paths = []) {
  const importers = paths.flatMap((path) => getImportersForPath(path));
  return preloadImporters(importers);
}

export function scheduleIdleRoutePreload(paths = [], { timeout = 900 } = {}) {
  if (typeof window === "undefined") return () => {};
  if (!Array.isArray(paths) || paths.length === 0) return () => {};

  const run = () => {
    preloadRoutes(paths);
  };

  if (typeof window.requestIdleCallback === "function") {
    const idleId = window.requestIdleCallback(run, { timeout });
    return () => {
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
    };
  }

  const timerId = window.setTimeout(run, Math.min(timeout, 350));
  return () => window.clearTimeout(timerId);
}
