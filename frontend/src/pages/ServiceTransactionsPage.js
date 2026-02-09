// frontend/src/pages/ServiceTransactionsPage.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { me } from "../services/auth";
import { getTransactions, createTransaction } from "../services/transactions";
import api from "../services/api";
import { applyLabels } from "../utils/labels";

/* ============================================================================
   🌍 FILE_BASE + normalizePath + toAbsUrl — PRODUCTION READY (SSR safe)
============================================================================ */
const RAW_API =
  (typeof window !== "undefined" &&
    (window.__TERANGA_API_BASE_URL || process.env.REACT_APP_API_BASE_URL)) ||
  process.env.REACT_APP_API_BASE_URL ||
  "";

export const FILE_BASE =
  (typeof window !== "undefined" &&
    (window.__TERANGA_FILE_BASE_URL ||
      RAW_API.replace(/\/api\/?$/, "") ||
      "")) ||
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
   🎨 STYLE INPUTS (remplace "form-input" cassé + évite window.formInputStyle)
============================================================================ */
const FORM_INPUT =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white " +
  "focus:outline-none focus:ring-2 focus:ring-blue-600 transition";

/* ============================================================================
   🔗 Proof resolver (ImageKit + legacy)
   - backend peut renvoyer: proofFile.url, proofFile.path, proofFile.filePath
   - ou proofFile string, ou proofFile = { url, fileId, ... }
============================================================================ */
function getProofHrefFromTransaction(t) {
  const pf = t?.proofFile;

  // 1) Si backend renvoie directement une string
  if (typeof pf === "string") return toAbsUrl(pf);

  // 2) ImageKit: url directe (absolue)
  if (pf?.url) return toAbsUrl(pf.url);

  // 3) Legacy: path / filePath
  if (pf?.path) return toAbsUrl(pf.path);
  if (pf?.filePath) return toAbsUrl(pf.filePath);

  // 4) Certains backends: { file: { path } }
  if (pf?.file?.path) return toAbsUrl(pf.file.path);

  return "";
}

function stripUrlParams(url = "") {
  return String(url || "").split("?")[0].split("#")[0];
}

function inferProofKind(pf, proofHref = "") {
  const mime = (pf?.mimeType || "").toLowerCase();
  const name = pf?.originalName || pf?.fileName || pf?.name || "";
  const cleanUrl = stripUrlParams(proofHref);

  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";

  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name) || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(cleanUrl)) {
    return "image";
  }
  if (/\.pdf$/i.test(name) || /\.pdf$/i.test(cleanUrl)) return "pdf";
  return "other";
}

function getProofExtLabel(pf, proofHref = "", fallback = "FILE") {
  const name = pf?.originalName || pf?.fileName || pf?.name || "";
  const cleanUrl = stripUrlParams(proofHref);
  const candidate = name || (cleanUrl.split("/").pop() || "");
  if (!candidate) return fallback;
  const parts = candidate.split(".");
  if (parts.length < 2) return fallback;
  const ext = parts[parts.length - 1].slice(0, 6).toUpperCase();
  return ext || fallback;
}


/* ============================================================================
   🧾 Payload builder (FormData si fichier)
   - évite régressions: createTransaction(payload) support JSON sans fichier
   - et support multipart si proofFile présent (upload.any() côté backend)
============================================================================ */
function buildCreateTransactionPayload(payload) {
  const hasFile = payload?.proofFile instanceof File;

  if (!hasFile) {
    // JSON simple (compatible existant)
    const clean = { ...payload };
    if (!clean.proofFile) delete clean.proofFile;
    return clean;
  }

  // FormData (robuste prod)
  const fd = new FormData();

  Object.entries(payload || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;

    if (k === "proofFile") {
      // ✅ backend tolère plusieurs noms, mais on envoie "proofFile"
      fd.append("proofFile", v);
      return;
    }

    fd.append(k, String(v));
  });

  return fd;
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
    // ✅ multi-pays : laisse backend normaliser (fallback XOF)
    currency: "XOF",
    description: "",
    taskId: "",
    proofFile: null,
  });

  /* ============================================================================
     🔐 Auth headers
  ============================================================================ */
  const authHeaders = useMemo(() => {
    const token =
      (typeof window !== "undefined" &&
        (localStorage.getItem("teranga_token") ||
          localStorage.getItem("token"))) ||
      null;

    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  /* ============================================================================
     📥 Charger transactions (robuste: array ou {transactions})
  ============================================================================ */
  const fetchTransactions = useCallback(async () => {
    try {
      const data = await getTransactions({ serviceId: id });

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.transactions)
        ? data.transactions
        : [];

      const enriched = (list || []).map((t) =>
        t?.statusLabel || t?.typeLabel || t?.currencyLabel ? t : applyLabels(t)
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
      setTasks(data?.tasks || []);
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

        if (typeof window !== "undefined") {
          localStorage.removeItem("teranga_token");
          localStorage.removeItem("token");
          window.location.href = "/login";
        }
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
     ➕ Création transaction (admin/agent/master)
     - ✅ anti double submit
     - ✅ payload FormData si fichier
     - ✅ currency inclus (multi-pays)
  ============================================================================ */
  async function handleSubmit(e) {
    e.preventDefault();

    if (!id) return alert("Service introuvable.");

    const amountNum = parseFloat(form.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return alert("Montant invalide.");
    }

    if (submitting) return; // anti double clic
    setSubmitting(true);

    try {
      const payload = {
        serviceId: parseInt(id, 10),
        taskId: form.taskId ? parseInt(form.taskId, 10) : undefined,
        type: form.type,
        amount: amountNum,
        currency: form.currency || "XOF",
        description: form.description || undefined,
        proofFile: form.proofFile || null,
      };

      const finalPayload = buildCreateTransactionPayload(payload);

      await createTransaction(finalPayload);

      alert("✅ Transaction ajoutée avec succès");

      setForm({
        type: "expense",
        amount: "",
        currency: "XOF",
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

  // ✅ master inclus (multi-pays / ACL backend)
  const canCreate =
    user?.role === "admin" || user?.role === "agent" || user?.role === "master";

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

        {/* ➕ FORMULAIRE PREMIUM (si autorisé) */}
        {canCreate && (
          <TransactionForm
            form={form}
            setForm={setForm}
            tasks={tasks}
            submitting={submitting}
            handleSubmit={handleSubmit}
          />
        )}

        {/* 📜 HISTORIQUE PREMIUM */}
        <TransactionHistory
          transactions={transactions}
          getProofHref={getProofHrefFromTransaction}
        />
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
            className={FORM_INPUT}
          >
            <option value="revenue">Revenu</option>
            <option value="expense">Dépense</option>
            <option value="commission">Commission</option>
            <option value="adjustment">Ajustement</option>
          </select>
        </FormGroup>

        {/* Montant */}
        <FormGroup label="Montant">
          <input
            type="number"
            step="0.01"
            placeholder="15000"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
            className={FORM_INPUT}
          />
        </FormGroup>

        {/* Devise (multi-pays) */}
        <FormGroup label="Devise">
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className={FORM_INPUT}
          >
            {/* ✅ fallback simple (tu peux enrichir via utils/labels si tu veux) */}
            <option value="XOF">FCFA (XOF)</option>
            <option value="XAF">FCFA (XAF)</option>
            <option value="EUR">Euro (EUR)</option>
            <option value="USD">Dollar (USD)</option>
            <option value="GBP">Livre (GBP)</option>
          </select>
        </FormGroup>

        {/* Tâche liée */}
        <FormGroup label="Lier à une tâche (optionnel)" full>
          <select
            value={form.taskId}
            onChange={(e) => setForm({ ...form, taskId: e.target.value })}
            className={FORM_INPUT}
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
            className={FORM_INPUT}
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
            className={FORM_INPUT}
          />
          {form.proofFile && (
            <p className="text-xs text-slate-500 mt-1 break-all">
              Fichier sélectionné : <strong>{form.proofFile.name}</strong>
            </p>
          )}
        </FormGroup>

        {/* Bouton */}
        <div className="col-span-1 sm:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition ${
              submitting
                ? "bg-blue-300 cursor-not-allowed text-white"
                : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"
            }`}
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
   🧩 HISTORIQUE — Premium Style A (proofs ImageKit + legacy)
============================================================================ */
function TransactionHistory({ transactions, getProofHref }) {
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

            const proofHref = getProofHref ? getProofHref(t) : "";
            const proofKind = inferProofKind(t?.proofFile, proofHref);
            const proofLabel =
              t?.proofFile?.originalName ||
              t?.proofFile?.fileName ||
              t?.proofFile?.name ||
              "";
            const proofExt = getProofExtLabel(
              t?.proofFile,
              proofHref,
              proofKind === "pdf" ? "PDF" : "FILE"
            );


            const createdAtDisplay = t.createdAt
              ? new Date(t.createdAt).toLocaleString("fr-FR")
              : "Date inconnue";

            const createdBy =
              t.user?.email ||
              `${t.user?.firstName || ""} ${t.user?.lastName || ""}`.trim() ||
              "—";

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

                  <div className="text-xs text-gray-500">{createdAtDisplay}</div>
                </div>

                {/* DETAILS */}
                <div className="mt-4 text-sm text-gray-700 space-y-2">
                  {t.task && (
                    <p className="break-words">
                      🔧 <strong>Tâche :</strong> {t.task.title} (ID {t.task.id})
                    </p>
                  )}

                  {proofHref && (
                    <div className="mt-2 flex flex-col sm:flex-row gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <a
                        href={proofHref}
                        target="_blank"
                        rel="noreferrer"
                        className="relative w-full sm:w-36 aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-white flex items-center justify-center"
                      >
                        {proofKind === "image" ? (
                          <img
                            src={proofHref}
                            alt="Preuve"
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-center">
                            <div className="text-[0.65rem] font-semibold text-slate-700 bg-white/80 border border-slate-200 px-2 py-0.5 rounded-full inline-flex">
                              {proofExt}
                            </div>
                          </div>
                        )}

                        <span
                          className={`absolute top-2 left-2 text-[0.65rem] font-semibold px-2 py-0.5 rounded-full border ${
                            proofKind === "image"
                              ? "bg-blue-50 text-blue-700 border-blue-100"
                              : proofKind === "pdf"
                              ? "bg-red-50 text-red-700 border-red-100"
                              : "bg-gray-50 text-gray-700 border-gray-200"
                          }`}
                        >
                          {proofKind === "image" ? "IMAGE" : proofKind === "pdf" ? "PDF" : "FICHIER"}
                        </span>
                      </a>

                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-slate-500">Preuve</div>
                        <a
                          href={proofHref}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-semibold text-blue-600 hover:underline break-all"
                        >
                          {proofLabel || "Pi\u00e8ce jointe"}
                        </a>
                        <div className="text-[0.7rem] text-slate-500 mt-1">
                          {proofKind === "image" ? "Aper\u00e7u disponible" : `Format: ${proofExt}`}
                        </div>
                      </div>
                    </div>
                  )}


                  <p className="text-xs text-gray-500 break-words">
                    Enregistré par <strong>{createdBy}</strong>
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
