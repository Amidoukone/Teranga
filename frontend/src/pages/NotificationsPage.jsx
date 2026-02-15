import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  getNotifications,
  getNotificationSummary,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notifications";
import PaginationBar from "../components/PaginationBar";
import { useLocale } from "../i18n/useLocale";
import { formatStatus } from "../utils/labels";

const PROGRESS_TABS = [
  { key: "new", labelKey: "notifications.tabs.new" },
  { key: "in_progress", labelKey: "notifications.tabs.inProgress" },
  { key: "done", labelKey: "notifications.tabs.done" },
];

export default function NotificationsPage() {
  const { t } = useTranslation();
  const { formatDate } = useLocale();
  const navigate = useNavigate();

  const [progress, setProgress] = useState("new");
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ unread: 0, byProgress: {} });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });

  const loadSummary = useCallback(async () => {
    try {
      const data = await getNotificationSummary();
      setSummary({
        unread: data?.unread ?? 0,
        byProgress: data?.byProgress || {},
      });
    } catch (e) {
      console.error("❌ load summary notifications:", e);
    }
  }, []);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getNotifications({
        progress,
        page,
        limit: pageSize,
      });
      setItems(Array.isArray(data?.notifications) ? data.notifications : []);
      setPagination(
        data?.pagination
          ? {
              page: data.pagination.page ?? page,
              limit: data.pagination.limit ?? pageSize,
              total: data.pagination.total ?? data.pagination.count ?? 0,
            }
          : { page, limit: pageSize, total: 0 }
      );
    } catch (e) {
      console.error("❌ load notifications:", e);
      setItems([]);
      setPagination({ page, limit: pageSize, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, progress]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    function onRefresh() {
      loadSummary();
      loadItems();
    }
    if (typeof window !== "undefined") {
      window.addEventListener("notifications:refresh", onRefresh);
      return () => window.removeEventListener("notifications:refresh", onRefresh);
    }
    return undefined;
  }, [loadItems, loadSummary]);

  useEffect(() => {
    setPage(1);
  }, [progress, pageSize]);

  const totalItems = useMemo(
    () => pagination?.total ?? pagination?.count ?? items.length,
    [pagination, items.length]
  );

  const displayItems = useMemo(() => {
    const seen = new Set();
    return items.filter((n) => {
      if (!n?.entityType || !n?.entityId) return true;
      const key = `${n.entityType}:${n.entityId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [items]);

  const entityMeta = useMemo(
    () => ({
      service: {
        icon: "🛠️",
        label: t("notifications.entities.service"),
        statusCategory: "service",
      },
      task: {
        icon: "📋",
        label: t("notifications.entities.task"),
        statusCategory: "task",
      },
      order: {
        icon: "🧾",
        label: t("notifications.entities.order"),
        statusCategory: "order",
      },
      evidence: { icon: "📎", label: t("notifications.entities.evidence") },
      project: {
        icon: "📁",
        label: t("notifications.entities.project"),
        statusCategory: "project",
      },
    }),
    [t]
  );

  const handleMarkRead = useCallback(
    async (id) => {
      try {
        await markNotificationRead(id);
        setItems((prev) =>
          prev.map((n) => (n.id === id ? { ...n, status: "read" } : n))
        );
        await loadSummary();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("notifications:refresh"));
        }
      } catch (e) {
        console.error("❌ mark notification read:", e);
      }
    },
    [loadSummary]
  );

  const handleMarkAllRead = useCallback(async () => {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, status: "read" })));
      await loadSummary();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("notifications:refresh"));
      }
    } catch (e) {
      console.error("❌ mark all notifications read:", e);
    }
  }, [loadSummary]);

  const resolveLink = useCallback((n) => {
    if (!n) return "/dashboard";
    if (n.entityType === "order") return n.entityId ? `/orders/${n.entityId}` : "/orders";
    if (n.entityType === "project") return n.entityId ? `/projects/${n.entityId}` : "/projects";
    if (n.entityType === "task") return "/tasks";
    if (n.entityType === "service") return "/services";
    if (n.entityType === "evidence") {
      const taskId = n?.metadata?.taskId;
      const orderId = n?.metadata?.orderId;
      if (taskId) return `/tasks/${taskId}/evidences`;
      if (orderId) return `/orders/${orderId}`;
    }
    return "/dashboard";
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 px-3 sm:px-4 lg:px-6 py-8">
      <div className="max-w-6xl mx-auto bg-white/95 shadow-2xl rounded-3xl border border-gray-100 p-4 sm:p-8 lg:p-10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-[0.7rem] uppercase tracking-wide text-blue-600 font-semibold">
              {t("notifications.kicker")}
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              🔔 {t("notifications.title")}
            </h1>
            <p className="text-sm text-gray-600">
              {t("notifications.subtitle")}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-full px-3 py-1">
              {t("notifications.unreadCount", { count: summary.unread || 0 })}
            </span>
            <button
              onClick={() => navigate("/activities")}
              className="px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition"
            >
              {t("activities.title")}
            </button>
            <button
              onClick={handleMarkAllRead}
              className="px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition"
            >
              {t("notifications.markAllRead")}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {PROGRESS_TABS.map((tab) => {
            const active = progress === tab.key;
            const count = summary.byProgress?.[tab.key] || 0;
            return (
              <button
                key={tab.key}
                onClick={() => setProgress(tab.key)}
                className={[
                  "px-4 py-2 rounded-full text-xs sm:text-sm font-semibold border transition",
                  active
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50",
                ].join(" ")}
              >
                {t(tab.labelKey)}{" "}
                <span className={active ? "text-blue-100" : "text-gray-400"}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <PaginationBar
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
          pageSizeOptions={[6, 10, 20]}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          className="mb-2"
        />

        {/* List */}
        {loading ? (
          <div className="py-10 text-center text-sm text-gray-500">
            {t("notifications.loading")}
          </div>
        ) : displayItems.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">
            {t("notifications.empty")}
          </div>
        ) : (
          <div className="grid gap-4">
            {displayItems.map((n) => {
              const meta = entityMeta[n.entityType] || {
                icon: "🔔",
                label: t("notifications.entities.other"),
              };
              const createdLabel = n.createdAt ? formatDate(n.createdAt) : "-";
              const actionKey = n.action || "created";
              const actionLabel = t(`notifications.actions.${actionKey}`, {
                defaultValue: actionKey,
              });
              const entityTitle = n?.metadata?.title || n?.metadata?.code || null;
              const title = entityTitle
                ? `${meta.label} • ${entityTitle}`
                : `${meta.label}`;
              const statusLabel =
                n.entityStatus && meta.statusCategory
                  ? formatStatus(n.entityStatus, meta.statusCategory)
                  : null;

              let message = t("notifications.genericMessage");
              if (n.entityType === "evidence" && n?.metadata?.evidenceCount) {
                message = t("notifications.messages.evidenceCount", {
                  count: n.metadata.evidenceCount,
                });
              } else if (
                n.entityStatus &&
                n.entityStatus !== "created" &&
                statusLabel
              ) {
                message = t("notifications.messages.status", {
                  entity: meta.label,
                  status: statusLabel,
                });
              } else if (actionLabel) {
                message = t("notifications.messages.action", {
                  entity: meta.label,
                  action: actionLabel,
                });
              }

              return (
                <div
                  key={n.id}
                  className={[
                    "rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 min-w-0",
                    n.status === "unread"
                      ? "bg-blue-50/60 border-blue-200"
                      : "bg-white border-gray-200",
                  ].join(" ")}
                >
                  <div className="flex gap-3 min-w-0 flex-1">
                    <div className="text-2xl shrink-0">{meta.icon}</div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <h3 className="text-sm sm:text-base font-semibold text-gray-900 break-words max-w-full line-clamp-2">
                          {title}
                        </h3>
                        <span className="text-[0.65rem] uppercase tracking-wide text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">
                          {meta.label}
                        </span>
                        {n.status === "unread" && (
                          <span className="text-[0.6rem] uppercase tracking-wide text-blue-700 bg-blue-100 border border-blue-200 rounded-full px-2 py-0.5">
                            {t("notifications.unread")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 mt-1 break-words line-clamp-3">
                        {message}
                      </p>
                      <p className="text-[0.7rem] text-gray-400 mt-2">
                        {createdLabel}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => navigate(resolveLink(n))}
                      className="px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
                    >
                      {t("notifications.view")}
                    </button>
                    {n.status !== "read" && (
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        className="px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition"
                      >
                        {t("notifications.markRead")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
