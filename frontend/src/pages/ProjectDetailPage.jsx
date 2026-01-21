// ============================================================
// frontend/src/pages/ProjectDetailPage.jsx
// Version Premium Responsive — MASTER SAFE — PARTIE 1 / 2
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
import { applyLabels, CURRENCY_LABELS } from "../utils/labels";
import { getTransactions, createTransaction } from "../services/transactions";
import { normalizeRole, isMasterUser } from "../utils/role";

/* ============================================================
   🌐 FILE_BASE + Helpers
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

/* ============================================================
   UI Components
============================================================ */
function Badge({ color = "gray", children }) {
  const colors = {
    blue: "bg-blue-100 text-blue-800 ring-blue-200",
    green: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    yellow: "bg-amber-100 text-amber-800 ring-amber-200",
    red: "bg-rose-100 text-rose-800 ring-rose-200",
    gray: "bg-slate-100 text-slate-800 ring-slate-200",
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
    secondary: "bg-slate-100 text-slate-800 hover:bg-slate-200 focus:ring-slate-300",
    danger: "bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-400",
    warning: "bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-400",
    ghost:
      "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 focus:ring-slate-400",
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
   🧾 Auteur transaction
   ✅ IMPORTANT : sera utilisé dans la table transactions (PARTIE 2)
============================================================ */
function getTransactionAuthorLabel(t) {
  if (!t) return "—";

  if (t.user) {
    const fn = t.user.firstName || t.user.firstname || "";
    const ln = t.user.lastName || t.user.lastname || "";
    const full = `${fn} ${ln}`.trim();
    if (full.length > 0) return full;
    if (t.user.email) return t.user.email;
  }

  if (t.createdByUser) {
    const full = `${t.createdByUser.firstName || ""} ${t.createdByUser.lastName || ""}`.trim();
    if (full.length > 0) return full;
    if (t.createdByUser.email) return t.createdByUser.email;
  }

  return "—";
}

/* ============================================================
   💰 Formulaire transaction projet
============================================================ */
function ProjectTransactionForm({ projectId, currentUser, onSuccess }) {
  const [form, setForm] = useState({
    type: "expense",
    amount: "",
    currency: "XOF",
    paymentMethod: "",
    description: "",
    proofFile: null,
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setSaving(true);

      await createTransaction({
        ...form,
        amount: form.amount === "" ? undefined : Number(form.amount),
        projectId: Number(projectId),
        userId: currentUser?.id,
      });

      alert("✅ Transaction enregistrée");
      setForm({
        type: "expense",
        amount: "",
        currency: "XOF",
        paymentMethod: "",
        description: "",
        proofFile: null,
      });
      onSuccess?.();
    } catch (err) {
      console.error("❌ Transaction error:", err);
      alert(err?.response?.data?.error || "Erreur lors de la création de la transaction.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-50 border border-slate-200 p-4 rounded-2xl mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3 shadow-sm"
    >
      <select
        value={form.type}
        onChange={(e) => setForm({ ...form, type: e.target.value })}
        className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full min-w-0"
      >
        <option value="expense">Dépense</option>
        <option value="revenue">Revenu</option>
        <option value="commission">Commission</option>
        <option value="adjustment">Ajustement</option>
      </select>

      <input
        type="number"
        step="0.01"
        placeholder="Montant"
        value={form.amount}
        onChange={(e) => setForm({ ...form, amount: e.target.value })}
        required
        className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full min-w-0"
      />

      <select
        value={form.currency}
        onChange={(e) => setForm({ ...form, currency: e.target.value })}
        className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full min-w-0"
      >
        {Object.entries(CURRENCY_LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>

      <input
        placeholder="Méthode de paiement"
        value={form.paymentMethod}
        onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
        className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full min-w-0"
      />

      <textarea
        placeholder="Description"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        className="sm:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm w-full min-w-0"
      />

      <input
        type="file"
        accept=".jpg,.jpeg,.png,.pdf"
        onChange={(e) => setForm({ ...form, proofFile: e.target.files?.[0] || null })}
        className="sm:col-span-2 text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white w-full block min-w-0"
      />

      <div className="sm:col-span-2 flex justify-end">
        <Btn type="submit" variant="primary" disabled={saving}>
          {saving ? "Enregistrement…" : "💾 Enregistrer"}
        </Btn>
      </div>
    </form>
  );
}
/* ============================================================
   🧠 PAGE PRINCIPALE — ProjectDetailPage (PARTIE 2 / 2)
============================================================ */
export default function ProjectDetailPage() {
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

  const [now, setNow] = useState(Date.now());

  // refresh fenêtre client (1h)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  /* ============================================================
     🔐 Roles & Permissions (MASTER SAFE)
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
     🔹 Load project (backend gère scope)
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
      setTransactions((trxs || []).map(applyLabels));
    } catch (e) {
      console.error("❌ loadProject:", e);
      setErrorMsg("Erreur lors du chargement du projet.");
      setProject(null);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;

    (async () => {
      try {
        const { user: u } = await me();
        if (!isMounted.current) return;
        setUser(u);
        await loadProject(id);
      } catch (e) {
        console.error("❌ init:", e);
        setErrorMsg("Erreur de chargement.");
      } finally {
        if (isMounted.current) setLoading(false);
      }
    })();

    return () => {
      isMounted.current = false;
    };
  }, [id, loadProject]);

  /* ============================================================
     🔹 Update status (admin/master = admin)
  ============================================================ */
  async function handleStatusChange(newStatus) {
    if (!isAdmin) return;
    try {
      await updateProject(project.id, { status: newStatus });
      await loadProject(project.id);
      alert("Statut mis à jour.");
    } catch (err) {
      console.error("❌ update status:", err);
      alert("Erreur lors de la mise à jour.");
    }
  }

  /* ============================================================
     💰 Totaux financiers
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
     🗂️ Phases
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
      console.error("❌ savePhase:", err);
      alert("Erreur lors de la sauvegarde.");
    }
  }

  function resetPhaseForm() {
    setPhaseForm({ title: "", description: "", startDate: "", endDate: "" });
    setEditPhaseId(null);
  }

  /* ============================================================
     📎 Documents
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
      console.error("❌ upload docs:", err);
      alert("Erreur upload documents.");
    }
  }

  async function handleDeleteDocument(docId) {
    if (!window.confirm("Supprimer ce document ?")) return;
    try {
      await deleteProjectDocument(docId);
      await loadProject(project.id);
    } catch (err) {
      console.error("❌ delete doc:", err);
      alert("Erreur suppression.");
    }
  }

  /* ============================================================
     🎨 Rendu
  ============================================================ */
  if (loading)
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-50">
        <p className="text-blue-700 text-lg animate-pulse font-medium">Chargement…</p>
      </div>
    );

  if (errorMsg && !project)
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-slate-50 p-6">
        <p className="text-rose-600 text-lg font-medium mb-4">{errorMsg}</p>
        <Btn onClick={() => navigate("/projects")} variant="primary">
          ← Retour
        </Btn>
      </div>
    );

  if (!project)
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-50">
        <p className="text-slate-500 text-lg">Projet introuvable.</p>
      </div>
    );

  const statusLabel = project.statusLabel || project.status || "—";

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* BACK */}
        <button
          onClick={() => navigate("/projects")}
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4"
        >
          <span className="text-lg">←</span> Retour
        </button>

        {/* CARD */}
        <div className="bg-white shadow-lg rounded-3xl border border-slate-100 p-6 md:p-8 space-y-10">
          {/* HEADER */}
          <div className="flex flex-col md:flex-row md:justify-between gap-6">
            <div className="space-y-3 flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 break-words">
                {project.title}
              </h1>

              <p className="text-sm text-slate-600 max-w-2xl break-words">
                {project.description || "Aucune description."}
              </p>

              <div className="flex flex-wrap items-center gap-3">
                {isAdmin ? (
                  <select
                    value={project.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                  >
                    <option value="created">Créé</option>
                    <option value="in_progress">En cours</option>
                    <option value="completed">Terminé</option>
                    <option value="validated">Validé</option>
                    <option value="cancelled">Annulé</option>
                  </select>
                ) : (
                  <Badge color="blue">Statut : {statusLabel}</Badge>
                )}

                {isMaster && <Badge color="yellow">MASTER</Badge>}

                <Badge color="green">
                  💰 Budget : {Number(project.budget || 0).toLocaleString("fr-FR")} XOF
                </Badge>

                {isClient && (
                  <Badge color={clientCanModifyOrDelete ? "yellow" : "gray"}>
                    {clientCanModifyOrDelete
                      ? `Modification possible ${timeLeftText}`
                      : "Fenêtre expirée"}
                  </Badge>
                )}
              </div>
            </div>

            {/* FINANCES */}
            <div className="w-full md:w-80 bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase">
                Synthèse financière
              </h3>

              <div className="space-y-2 text-sm mt-2">
                <div className="flex justify-between">
                  <span>Revenus</span>
                  <span className="font-semibold text-emerald-700">
                    {totals.revenues.toLocaleString("fr-FR")} XOF
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>Dépenses</span>
                  <span className="font-semibold text-rose-700">
                    {totals.expenses.toLocaleString("fr-FR")} XOF
                  </span>
                </div>

                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="font-medium">Solde</span>
                  <span
                    className={`font-semibold ${
                      totals.balance >= 0 ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {totals.balance.toLocaleString("fr-FR")} XOF
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
                <h2 className="text-lg font-semibold text-slate-900 mb-3">
                  💰 Transactions liées
                </h2>

                {(isAdmin || isAssignedAgent) && (
                  <ProjectTransactionForm
                    projectId={project.id}
                    currentUser={user}
                    onSuccess={() => loadProject(project.id)}
                  />
                )}

                {transactions.length === 0 ? (
                  <p className="text-slate-500 italic text-sm">Aucune transaction.</p>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm">
                    <table className="min-w-full text-xs md:text-sm">
                      <thead className="bg-slate-50 text-slate-600 font-semibold">
                        <tr>
                          <th className="px-3 py-2 text-left">Type</th>
                          <th className="px-3 py-2 text-left">Montant</th>
                          <th className="px-3 py-2 text-left">Devise</th>
                          <th className="px-3 py-2 text-left">Méthode</th>
                          <th className="px-3 py-2 text-left">Créé par</th>
                          <th className="px-3 py-2 text-left">Statut</th>
                          <th className="px-3 py-2 text-left">Date</th>
                        </tr>
                      </thead>

                      <tbody>
                        {transactions.map((t) => (
                          <tr key={t.id} className="border-t border-slate-100">
                            <td className="px-3 py-2">{t.typeLabel || t.type}</td>
                            <td className="px-3 py-2">
                              {Number(t.amount || 0).toLocaleString("fr-FR")}
                            </td>
                            <td className="px-3 py-2">{t.currency || "—"}</td>
                            <td className="px-3 py-2">{t.paymentMethod || "—"}</td>

                            {/* ✅ UTILISATION = supprime l’erreur eslint/ts */}
                            <td className="px-3 py-2">
                              {getTransactionAuthorLabel(t)}
                            </td>

                            <td className="px-3 py-2">{t.statusLabel || t.status || "—"}</td>
                            <td className="px-3 py-2">
                              {t.createdAt
                                ? new Date(t.createdAt).toLocaleDateString("fr-FR")
                                : "—"}
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
                <h2 className="text-lg font-semibold text-slate-900 mb-3">
                  🗂️ Phases du projet
                </h2>

                {(isAdmin || (isClient && clientCanModifyOrDelete)) && (
                  <form
                    onSubmit={handlePhaseSubmit}
                    className="bg-slate-50 border border-slate-200 p-5 rounded-2xl mb-5 grid gap-4 md:grid-cols-2"
                  >
                    <input
                      placeholder="Titre *"
                      value={phaseForm.title}
                      onChange={(e) => setPhaseForm({ ...phaseForm, title: e.target.value })}
                      required
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full min-w-0"
                    />

                    <input
                      placeholder="Description"
                      value={phaseForm.description}
                      onChange={(e) =>
                        setPhaseForm({ ...phaseForm, description: e.target.value })
                      }
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full min-w-0"
                    />

                    <input
                      type="date"
                      value={phaseForm.startDate}
                      onChange={(e) =>
                        setPhaseForm({ ...phaseForm, startDate: e.target.value })
                      }
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full min-w-0"
                    />

                    <input
                      type="date"
                      value={phaseForm.endDate}
                      onChange={(e) =>
                        setPhaseForm({ ...phaseForm, endDate: e.target.value })
                      }
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full min-w-0"
                    />

                    <div className="md:col-span-2 flex justify-end gap-2">
                      {editPhaseId && (
                        <Btn type="button" variant="secondary" size="sm" onClick={resetPhaseForm}>
                          Annuler
                        </Btn>
                      )}

                      <Btn type="submit" variant="primary" size="sm">
                        {editPhaseId ? "💾 Enregistrer" : "➕ Ajouter"}
                      </Btn>
                    </div>
                  </form>
                )}

                {phases.length === 0 ? (
                  <p className="text-slate-500 italic text-sm">Aucune phase enregistrée.</p>
                ) : (
                  <div className="grid md:grid-cols-2 gap-5">
                    {phases.map((ph) => (
                      <div
                        key={ph.id}
                        className="border border-slate-200 rounded-2xl p-4 bg-white shadow-sm"
                      >
                        <div className="flex justify-between">
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-slate-900 break-words">
                              {ph.title}
                            </h3>

                            {ph.description && (
                              <p className="text-xs text-slate-600 mt-1 break-words">
                                {ph.description}
                              </p>
                            )}

                            <p className="text-[11px] text-slate-500 mt-1">
                              Début :
                              {ph.startDate
                                ? new Date(ph.startDate).toLocaleDateString("fr-FR")
                                : " —"}
                              {" • "}
                              Fin :
                              {ph.endDate
                                ? new Date(ph.endDate).toLocaleDateString("fr-FR")
                                : " —"}
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
                              >
                                ✏️
                              </Btn>

                              <Btn
                                variant="danger"
                                size="xs"
                                onClick={async () => {
                                  if (!window.confirm("Supprimer cette phase ?")) return;
                                  try {
                                    await deleteProjectPhase(ph.id);
                                    await loadProject(project.id);
                                  } catch {
                                    alert("Erreur suppression phase.");
                                  }
                                }}
                              >
                                ❌
                              </Btn>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* ----------- RIGHT COLUMN — DOCUMENTS ----------- */}
            <div className="space-y-6">
              <section>
                <h2 className="text-lg font-semibold text-slate-900 mb-3">📎 Documents</h2>

                {(isAdmin || clientCanAddDocs || agentCanAddDocs) && (
                  <form
                    onSubmit={handleUploadDocuments}
                    className="
                      bg-slate-50 border border-slate-200 rounded-2xl 
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
                          border border-slate-300 rounded-lg 
                          px-3 py-2 text-xs 
                          bg-white 
                          min-w-0
                        "
                      />
                    </div>

                    <select
                      value={selectedPhaseId}
                      onChange={(e) => setSelectedPhaseId(e.target.value)}
                      className="border border-slate-300 rounded-lg px-3 py-2 text-xs w-full min-w-0"
                    >
                      <option value="">— Phase (optionnel)</option>
                      {phases.map((ph) => (
                        <option key={ph.id} value={ph.id}>
                          {ph.title}
                        </option>
                      ))}
                    </select>

                    <input
                      placeholder="Titre (optionnel)"
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                      className="border border-slate-300 rounded-lg px-3 py-2 text-xs w-full min-w-0"
                    />

                    <select
                      value={docKind}
                      onChange={(e) => setDocKind(e.target.value)}
                      className="border border-slate-300 rounded-lg px-3 py-2 text-xs w-full min-w-0"
                    >
                      <option value="other">Autre</option>
                      <option value="contract">Contrat</option>
                      <option value="plan">Plan</option>
                      <option value="report">Rapport</option>
                      <option value="photo">Photo</option>
                    </select>

                    <input
                      placeholder="Notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="border border-slate-300 rounded-lg px-3 py-2 text-xs w-full min-w-0"
                    />

                    <div className="sm:col-span-2 flex justify-end">
                      <Btn type="submit" variant="primary" size="sm">
                        📤 Upload
                      </Btn>
                    </div>
                  </form>
                )}

                {documents.length === 0 ? (
                  <p className="text-slate-500 italic text-sm">Aucun document.</p>
                ) : (
                  <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="border border-slate-200 rounded-2xl p-3.5 bg-white shadow-sm flex flex-col min-w-0"
                      >
                        <div className="space-y-1 min-w-0">
                          <p className="font-semibold text-sm text-slate-900 break-words">
                            {doc.title || doc.originalName || "Document"}
                          </p>

                          {(doc.phase?.title || doc.phaseTitle) && (
                            <p className="text-[11px] text-slate-600 break-words">
                              🔗 Phase : {doc.phase?.title || doc.phaseTitle}
                            </p>
                          )}

                          <p className="text-[11px] text-slate-500">
                            {doc.mimeType} — {(doc.fileSize / 1024).toFixed(1)} Ko
                          </p>

                          <p className="text-[11px] text-slate-400">
                            Ajouté le {new Date(doc.createdAt).toLocaleString("fr-FR")}
                          </p>

                          {doc.notes && (
                            <p className="text-xs text-slate-700 break-words">{doc.notes}</p>
                          )}
                        </div>

                        <div className="flex justify-between mt-2 items-center">
                          <a
                            href={toAbsUrl(doc.filePath)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            📄 Ouvrir
                          </a>

                          {(isAdmin || clientCanModifyOrDelete) && (
                            <Btn onClick={() => handleDeleteDocument(doc.id)} variant="danger" size="xs">
                              🗑️
                            </Btn>
                          )}
                        </div>
                      </div>
                    ))}
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
