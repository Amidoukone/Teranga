// ============================================================
// frontend/src/pages/ServiceTasksPage.jsx
// Version Premium 2025 AAAasAAaA MASTER SAFE (multi-pays) AAAasAAaA PARTIE 1 / 2
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
   ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â§ PAGE : ServiceTasksPage ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Style A Premium 2025 (MASTER SAFE)
   - Chargement des tÃƒÆ’Ã‚Â¢ches dÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢un service
   - Labels cohÃƒÆ’Ã‚Â©rents (statusLabel, typeLabelÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦)
   - UI responsive / mobile-first
   - ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Aucune rÃƒÆ’Ã‚Â©gression : mÃƒÆ’Ã‚Âªme endpoint / mÃƒÆ’Ã‚Âªme navigation preuves
   - ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Multi-pays : envoie params geo (admin scoped/master) comme le reste de lÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢app
   - ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Permissions : admin/master/agent/client (affichage) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â backend reste source de vÃƒÆ’Ã‚Â©ritÃƒÆ’Ã‚Â©
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
     ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â Auth headers (production-safe)
  ============================================================ */
  const authHeaders = useMemo(() => {
    const token =
      localStorage.getItem("teranga_token") ||
      localStorage.getItem("token");

    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  /* ============================================================
     ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â RÃƒÆ’Ã‚Â´les (UX uniquement) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â backend = source de vÃƒÆ’Ã‚Â©ritÃƒÆ’Ã‚Â©
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
     ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â¥ Chargement des tÃƒÆ’Ã‚Â¢ches (MASTER SAFE + Geo Params)
  ============================================================ */
  const loadTasks = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      setErrorMsg("");

      const { data } = await api.get(`/tasks/service/${id}`, {
        headers: authHeaders,
        params: getGeoParams(), // ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ multi-pays : scope admin/master
      });

      const rawTasks = data?.tasks || [];

 // Toujours recalculer les labels via i18n (AAAvite les labels FR renvoyAAAs par le backend)
      const withLabels = rawTasks.map((t) => applyLabels(t, "task"));

      setTasks(withLabels);
    } catch (err) {
      console.error("AAAAA...aTM Erreur chargement tAAAches:", err);
      setErrorMsg(t("serviceTasksPage.errors.load"));
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [id, authHeaders, t]);

  /* ============================================================
     ÃƒÂ°Ã…Â¸Ã…Â¡Ã¢â€šÂ¬ Init : user + tasks
  ============================================================ */
  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const u = await me();
        if (!active) return;
        const current = u?.user;
        if (!current) {
          window.location.href = "/login";
          return;
        }
        setUser(current);

        const roleNow = normalizeRole(current?.role);
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
              console.error("AAAAA...aTM Erreur chargement service:", err);
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
            console.error("AAAAA...aTM Erreur chargement agents:", err);
            if (active) setAgents([]);
          }
        }
      } catch (e) {
 // si besoin, laisse lAAAasAAazAapp gAAArer ailleurs (middleware / router)
        console.error("AAAAA...aTM me() ServiceTasksPage:", e);
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
     ÃƒÂ¢Ã…â€œÃ‚Â¨ CrÃƒÆ’Ã‚Â©ation d'une tÃƒÆ’Ã‚Â¢che (CLIENT + ADMIN)
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
      console.error("AAAAA...aTM Erreur crAAAation tAAAche:", err);
      setFormNotice({
        type: "error",
        message: err?.response?.data?.error || t("tasksPage.alerts.createError"),
      });
    } finally {
      setCreating(false);
    }
  }

  /* ============================================================
     ÃƒÂ¢Ã‚ÂÃ‚Â³ ÃƒÆ’Ã¢â‚¬Â°cran de chargement premium
  ============================================================ */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-4">
        <div className="bg-surface-card/90 border border-border/70 rounded-2xl shadow-xl px-6 py-5 text-center max-w-md w-full">
          <p className="text-sm font-semibold text-text-primary mb-1">
            {t("serviceTasksPage.loading.title")}
          </p>
          <p className="text-xs text-text-muted animate-pulse">
            {t("serviceTasksPage.loading.subtitle")}
          </p>
        </div>
      </div>
    );
  }

  /* ============================================================
     ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â¨ Rendu principal ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â responsive
  ============================================================ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-3 py-8 sm:px-4 sm:py-10">
      <div className="max-w-5xl mx-auto bg-surface-card shadow-2xl rounded-3xl border border-border/70 px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
 {/* AAA...A AAAA EN-TAA...A TE */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 pb-4 border-b border-border/70">
          <div className="break-words">
            <p className="text-[0.7rem] uppercase tracking-wide text-blue-600 font-semibold mb-1">
              {t("serviceTasksPage.header.kicker")}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary break-words">
                {headerTitle}
              </h1>

 {/* Badge UX AAAasAAaA sans impact backend */}
              {serviceTypeLabel && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[0.7rem] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                  {serviceTypeLabel}
                </span>
              )}
              {isMaster && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[0.7rem] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  {t("roles.master")}
                </span>
              )}
              {isAdmin && !isMaster && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[0.7rem] font-bold bg-surface-main text-text-secondary border border-border">
                  {t("roles.admin")}
                </span>
              )}
              {isAgent && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[0.7rem] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                  {t("roles.agent")}
                </span>
              )}
              {isClient && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[0.7rem] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  {t("roles.client")}
                </span>
              )}
            </div>

            <p className="text-xs sm:text-sm text-text-muted mt-1">
              {t("serviceTasksPage.header.subtitle")}
            </p>
            <p className="mt-2 inline-flex items-center gap-2 text-xs sm:text-sm text-text-muted bg-surface-main px-3 py-1.5 rounded-full border border-border">
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
                  ? t("serviceTasksPage.buttons.hideForm")
                  : t("serviceTasksPage.buttons.showForm")}
              </button>
            )}
            <button
              onClick={() => navigate(-1)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg shadow-sm app-btn-neutral transition"
            >
              <span>{t("common.back")}</span>
            </button>
          </div>
        </div>

        {/* Message d'erreur */}
        {errorMsg && (
          <div className="mb-6 rounded-2xl bg-rose-500/15 border border-rose-500/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-300 flex gap-2 items-start">
            <span className="mt-[2px]">!</span>
            <p className="break-words">{errorMsg}</p>
          </div>
        )}

 {/* FORMULAIRE (crAAAation rapide) */}
        {canCreateTask && showForm && (
          <div className="mb-8">
            <h2 className="text-base sm:text-lg font-semibold text-text-primary mb-2">
              {t("serviceTasksPage.form.title")}
            </h2>
            <p className="text-xs sm:text-sm text-text-muted mb-4">
              {t("serviceTasksPage.form.subtitle")}
            </p>

            {formNotice && (
              <div
                className={`mb-4 rounded-xl border px-4 py-3 text-xs sm:text-sm flex gap-2 items-start ${
                  formNotice.type === "error"
                    ? "bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300"
                    : "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                }`}
              >
                <span className="mt-[1px]">
                  {formNotice.type === "error" ? "!" : "i"}
                </span>
                <p className="break-words">{formNotice.message}</p>
              </div>
            )}

            <form
              onSubmit={createTask}
              className="
                grid grid-cols-1 sm:grid-cols-2 gap-4
                bg-surface-main p-4 sm:p-5 rounded-2xl border border-border
              "
            >
 {/* Service (prAAA-sAAAlectionnAAA) */}
              <div className="w-full sm:col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
                  {t("serviceTasksPage.form.serviceLabel")}
                </label>
                <input
                  value={
                    serviceTitle ||
                    t("serviceTasksPage.form.serviceValue", { id })
                  }
                  disabled
                  className="
                    w-full border border-border rounded-lg px-3 py-2
                    text-sm sm:text-base bg-surface-main/80 text-text-secondary
                  "
                />
                <p className="mt-1 text-xs text-text-muted">
                  {t("serviceTasksPage.form.serviceHint")}
                </p>
              </div>

 {/* Type de tAAAche */}
              <div className="w-full">
                <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
                  {t("tasksPage.form.typeLabel")}
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  required
                  className="
                    w-full border border-border rounded-lg px-3 py-2
                    text-sm sm:text-base bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500
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
                <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
                  {t("tasksPage.form.titleLabel")} <span className="text-red-500">*</span>
                </label>
                <input
                  placeholder={t("tasksPage.form.titlePlaceholder")}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  className="
                    w-full border border-border rounded-lg px-3 py-2
                    text-sm sm:text-base bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500 break-words
                  "
                />
              </div>

              {/* Description */}
              <div className="w-full sm:col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
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
                    w-full border border-border rounded-lg px-3 py-2
                    text-sm sm:text-base bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500 break-words
                  "
                />
              </div>

 {/* PrioritAAA */}
              <div className="w-full">
                <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
                  {t("tasksPage.form.priorityLabel")}
                </label>
                <select
                  value={form.priority}
                  onChange={(e) =>
                    setForm({ ...form, priority: e.target.value })
                  }
                  className="
                    w-full border border-border rounded-lg px-3 py-2
                    text-sm sm:text-base bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500
                  "
                >
                  {Object.entries(TASK_PRIORITIES).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

 {/* Date dAAAasAAazAAAAchAAAance */}
              <div className="w-full">
                <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
                  {t("tasksPage.form.dueDateLabel")}
                </label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="
                    w-full border border-border rounded-lg px-3 py-2
                    text-sm sm:text-base bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500
                  "
                />
              </div>

 {/* CoAAAt estimAAA */}
              <div className="w-full">
                <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
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
                    w-full border border-border rounded-lg px-3 py-2
                    text-sm sm:text-base bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500
                  "
                />
              </div>

              {/* Assignation (admin/master uniquement) */}
              {isAdmin && (
                <div className="w-full">
                  <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
                    {t("tasksPage.form.assignedLabel")}
                  </label>
                  <select
                    value={form.assignedTo}
                    onChange={(e) =>
                      setForm({ ...form, assignedTo: e.target.value })
                    }
                    className="
                      w-full border border-border rounded-lg px-3 py-2
                      text-sm sm:text-base bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500
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
            <div className="w-12 h-12 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 flex items-center justify-center mb-3">
              <span className="text-xl">i</span>
            </div>
            <p className="text-sm font-semibold text-text-primary mb-1">
              {t("serviceTasksPage.empty.title")}
            </p>
            <p className="text-xs text-text-muted max-w-sm">
              {canCreateTask
                ? t("serviceTasksPage.empty.subtitleCanCreate")
                : t("serviceTasksPage.empty.subtitleReadOnly")}
            </p>
            {canCreateTask && !showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg shadow-sm bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                {t("serviceTasksPage.buttons.showForm")}
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
 // UX only: donne le rAAA le courant (sans changer lAAAasAAazAACL backend)
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
   ÃƒÂ°Ã…Â¸Ã‚Â§Ã‚Â© TaskCard ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â carte responsive & premium (Style A)
   ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Aucune rÃƒÆ’Ã‚Â©gression : mÃƒÆ’Ã‚Âªme navigation / mÃƒÆ’Ã‚Âªmes infos
   ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ MASTER SAFE : aucun filtrage cÃƒÆ’Ã‚Â´tÃƒÆ’Ã‚Â© UI, backend gÃƒÆ’Ã‚Â¨re le scope/ACL
=========================================================================== */
function TaskCard({ task, navigate, userRole, isMaster }) {
  const { t } = useTranslation();
  const { formatDateTime } = useLocale();
  const statusMeta =
    task.status === "created"
      ? {
          icon: "*",
          badge: "bg-surface-main/80 text-text-secondary border-border",
        }
      : task.status === "in_progress"
      ? {
          icon: "~",
          badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
        }
      : task.status === "completed"
      ? {
          icon: "ok",
          badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
        }
      : task.status === "validated"
      ? {
          icon: "ok",
          badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
        }
      : {
          icon: "-",
          badge: "bg-surface-main/80 text-text-muted border-border",
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
        bg-gradient-to-br from-surface-main via-surface-card to-surface-main
        border border-border rounded-2xl shadow-sm
        p-4 sm:p-5 hover:shadow-md hover:border-blue-500/40 transition
        w-full break-words
      "
    >
      {/* Titre + statut */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold text-text-primary break-words">
              {task.title || t("serviceTasksPage.taskFallback", { id: task.id })}
            </h3>

 {/* Badge rAAA le (UX only) */}
            {isMaster && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                {t("roles.master")}
              </span>
            )}
            {userRole === "admin" && !isMaster && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-surface-main text-text-secondary border border-border">
                {t("roles.admin")}
              </span>
            )}
            {userRole === "agent" && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                {t("roles.agent")}
              </span>
            )}
            {userRole === "client" && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                {t("roles.client")}
              </span>
            )}
          </div>

          <p className="text-xs sm:text-sm text-text-secondary break-words mt-1">
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

 {/* DAAAtails */}
      <div className="mt-4 sm:mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm text-text-secondary">
        <div className="break-words">
          <span className="font-semibold text-text-primary">
            {t("serviceTasksPage.details.type")}:
          </span>{" "}
          {TASK_TYPES[task.type] || task.type || t("common.dash")}
        </div>

        <div className="break-words">
          <span className="font-semibold text-text-primary">
            {t("serviceTasksPage.details.creator")}:
          </span>{" "}
          {creatorLabel}
        </div>

        <div className="break-words">
          <span className="font-semibold text-text-primary">
            {t("serviceTasksPage.details.assignee")}:
          </span>{" "}
          {assigneeLabel}
        </div>

        <div className="break-words">
          <span className="font-semibold text-text-primary">
            {t("serviceTasksPage.details.taskId")}:
          </span>{" "}
          {task.id}
        </div>

        {task.createdAt && (
          <div className="break-words">
            <span className="font-semibold text-text-primary">
              {t("serviceTasksPage.details.createdAt")}:
            </span>{" "}
            {formatDateTime(task.createdAt)}
          </div>
        )}

        {task.updatedAt && (
          <div className="break-words">
            <span className="font-semibold text-text-primary">
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
          <span>{t("serviceTasksPage.actions.viewEvidences")}</span>

        </button>
      </div>
    </div>
  );
}





