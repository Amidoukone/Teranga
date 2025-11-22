// frontend/src/pages/ServiceTasksPage.jsx
import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import { applyLabels } from "../utils/labels";

/* ========================================================================
   🔧 PAGE : ServiceTasksPage — Option B + Version Optimale Responsive
   - Chargement des tâches du service
   - Labels cohérents (statusLabel, typeLabel…)
   - UI responsive / mobile-first
   - Styles premium cohérents avec ServicesPage
   - Gestion erreurs + états de chargement
=========================================================================== */

export default function ServiceTasksPage() {
  const { id } = useParams(); // serviceId depuis URL
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  /* ============================================================
     🔐 Auth headers (production-safe)
  ============================================================ */
  const authHeaders = useMemo(() => {
    const token =
      localStorage.getItem("teranga_token") ||
      localStorage.getItem("token");

    return {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    };
  }, []);

  /* ============================================================
     📥 Chargement des tâches
  ============================================================ */
  useEffect(() => {
    async function load() {
      if (!id) return;

      try {
        setLoading(true);
        setErrorMsg("");

        const { data } = await api.get(`/tasks/service/${id}`, authHeaders);

        const rawTasks = data?.tasks || [];

        // Application labels (FR) si le backend ne les fournit pas
        const withLabels = rawTasks.map((t) => applyLabels(t));

        setTasks(withLabels);
      } catch (err) {
        console.error("❌ Erreur chargement tâches:", err);
        setErrorMsg(
          "Erreur lors du chargement des tâches du service. Veuillez réessayer."
        );
        setTasks([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, authHeaders]);

  /* ============================================================
     ⏳ Écran de chargement (premium)
  ============================================================ */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100">
        <div className="text-center">
          <p className="text-gray-600 text-lg font-medium animate-pulse">
            Chargement des tâches…
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
      <div className="max-w-5xl mx-auto bg-white shadow-xl rounded-2xl p-4 sm:p-8 border border-gray-100">

        {/* 🧭 EN-TÊTE */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="break-words">
            <h1 className="text-2xl font-bold text-gray-900 break-words">
              📋 Tâches du service #{id}
            </h1>
          </div>

          <button
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            ← Retour
          </button>
        </div>

        {/* Message d'erreur */}
        {errorMsg && (
          <div className="mb-6 rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 break-words">
            {errorMsg}
          </div>
        )}

        {/* Liste vide */}
        {tasks.length === 0 ? (
          <p className="text-center text-gray-500 italic py-8">
            Aucune tâche enregistrée pour ce service.
          </p>
        ) : (
          <div className="grid gap-6">
            {tasks.map((t) => (
              <TaskCard key={t.id} task={t} navigate={navigate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ========================================================================
   🧩 TaskCard — carte responsive & premium
=========================================================================== */
function TaskCard({ task, navigate }) {
  const statusClass =
    task.status === "created"
      ? "bg-gray-100 text-gray-700"
      : task.status === "in_progress"
      ? "bg-blue-100 text-blue-700"
      : task.status === "completed"
      ? "bg-green-100 text-green-700"
      : task.status === "validated"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-gray-100 text-gray-500";

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 sm:p-6 hover:shadow-md transition w-full break-words">

      {/* Titre + statut */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-gray-900 break-words">
            {task.title || `Tâche #${task.id}`}
          </h3>

          <p className="text-sm text-gray-600 break-words mt-1">
            {task.description || "Aucune description fournie."}
          </p>
        </div>

        <div
          className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${statusClass}`}
        >
          {task.statusLabel ||
            (task.status ? task.status.replace("_", " ") : "—")}
        </div>
      </div>

      {/* Détails */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700">

        <div className="break-words">
          <span className="font-semibold">Type :</span>{" "}
          {task.typeLabel || task.type || "—"}
        </div>

        <div className="break-words">
          <span className="font-semibold">Créateur :</span>{" "}
          {task.creator?.email ||
            task.creator?.name ||
            task.creatorLabel ||
            "—"}
        </div>

        <div className="break-words">
          <span className="font-semibold">Assigné à :</span>{" "}
          {task.assignee
            ? `${task.assignee.firstName || ""} ${
                task.assignee.lastName || ""
              }`.trim() || task.assignee.email
            : "Non assigné"}
        </div>

        <div>
          <span className="font-semibold">ID tâche :</span>{" "}
          {task.id}
        </div>

        {task.createdAt && (
          <div>
            <span className="font-semibold">Créée le :</span>{" "}
            {new Date(task.createdAt).toLocaleString("fr-FR")}
          </div>
        )}

        {task.updatedAt && (
          <div>
            <span className="font-semibold">Dernière MAJ :</span>{" "}
            {new Date(task.updatedAt).toLocaleString("fr-FR")}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-6">
        <button
          onClick={() => navigate(`/tasks/${task.id}/evidences`)}
          className="w-full sm:w-auto px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          📎 Voir preuves
        </button>
      </div>
    </div>
  );
}
