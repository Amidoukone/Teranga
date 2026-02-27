// ============================================================
// frontend/src/pages/ProjectDetailPage.jsx
// Contexte: detail de projet.
// ============================================================

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { me } from "../services/auth";
import {
  getProjectById,
  getProjectPhases,
  saveProjectPhase,
  deleteProjectPhase,
  getProjectDocuments,
  uploadProjectDocuments,
  deleteProjectDocument,
  updateProject,
} from "../services/projects";
import {
  applyLabels,
  CURRENCY_LABELS,
  TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
  PROJECT_STATUSES,
} from "../utils/labels";
import { getTransactions, createTransaction } from "../services/transactions";
import { normalizeRole, isMasterUser } from "../utils/role";
import { useLocale } from "../i18n/useLocale";
import { useTranslation } from "react-i18next";
import { notify } from '../utils/notify';
import { useDeleteConfirm } from "../hooks/useDeleteConfirm";

/* ============================================================
   URLs API/fichiers (dev/prod).
============================================================ */
const FILE_BASE =
  window.__TERANGA_FILE_BASE_URL || process.env.REACT_APP_FILE_BASE_URL || "";
const CURRENCY_CODES = Object.keys(CURRENCY_LABELS);

function normalizePath(path = "") {
  if (!path) return "";
  const clean = String(path).trim().replace(/\\/g, "/");
  if (/^https?:\/\//i.test(clean)) return clean;
  const pref = clean.startsWith("/") ? clean : "/" + clean;
  return pref.replace(/\/{2,}/g, "/");
}

function toAbsUrl(path = "") {
  const norm = normalizePath(path);
  if (/^https?:\/\//i.test(norm)) return norm;

  return FILE_BASE.replace(/\/$/, "") + "/" + norm.replace(/^\//, "");
}

function extractFileName(path = "") {
  if (!path) return "";
  try {
    const url = new URL(path);
    return decodeURIComponent(url.pathname.split("/").pop() || "");
  } catch {
    const last = String(path).split("/").pop() || "";
    try {
      return decodeURIComponent(last);
    } catch {
      return last;
    }
  }
}

function getDocDisplayName(doc, fallbackLabel = "Document") {
  if (!doc) return fallbackLabel;
  if (doc.title) return doc.title;
  if (doc.originalName) return doc.originalName;
  return extractFileName(doc.filePath || "") || fallbackLabel;
}

function getDocUploaderLabel(doc, fallbackLabel) {
  if (!doc) return fallbackLabel;
  if (doc.uploaderName) return doc.uploaderName;

  const u =
    doc.uploader ||
    doc.createdByUser ||
    doc.createdBy ||
    doc.user ||
    doc.author ||
    null;

  if (u) {
    const fn = u.firstName || u.firstname || "";
    const ln = u.lastName || u.lastname || "";
    const full = `${fn} ${ln}`.trim();
    return full || u.email || fallbackLabel;
  }

  return fallbackLabel;
}

function inferDocKind(doc) {
  const mime = (doc?.mimeType || "").toLowerCase();
  const name = doc?.originalName || doc?.filePath || doc?.title || "";

  if (doc?.kind === "photo") return "image";
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)) return "image";
  if (/\.pdf$/i.test(name)) return "pdf";
  return "other";
}

function getFileExtLabel(name = "", fallback = "FILE") {
  const base = String(name || "").trim();
  if (!base) return fallback;
  const parts = base.split(".");
  if (parts.length < 2) return fallback;
  const ext = parts[parts.length - 1].slice(0, 6).toUpperCase();
  return ext || fallback;
}

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let val = n;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx += 1;
  }
  const precision = val >= 100 ? 0 : val >= 10 ? 1 : 2;
  return `${val.toFixed(precision)} ${units[idx]}`;
}

/* ============================================================
   UI Components
============================================================ */
function Badge({ color = "gray", children }) {
  const colors = {
    blue: "bg-blue-100 text-blue-800 ring-blue-200",
    green: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    yellow: "bg-amber-100 text-amber-800 ring-amber-200",
    red: "bg-rose-100 text-rose-800 ring-rose-200",
    gray: "bg-surface-main/80 text-text-primary ring-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ring-1 shadow-sm ${colors[color]}`}
    >
      {children}
    </span>
  );
}

function Btn({ variant = "primary", size = "md", children, className = "", ...props }) {
  const styles = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-400",
    secondary: "bg-surface-main/80 text-text-primary hover:bg-surface-main/80 focus:ring-primary/20",
    danger: "bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-400",
    warning: "bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-400",
    ghost:
      "bg-surface-card border border-border text-text-secondary hover:bg-surface-main focus:ring-primary/20",
  };

  const sizeClasses = {
    md: "px-3.5 py-2 text-sm",
    sm: "px-3 py-1.5 text-xs",
    xs: "px-2 py-1 text-[11px]",
  };

  return (
    <button
      {...props}
      className={`
        inline-flex items-center justify-center rounded-xl font-semibold shadow-sm
        transition-all duration-150 
        focus:outline-none focus:ring-2 focus:ring-offset-1 
        disabled:opacity-60 disabled:cursor-not-allowed
        ${styles[variant]} ${sizeClasses[size]} ${className}
      `}
    >
      {children}
    </button>
  );
}

/* ============================================================
   Contexte: detail d un projet.
============================================================ */
function getTransactionAuthorLabel(transaction, dashLabel = "-") {
  if (!transaction) return dashLabel;

  if (transaction.user) {
    const fn = transaction.user.firstName || transaction.user.firstname || "";
    const ln = transaction.user.lastName || transaction.user.lastname || "";
    const full = `${fn} ${ln}`.trim();
    if (full.length > 0) return full;
    if (transaction.user.email) return transaction.user.email;
  }

  if (transaction.createdByUser) {
    const full = `${transaction.createdByUser.firstName || ""} ${transaction.createdByUser.lastName || ""}`.trim();
    if (full.length > 0) return full;
    if (transaction.createdByUser.email) return transaction.createdByUser.email;
  }

  return dashLabel;
}

/* ============================================================
   Sous-composant formulaire.
============================================================ */
function ProjectTransactionForm({ projectId, currentUser, onSuccess }) {
  const { t } = useTranslation();
  const canSeeOrder =
    normalizeRole(currentUser?.role) === "admin" ||
    normalizeRole(currentUser?.role) === "agent";
  const [form, setForm] = useState({
    type: "expense",
    amount: "",
    currency: "XOF",
    paymentMethod: "",
    description: "",
    orderId: "",
    proofFile: null,
  });
  const [saving, setSaving] = useState(false);
  const currencyOptions = useMemo(
    () =>
      CURRENCY_CODES.map((code) => ({
        value: code,
        label: t(`currency.${code}`, { defaultValue: code }),
      })),
    [t]
  );

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setSaving(true);

      await createTransaction({
        type: form.type,
        amount: form.amount === "" ? undefined : Number(form.amount),
        currency: form.currency,
        paymentMethod: form.paymentMethod || undefined,
        description: form.description || undefined,
        orderId: form.orderId ? Number(form.orderId) : undefined,
        proofFile: form.proofFile || undefined,
        projectId: Number(projectId),
        userId: currentUser?.id,
      });

      notify(t("projects.transaction.alerts.createSuccess"));
      setForm({
        type: "expense",
        amount: "",
        currency: "XOF",
        paymentMethod: "",
        description: "",
        orderId: "",
        proofFile: null,
      });
      onSuccess?.();
    } catch (err) {
      console.error("Transaction error:", err);
      notify(
        err?.response?.data?.error ||
          t("projects.transaction.alerts.createError")
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-6 bg-surface-main border border-border rounded-2xl p-4 shadow-sm w-full max-w-full min-w-0">
      <h4 className="text-sm font-semibold text-text-secondary mb-3">
        {t("projects.transaction.title")}
      </h4>
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        <div>
          <label className="text-xs text-text-secondary font-medium mb-1 block">
            {t("projects.transaction.typeLabel")}
          </label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="border border-border rounded-lg px-3 py-2 text-sm w-full min-w-0"
          >
            <option value="expense">{t("transactions.type.expense")}</option>
            <option value="revenue">{t("transactions.type.revenue")}</option>
            <option value="commission">{t("transactions.type.commission")}</option>
            <option value="adjustment">{t("transactions.type.adjustment")}</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-text-secondary font-medium mb-1 block">
            {t("projects.transaction.amountLabel")}
          </label>
          <input
            type="number"
            step="0.01"
            placeholder={t("projects.transaction.amountPlaceholder")}
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
            className="border border-border rounded-lg px-3 py-2 text-sm w-full min-w-0"
          />
        </div>

        <div>
          <label className="text-xs text-text-secondary font-medium mb-1 block">
            {t("projects.transaction.currencyLabel")}
          </label>
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className="border border-border rounded-lg px-3 py-2 text-sm w-full min-w-0"
          >
            {currencyOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-text-secondary font-medium mb-1 block">
            {t("projects.transaction.paymentMethodLabel")}
          </label>
          <input
            placeholder={t("projects.transaction.paymentMethodPlaceholder")}
            value={form.paymentMethod}
            onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            className="border border-border rounded-lg px-3 py-2 text-sm w-full min-w-0"
          />
        </div>

        {canSeeOrder && (
          <div className="sm:col-span-2">
            <label className="text-xs text-text-secondary font-medium mb-1 block">
              {t("projects.transaction.orderIdLabel")}
            </label>
            <input
              type="number"
              value={form.orderId}
              onChange={(e) => setForm({ ...form, orderId: e.target.value })}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm min-w-0"
            />
          </div>
        )}

        <div className="sm:col-span-2">
          <label className="text-xs text-text-secondary font-medium mb-1 block">
            {t("projects.transaction.descriptionLabel")}
          </label>
          <textarea
            rows={3}
            placeholder={t("projects.transaction.descriptionPlaceholder")}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="border border-border rounded-lg px-3 py-2 text-sm w-full min-w-0"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="text-xs text-text-secondary font-medium mb-1 block">
            {t("projects.transaction.proofLabel")}
          </label>
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx"
            onChange={(e) =>
              setForm({ ...form, proofFile: e.target.files?.[0] || null })
            }
            className="text-sm border border-border rounded-lg px-3 py-2 bg-surface-card w-full block min-w-0"
          />
        </div>

        <div className="sm:col-span-2 flex justify-end gap-2">
          <Btn type="submit" variant="primary" disabled={saving}>
            {saving
            ? t("projects.transaction.saving")
            : t("projects.transaction.save")}
          </Btn>
        </div>
      </form>
    </div>
  );
}
/* ============================================================
   Sous-composant formulaire.
============================================================ */
export default function ProjectDetailPage() {
  const { formatNumber, formatDate, formatDateTime } = useLocale();
  const { t } = useTranslation();
  const { confirmDelete } = useDeleteConfirm();
  const { id } = useParams();
  const navigate = useNavigate();
  const isMounted = useRef(true);

  const [user, setUser] = useState(null);
  const [project, setProject] = useState(null);
  const [phases, setPhases] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [phaseForm, setPhaseForm] = useState({
    title: "",
    description: "",
    startDate: "",
    endDate: "",
  });
  const [editPhaseId, setEditPhaseId] = useState(null);

  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState("");
  const [selectedPhaseId, setSelectedPhaseId] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [docKind, setDocKind] = useState("other");
  const [docFilters, setDocFilters] = useState({
    q: "",
    kind: "",
    sort: "-createdAt",
  });

  const [now, setNow] = useState(Date.now());

 // Contexte: detail de projet.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  /* ============================================================
     Roles admin/master et perimetre d'acces.
  ============================================================ */
  const role = normalizeRole(user?.role);
  const isAdmin = role === "admin";
  const isAgent = role === "agent";
  const isClient = role === "client";
  const isMaster = isMasterUser(user); // UX uniquement

  const isAssignedAgent = isAgent && project?.agent?.id === user?.id;

  const clientCanAddDocs = isClient;
  const agentCanAddDocs = isAssignedAgent;

  const createdAtMs = useMemo(() => {
    if (!project?.createdAt) return null;
    const t = new Date(project.createdAt).getTime();
    return Number.isFinite(t) ? t : null;
  }, [project?.createdAt]);

  const withinOneHour = useMemo(
    () => (createdAtMs ? now - createdAtMs <= 3600000 : false),
    [createdAtMs, now]
  );

  const clientCanModifyOrDelete = isClient && withinOneHour;

  const timeLeftText = useMemo(() => {
    if (!clientCanModifyOrDelete || !createdAtMs) return "";
    const msLeft = 3600000 - (now - createdAtMs);
    const mins = Math.max(0, Math.floor(msLeft / 60000));
    const secs = Math.max(0, Math.floor((msLeft % 60000) / 1000));
    return `${mins}m ${secs < 10 ? "0" : ""}${secs}s`;
  }, [clientCanModifyOrDelete, createdAtMs, now]);

  /* ============================================================
     Contexte: detail d un projet.
  ============================================================ */
  const loadProject = useCallback(async (pid) => {
    if (!pid) return;
    try {
      const [p, phs, docs, trxs] = await Promise.all([
        getProjectById(pid),
        getProjectPhases(pid),
        getProjectDocuments(pid),
        getTransactions({ projectId: pid }),
      ]);

      if (!isMounted.current) return;

      setProject(applyLabels(p));
      setPhases((phs || []).map(applyLabels));
      setDocuments(docs || []);
      setTransactions((trxs || []).map((t) => applyLabels(t, "transaction")));
    } catch (e) {
      console.error("loadProject:", e);
      setErrorMsg(t("projectDetail.alerts.loadError"));
      setProject(null);
    }
  }, [t]);

  useEffect(() => {
    isMounted.current = true;

    (async () => {
      try {
        const { user: u } = await me();
        if (!isMounted.current) return;
        if (!u) {
          navigate("/login");
          return;
        }
        setUser(u);
        await loadProject(id);
      } catch (e) {
        console.error("init:", e);
        setErrorMsg(t("projectDetail.alerts.genericError"));
      } finally {
        if (isMounted.current) setLoading(false);
      }
    })();

    return () => {
      isMounted.current = false;
    };
  }, [id, loadProject, navigate, t]);

  /* ============================================================
     Mise a jour du statut metier.
  ============================================================ */
  async function handleStatusChange(newStatus) {
    if (!isAdmin) return;
    try {
      await updateProject(project.id, { status: newStatus });
      await loadProject(project.id);
      notify(t("projectDetail.alerts.statusUpdateSuccess"));
    } catch (err) {
      console.error("update status:", err);
      notify(t("projectDetail.alerts.statusUpdateError"));
    }
  }

  /* ============================================================
     Filtrage et tri cote interface utilisateur.
  ============================================================ */
  const totals = useMemo(() => {
    const rev = transactions
      .filter((t) => t.type === "revenue")
      .reduce((s, t) => s + Number(t.amount || 0), 0);

    const exp = transactions
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + Number(t.amount || 0), 0);

    return { revenues: rev, expenses: exp, balance: rev - exp };
  }, [transactions]);

  /* ============================================================
     Contexte: detail d un projet.
  ============================================================ */
  async function handlePhaseSubmit(e) {
    e.preventDefault();
    try {
      const payload = { ...phaseForm, projectId: project.id };
      if (editPhaseId) payload.id = editPhaseId;

      await saveProjectPhase(payload);
      resetPhaseForm();
      await loadProject(project.id);
    } catch (err) {
      console.error("savePhase:", err);
      notify(t("projectDetail.phases.alerts.saveError"));
    }
  }

  function resetPhaseForm() {
    setPhaseForm({ title: "", description: "", startDate: "", endDate: "" });
    setEditPhaseId(null);
  }

  /* ============================================================
     Contexte: detail d un projet.
  ============================================================ */
  function handleFileChange(e) {
    setFiles(Array.from(e.target.files || []));
  }

  async function handleUploadDocuments(e) {
    e.preventDefault();
    try {
      await uploadProjectDocuments(
        project.id,
        files,
        notes,
        selectedPhaseId ? Number(selectedPhaseId) : undefined,
        { title: docTitle || undefined, kind: docKind || "other" }
      );

      setFiles([]);
      setNotes("");
      setDocTitle("");
      setSelectedPhaseId("");

      await loadProject(project.id);
    } catch (err) {
      console.error("upload docs:", err);
      notify(t("projectDetail.documents.alerts.uploadError"));
    }
  }

  async function handleDeleteDocument(docId) {
    const ok = await confirmDelete("projectDocument");
    if (!ok) return;
    try {
      await deleteProjectDocument(docId);
      await loadProject(project.id);
    } catch (err) {
      console.error("delete doc:", err);
      notify(t("projectDetail.documents.alerts.deleteError"));
    }
  }

  const filteredDocuments = useMemo(() => {
    let arr = [...(documents || [])];

    if (docFilters.q.trim()) {
      const q = docFilters.q.trim().toLowerCase();
      arr = arr.filter((doc) =>
        [
          getDocDisplayName(doc, t("projectDetail.documents.itemFallback")),
          doc.originalName,
          doc.notes,
          doc.kind,
          doc.kindLabel,
          doc.phase?.title,
          doc.phaseTitle,
          doc.uploaderName,
          doc.uploader?.firstName,
          doc.uploader?.lastName,
          doc.uploader?.email,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }

    if (docFilters.kind) {
      arr = arr.filter((doc) => inferDocKind(doc) === docFilters.kind);
    }

    const by = docFilters.sort || "-createdAt";
    const sign = by.startsWith("-") ? -1 : 1;
    const key = by.replace(/^-/, "");

    arr.sort((a, b) => {
      if (key === "createdAt") {
        const va = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
        const vb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (va < vb) return -1 * sign;
        if (va > vb) return 1 * sign;
        return 0;
      }
      return 0;
    });

    return arr;
  }, [documents, docFilters, t]);

  /* ============================================================
     Filtrage et tri cote interface utilisateur.
  ============================================================ */
  if (loading)
    return (
      <div className="flex justify-center items-center min-h-screen bg-surface-main">
        <p className="text-blue-700 text-lg animate-pulse font-medium">
          {t("projectDetail.loading")}
        </p>
      </div>
    );

  if (errorMsg && !project)
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-surface-main p-6">
        <p className="text-rose-600 text-lg font-medium mb-4">{errorMsg}</p>
        <Btn onClick={() => navigate("/projects")} variant="primary">
          {t("projectDetail.actions.backToProjects")}
        </Btn>
      </div>
    );

  if (!project)
    return (
      <div className="flex justify-center items-center min-h-screen bg-surface-main">
        <p className="text-text-muted text-lg">{t("projectDetail.notFound")}</p>
      </div>
    );

  const statusLabel = project.status
    ? PROJECT_STATUSES[project.status] || project.status
    : t("common.dash");

  return (
    <div className="min-h-screen bg-surface-main px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* BACK */}
        <button
          onClick={() => navigate("/projects")}
          className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary mb-4"
        >
          <span className="text-lg">{"<"}</span> {t("projectDetail.actions.backToProjects")}
        </button>

        {/* CARD */}
        <div className="bg-surface-card shadow-lg rounded-3xl border border-border/70 p-6 md:p-8 space-y-10">
          {/* HEADER */}
          <div className="flex flex-col md:flex-row md:justify-between gap-6">
            <div className="space-y-3 flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-text-primary break-words">
                {project.title}
              </h1>

              <p className="text-sm text-text-secondary max-w-2xl break-words">
                {project.description || t("projectDetail.descriptionFallback")}
              </p>

              <div className="flex flex-wrap items-center gap-3">
                {isAdmin ? (
                  <select
                    value={project.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="border border-border rounded-lg px-3 py-1.5 text-sm"
                  >
                    <option value="created">{t("projects.status.created")}</option>
                    <option value="in_progress">{t("projects.status.in_progress")}</option>
                    <option value="completed">{t("projects.status.completed")}</option>
                    <option value="validated">{t("projects.status.validated")}</option>
                    <option value="cancelled">{t("projects.status.cancelled")}</option>
                  </select>
                ) : (
                  <Badge color="blue">
                    {t("projectDetail.labels.status", { status: statusLabel })}
                  </Badge>
                )}

                {isMaster && (
                  <Badge color="yellow">{t("projectDetail.badges.master")}</Badge>
                )}

                <Badge color="green">
                  {t("projectDetail.labels.budget")}{" "}
                  {formatNumber(project.budget || 0)}{" "}
                  {t("projects.card.currency", { defaultValue: "XOF" })}
                </Badge>

                {isClient && (
                  <Badge color={clientCanModifyOrDelete ? "yellow" : "gray"}>
                    {clientCanModifyOrDelete
                      ? t("projectDetail.badges.editWindowAllowed", {
                          time: timeLeftText,
                        })
                      : t("projectDetail.badges.editWindowExpired")}
                  </Badge>
                )}
              </div>
            </div>

            {/* FINANCES */}
            <div className="w-full md:w-80 bg-surface-main border border-border rounded-2xl p-4">
              <h3 className="text-xs font-semibold text-text-muted uppercase">
                {t("projectDetail.finance.title")}
              </h3>

              <div className="space-y-2 text-sm mt-2">
                <div className="flex justify-between">
                  <span>{t("projectDetail.finance.revenues")}</span>
                  <span className="font-semibold text-emerald-700">
                    {formatNumber(totals.revenues)}{" "}
                    {t("projects.card.currency", { defaultValue: "XOF" })}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>{t("projectDetail.finance.expenses")}</span>
                  <span className="font-semibold text-rose-700">
                    {formatNumber(totals.expenses)}{" "}
                    {t("projects.card.currency", { defaultValue: "XOF" })}
                  </span>
                </div>

                <div className="flex justify-between border-t border-border pt-2">
                  <span className="font-medium">{t("projectDetail.finance.balance")}</span>
                  <span
                    className={`font-semibold ${
                      totals.balance >= 0 ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {formatNumber(totals.balance)}{" "}
                    {t("projects.card.currency", { defaultValue: "XOF" })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ========================= GRID PRINCIPALE ========================= */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* ----------- LARGE COLUMN : Transactions + Phases ----------- */}
            <div className="lg:col-span-2 space-y-8">
              {/* ---------------- TRANSACTIONS LIEES ---------------- */}
              <section>
                <h2 className="text-lg font-semibold text-text-primary mb-3">
                  {t("projectDetail.sections.transactions")}
                </h2>

                {(isAdmin || isAssignedAgent) && (
                  <ProjectTransactionForm
                    projectId={project.id}
                    currentUser={user}
                    onSuccess={() => loadProject(project.id)}
                  />
                )}

                {transactions.length === 0 ? (
                  <p className="text-text-muted italic text-sm">
                    {t("projectDetail.transactions.empty")}
                  </p>
                ) : (
                  <div className="overflow-x-auto border border-border rounded-2xl shadow-sm">
                    <table className="min-w-full text-xs md:text-sm table-fixed">
                      <thead className="bg-surface-main text-text-secondary font-semibold">
                        <tr>
                          <th className="px-3 py-2 text-left w-28">
                            {t("projectDetail.transactions.headers.type")}
                          </th>
                          <th className="px-3 py-2 text-left w-28">
                            {t("projectDetail.transactions.headers.amount")}
                          </th>
                          <th className="px-3 py-2 text-left w-28">
                            {t("projectDetail.transactions.headers.currency")}
                          </th>
                          <th className="px-3 py-2 text-left w-52">
                            {t("projectDetail.transactions.headers.method")}
                          </th>
                          <th className="px-3 py-2 text-left w-44">
                            {t("projectDetail.transactions.headers.createdBy")}
                          </th>
                          <th className="px-3 py-2 text-left w-28">
                            {t("projectDetail.transactions.headers.status")}
                          </th>
                          <th className="px-3 py-2 text-left w-28">
                            {t("projectDetail.transactions.headers.date")}
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {transactions.map((trx) => (
                          <tr key={trx.id} className="border-t border-border/70">
                            <td className="px-3 py-2">
                              <div className="truncate">
                                {trx.type
                                  ? TRANSACTION_TYPES[trx.type] ||
                                    trx.type
                                  : t("common.dash")}
                              </div>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {formatNumber(trx.amount || 0)}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {trx.currency
                                ? CURRENCY_LABELS[trx.currency] ||
                                  trx.currency
                                : t("common.dash")}
                            </td>
                            <td className="px-3 py-2">
                              <div className="max-w-[220px] break-words line-clamp-2">
                                {trx.paymentMethod || t("common.dash")}
                              </div>
                            </td>

 {/* Contexte: detail de projet. */}
                            <td className="px-3 py-2">
                              <div className="max-w-[180px] break-words line-clamp-2">
                                {getTransactionAuthorLabel(
                                  trx,
                                  t("common.dash")
                                )}
                              </div>
                            </td>

                            <td className="px-3 py-2 whitespace-nowrap">
                              {trx.status
                                ? TRANSACTION_STATUSES[trx.status] ||
                                  trx.status
                                : t("common.dash")}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {trx.createdAt
                                ? formatDate(trx.createdAt)
                                : t("common.dash")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* ---------------- PHASES DU PROJET ---------------- */}
              <section>
                <h2 className="text-lg font-semibold text-text-primary mb-3">
                  {t("projectDetail.sections.phases")}
                </h2>

                {(isAdmin || (isClient && clientCanModifyOrDelete)) && (
                  <form
                    onSubmit={handlePhaseSubmit}
                    className="bg-surface-main border border-border p-5 rounded-2xl mb-5 grid gap-4 md:grid-cols-2"
                  >
                    <input
                      placeholder={t("projectDetail.phases.form.titlePlaceholder")}
                      value={phaseForm.title}
                      onChange={(e) => setPhaseForm({ ...phaseForm, title: e.target.value })}
                      required
                      className="border border-border rounded-lg px-3 py-2 text-sm w-full min-w-0"
                    />

                    <input
                      placeholder={t("projectDetail.phases.form.descriptionPlaceholder")}
                      value={phaseForm.description}
                      onChange={(e) =>
                        setPhaseForm({ ...phaseForm, description: e.target.value })
                      }
                      className="border border-border rounded-lg px-3 py-2 text-sm w-full min-w-0"
                    />

                    <input
                      type="date"
                      value={phaseForm.startDate}
                      onChange={(e) =>
                        setPhaseForm({ ...phaseForm, startDate: e.target.value })
                      }
                      aria-label={t("projectDetail.phases.form.startDateLabel")}
                      className="border border-border rounded-lg px-3 py-2 text-sm w-full min-w-0"
                    />

                    <input
                      type="date"
                      value={phaseForm.endDate}
                      onChange={(e) =>
                        setPhaseForm({ ...phaseForm, endDate: e.target.value })
                      }
                      aria-label={t("projectDetail.phases.form.endDateLabel")}
                      className="border border-border rounded-lg px-3 py-2 text-sm w-full min-w-0"
                    />

                    <div className="md:col-span-2 flex justify-end gap-2">
                      {editPhaseId && (
                        <Btn type="button" variant="secondary" size="sm" onClick={resetPhaseForm}>
                          {t("projectDetail.phases.form.cancel")}
                        </Btn>
                      )}

                      <Btn type="submit" variant="primary" size="sm">
                        {editPhaseId
                          ? t("projectDetail.phases.form.save")
                          : t("projectDetail.phases.form.add")}
                      </Btn>
                    </div>
                  </form>
                )}

                {phases.length === 0 ? (
                  <p className="text-text-muted italic text-sm">
                    {t("projectDetail.phases.empty")}
                  </p>
                ) : (
                  <div className="grid md:grid-cols-2 gap-5">
                    {phases.map((ph) => (
                      <div
                        key={ph.id}
                        className="border border-border rounded-2xl p-4 bg-surface-card shadow-sm"
                      >
                        <div className="flex justify-between">
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-text-primary break-words">
                              {ph.title}
                            </h3>

                            {ph.description && (
                              <p className="text-xs text-text-secondary mt-1 break-words">
                                {ph.description}
                              </p>
                            )}

                            <p className="text-[11px] text-text-muted mt-1">
                              {t("projectDetail.phases.labels.start")}{" - "}
                              {ph.startDate
                                ? formatDate(ph.startDate)
                                : ` ${t("common.dash")}`}
                              {" - "}
                              {t("projectDetail.phases.labels.end")}{" - "}
                              {ph.endDate
                                ? formatDate(ph.endDate)
                                : ` ${t("common.dash")}`}
                            </p>
                          </div>

                          {(isAdmin || isAssignedAgent || clientCanModifyOrDelete) && (
                            <div className="flex flex-col gap-1">
                              <Btn
                                variant="warning"
                                size="xs"
                                onClick={() => {
                                  setEditPhaseId(ph.id);
                                  setPhaseForm({
                                    title: ph.title,
                                    description: ph.description || "",
                                    startDate: ph.startDate ? ph.startDate.slice(0, 10) : "",
                                    endDate: ph.endDate ? ph.endDate.slice(0, 10) : "",
                                  });
                                }}
                              >Edit</Btn>

                              <Btn
                                variant="danger"
                                size="xs"
                                onClick={async () => {
                                  const ok = await confirmDelete("projectPhase");
                                  if (!ok) return;
                                  try {
                                    await deleteProjectPhase(ph.id);
                                    await loadProject(project.id);
                                  } catch {
                                    notify(t("projectDetail.phases.alerts.deleteError"));
                                  }
                                }}
                              >Del</Btn>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

 {/* Contexte: detail de projet. */}
            <div className="space-y-6">
              <section>
                <h2 className="text-lg font-semibold text-text-primary mb-3">
                  {t("projectDetail.sections.documents")}
                </h2>

                {(isAdmin || clientCanAddDocs || agentCanAddDocs) && (
                  <form
                    onSubmit={handleUploadDocuments}
                    className="
                      bg-surface-main border border-border rounded-2xl 
                      p-4 mb-4 
                      grid grid-cols-1 sm:grid-cols-2 gap-4
                    "
                  >
                    <div className="sm:col-span-2">
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleFileChange}
                        className="
                          w-full block 
                          border border-border rounded-lg 
                          px-3 py-2 text-xs 
                          bg-surface-card 
                          min-w-0
                        "
                      />
                    </div>

                    <select
                      value={selectedPhaseId}
                      onChange={(e) => setSelectedPhaseId(e.target.value)}
                      className="border border-border rounded-lg px-3 py-2 text-xs w-full min-w-0"
                    >
                      <option value="">
                        {t("projectDetail.documents.phasePlaceholder")}
                      </option>
                      {phases.map((ph) => (
                        <option key={ph.id} value={ph.id}>
                          {ph.title}
                        </option>
                      ))}
                    </select>

                    <input
                      placeholder={t("projectDetail.documents.titlePlaceholder")}
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                      className="border border-border rounded-lg px-3 py-2 text-xs w-full min-w-0"
                    />

                    <select
                      value={docKind}
                      onChange={(e) => setDocKind(e.target.value)}
                      className="border border-border rounded-lg px-3 py-2 text-xs w-full min-w-0"
                    >
                      <option value="other">
                        {t("projectDetail.documents.kinds.other")}
                      </option>
                      <option value="contract">
                        {t("projectDetail.documents.kinds.contract")}
                      </option>
                      <option value="plan">
                        {t("projectDetail.documents.kinds.plan")}
                      </option>
                      <option value="report">
                        {t("projectDetail.documents.kinds.report")}
                      </option>
                      <option value="photo">
                        {t("projectDetail.documents.kinds.photo")}
                      </option>
                    </select>

                    <input
                      placeholder={t("projectDetail.documents.notesPlaceholder")}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="border border-border rounded-lg px-3 py-2 text-xs w-full min-w-0"
                    />

                    <div className="sm:col-span-2 flex justify-end">
                      <Btn type="submit" variant="primary" size="sm">{t("projectDetail.documents.upload")}</Btn>
                    </div>
                  </form>
                )}

                {documents.length === 0 ? (
                  <p className="text-text-muted italic text-sm">
                    {t("projectDetail.documents.empty")}
                  </p>
                ) : (
                  <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                    <div className="bg-surface-main border border-border rounded-2xl p-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          placeholder={t("projectDetail.documents.filters.searchPlaceholder")}
                          value={docFilters.q}
                          onChange={(e) =>
                            setDocFilters((prev) => ({
                              ...prev,
                              q: e.target.value,
                            }))
                          }
                          className="border border-border rounded-lg px-3 py-2 text-xs w-full min-w-0"
                        />

                        <select
                          value={docFilters.kind}
                          onChange={(e) =>
                            setDocFilters((prev) => ({
                              ...prev,
                              kind: e.target.value,
                            }))
                          }
                          className="border border-border rounded-lg px-3 py-2 text-xs w-full min-w-0"
                        >
                          <option value="">
                            {t("projectDetail.documents.filters.kindAll")}
                          </option>
                          <option value="image">
                            {t("projectDetail.documents.filters.kindImage")}
                          </option>
                          <option value="pdf">
                            {t("projectDetail.documents.filters.kindPdf")}
                          </option>
                          <option value="other">
                            {t("projectDetail.documents.filters.kindOther")}
                          </option>
                        </select>

                        <select
                          value={docFilters.sort}
                          onChange={(e) =>
                            setDocFilters((prev) => ({
                              ...prev,
                              sort: e.target.value,
                            }))
                          }
                          className="border border-border rounded-lg px-3 py-2 text-xs w-full min-w-0"
                        >
                          <option value="-createdAt">
                            {t("projectDetail.documents.filters.sortNewest")}
                          </option>
                          <option value="createdAt">
                            {t("projectDetail.documents.filters.sortOldest")}
                          </option>
                        </select>
                      </div>

                      <div className="mt-2 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            setDocFilters({ q: "", kind: "", sort: "-createdAt" })
                          }
                          className="text-[11px] text-text-secondary hover:text-text-primary"
                        >
                          {t("common.resetFilters")}
                        </button>
                      </div>
                    </div>

                    {filteredDocuments.map((doc) => {
                      const displayName = getDocDisplayName(
                        doc,
                        t("projectDetail.documents.itemFallback")
                      );
                      const originalName =
                        doc.title &&
                        doc.originalName &&
                        doc.originalName !== doc.title
                          ? doc.originalName
                          : "";
                      const fileUrl = doc.filePath ? toAbsUrl(doc.filePath) : "";
                      const kind = inferDocKind(doc);
                      const extFallback = kind === "pdf" ? "PDF" : "FILE";
                      const extLabel = getFileExtLabel(displayName, extFallback);
                      const kindLabel =
                        doc.kindLabel ||
                        (doc.kind
                          ? t(`projectDetail.documents.kinds.${doc.kind}`)
                          : t("projectDetail.documents.kinds.other"));
                      const phaseTitle = doc.phase?.title || doc.phaseTitle;
                      const sizeLabel = formatBytes(doc.fileSize);
                      const metaLine = [doc.mimeType, sizeLabel]
                        .filter(Boolean)
                        .join(" - ");
                      const uploaderLabel = getDocUploaderLabel(
                        doc,
                        t("common.dash")
                      );
                      const createdAtLabel = doc.createdAt
                        ? formatDateTime(doc.createdAt)
                        : t("common.dash");
                      const addedOnByLabel = t(
                        "projectDetail.documents.addedOnBy",
                        { date: createdAtLabel, name: uploaderLabel }
                      );

                      return (
                        <div
                          key={doc.id}
                          className="group border border-border rounded-2xl p-4 bg-surface-card shadow-sm flex flex-col min-w-0"
                        >
                          <div className="flex gap-3 min-w-0">
                            <div className="w-16 h-16 rounded-xl border border-border bg-surface-main overflow-hidden flex items-center justify-center shrink-0">
                              {fileUrl && kind === "image" ? (
                                <img
                                  src={fileUrl}
                                  alt={displayName}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  decoding="async"
                                />
                              ) : (
                                <span className="text-[0.65rem] font-semibold text-text-secondary bg-surface-card/80 border border-border px-2 py-1 rounded-full">
                                  {extLabel}
                                </span>
                              )}
                            </div>

                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-main/80 text-text-secondary border border-border">
                                  {kindLabel}
                                </span>
                                {phaseTitle && (
                                  <span className="text-[10px] text-text-secondary bg-surface-card border border-border px-2 py-0.5 rounded-full">
                                    {t("projectDetail.documents.phaseLabel")}{" "}
                                    {phaseTitle}
                                  </span>
                                )}
                              </div>

                              <p className="font-semibold text-sm text-text-primary break-words">
                                {displayName}
                              </p>

                              {originalName && (
                                <p className="text-[11px] text-text-muted break-words">
                                  {originalName}
                                </p>
                              )}

                              {metaLine && (
                                <p className="text-[11px] text-text-muted">
                                  {metaLine}
                                </p>
                              )}

                              <p className="text-[11px] text-text-muted">
                                {addedOnByLabel}
                              </p>

                              {doc.notes && (
                                <div className="text-xs text-text-secondary bg-surface-main border border-border rounded-lg px-3 py-2 break-words">
                                  {doc.notes}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {fileUrl ? (
                              <a
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {t("projectDetail.documents.open")}
                              </a>
                            ) : (
                              <span className="text-xs text-text-muted">
                                {t("common.dash")}
                              </span>
                            )}

                            {(isAdmin || clientCanModifyOrDelete) && (
                              <Btn
                                onClick={() => handleDeleteDocument(doc.id)}
                                variant="danger"
                                size="xs"
                              >Del</Btn>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}




