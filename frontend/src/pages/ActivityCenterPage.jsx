import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { getActivities } from "../services/activities";
import PaginationBar from "../components/PaginationBar";
import { useLocale } from "../i18n/useLocale";
import { formatStatus } from "../utils/labels";

const PROGRESS_TABS = [
  { key: "all", labelKey: "activities.tabs.all" },
  { key: "new", labelKey: "activities.tabs.new" },
  { key: "in_progress", labelKey: "activities.tabs.inProgress" },
  { key: "done", labelKey: "activities.tabs.done" },
];

const ACTION_OPTIONS = [
  { value: "", labelKey: "activities.filters.allActions" },
  { value: "created", labelKey: "activities.actions.created" },
  { value: "assigned", labelKey: "activities.actions.assigned" },
  { value: "status_updated", labelKey: "activities.actions.status_updated" },
];

const ENTITY_OPTIONS = [
  { value: "", labelKey: "activities.filters.allEntities" },
  { value: "service", labelKey: "activities.entities.service" },
  { value: "task", labelKey: "activities.entities.task" },
  { value: "order", labelKey: "activities.entities.order" },
  { value: "evidence", labelKey: "activities.entities.evidence" },
  { value: "project", labelKey: "activities.entities.project" },
];

const DATE_OPTIONS = [
  { value: "all", labelKey: "activities.filters.allDates" },
  { value: "7d", labelKey: "activities.filters.last7Days" },
  { value: "30d", labelKey: "activities.filters.last30Days" },
  { value: "custom", labelKey: "activities.filters.customRange" },
];

function toLocalStartOfDay(value) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map((v) => parseInt(v, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function toLocalEndOfDay(value) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map((v) => parseInt(v, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

function getInitials(value) {
  if (!value) return "?";
  const base = String(value).split("@")[0];
  const cleaned = base.replace(/[^a-zA-ZÀ-ÿ0-9 ]/g, " ").trim();
  if (!cleaned) return "?";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function roleBadgeClass(role) {
  switch (role) {
    case "admin":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "agent":
      return "bg-sky-100 text-sky-700 border-sky-200";
    case "client":
      return "bg-amber-100 text-amber-700 border-amber-200";
    default:
      return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

export default function ActivityCenterPage() {
  const { t } = useTranslation();
  const { formatDate } = useLocale();
  const navigate = useNavigate();

  const [progress, setProgress] = useState("all");
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateError, setDateError] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });

  const isDateRangeInvalid = useMemo(() => {
    if (dateRange !== "custom") return false;
    const start = toLocalStartOfDay(dateFrom);
    const end = toLocalEndOfDay(dateTo);
    return Boolean(start && end && start > end);
  }, [dateRange, dateFrom, dateTo]);

  const loadItems = useCallback(async () => {
    if (isDateRangeInvalid) {
      setDateError(t("activities.validation.invalidDateRange"));
      setLoading(false);
      return;
    }

    setDateError("");
    try {
      setLoading(true);
      const params = { page, limit: pageSize };
      if (progress && progress !== "all") params.progress = progress;
      if (entityType) params.entityType = entityType;
      if (action) params.action = action;
      if (dateRange && dateRange !== "all") {
        if (dateRange === "custom") {
          const start = toLocalStartOfDay(dateFrom);
          const end = toLocalEndOfDay(dateTo);
          if (start) params.from = start.toISOString();
          if (end) params.to = end.toISOString();
        } else {
          const days = dateRange === "7d" ? 7 : 30;
          const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
          params.from = from.toISOString();
        }
      }

      const data = await getActivities(params);
      setItems(Array.isArray(data?.activities) ? data.activities : []);
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
      console.error("❌ load activities:", e);
      setItems([]);
      setPagination({ page, limit: pageSize, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    progress,
    entityType,
    action,
    dateRange,
    dateFrom,
    dateTo,
    isDateRangeInvalid,
    t,
  ]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    setPage(1);
  }, [progress, entityType, action, dateRange, dateFrom, dateTo, pageSize]);

  const totalItems = useMemo(
    () => pagination?.total ?? pagination?.count ?? items.length,
    [pagination, items.length]
  );

  const entityMeta = useMemo(
    () => ({
      service: {
        icon: "🛠️",
        label: t("activities.entities.service"),
        statusCategory: "service",
      },
      task: {
        icon: "📋",
        label: t("activities.entities.task"),
        statusCategory: "task",
      },
      order: {
        icon: "🧾",
        label: t("activities.entities.order"),
        statusCategory: "order",
      },
      evidence: { icon: "📎", label: t("activities.entities.evidence") },
      project: {
        icon: "📁",
        label: t("activities.entities.project"),
        statusCategory: "project",
      },
    }),
    [t]
  );

  const progressBadge = useCallback((value) => {
    switch (value) {
      case "done":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "in_progress":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "new":
      default:
        return "bg-blue-100 text-blue-700 border-blue-200";
    }
  }, []);

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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef2ff,_#f8fafc_45%,_#f1f5f9_100%)] px-3 sm:px-4 lg:px-6 py-8">
      <div className="max-w-6xl mx-auto bg-white/95 shadow-2xl rounded-3xl border border-gray-100 p-4 sm:p-8 lg:p-10 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <p className="text-[0.7rem] uppercase tracking-wide text-indigo-600 font-semibold">
              {t("activities.kicker")}
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              ✨ {t("activities.title")}
            </h1>
            <p className="text-sm text-gray-600">
              {t("activities.subtitle")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">
              {t("activities.filters.label")}
            </div>
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-gray-50 border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              {ENTITY_OPTIONS.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-gray-50 border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-gray-50 border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              {DATE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
            {dateRange === "custom" ? (
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide">
                  {t("activities.filters.from")}
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-gray-50 border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
                <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide">
                  {t("activities.filters.to")}
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-gray-50 border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
            ) : null}
            {dateError ? (
              <p className="text-xs text-rose-600 font-semibold">
                {dateError}
              </p>
            ) : null}
          </div>
        </div>

        {dateError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 font-semibold">
            {dateError}
          </div>
        ) : null}

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {PROGRESS_TABS.map((tab) => {
            const active = progress === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setProgress(tab.key)}
                className={[
                  "px-4 py-2 rounded-full text-xs sm:text-sm font-semibold border transition",
                  active
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50",
                ].join(" ")}
              >
                {t(tab.labelKey)}
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
        <div
          className={[
            "transition-opacity",
            isDateRangeInvalid ? "opacity-50 pointer-events-none" : "opacity-100",
          ].join(" ")}
        >
          {loading ? (
            <div className="py-10 text-center text-sm text-gray-500">
              {t("activities.loading")}
            </div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">
              {t("activities.empty")}
            </div>
          ) : (
            <div className="grid gap-4">
              {items.map((n) => {
                const meta = entityMeta[n.entityType] || {
                  icon: "✨",
                  label: t("activities.entities.other"),
                };
                const createdLabel = n.createdAt ? formatDate(n.createdAt) : "-";
                const actionKey = n.action || "created";
                const actionLabel = t(`activities.actions.${actionKey}`, {
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
                const actorName = [n?.actor?.firstName, n?.actor?.lastName]
                  .filter(Boolean)
                  .join(" ")
                  .trim() || n?.actor?.email || null;
                const actorLabel = actorName || t("activities.actor.unknown");
                const actorInitials = getInitials(actorLabel);
                const actorRole = n?.actor?.role || null;
                const actorRoleLabel = actorRole
                  ? t(`roles.${actorRole}`, { defaultValue: actorRole })
                  : null;

                let message = t("activities.genericMessage");
                if (n.entityType === "evidence" && n?.metadata?.evidenceCount) {
                  message = t("activities.messages.evidenceCount", {
                    count: n.metadata.evidenceCount,
                  });
                } else if (
                  n.entityStatus &&
                  n.entityStatus !== "created" &&
                  statusLabel
                ) {
                  message = t("activities.messages.status", {
                    entity: meta.label,
                    status: statusLabel,
                  });
                } else if (actionLabel) {
                  message = t("activities.messages.action", {
                    entity: meta.label,
                    action: actionLabel,
                  });
                }

                return (
                  <div
                    key={n.id}
                    className="rounded-2xl border bg-white border-gray-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
                  >
                    <div className="flex gap-3">
                      <div className="text-2xl">{meta.icon}</div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm sm:text-base font-semibold text-gray-900">
                            {title}
                          </h3>
                          <span className="text-[0.65rem] uppercase tracking-wide text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">
                            {meta.label}
                          </span>
                          <span
                            className={[
                              "text-[0.6rem] uppercase tracking-wide rounded-full px-2 py-0.5 border",
                              progressBadge(n.progress),
                            ].join(" ")}
                          >
                            {t(`activities.progress.${n.progress || "new"}`)}
                          </span>
                          {actionLabel ? (
                            <span className="text-[0.6rem] uppercase tracking-wide text-indigo-700 bg-indigo-100 border border-indigo-200 rounded-full px-2 py-0.5">
                              {actionLabel}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600 mt-1">
                          {message}
                        </p>
                        <p className="text-[0.7rem] text-gray-400 mt-2">
                          {createdLabel}
                          {actorName
                            ? ` • ${t("activities.by", { name: actorName })}`
                            : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-500 text-white text-xs font-bold flex items-center justify-center shadow">
                          {actorInitials}
                        </div>
                        <div>
                          <div className="text-[0.6rem] uppercase tracking-wide text-gray-500">
                            {t("activities.actor.label")}
                          </div>
                          <div className="text-xs font-semibold text-gray-800 max-w-[160px] truncate">
                            {actorLabel}
                          </div>
                          {actorRoleLabel ? (
                            <span
                              className={[
                                "mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[0.55rem] font-semibold uppercase tracking-wide",
                                roleBadgeClass(actorRole),
                              ].join(" ")}
                            >
                              {actorRoleLabel}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(resolveLink(n))}
                        disabled={isDateRangeInvalid}
                        className={[
                          "px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg transition",
                          isDateRangeInvalid
                            ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                            : "bg-indigo-600 text-white hover:bg-indigo-700",
                        ].join(" ")}
                      >
                        {t("activities.view")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
