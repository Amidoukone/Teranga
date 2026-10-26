import WorkProgressPanel from '../features/mission-tracking/WorkProgressPanel';
// ============================================================
// frontend/src/pages/ProjectDetailPage.jsx
// Contexte: detail de projet.
// ============================================================

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useGeo } from '../contexts/GeoContext';
import DossierHeader, { DossierNextAction } from '../components/DossierHeader';
import ProjectTasksPanel from '../features/service-workspace/ProjectTasksPanel';
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
  PROJECT_STATUSES,
  getProjectStatusTone,
} from "../utils/labels";
import { getAllTransactions } from "../services/transactions";
import { summarizeTransactionsByCurrency } from "../utils/currency";
import { Badge } from "../components/ui";
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
function Btn({ variant = "primary", size = "md", children, className = "", ...props }) {
  const styles = {
    primary: "app-btn-primary",
    secondary: "app-btn-neutral",
    danger: "app-btn-danger",
    warning: "app-btn-warning",
    ghost: "app-btn-soft",
  };

  const sizeClasses = {
    md: "px-4 py-2.5 text-sm",
    sm: "px-4 py-2 text-sm",
    xs: "px-3 py-1.5 text-xs",
  };

  return (
    <button
      {...props}
      className={`
        inline-flex items-center justify-center whitespace-normal break-words rounded-lg font-semibold
        transition-all duration-150
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
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
export default function ProjectDetailPage() {
  const { id } = useParams();
  const { user, countryId, regionId } = useGeo();
  return <ProjectDossier key={JSON.stringify([id, user?.id, user?.role, countryId, regionId])} />;
}

function ProjectDossier() {
  const { formatNumber, formatDate, formatDateTime } = useLocale();
  const { t } = useTranslation();
  const { confirmDelete } = useDeleteConfirm();
  const { id } = useParams();
  const navigate = useNavigate();
  const isMounted = useRef(true);
  const request = useRef(0);

  const [user, setUser] = useState(null);
  const [project, setProject] = useState(null);
  const [phases, setPhases] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [sectionErrors, setSectionErrors] = useState({});
  const [revision, setRevision] = useState(0);
  const [editingPhase, setEditingPhase] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);

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
  const [uploadingDocuments, setUploadingDocuments] = useState(false);
  const uploadInFlightRef = useRef(false);
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

  const isAssignedAgent = isAgent && String(project?.agentId || project?.agent?.id) === String(user?.id);

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
    if (!pid || !isMounted.current) return;
    const version = ++request.current;
    try {
      const p = await getProjectById(pid);
      if (!isMounted.current || version !== request.current) return;
      const results = await Promise.allSettled([
        getProjectPhases(pid),
        getProjectDocuments(pid, { countryId: p?.countryId ?? null, regionId: p?.regionId ?? null }),
        getAllTransactions({ projectId: pid, countryId: p?.countryId ?? null, regionId: p?.regionId ?? null }),
      ]);
      if (!isMounted.current || version !== request.current) return;
      setProject(applyLabels(p));
      const setters = [setPhases, setDocuments, setTransactions];
      const names = ['phases', 'documents', 'finance'];
      const errors = {};
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') setters[index](result.value || []);
        else {
          errors[names[index]] = true;
          if ([401, 403, 404].includes(result.reason?.response?.status)) setters[index]([]);
        }
      });
      setSectionErrors(errors); setErrorMsg(''); setRevision((value) => value + 1);
    } catch (e) {
      if (!isMounted.current || version !== request.current) return;
      setErrorMsg(t("projectDetail.alerts.loadError"));
      if ([401, 403, 404].includes(e?.response?.status)) { setProject(null); setPhases([]); setDocuments([]); setTransactions([]); }
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
        console.error("ProjectDetailPage init error:", e);
        setErrorMsg(t("projectDetail.alerts.genericError"));
      } finally {
        if (isMounted.current) setLoading(false);
      }
    })();

    return () => {
      isMounted.current = false;
      request.current += 1;
    };
  }, [id, loadProject, navigate, t]);

  useEffect(() => {
    if (!project?.id) return undefined;
    const refresh = () => { if (document.visibilityState === 'visible' && !uploadInFlightRef.current) loadProject(id); };
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); };
  }, [project?.id, loadProject, id]);

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
      console.error("ProjectDetailPage update status error:", err);
      notify(t("projectDetail.alerts.statusUpdateError"));
    }
  }

  /* ============================================================
     Filtrage et tri cote interface utilisateur.
  ============================================================ */
  const totalsByCurrency = useMemo(() => {
    const totals = summarizeTransactionsByCurrency(transactions);
    return totals.length ? totals : [{ currency: project?.currency || 'XOF', revenues: 0, expenses: 0, balance: 0 }];
  }, [transactions, project?.currency]);

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
      console.error("ProjectDetailPage save phase error:", err);
      notify(t("projectDetail.phases.alerts.saveError"));
    }
  }

  function resetPhaseForm() {
    setPhaseForm({ title: "", description: "", startDate: "", endDate: "" });
    setEditPhaseId(null);
    setEditingPhase(false);
  }

  /* ============================================================
     Contexte: detail d un projet.
  ============================================================ */
  function handleFileChange(e) {
    setFiles(Array.from(e.target.files || []));
  }

  async function handleUploadDocuments(e) {
    e.preventDefault();
    if (uploadInFlightRef.current) return;

    uploadInFlightRef.current = true;
    setUploadingDocuments(true);
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
      console.error("ProjectDetailPage upload documents error:", err);
      notify(t("projectDetail.documents.alerts.uploadError"));
    } finally {
      uploadInFlightRef.current = false;
      if (isMounted.current) setUploadingDocuments(false);
    }
  }

  async function handleDeleteDocument(docId) {
    const ok = await confirmDelete("projectDocument");
    if (!ok) return;
    try {
      await deleteProjectDocument(docId);
      await loadProject(project.id);
    } catch (err) {
      console.error("ProjectDetailPage delete document error:", err);
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

  return <div className="app-page-wrap"><div className="app-page-shell max-w-5xl space-y-6">
    <DossierHeader kind="project" id={project.id} title={project.title} description={project.description}
      assignee={[project.agent?.firstName, project.agent?.lastName].filter(Boolean).join(' ') || (project.agentId ? `#${project.agentId}` : '')}
      status={<Badge tone={getProjectStatusTone(project.status)}>{statusLabel}</Badge>} />
    {errorMsg && <p role="alert" className="app-alert app-alert-error">{errorMsg} <button type="button" onClick={() => loadProject(id)} className="min-h-11 underline">{t('serviceOrders.retry')}</button></p>}
    <DossierNextAction kind="project" status={project.status} role={role} assigned={isAssignedAgent} coordinated={Boolean(project.coordination)} />
    <section id="dossier-realisation" className="scroll-mt-24 space-y-5" aria-label={t('dossier.realisation')}>
      <h2 className="text-xl font-bold">{t('dossier.realisation')}</h2>
      <p className="text-sm text-text-secondary">{t('dossier.optionalPhases')}</p>
      {sectionErrors.phases && <p role="alert" className="app-alert app-alert-error">{t('dossier.loadError')} <button type="button" onClick={() => loadProject(id)} className="min-h-11 underline">{t('serviceOrders.retry')}</button></p>}
      <section id="project-phases" className="scroll-mt-6">
                <h2 className="text-lg font-semibold text-text-primary mb-3">
                  {t("projectDetail.sections.phases")}
                </h2>

                {(isAdmin || (isClient && clientCanModifyOrDelete)) && (
                  <details open={editingPhase} onToggle={(event) => setEditingPhase(event.currentTarget.open)} className="mb-4 rounded-xl border border-border p-3">
                  <summary className="min-h-11 cursor-pointer text-sm font-semibold">{t('dossier.addPhase')}</summary>
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

                    <details className="md:col-span-2 rounded-xl border border-border bg-surface-card/50 px-3 py-2">
                      <summary className="cursor-pointer text-sm font-semibold text-text-primary">
                        {t("projectDetail.phases.form.advancedDetails")}
                      </summary>
                      <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <input
                      placeholder={t("projectDetail.phases.form.descriptionPlaceholder")}
                      value={phaseForm.description}
                      onChange={(e) =>
                        setPhaseForm({ ...phaseForm, description: e.target.value })
                      }
                      className="border border-border rounded-lg px-3 py-2 text-sm w-full min-w-0"
                    />
                      </div>
                    </details>

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
                  </details>
                )}

                {phases.length === 0 && !sectionErrors.phases ? (
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
                            <p className="mt-2 text-sm">{t(`dossier.phaseStates.${ph.status}`, { defaultValue: ph.status })}</p>
                            {(isAdmin || clientCanModifyOrDelete) && <label className="mt-2 block text-sm">
                              <span className="sr-only">{t('dossier.phaseStatus', { title: ph.title })}</span>
                              <select value={ph.status} onChange={async (event) => {
                                try { await saveProjectPhase({ id: ph.id, status: event.target.value }); await loadProject(project.id); }
                                catch (error) { notify(error?.response?.data?.error || t('projectDetail.phases.alerts.saveError')); }
                              }} className="min-h-11 rounded-xl border border-border bg-surface-main p-2">
                                {['pending', 'active', 'completed'].map((state) => <option key={state} value={state}>{t(`dossier.phaseStates.${state}`)}</option>)}
                              </select>
                            </label>}
                            {isAssignedAgent && <p className="mt-2 text-xs text-text-secondary">{t('dossier.phaseManaged')}</p>}

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

                          {(isAdmin || clientCanModifyOrDelete) && (
                            <div className="flex flex-col gap-1">
                              <Btn
                                variant="warning"
                                size="xs"
                                onClick={() => {
                                  setEditPhaseId(ph.id);
                                  setEditingPhase(true);
                                  setPhaseForm({
                                    title: ph.title,
                                    description: ph.description || "",
                                    startDate: ph.startDate ? ph.startDate.slice(0, 10) : "",
                                    endDate: ph.endDate ? ph.endDate.slice(0, 10) : "",
                                  });
                                }}
                              >{t("projects.actions.edit")}</Btn>

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
                              >{t("projects.actions.delete")}</Btn>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
      <ProjectTasksPanel projectId={project.id} onRefresh={() => loadProject(project.id)} />
      {sectionErrors.documents && <p role="alert" className="app-alert app-alert-error">{t('dossier.loadError')} <button type="button" onClick={() => loadProject(id)} className="min-h-11 underline">{t('serviceOrders.retry')}</button></p>}
      <section id="project-documents" className="scroll-mt-6">
                <h2 className="text-lg font-semibold text-text-primary mb-3">
                  {t("projectDetail.sections.documents")}
                </h2>

                {(isAdmin || clientCanAddDocs || agentCanAddDocs) && (
                  <details open={documentsOpen} onToggle={(event) => setDocumentsOpen(event.currentTarget.open)} className="mb-4 rounded-xl border border-border p-3">
                  <summary className="min-h-11 cursor-pointer text-sm font-semibold">{t('dossier.addDocument')}</summary>
                  <p className="mb-3 text-sm text-text-secondary">{t('dossier.projectProofHint')}</p>
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

                    <label htmlFor="project-document-kind" className="sm:col-span-2 text-sm">{t('dossier.proofKind')}
                      <select id="project-document-kind" aria-label={t('dossier.proofKind')} value={docKind} onChange={(event) => setDocKind(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface-card p-2">
                        {['other','contract','plan','report','photo'].map((kind) => <option key={kind} value={kind}>{t(`projectDetail.documents.kinds.${kind}`)}</option>)}
                      </select>
                    </label>
                    <details className="sm:col-span-2 rounded-xl border border-border bg-surface-card/50 px-3 py-2">
                      <summary className="cursor-pointer text-sm font-semibold text-text-primary">
                        {t("projectDetail.documents.form.advancedDetails")}
                      </summary>
                      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
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

                    <input
                      placeholder={t("projectDetail.documents.notesPlaceholder")}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="border border-border rounded-lg px-3 py-2 text-xs w-full min-w-0"
                    />
                      </div>
                    </details>

                    <div className="sm:col-span-2 flex justify-end">
                      <Btn
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={uploadingDocuments}
                        aria-busy={uploadingDocuments}
                      >
                        {uploadingDocuments
                          ? `${t("projectDetail.documents.upload")}...`
                          : t("projectDetail.documents.upload")}
                      </Btn>
                    </div>
                  </form>
                  </details>
                )}

                {documents.length === 0 && !sectionErrors.documents ? (
                  <p className="text-text-muted italic text-sm">
                    {t("projectDetail.documents.empty")}
                  </p>
                ) : (
                  <div className="space-y-3">
                    <details className="bg-surface-main border border-border rounded-2xl p-3">
                      <summary className="min-h-11 cursor-pointer text-sm font-semibold">{t('dossier.filterDocuments')}</summary>
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
                        <Btn
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() =>
                            setDocFilters({ q: "", kind: "", sort: "-createdAt" })
                          }
                        >
                          {t("common.resetFilters")}
                        </Btn>
                      </div>
                    </details>

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
                              >{t("projects.actions.delete")}</Btn>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
      <WorkProgressPanel embedded entityType="project" entityId={project.id} status={project.status} revision={revision} reviewBlocked={Boolean(sectionErrors.documents)} onSaved={() => loadProject(project.id)} />
    </section>
    <details id="dossier-finance" className="scroll-mt-24 rounded-2xl border border-border bg-surface-card p-4 sm:p-5">
      <summary className="min-h-11 cursor-pointer text-lg font-bold">{t('dossier.finance')}</summary>
      <p className="mb-3 text-sm">{t('projectDetail.labels.budget')} {formatNumber(project.budget || 0)} {project.currency || 'XOF'}</p>
      {sectionErrors.finance && <p role="alert" className="app-alert app-alert-error">{t('dossier.loadError')} <button type="button" onClick={() => loadProject(id)} className="min-h-11 underline">{t('serviceOrders.retry')}</button></p>}
      {!sectionErrors.finance && <div className="mb-5 grid gap-3 sm:grid-cols-2">{totalsByCurrency.map((totals) => <div key={totals.currency} role="group" aria-label={totals.currency} className="rounded-xl border border-border p-3 text-sm">
        <h3 className="font-bold">{totals.currency}</h3>
        <p>{t('projectDetail.finance.revenues')} <strong>{formatNumber(totals.revenues)} {totals.currency}</strong></p>
        <p>{t('projectDetail.finance.expenses')} <strong>{formatNumber(totals.expenses)} {totals.currency}</strong></p>
        <p>{t('projectDetail.finance.balance')} <strong>{formatNumber(totals.balance)} {totals.currency}</strong></p>
      </div>)}</div>}
      <p className="mt-3 text-sm text-text-secondary">{t('financialWorkspace.external')}</p>
      <Link to={`/projects/${project.id}/transactions`} className="mt-3 inline-flex min-h-11 items-center text-sm underline">{t('financialWorkspace.title')}</Link>
    </details>
    <details id="dossier-details" className="scroll-mt-24 rounded-2xl border border-border bg-surface-card p-4 sm:p-5">
      <summary className="min-h-11 cursor-pointer text-lg font-bold">{t('dossier.details')}</summary>
      {project.description && <p className="mt-3 whitespace-pre-line text-sm">{project.description}</p>}
      <p className="mt-3 text-sm">{t('dossier.project')} #{project.id}</p>
      {project.createdAt && <p className="mt-2 text-sm">{formatDateTime(project.createdAt)}</p>}
      {isMaster && <Badge tone="warning">{t('projectDetail.badges.master')}</Badge>}
      {isClient && <p className="mt-2 text-sm text-text-secondary">{clientCanModifyOrDelete ? t('projectDetail.badges.editWindowAllowed', { time: timeLeftText }) : t('projectDetail.badges.editWindowExpired')}</p>}
      {isAdmin && !project.coordination && <label className="mt-3 block text-sm">{t('projectDetail.labels.status', { status: statusLabel })}<select aria-label={t('dossier.tools')} value={project.status} onChange={(event) => handleStatusChange(event.target.value)} className="ml-3 min-h-11 rounded-xl border border-border bg-surface-main p-2">
        {['created','in_progress','completed','validated','cancelled'].map((state) => <option key={state} value={state}>{t(`projects.status.${state}`)}</option>)}
      </select></label>}
    </details>
  </div></div>;
}
