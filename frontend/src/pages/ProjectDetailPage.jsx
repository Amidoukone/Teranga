// frontend/src/pages/ProjectDetailPage.jsx
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
import { getFileUrl } from "../services/api";
import { getTransactions, createTransaction } from "../services/transactions";
import { applyLabels, CURRENCY_LABELS } from "../utils/labels";

/* ============================================================
   🎨 UI Components — Style B
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
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ring-1 shadow-sm whitespace-normal break-words ${colors[color]}`}
    >
      {children}
    </span>
  );
}

function Btn({
  variant = "primary",
  size = "md",
  children,
  className = "",
  ...props
}) {
  const styles = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-400",
    secondary:
      "bg-slate-100 text-slate-800 hover:bg-slate-200 focus:ring-slate-300",
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
        whitespace-normal break-words text-center
        ${styles[variant]} ${sizeClasses[size]} ${className}
      `}
    >
      {children}
    </button>
  );
}

/* ============================================================
   🧾 Helper : libellé de l'auteur de la transaction
   👉 On priorise les champs createdBy / createdByUser / createdByLabel
============================================================ */
function getTransactionAuthorLabel(t) {
  if (!t) return "—";

  // 1️⃣ Cas idéal : backend renvoie un objet createdBy (ou createdByUser)
  if (t.createdBy && (t.createdBy.firstName || t.createdBy.lastName)) {
    return (
      `${t.createdBy.firstName || ""} ${t.createdBy.lastName || ""}`.trim() ||
      "—"
    );
  }
  if (
    t.createdByUser &&
    (t.createdByUser.firstName || t.createdByUser.lastName)
  ) {
    return (
      `${t.createdByUser.firstName || ""} ${
        t.createdByUser.lastName || ""
      }`.trim() || "—"
    );
  }

  // 2️⃣ Cas où applyLabels a généré un label pour le créateur
  if (t.createdByLabel || t.createdByName || t.createdByEmail) {
    return t.createdByLabel || t.createdByName || t.createdByEmail || "—";
  }

  // 3️⃣ En dernier recours, on regarde éventuellement un "user" générique
  if (t.user && (t.user.firstName || t.user.lastName)) {
    return `${t.user.firstName || ""} ${t.user.lastName || ""}`.trim() || "—";
  }

  return t.userLabel || t.userName || t.userEmail || "—";
}

/* ============================================================
   💰 Formulaire de transaction liée au projet
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
        // 🔹 On transmet aussi l'utilisateur courant pour la traçabilité
        userId: currentUser?.id,
      });
      alert("✅ Transaction enregistrée avec succès");
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
      console.error("❌ Erreur transaction projet:", err);
      alert(
        err?.response?.data?.error ||
          "Erreur lors de la création de la transaction."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-50 border border-slate-200 p-4 rounded-2xl mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3 shadow-sm overflow-hidden max-w-full"
    >
      <select
        value={form.type}
        onChange={(e) => setForm({ ...form, type: e.target.value })}
        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 whitespace-normal break-words"
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
        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
      />

      <select
        value={form.currency}
        onChange={(e) => setForm({ ...form, currency: e.target.value })}
        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 whitespace-normal break-words"
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
        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 whitespace-normal break-words"
      />

      <textarea
        placeholder="Description"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        className="sm:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 whitespace-normal break-words"
      />

      <input
        type="file"
        accept=".jpg,.jpeg,.png,.pdf"
        onChange={(e) =>
          setForm({ ...form, proofFile: e.target.files?.[0] || null })
        }
        className="sm:col-span-2 text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500"
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
   🧠 Page principale
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

  // ACL
  const isAdmin = user?.role === "admin";
  const isAgent = user?.role === "agent";
  const isClient = user?.role === "client";
  const isAssignedAgent = isAgent && project?.agent?.id === user?.id;
  const adminAll = isAdmin;
  const clientCanAdd = isClient;
  const agentCanAddDocs = isAssignedAgent;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

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
     🔹 Chargement complet projet + phases + documents + transactions
  ============================================================ */
  const loadProject = useCallback(async (pid) => {
    if (!pid) return;
    try {
      const [data, phs, docs, trxs] = await Promise.all([
        getProjectById(pid),
        getProjectPhases(pid),
        getProjectDocuments(pid),
        getTransactions({ projectId: pid }),
      ]);
      if (!isMounted.current) return;
      setProject(applyLabels(data));
      setPhases((phs || []).map(applyLabels));
      setDocuments(docs || []);
      setTransactions((trxs || []).map(applyLabels));
    } catch (e) {
      console.error("❌ Erreur chargement projet:", e);
      if (isMounted.current) {
        setErrorMsg("Erreur lors du chargement du projet.");
        setProject(null);
      }
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    (async () => {
      try {
        const { user: u } = await me();
        setUser(u);
        await loadProject(id);
      } catch (err) {
        console.error("❌ Erreur init projet:", err);
        setErrorMsg("Erreur chargement projet.");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      isMounted.current = false;
    };
  }, [id, loadProject]);

  /* ============================================================
     🔹 Mise à jour du statut projet (ADMIN uniquement)
  ============================================================ */
  async function handleStatusChange(newStatus) {
    if (!isAdmin) return; // sécurité front
    try {
      if (!project?.id) return;
      await updateProject(project.id, { status: newStatus });
      await loadProject(project.id);
      alert("✅ Statut mis à jour avec succès");
    } catch (err) {
      console.error("❌ Erreur mise à jour statut:", err);
      alert("Erreur lors de la mise à jour du statut.");
    }
  }

  /* ============================================================
     🔹 Totaux financiers
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
     🔹 PHASES + DOCUMENTS
  ============================================================ */
  async function handlePhaseSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        ...phaseForm,
        projectId: project.id,
      };
      if (editPhaseId) payload.id = editPhaseId;
      await saveProjectPhase(payload);
      resetPhaseForm();
      await loadProject(project.id);
    } catch (err) {
      console.error("❌ Erreur phase:", err);
      alert("Erreur lors de la sauvegarde de la phase.");
    }
  }

  function resetPhaseForm() {
    setPhaseForm({
      title: "",
      description: "",
      startDate: "",
      endDate: "",
    });
    setEditPhaseId(null);
  }

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
        {
          title: docTitle || undefined,
          kind: docKind || "other",
        }
      );
      setFiles([]);
      setNotes("");
      setDocTitle("");
      setSelectedPhaseId("");
      await loadProject(project.id);
    } catch (err) {
      console.error("❌ Erreur upload document:", err);
      alert("Erreur lors du téléversement.");
    }
  }

  async function handleDeleteDocument(docId) {
    if (!window.confirm("Supprimer ce document ?")) return;
    try {
      await deleteProjectDocument(docId);
      await loadProject(project.id);
    } catch (err) {
      console.error("❌ Erreur suppression document:", err);
      alert("Erreur lors de la suppression du document.");
    }
  }

  /* ============================================================
     🔹 Rendu
  ============================================================ */
  if (loading)
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-50">
        <p className="text-blue-700 text-lg animate-pulse font-medium">
          ⏳ Chargement du projet...
        </p>
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
        {/* Barre de navigation locale */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <button
            onClick={() => navigate("/projects")}
            className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
          >
            <span className="text-lg">←</span>
            <span className="whitespace-normal break-words">
              Retour aux projets
            </span>
          </button>

          <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
            {project.client && (
              <span className="truncate max-w-[200px] sm:max-w-xs">
                👤 Client:{" "}
                <span className="font-medium text-slate-800 whitespace-normal break-words">
                  {project.client.firstName} {project.client.lastName}
                </span>
              </span>
            )}
            {project.agent && (
              <span className="hidden sm:inline truncate max-w-[200px]">
                • 🧑‍💼 Agent:{" "}
                <span className="font-medium text-slate-800 whitespace-normal break-words">
                  {project.agent.firstName} {project.agent.lastName}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Carte principale */}
        <div className="bg-white shadow-lg rounded-3xl border border-slate-100 p-6 md:p-8 space-y-10 overflow-hidden">
          {/* HEADER */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between md:flex-wrap gap-6">
            <div className="space-y-3 flex-1 min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 border border-slate-200 px-3 py-1 text-xs text-slate-500 flex-wrap">
                <span>Projet #{project.id}</span>
                {project.createdAt && (
                  <>
                    <span className="opacity-40">•</span>
                    <span className="truncate max-w-[260px] md:max-w-xs whitespace-normal break-words">
                      Créé le{" "}
                      {new Date(project.createdAt).toLocaleString("fr-FR")}
                    </span>
                  </>
                )}
              </div>

              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-start gap-2 break-words whitespace-normal">
                <span>📁</span>
                <span className="break-words whitespace-normal min-w-0">
                  {project.title}
                </span>
              </h1>

              <p className="text-sm md:text-base text-slate-600 max-w-2xl whitespace-normal break-words">
                {project.description || "Aucune description fournie."}
              </p>

              <div className="flex flex-wrap items-center gap-3">
                {/* Statut : ADMIN peut changer, autres voient un badge */}
                {isAdmin ? (
                  <div className="inline-flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-500">Statut :</span>
                    <select
                      value={project.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs md:text-sm focus:ring-2 focus:ring-blue-500 bg-white max-w-full whitespace-normal break-words"
                    >
                      <option value="created">Créé</option>
                      <option value="in_progress">En cours</option>
                      <option value="completed">Terminé</option>
                      <option value="validated">Validé</option>
                      <option value="cancelled">Annulé</option>
                    </select>
                  </div>
                ) : (
                  <Badge color="blue">
                    Statut :{" "}
                    <span className="ml-1 break-words whitespace-normal">
                      {statusLabel}
                    </span>
                  </Badge>
                )}

                <Badge color="green">
                  💰 Budget :{" "}
                  {Number(project.budget || 0).toLocaleString("fr-FR")} XOF
                </Badge>

                {isClient && (
                  <Badge color={clientCanModifyOrDelete ? "yellow" : "gray"}>
                    {clientCanModifyOrDelete
                      ? `⏱ Modification possible encore ${timeLeftText}`
                      : "⏱ Fenêtre de modification expirée"}
                  </Badge>
                )}
              </div>
            </div>

            {/* Carte synthèse finances */}
            <div className="w-full md:w-80 bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 overflow-hidden">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Synthèse financière
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Revenus</span>
                  <span className="font-semibold text-emerald-700">
                    {totals.revenues.toLocaleString("fr-FR")} XOF
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Dépenses</span>
                  <span className="font-semibold text-rose-700">
                    {totals.expenses.toLocaleString("fr-FR")} XOF
                  </span>
                </div>
                <div className="border-t border-slate-200 pt-2 mt-1 flex justify-between items-center">
                  <span className="text-slate-600 font-medium">Solde</span>
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

          {/* GRID CONTENU PRINCIPAL */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Colonne gauche : Transactions + Phases */}
            <div className="lg:col-span-2 space-y-8 min-w-0">
              {/* TRANSACTIONS */}
              <section>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h2 className="text-lg font-semibold text-slate-900 whitespace-normal break-words">
                    💰 Transactions liées
                  </h2>
                </div>

                {/* 🔒 On cache le formulaire aux clients. Seuls admin + agent assigné peuvent créer. */}
                {(isAdmin || isAssignedAgent) && (
                  <ProjectTransactionForm
                    projectId={project.id}
                    currentUser={user}
                    onSuccess={() => loadProject(project.id)}
                  />
                )}

                {transactions.length === 0 ? (
                  <p className="text-slate-500 italic text-sm">
                    Aucune transaction enregistrée pour ce projet.
                  </p>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm">
                    <table className="min-w-full text-xs md:text-sm">
                      <thead className="bg-slate-50 text-slate-600 font-semibold">
                        <tr>
                          <th className="px-3 py-2 text-left whitespace-normal break-words">
                            Type
                          </th>
                          <th className="px-3 py-2 text-left whitespace-normal break-words">
                            Montant
                          </th>
                          <th className="px-3 py-2 text-left whitespace-normal break-words">
                            Devise
                          </th>
                          <th className="px-3 py-2 text-left whitespace-normal break-words">
                            Méthode
                          </th>
                          <th className="px-3 py-2 text-left whitespace-normal break-words">
                            Créé par
                          </th>
                          <th className="px-3 py-2 text-left whitespace-normal break-words">
                            Statut
                          </th>
                          <th className="px-3 py-2 text-left whitespace-normal break-words">
                            Date
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((t) => (
                          <tr
                            key={t.id}
                            className="border-t border-slate-100 hover:bg-slate-50"
                          >
                            <td className="px-3 py-2 break-words whitespace-normal">
                              {t.typeLabel || t.type}
                            </td>
                            <td className="px-3 py-2">
                              {Number(t.amount || 0).toLocaleString("fr-FR")}
                            </td>
                            <td className="px-3 py-2">{t.currency || "—"}</td>
                            <td className="px-3 py-2 break-words whitespace-normal">
                              {t.paymentMethod || "—"}
                            </td>
                            <td className="px-3 py-2 break-words whitespace-normal">
                              {getTransactionAuthorLabel(t)}
                            </td>
                            <td className="px-3 py-2 break-words whitespace-normal">
                              {t.statusLabel || t.status || "—"}
                            </td>
                            <td className="px-3 py-2">
                              {t.createdAt
                                ? new Date(t.createdAt).toLocaleDateString(
                                    "fr-FR"
                                  )
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* PHASES */}
              <section>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h2 className="text-lg font-semibold text-slate-900 whitespace-normal break-words">
                    🗂️ Phases du projet
                  </h2>
                </div>

                {(isAdmin || (isClient && clientCanModifyOrDelete)) && (
                  <form
                    onSubmit={handlePhaseSubmit}
                    className="bg-slate-50 border border-slate-200 p-5 rounded-2xl mb-5 grid gap-4 md:grid-cols-2 shadow-sm overflow-hidden max-w-full"
                  >
                    <input
                      placeholder="Titre de la phase *"
                      value={phaseForm.title}
                      onChange={(e) =>
                        setPhaseForm({
                          ...phaseForm,
                          title: e.target.value,
                        })
                      }
                      required
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      placeholder="Description (optionnel)"
                      value={phaseForm.description}
                      onChange={(e) =>
                        setPhaseForm({
                          ...phaseForm,
                          description: e.target.value,
                        })
                      }
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />

                    <input
                      type="date"
                      placeholder="Date de début"
                      value={phaseForm.startDate}
                      onChange={(e) =>
                        setPhaseForm({
                          ...phaseForm,
                          startDate: e.target.value,
                        })
                      }
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="date"
                      placeholder="Date de fin"
                      value={phaseForm.endDate}
                      onChange={(e) =>
                        setPhaseForm({
                          ...phaseForm,
                          endDate: e.target.value,
                        })
                      }
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />

                    <div className="md:col-span-2 flex justify-end gap-2 flex-wrap">
                      {editPhaseId && (
                        <Btn
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={resetPhaseForm}
                        >
                          Annuler
                        </Btn>
                      )}
                      <Btn type="submit" variant="primary" size="sm">
                        {editPhaseId
                          ? "💾 Enregistrer la phase"
                          : "➕ Ajouter la phase"}
                      </Btn>
                    </div>
                  </form>
                )}

                {phases.length === 0 ? (
                  <p className="text-slate-500 italic text-sm">
                    Aucune phase enregistrée.
                  </p>
                ) : (
                  <div className="grid md:grid-cols-2 gap-5">
                    {phases.map((ph) => (
                      <div
                        key={ph.id}
                        className="border border-slate-200 rounded-2xl p-4 bg-white shadow-sm overflow-hidden"
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-semibold text-slate-900 break-words whitespace-normal">
                              {ph.title}
                            </h3>
                            {ph.description && (
                              <p className="text-xs text-slate-600 mt-1 break-words whitespace-normal">
                                {ph.description}
                              </p>
                            )}
                            <p className="text-[11px] text-slate-500 mt-1">
                              {ph.startDate
                                ? `Début: ${new Date(
                                    ph.startDate
                                  ).toLocaleDateString("fr-FR")}`
                                : "Début: —"}{" "}
                              •{" "}
                              {ph.endDate
                                ? `Fin: ${new Date(
                                    ph.endDate
                                  ).toLocaleDateString("fr-FR")}`
                                : "Fin: —"}
                            </p>
                          </div>

                          {(isAdmin ||
                            isAssignedAgent ||
                            (isClient && clientCanModifyOrDelete)) && (
                            <div className="flex flex-col gap-1 shrink-0">
                              <Btn
                                variant="warning"
                                size="xs"
                                onClick={() => {
                                  setEditPhaseId(ph.id);
                                  setPhaseForm({
                                    title: ph.title || "",
                                    description: ph.description || "",
                                    startDate: ph.startDate
                                      ? ph.startDate.slice(0, 10)
                                      : "",
                                    endDate: ph.endDate
                                      ? ph.endDate.slice(0, 10)
                                      : "",
                                  });
                                }}
                              >
                                ✏️
                              </Btn>
                              <Btn
                                variant="danger"
                                size="xs"
                                onClick={async () => {
                                  if (
                                    !window.confirm("Supprimer cette phase ?")
                                  )
                                    return;
                                  try {
                                    await deleteProjectPhase(ph.id);
                                    await loadProject(project.id);
                                  } catch (err) {
                                    console.error(
                                      "❌ Erreur suppression phase:",
                                      err
                                    );
                                    alert(
                                      "Erreur lors de la suppression de la phase."
                                    );
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

            {/* Colonne droite : Documents */}
            <div className="space-y-6">
              <section>
                <h2 className="text-lg font-semibold text-slate-900 mb-3 whitespace-normal break-words">
                  📎 Documents du projet
                </h2>

                {(adminAll || clientCanAdd || agentCanAddDocs) && (
                  <form
                    onSubmit={handleUploadDocuments}
                    className="bg-slate-50 border border-slate-200 p-4 rounded-2xl mb-4 grid gap-3 shadow-sm overflow-hidden max-w-full"
                  >
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileChange}
                      className="border border-slate-300 rounded-lg px-3 py-2 text-xs md:text-sm cursor-pointer focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={selectedPhaseId}
                      onChange={(e) => setSelectedPhaseId(e.target.value)}
                      className="border border-slate-300 rounded-lg px-3 py-2 text-xs md:text-sm focus:ring-2 focus:ring-blue-500 whitespace-normal break-words"
                    >
                      <option value="">
                        — Associer à une phase (optionnel) —
                      </option>
                      {phases.map((ph) => (
                        <option key={ph.id} value={ph.id}>
                          {ph.title}
                        </option>
                      ))}
                    </select>
                    <input
                      placeholder="Titre du document (optionnel)"
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                      className="border border-slate-300 rounded-lg px-3 py-2 text-xs md:text-sm focus:ring-2 focus:ring-blue-500 whitespace-normal break-words"
                    />
                    <select
                      value={docKind}
                      onChange={(e) => setDocKind(e.target.value)}
                      className="border border-slate-300 rounded-lg px-3 py-2 text-xs md:text-sm focus:ring-2 focus:ring-blue-500 whitespace-normal break-words"
                    >
                      <option value="other">Autre</option>
                      <option value="contract">Contrat</option>
                      <option value="plan">Plan</option>
                      <option value="report">Rapport</option>
                      <option value="photo">Photo</option>
                    </select>
                    <input
                      placeholder="Notes (optionnel)"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="border border-slate-300 rounded-lg px-3 py-2 text-xs md:text-sm focus:ring-2 focus:ring-blue-500 whitespace-normal break-words"
                    />
                    <div className="flex justify-end">
                      <Btn type="submit" variant="primary" size="sm">
                        📤 Upload
                      </Btn>
                    </div>
                  </form>
                )}

                {documents.length === 0 ? (
                  <p className="text-slate-500 italic text-sm">
                    Aucun document joint.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="border border-slate-200 rounded-2xl p-3.5 bg-white shadow-sm flex flex-col justify-between gap-2 overflow-hidden"
                      >
                        <div className="space-y-1 min-w-0">
                          <p className="font-semibold text-sm text-slate-900 break-words whitespace-normal">
                            {doc.title || doc.originalName || "Document"}
                          </p>
                          {(doc.phase?.title || doc.phaseTitle) && (
                            <p className="text-[11px] text-slate-600 break-words whitespace-normal">
                              🔗 Phase : {doc.phase?.title || doc.phaseTitle}
                            </p>
                          )}
                          <p className="text-[11px] text-slate-500">
                            {doc.mimeType || "Fichier"} •{" "}
                            {typeof doc.fileSize === "number"
                              ? (doc.fileSize / 1024).toFixed(1)
                              : "?"}{" "}
                            Ko
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Ajouté le{" "}
                            {new Date(doc.createdAt).toLocaleString("fr-FR")}
                          </p>
                          {doc.notes && (
                            <p className="text-xs text-slate-700 mt-1 break-words whitespace-normal">
                              {doc.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex justify-between items-center pt-1 gap-2 flex-wrap">
                          <a
                            href={getFileUrl(doc.filePath)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline truncate max-w-[140px]"
                          >
                            📄 Ouvrir
                          </a>
                          {(adminAll || clientCanModifyOrDelete) && (
                            <Btn
                              onClick={() => handleDeleteDocument(doc.id)}
                              variant="danger"
                              size="xs"
                            >
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
