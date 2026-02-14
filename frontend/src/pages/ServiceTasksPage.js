// ============================================================
// frontend/src/pages/ServiceTasksPage.jsx
// Version Premium 2025 — MASTER SAFE (multi-pays) — PARTIE 1 / 2
// ============================================================

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import {
  applyLabels,
  TASK_STATUSES,
  TASK_TYPES,
  TASK_PRIORITIES,
  SERVICE_TYPES,
} from "../utils/labels";
import { me } from "../services/auth";
import { getGeoParams } from "../services/geo";
import { normalizeRole, isMasterUser } from "../utils/role";
import { useLocale } from "../i18n/useLocale";
import { useTranslation } from "react-i18next";

/* ========================================================================
   🔧 PAGE : ServiceTasksPage — Style A Premium 2025 (MASTER SAFE)
   - Chargement des tâches d’un service
   - Labels cohérents (statusLabel, typeLabel…)
   - UI responsive / mobile-first
   - ✅ Aucune régression : même endpoint / même navigation preuves
   - ✅ Multi-pays : envoie params geo (admin scoped/master) comme le reste de l’app
   - ✅ Permissions : admin/master/agent/client (affichage) — backend reste source de vérité
=========================================================================== */

export default function ServiceTasksPage() {
  const { t } = useTranslation();
  const { id } = useParams(); // serviceId depuis URL
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [agents, setAgents] = useState([]);
  const [serviceInfo, setServiceInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [user, setUser] = useState(null);
  const [creating, setCreating] = useState(false);
  const [formNotice, setFormNotice] = useState(null);

  const [showForm, setShowForm] = useState(() => {
    const saved = localStorage.getItem("teranga_service_tasks_showForm");
    return saved === null ? true : saved === "1";
  });

  const [form, setForm] = useState({
    title: "",
    type: "other",
    description: "",
    priority: "normal",
    dueDate: "",
    estimatedCost: "",
    assignedTo: "",
  });

  /* ============================================================
     🔐 Auth headers (production-safe)
  ============================================================ */
  const authHeaders = useMemo(() => {
    const token =
      localStorage.getItem("teranga_token") ||
      localStorage.getItem("token");

    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  /* ============================================================
     🔐 Rôles (UX uniquement) — backend = source de vérité
  ============================================================ */
  const role = normalizeRole(user?.role);
  const isAdmin = role === "admin";
  const isAgent = role === "agent";
  const isClient = role === "client";
  const isMaster = isMasterUser(user); // MASTER = admin scoped (UX tag)
  const canCreateTask = isClient || isAdmin;
  const serviceTitle = serviceInfo?.title?.trim() || "";
  const serviceTypeLabel =
    serviceInfo?.typeLabel ||
    (serviceInfo?.type ? SERVICE_TYPES[serviceInfo.type] : "") ||
    "";
  const headerTotal = tasks.length;
  const headerTitle = serviceTitle
    ? t("serviceTasksPage.header.titleWithName", { name: serviceTitle })
    : t("serviceTasksPage.header.title", { id });

  /* ============================================================
     📥 Chargement des tâches (MASTER SAFE + Geo Params)
  ============================================================ */
  const loadTasks = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      setErrorMsg("");

      const { data } = await api.get(`/tasks/service/${id}`, {
        headers: authHeaders,
        params: getGeoParams(), // ✅ multi-pays : scope admin/master
      });

      const rawTasks = data?.tasks || [];

      // Toujours recalculer les labels via i18n (évite les labels FR renvoyés par le backend)
      const withLabels = rawTasks.map((t) => applyLabels(t, "task"));

      setTasks(withLabels);
    } catch (err) {
      console.error("❌ Erreur chargement tâches:", err);
      setErrorMsg(t("serviceTasksPage.errors.load"));
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [id, authHeaders, t]);

  /* ============================================================
     🚀 Init : user + tasks
  ============================================================ */
  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const u = await me();
        if (!active) return;
        setUser(u?.user || null);

        const roleNow = normalizeRole(u?.user?.role);
        if (id) {
          const serviceId = parseInt(id, 10);
          if (Number.isFinite(serviceId)) {
            try {
              let services = [];
              if (roleNow === "admin") {
                const { data } = await api.get("/services", {
                  headers: authHeaders,
                  params: getGeoParams(),
                });
                services = data?.services || [];
              } else if (roleNow === "client") {
                const { data } = await api.get("/services/me", {
                  headers: authHeaders,
                  params: getGeoParams(),
                });
                services = data?.services || [];
              } else if (roleNow === "agent") {
                const { data } = await api.get("/services/agent/services", {
                  headers: authHeaders,
                  params: getGeoParams(),
                });
                services = data?.services || [];
              }

              const found = services.find(
                (s) => String(s.id) === String(serviceId)
              );
              if (active) {
                setServiceInfo(found ? applyLabels(found, "service") : null);
              }
            } catch (err) {
              console.error("❌ Erreur chargement service:", err);
              if (active) setServiceInfo(null);
            }
          }
        }

        if (roleNow === "admin") {
          try {
            const { data: agentsRes } = await api.get("/users", {
              params: { role: "agent", ...getGeoParams() },
              headers: authHeaders,
            });
            if (active) setAgents(agentsRes?.users || []);
          } catch (err) {
            console.error("❌ Erreur chargement agents:", err);
            if (active) setAgents([]);
          }
        }
      } catch (e) {
        // si besoin, laisse l’app gérer ailleurs (middleware / router)
        console.error("❌ me() ServiceTasksPage:", e);
      } finally {
        if (active) {
          await loadTasks();
        }
      }
    }

    init();

    return () => {
      active = false;
    };
  }, [loadTasks, authHeaders, id]);

  useEffect(() => {
    localStorage.setItem("teranga_service_tasks_showForm", showForm ? "1" : "0");
  }, [showForm]);

  useEffect(() => {
    if (!serviceTitle) return;
    setForm((prev) =>
      prev.title ? prev : { ...prev, title: serviceTitle }
    );
  }, [serviceTitle]);

  /* ============================================================
     ✨ Création d'une tâche (CLIENT + ADMIN)
  ============================================================ */
  async function createTask(e) {
    e.preventDefault();
    if (!id) return;

    try {
      setFormNotice(null);
      setCreating(true);
      const serviceId = parseInt(id, 10);
      const payload = {
        serviceId: Number.isFinite(serviceId) ? serviceId : null,
        title: form.title.trim(),
        type: form.type,
        description: form.description?.trim() || null,
        priority: form.priority,
        dueDate: form.dueDate ? new Date(form.dueDate) : null,
        estimatedCost:
          form.estimatedCost === "" ? null : parseFloat(form.estimatedCost),
        assignedTo: form.assignedTo ? parseInt(form.assignedTo, 10) : null,
      };

      await api.post("/tasks", payload, { headers: authHeaders });
      setFormNotice({
        type: "success",
        message: t("tasksPage.alerts.createSuccess"),
      });

      setForm({
        title: "",
        type: "other",
        description: "",
        priority: "normal",
        dueDate: "",
        estimatedCost: "",
        assignedTo: "",
      });

      await loadTasks();
    } catch (err) {
      console.error("❌ Erreur création tâche:", err);
      setFormNotice({
        type: "error",
        message: err?.response?.data?.error || t("tasksPage.alerts.createError"),
      });
    } finally {
      setCreating(false);
    }
  }

  /* ============================================================
     ⏳ Écran de chargement premium
  ============================================================ */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4">
        <div className="bg-white/90 border border-gray-100 rounded-2xl shadow-xl px-6 py-5 text-center max-w-md w-full">
          <p className="text-sm font-semibold text-gray-900 mb-1">
            {t("serviceTasksPage.loading.title")}
          </p>
          <p className="text-xs text-gray-500 animate-pulse">
            {t("serviceTasksPage.loading.subtitle")}
          </p>
        </div>
      </div>
    );
  }

  /* ============================================================
     🎨 Rendu principal — responsive
  ============================================================ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-3 py-8 sm:px-4 sm:py-10">
      <div className="max-w-5xl mx-auto bg-white shadow-2xl rounded-3xl border border-gray-100 px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* 🧭 EN-TÊTE */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 pb-4 border-b border-gray-100">
          <div className="break-words">
            <p className="text-[0.7rem] uppercase tracking-wide text-blue-600 font-semibold mb-1">
              {t("serviceTasksPage.header.kicker")}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 break-words">
                📋 {headerTitle}
              </h1>

              {/* Badge UX — sans impact backend */}
              {serviceTypeLabel && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[0.7rem] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {serviceTypeLabel}
                </span>
              )}
              {isMaster && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[0.7rem] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  {t("roles.master")}
                </span>
              )}
              {isAdmin && !isMaster && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[0.7rem] font-bold bg-slate-50 text-slate-700 border border-slate-200">
                  {t("roles.admin")}
                </span>
              )}
              {isAgent && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[0.7rem] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {t("roles.agent")}
                </span>
              )}
              {isClient && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[0.7rem] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {t("roles.client")}
                </span>
              )}
            </div>

            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              {t("serviceTasksPage.header.subtitle")}
            </p>
            <p className="mt-2 inline-flex items-center gap-2 text-xs sm:text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
              {t("serviceTasksPage.header.count", { count: headerTotal })}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {canCreateTask && (
              <button
                onClick={() => setShowForm((v) => !v)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg shadow-sm bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                {showForm
                  ? `➖ ${t("serviceTasksPage.buttons.hideForm")}`
                  : `➕ ${t("serviceTasksPage.buttons.showForm")}`}
              </button>
            )}
            <button
              onClick={() => navigate(-1)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg shadow-sm bg-slate-900 text-white hover:bg-slate-800 transition"
            >
              <span>← {t("common.back")}</span>
            </button>
          </div>
        </div>

        {/* Message d'erreur */}
        {errorMsg && (
          <div className="mb-6 rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 flex gap-2 items-start">
            <span className="mt-[2px]">⚠️</span>
            <p className="break-words">{errorMsg}</p>
          </div>
        )}

        {/* FORMULAIRE (création rapide) */}
        {canCreateTask && showForm && (
          <div className="mb-8">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
              ➕ {t("serviceTasksPage.form.title")}
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mb-4">
              {t("serviceTasksPage.form.subtitle")}
            </p>

            {formNotice && (
              <div
                className={`mb-4 rounded-xl border px-4 py-3 text-xs sm:text-sm flex gap-2 items-start ${
                  formNotice.type === "error"
                    ? "bg-rose-50 border-rose-200 text-rose-700"
                    : "bg-emerald-50 border-emerald-200 text-emerald-700"
                }`}
              >
                <span className="mt-[1px]">
                  {formNotice.type === "error" ? "⚠️" : "✅"}
                </span>
                <p className="break-words">{formNotice.message}</p>
              </div>
            )}

            <form
              onSubmit={createTask}
              className="
                grid grid-cols-1 sm:grid-cols-2 gap-4
                bg-gray-50 p-4 sm:p-5 rounded-2xl border border-gray-200
              "
            >
              {/* Service (pré-sélectionné) */}
              <div className="w-full sm:col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  {t("serviceTasksPage.form.serviceLabel")}
                </label>
                <input
                  value={
                    serviceTitle ||
                    t("serviceTasksPage.form.serviceValue", { id })
                  }
                  disabled
                  className="
                    w-full border border-gray-300 rounded-lg px-3 py-2
                    text-sm sm:text-base bg-gray-100 text-gray-700
                  "
                />
                <p className="mt-1 text-xs text-gray-500">
                  {t("serviceTasksPage.form.serviceHint")}
                </p>
              </div>

              {/* Type de tâche */}
              <div className="w-full">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  {t("tasksPage.form.typeLabel")}
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  required
                  className="
                    w-full border border-gray-300 rounded-lg px-3 py-2
                    text-sm sm:text-base focus:ring-2 focus:ring-blue-500
                  "
                >
                  {Object.entries(TASK_TYPES).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Titre */}
              <div className="w-full sm:col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  {t("tasksPage.form.titleLabel")} <span className="text-red-500">*</span>
                </label>
                <input
                  placeholder={t("tasksPage.form.titlePlaceholder")}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  className="
                    w-full border border-gray-300 rounded-lg px-3 py-2
                    text-sm sm:text-base focus:ring-2 focus:ring-blue-500 break-words
                  "
                />
              </div>

              {/* Description */}
              <div className="w-full sm:col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  {t("tasksPage.form.descriptionLabel")}
                </label>
                <textarea
                  placeholder={t("tasksPage.form.descriptionPlaceholder")}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={3}
                  className="
                    w-full border border-gray-300 rounded-lg px-3 py-2
                    text-sm sm:text-base focus:ring-2 focus:ring-blue-500 break-words
                  "
                />
              </div>

              {/* Priorité */}
              <div className="w-full">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  {t("tasksPage.form.priorityLabel")}
                </label>
                <select
                  value={form.priority}
                  onChange={(e) =>
                    setForm({ ...form, priority: e.target.value })
                  }
                  className="
                    w-full border border-gray-300 rounded-lg px-3 py-2
                    text-sm sm:text-base focus:ring-2 focus:ring-blue-500
                  "
                >
                  {Object.entries(TASK_PRIORITIES).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date d’échéance */}
              <div className="w-full">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  {t("tasksPage.form.dueDateLabel")}
                </label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="
                    w-full border border-gray-300 rounded-lg px-3 py-2
                    text-sm sm:text-base focus:ring-2 focus:ring-blue-500
                  "
                />
              </div>

              {/* Coût estimé */}
              <div className="w-full">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  {t("tasksPage.form.estimatedCostLabel")}
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder={t("tasksPage.form.estimatedCostPlaceholder")}
                  value={form.estimatedCost}
                  onChange={(e) =>
                    setForm({ ...form, estimatedCost: e.target.value })
                  }
                  className="
                    w-full border border-gray-300 rounded-lg px-3 py-2
                    text-sm sm:text-base focus:ring-2 focus:ring-blue-500
                  "
                />
              </div>

              {/* Assignation (admin/master uniquement) */}
              {isAdmin && (
                <div className="w-full">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    {t("tasksPage.form.assignedLabel")}
                  </label>
                  <select
                    value={form.assignedTo}
                    onChange={(e) =>
                      setForm({ ...form, assignedTo: e.target.value })
                    }
                    className="
                      w-full border border-gray-300 rounded-lg px-3 py-2
                      text-sm sm:text-base focus:ring-2 focus:ring-blue-500
                    "
                  >
                    <option value="">
                      {t("tasksPage.form.assignedPlaceholder")}
                    </option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.firstName || a.lastName
                          ? `${a.firstName || ""} ${a.lastName || ""}`.trim()
                          : a.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Bouton de soumission */}
              <div className="col-span-1 sm:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={creating}
                  className="
                    w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white rounded-lg
                    text-sm sm:text-base font-semibold hover:bg-blue-700 transition
                    disabled:bg-blue-300 disabled:cursor-not-allowed
                  "
                >
                  {creating
                    ? t("serviceTasksPage.form.submitting")
                    : t("tasksPage.form.submit")}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Liste vide */}
        {tasks.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-3">
              <span className="text-xl">🗂️</span>
            </div>
            <p className="text-sm font-semibold text-gray-800 mb-1">
              {t("serviceTasksPage.empty.title")}
            </p>
            <p className="text-xs text-gray-500 max-w-sm">
              {canCreateTask
                ? t("serviceTasksPage.empty.subtitleCanCreate")
                : t("serviceTasksPage.empty.subtitleReadOnly")}
            </p>
            {canCreateTask && !showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg shadow-sm bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                ➕ {t("serviceTasksPage.buttons.showForm")}
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-5">
            {tasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                navigate={navigate}
                // UX only: donne le rôle courant (sans changer l’ACL backend)
                userRole={role}
                isMaster={isMaster}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ========================================================================
   🧩 TaskCard — carte responsive & premium (Style A)
   ✅ Aucune régression : même navigation / mêmes infos
   ✅ MASTER SAFE : aucun filtrage côté UI, backend gère le scope/ACL
=========================================================================== */
function TaskCard({ task, navigate, userRole, isMaster }) {
  const { t } = useTranslation();
  const { formatDateTime } = useLocale();
  const statusMeta =
    task.status === "created"
      ? {
          icon: "🆕",
          badge: "bg-slate-100 text-slate-700 border-slate-200",
        }
      : task.status === "in_progress"
      ? {
          icon: "⏳",
          badge: "bg-blue-50 text-blue-700 border-blue-100",
        }
      : task.status === "completed"
      ? {
          icon: "✅",
          badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
        }
      : task.status === "validated"
      ? {
          icon: "✔️",
          badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
        }
      : {
          icon: "⏺",
          badge: "bg-slate-100 text-slate-500 border-slate-200",
        };

  const creatorLabel =
    task.creator?.email ||
    task.creator?.name ||
    task.creatorLabel ||
    (task.creator
      ? `${task.creator.firstName || ""} ${task.creator.lastName || ""}`.trim()
      : "") ||
    t("common.dash");

  const assigneeLabel = task.assignee
    ? (
        `${task.assignee.firstName || ""} ${task.assignee.lastName || ""}`.trim() ||
        task.assignee.email
      )
    : t("serviceTasksPage.details.unassigned");

  return (
    <div
      className="
        bg-gradient-to-br from-slate-50 via-white to-slate-50
        border border-gray-200 rounded-2xl shadow-sm
        p-4 sm:p-5 hover:shadow-md hover:border-blue-100 transition
        w-full break-words
      "
    >
      {/* Titre + statut */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 break-words">
              {task.title || t("serviceTasksPage.taskFallback", { id: task.id })}
            </h3>

            {/* Badge rôle (UX only) */}
            {isMaster && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                {t("roles.master")}
              </span>
            )}
            {userRole === "admin" && !isMaster && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-slate-50 text-slate-700 border border-slate-200">
                {t("roles.admin")}
              </span>
            )}
            {userRole === "agent" && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {t("roles.agent")}
              </span>
            )}
            {userRole === "client" && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {t("roles.client")}
              </span>
            )}
          </div>

          <p className="text-xs sm:text-sm text-gray-600 break-words mt-1">
            {task.description || t("serviceTasksPage.details.noDescription")}
          </p>
        </div>

        <div
          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[0.7rem] font-semibold whitespace-nowrap border ${statusMeta.badge}`}
        >
          <span>{statusMeta.icon}</span>
          <span>
            {TASK_STATUSES[task.status] ||
              (task.status ? task.status.replace("_", " ") : t("common.dash"))}
          </span>
        </div>
      </div>

      {/* Détails */}
      <div className="mt-4 sm:mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm text-gray-700">
        <div className="break-words">
          <span className="font-semibold text-gray-800">
            {t("serviceTasksPage.details.type")}:
          </span>{" "}
          {TASK_TYPES[task.type] || task.type || t("common.dash")}
        </div>

        <div className="break-words">
          <span className="font-semibold text-gray-800">
            {t("serviceTasksPage.details.creator")}:
          </span>{" "}
          {creatorLabel}
        </div>

        <div className="break-words">
          <span className="font-semibold text-gray-800">
            {t("serviceTasksPage.details.assignee")}:
          </span>{" "}
          {assigneeLabel}
        </div>

        <div className="break-words">
          <span className="font-semibold text-gray-800">
            {t("serviceTasksPage.details.taskId")}:
          </span>{" "}
          {task.id}
        </div>

        {task.createdAt && (
          <div className="break-words">
            <span className="font-semibold text-gray-800">
              {t("serviceTasksPage.details.createdAt")}:
            </span>{" "}
            {formatDateTime(task.createdAt)}
          </div>
        )}

        {task.updatedAt && (
          <div className="break-words">
            <span className="font-semibold text-gray-800">
              {t("serviceTasksPage.details.updatedAt")}:
            </span>{" "}
            {formatDateTime(task.updatedAt)}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-5 sm:mt-6">
        <button
          onClick={() => navigate(`/tasks/${task.id}/evidences`)}
          className="
            w-full sm:w-auto inline-flex items-center justify-center gap-1
            px-4 py-2 text-xs sm:text-sm font-semibold
            bg-blue-600 text-white rounded-lg shadow-sm
            hover:bg-blue-700 active:bg-blue-800 transition
          "
        >
          <span>📎</span>
          <span>{t("serviceTasksPage.actions.viewEvidences")}</span>
        </button>
      </div>
    </div>
  );
}



