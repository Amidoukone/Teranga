import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  getNotifications,
  getNotificationSummary,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notifications";
import { getLocalUser } from "../services/auth";
import PaginationBar from "../components/PaginationBar";
import { useLocale } from "../i18n/useLocale";
import { formatStatus } from "../utils/labels";
import { normalizeRole } from "../utils/role";
import { notify } from "../utils/notify";

const PROGRESS_TABS = [
  { key: "new", labelKey: "notifications.tabs.new" },
  { key: "in_progress", labelKey: "notifications.tabs.inProgress" },
  { key: "done", labelKey: "notifications.tabs.done" },
];

export default function NotificationsPage() {
  const { t } = useTranslation();
  const { formatDate } = useLocale();
  const navigate = useNavigate();
  const currentUserRole = useMemo(
    () => normalizeRole(getLocalUser()?.role),
    []
  );

  const [progress, setProgress] = useState("new");
  const [statusFilter, setStatusFilter] = useState("all");
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ unread: 0, byProgress: {} });
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [markingOneIds, setMarkingOneIds] = useState({});
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
      const isTimeout = e?.code === "ECONNABORTED";
      const isNetwork = !e?.response;
      if (!isTimeout && !isNetwork) {
        console.error("load summary notifications:", e);
      }
    }
  }, []);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getNotifications({
        progress,
        status: statusFilter === "all" ? undefined : statusFilter,
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
      console.error("load notifications:", e);
      setItems([]);
      setPagination({ page, limit: pageSize, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, progress, statusFilter]);

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
  }, [progress, statusFilter, pageSize]);

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
        icon: "SV",
        label: t("notifications.entities.service"),
        statusCategory: "service",
      },
      task: {
        icon: "TSK",
        label: t("notifications.entities.task"),
        statusCategory: "task",
      },
      order: {
        icon: "ORD",
        label: t("notifications.entities.order"),
        statusCategory: "order",
      },
      evidence: { icon: "DOC", label: t("notifications.entities.evidence") },
      project: {
        icon: "PRJ",
        label: t("notifications.entities.project"),
        statusCategory: "project",
      },
    }),
    [t]
  );

  const handleMarkRead = useCallback(
    async (id) => {
      if (!id || markingOneIds[id]) return;
      try {
        setMarkingOneIds((prev) => ({ ...prev, [id]: true }));
        await markNotificationRead(id);
        setItems((prev) =>
          prev.map((n) => (n.id === id ? { ...n, status: "read" } : n))
        );
        await Promise.all([loadSummary(), loadItems()]);
        notify(
          t("notifications.markReadSuccess", {
            defaultValue: "Notification marquee comme lue.",
          }),
          { type: "success" }
        );
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("notifications:refresh"));
        }
      } catch (e) {
        console.error("mark notification read:", e);
        notify(
          t("notifications.markReadError", {
            defaultValue: "Impossible de marquer cette notification comme lue.",
          }),
          { type: "error" }
        );
      } finally {
        setMarkingOneIds((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    },
    [loadItems, loadSummary, markingOneIds, t]
  );

  const handleMarkAllRead = useCallback(async () => {
    if (markingAll) return;
    if ((summary.unread || 0) <= 0) {
      notify(
        t("notifications.nothingToMark", {
          defaultValue: "Aucune notification non lue a marquer.",
        }),
        { type: "info" }
      );
      return;
    }

    try {
      setMarkingAll(true);
      await markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, status: "read" })));
      await Promise.all([loadSummary(), loadItems()]);
      notify(
        t("notifications.markAllReadSuccess", {
          defaultValue: "Toutes les notifications sont maintenant lues.",
        }),
        { type: "success" }
      );
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("notifications:refresh"));
      }
    } catch (e) {
      console.error("mark all notifications read:", e);
      notify(
        t("notifications.markAllReadError", {
          defaultValue: "Erreur lors du marquage global des notifications.",
        }),
        { type: "error" }
      );
    } finally {
      setMarkingAll(false);
    }
  }, [loadItems, loadSummary, markingAll, summary.unread, t]);

  const resolveLink = useCallback(
    (n) => {
      if (!n) return "/dashboard";
      if (n.entityType === "order") return n.entityId ? `/orders/${n.entityId}` : "/orders";
      if (n.entityType === "project") return n.entityId ? `/projects/${n.entityId}` : "/projects";
      if (n.entityType === "task") return "/tasks";
      if (n.entityType === "service") {
        return currentUserRole === "agent" ? "/agent/services" : "/services";
      }
      if (n.entityType === "evidence") {
        const taskId = n?.metadata?.taskId;
        const orderId = n?.metadata?.orderId;
        if (taskId) return `/tasks/${taskId}/evidences`;
        if (orderId) return `/orders/${orderId}`;
      }
      return "/dashboard";
    },
    [currentUserRole]
  );

  return (
    <div className="app-page-wrap">
      <div className="app-page-shell space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="page-kicker">
              {t("notifications.kicker")}
            </p>
            <h1 className="app-page-headline">{t("notifications.title")}</h1>
            <p className="app-page-subtitle">
              {t("notifications.subtitle")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setStatusFilter((prev) => (prev === "unread" ? "all" : "unread"))
              }
              className={[
                "app-toolbar-pill transition",
                statusFilter === "unread"
                  ? "ring-2 ring-primary/40 bg-primary/10 text-primary"
                  : "",
              ].join(" ")}
              title={
                statusFilter === "unread"
                  ? t("notifications.resetUnreadFilter")
                  : t("notifications.filterUnread")
              }
            >
              {t("notifications.unreadCount", { count: summary.unread || 0 })} {" - "}
              {statusFilter === "unread"
                ? t("notifications.resetUnreadFilter")
                : t("notifications.filterUnread")}
            </button>
            <button
              onClick={() => navigate("/activities")}
              className="app-btn-primary"
            >
              {t("activities.title")}
            </button>
            <button
              onClick={handleMarkAllRead}
              disabled={markingAll || (summary.unread || 0) <= 0}
              className={[
                "app-btn-neutral",
                markingAll || (summary.unread || 0) <= 0
                  ? "opacity-60 cursor-not-allowed"
                  : "",
              ].join(" ")}
            >
              {markingAll
                ? t("common.loading", { defaultValue: "Chargement..." })
                : t("notifications.markAllRead")}
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
                  "app-tab",
                  active ? "app-tab-active" : "app-tab-idle",
                ].join(" ")}
              >
                <span className="app-tab-inner">
                  <span>{t(tab.labelKey)}</span>
                  <span
                    className={[
                      "app-count-badge",
                      active ? "app-count-badge-active" : "app-count-badge-idle",
                    ].join(" ")}
                  >
                    {count}
                  </span>
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
          <div className="rounded-2xl border border-border/70 bg-surface-card/70 py-10 text-center text-sm text-text-secondary">
            {t("notifications.loading")}
          </div>
        ) : displayItems.length === 0 ? (
          <div className="rounded-2xl border border-border/70 bg-surface-card/70 py-10 text-center text-sm text-text-secondary">
            {t("notifications.empty")}
          </div>
        ) : (
          <div className="grid gap-4">
            {displayItems.map((n) => {
              const meta = entityMeta[n.entityType] || {
                icon: "N",
                label: t("notifications.entities.other"),
              };
              const createdLabel = n.createdAt ? formatDate(n.createdAt) : "-";
              const actionKey = n.action || "created";
              const actionLabel = t(`notifications.actions.${actionKey}`, {
                defaultValue: actionKey,
              });
              const entityTitle = n?.metadata?.title || n?.metadata?.code || null;
              const title = entityTitle
                ? `${meta.label} - ${entityTitle}`
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
                    "app-list-card flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
                    n.status === "unread"
                      ? "app-list-card-unread"
                      : "app-list-card-read",
                  ].join(" ")}
                >
                  <div className="flex gap-3 min-w-0 flex-1">
                    <div className="text-2xl shrink-0">{meta.icon}</div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <h3 className="max-w-full break-words text-sm font-semibold text-text-primary line-clamp-2 sm:text-base">
                          {title}
                        </h3>
                        <span className="rounded-full border border-border/80 bg-surface-main/80 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-text-secondary">
                          {meta.label}
                        </span>
                        {n.status === "unread" && (
                          <span className="rounded-full border border-blue-500/30 bg-blue-500/15 px-2 py-0.5 text-[0.6rem] uppercase tracking-wide text-blue-700 dark:text-blue-300">
                            {t("notifications.unread")}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 break-words text-xs text-text-secondary line-clamp-3 sm:text-sm">
                        {message}
                      </p>
                      <p className="mt-2 text-[0.7rem] text-text-muted">
                        {createdLabel}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => navigate(resolveLink(n))}
                      className="app-btn-primary"
                    >
                      {t("notifications.view")}
                    </button>
                    {n.status !== "read" && (
                      <button
                        type="button"
                        onClick={() => handleMarkRead(n.id)}
                        disabled={Boolean(markingOneIds[n.id])}
                        className="app-btn-soft"
                      >
                        {markingOneIds[n.id]
                          ? t("common.loading", { defaultValue: "Chargement..." })
                          : t("notifications.markRead")}
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


