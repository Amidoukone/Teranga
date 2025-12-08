// frontend/src/pages/ServiceTransactionsPage.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { me } from "../services/auth";
import { getTransactions, createTransaction } from "../services/transactions";
import api from "../services/api";
import { applyLabels } from "../utils/labels";

/* ============================================================================    
   🌍 FILE_BASE + normalizePath + toAbsUrl — PRODUCTION READY
============================================================================ */
const RAW_API =
  window.__TERANGA_API_BASE_URL ||
  process.env.REACT_APP_API_BASE_URL ||
  "";

export const FILE_BASE =
  window.__TERANGA_FILE_BASE_URL ||
  RAW_API.replace(/\/api\/?$/, "") ||
  "";

/** Normalisation chemins backend */
function normalizePath(path = "") {
  if (!path) return "";
  const clean = String(path).replace(/\\/g, "/").trim();

  if (/^https?:\/\//i.test(clean)) return clean;
  const fixed = clean.startsWith("/") ? clean : `/${clean}`;
  return fixed.replace(/\/{2,}/g, "/");
}

/** Conversion en URL absolue */
function toAbsUrl(path = "") {
  const norm = normalizePath(path);
  if (!norm) return "";
  if (/^https?:\/\//i.test(norm)) return norm;

  return FILE_BASE.replace(/\/$/, "") + "/" + norm.replace(/^\//, "");
}

/* ============================================================================    
   📄 PAGE : ServiceTransactionsPage — VERSION PREMIUM STYLE A 2025
============================================================================ */
export default function ServiceTransactionsPage() {
  const { id } = useParams(); // serviceId
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    type: "expense",
    amount: "",
    description: "",
    taskId: "",
    proofFile: null,
  });

  /* ============================================================================    
     🔐 Auth headers
  ============================================================================ */
  const authHeaders = useMemo(() => {
    const token =
      localStorage.getItem("teranga_token") ||
      localStorage.getItem("token");

    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  /* ============================================================================    
     📥 Charger transactions
  ============================================================================ */
  const fetchTransactions = useCallback(async () => {
    try {
      const data = await getTransactions({ serviceId: id });

      const enriched = (data || []).map((t) =>
        t.statusLabel || t.typeLabel || t.currencyLabel
          ? t
          : applyLabels(t)
      );

      setTransactions(enriched);
    } catch (err) {
      console.error("❌ Erreur fetchTransactions:", err);
      setTransactions([]);
    }
  }, [id]);

  /* ============================================================================    
     📥 Charger tâches
  ============================================================================ */
  const fetchTasks = useCallback(async () => {
    try {
      const { data } = await api.get(`/tasks/service/${id}`, {
        headers: authHeaders,
      });
      setTasks(data.tasks || []);
    } catch (err) {
      console.error("❌ Erreur fetchTasks:", err);
      setTasks([]);
    }
  }, [id, authHeaders]);

  /* ============================================================================    
     🚀 Initialisation
  ============================================================================ */
  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const u = await me();
        if (!active) return;

        setUser(u.user);

        await Promise.all([fetchTransactions(), fetchTasks()]);
      } catch (err) {
        console.error("❌ Erreur init:", err);
        localStorage.removeItem("teranga_token");
        localStorage.removeItem("token");
        window.location.href = "/login";
      } finally {
        if (active) setLoading(false);
      }
    }

    init();
    return () => {
      active = false;
    };
  }, [fetchTransactions, fetchTasks]);

  /* ============================================================================    
     ➕ Création transaction
  ============================================================================ */
  async function handleSubmit(e) {
    e.preventDefault();

    if (!id) return alert("Service introuvable.");

    const amountNum = parseFloat(form.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return alert("Montant invalide.");
    }

    setSubmitting(true);

    try {
      const payload = {
        serviceId: parseInt(id, 10),
        taskId: form.taskId ? parseInt(form.taskId, 10) : undefined,
        type: form.type,
        amount: amountNum,
        description: form.description || undefined,
        proofFile: form.proofFile || null,
      };

      await createTransaction(payload);

      alert("✅ Transaction ajoutée avec succès");

      setForm({
        type: "expense",
        amount: "",
        description: "",
        taskId: "",
        proofFile: null,
      });

      await fetchTransactions();
    } catch (err) {
      console.error("❌ Erreur ajout transaction:", err);
      alert("Erreur lors de l’ajout de la transaction");
    } finally {
      setSubmitting(false);
    }
  }

  /* ============================================================================    
     ⏳ Loading
  ============================================================================ */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100">
        <p className="text-gray-600 text-lg animate-pulse text-center">
          Chargement des transactions du service…
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-red-600 text-lg font-semibold">
          Utilisateur non authentifié.
        </p>
      </div>
    );
  }

  /* ============================================================================    
     🎨 UI principale — STYLE A PREMIUM
  ============================================================================ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-3 py-8 sm:px-4 sm:py-10">
      <div className="max-w-5xl mx-auto bg-white shadow-2xl rounded-3xl border border-gray-100 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-10">

        {/* 🧭 HEADER PREMIUM */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[0.7rem] uppercase tracking-wide font-semibold text-blue-600 mb-1">
              Opérations liées au service #{id}
            </p>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 break-words">
              💼 Transactions du service
            </h1>

            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              Suivez et ajoutez des transactions rattachées aux tâches du service.
            </p>
          </div>

          <button
            onClick={() => navigate(`/services/${id}/tasks`)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg shadow-sm bg-slate-900 text-white hover:bg-slate-800 transition"
          >
            📋 Voir tâches
          </button>
        </div>

        {/* ➕ FORMULAIRE PREMIUM */}
        <TransactionForm
          form={form}
          setForm={setForm}
          tasks={tasks}
          submitting={submitting}
          handleSubmit={handleSubmit}
        />

        {/* 📜 HISTORIQUE PREMIUM */}
        <TransactionHistory transactions={transactions} />
      </div>
    </div>
  );
}

/* ============================================================================
   🧩 FORMULAIRE — PREMIUM STYLE A
============================================================================ */
function TransactionForm({ form, setForm, tasks, submitting, handleSubmit }) {
  return (
    <div className="">
      <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">
        ➕ Ajouter une transaction
      </h2>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-5 rounded-2xl border border-gray-200 shadow-sm"
      >
        {/* Type */}
        <FormGroup label="Type de transaction">
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="form-input"
          >
            <option value="revenue">Revenu</option>
            <option value="expense">Dépense</option>
            <option value="commission">Commission</option>
            <option value="adjustment">Ajustement</option>
          </select>
        </FormGroup>

        {/* Montant */}
        <FormGroup label="Montant (FCFA)">
          <input
            type="number"
            step="0.01"
            placeholder="15000"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
            className="form-input"
          />
        </FormGroup>

        {/* Tâche liée */}
        <FormGroup label="Lier à une tâche (optionnel)" full>
          <select
            value={form.taskId}
            onChange={(e) => setForm({ ...form, taskId: e.target.value })}
            className="form-input"
          >
            <option value="">— Aucune tâche —</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title || `Tâche #${t.id}`}
              </option>
            ))}
          </select>
        </FormGroup>

        {/* Description */}
        <FormGroup label="Description" full>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="form-input"
            placeholder="Description ou détails…"
          />
        </FormGroup>

        {/* Fichier */}
        <FormGroup label="Pièce justificative (PDF, JPG, PNG)" full>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) =>
              setForm({
                ...form,
                proofFile: e.target.files?.[0] || null,
              })
            }
            className="form-input"
          />
        </FormGroup>

        {/* Bouton */}
        <div className="col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className={`
              px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition
              ${
                submitting
                  ? "bg-blue-300 cursor-not-allowed text-white"
                  : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"
              }
            `}
          >
            {submitting ? "Ajout…" : "Ajouter la transaction"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ============================================================================
   🧩 FormGroup — composant premium
============================================================================ */
function FormGroup({ label, children, full }) {
  return (
    <div className={full ? "col-span-1 sm:col-span-2" : ""}>
      <label className="block text-sm font-medium text-gray-800 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

/* ============================================================================
   🧩 HISTORIQUE — Premium Style A
============================================================================ */
function TransactionHistory({ transactions }) {
  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
        📜 Historique des transactions
      </h2>

      {transactions.length === 0 ? (
        <p className="text-gray-500 italic text-center py-6">
          Aucune transaction enregistrée.
        </p>
      ) : (
        <div className="grid gap-6">
          {transactions.map((t) => {
            const title = (t.typeLabel || t.type || "").toString();
            const amount = Number(t.amount || 0).toLocaleString("fr-FR");
            const currency = t.currencyLabel || t.currency || "";

            return (
              <div
                key={t.id}
                className="bg-gradient-to-br from-white via-slate-50 to-white border border-gray-200 rounded-2xl shadow-sm p-5 hover:shadow-md transition"
              >
                {/* HEADER */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 break-words">
                      {title} — {amount} {currency}
                    </h3>
                    <p className="text-sm text-gray-600 break-words mt-1">
                      {t.description || "Aucune description"}
                    </p>
                  </div>

                  <div className="text-xs text-gray-500">
                    {t.createdAt
                      ? new Date(t.createdAt).toLocaleString("fr-FR")
                      : "Date inconnue"}
                  </div>
                </div>

                {/* DETAILS */}
                <div className="mt-4 text-sm text-gray-700 space-y-2">
                  {t.task && (
                    <p className="break-words">
                      🔧 <strong>Tâche :</strong> {t.task.title} (ID {t.task.id})
                    </p>
                  )}

                  {t.proofFile?.path && (
                    <p className="break-words">
                      📎{" "}
                      <a
                        href={toAbsUrl(t.proofFile.path)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline break-all"
                      >
                        Voir la pièce jointe
                      </a>
                    </p>
                  )}

                  <p className="text-xs text-gray-500 break-words">
                    Enregistré par{" "}
                    <strong>
                      {t.user?.email ||
                        `${t.user?.firstName || ""} ${t.user?.lastName || ""}`.trim() ||
                        "—"}
                    </strong>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================================    
   STYLE GLOBAL INPUT (uniformisation)
============================================================================ */
const inputBase =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-600 bg-white";

// On applique aux champs du formulaire
window.formInputStyle = inputBase;
