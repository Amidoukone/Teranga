// ============================================================
// frontend/src/pages/ServiceTasksPage.jsx
// Version Premium 2025 — MASTER SAFE (multi-pays) — PARTIE 1 / 2
// ============================================================

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import { applyLabels } from "../utils/labels";
import { me } from "../services/auth";
import { getGeoParams } from "../services/geo";
import { normalizeRole, isMasterUser } from "../utils/role";

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
  const { id } = useParams(); // serviceId depuis URL
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [user, setUser] = useState(null);

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

      // Labels FR : si backend ne renvoie pas déjà statusLabel/typeLabel/...
      const withLabels = rawTasks.map((t) => (t?.statusLabel ? t : applyLabels(t)));

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
  }, [id, authHeaders]);

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
  }, [loadTasks]);

  /* ============================================================
     ⏳ Écran de chargement premium
  ============================================================ */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4">
        <div className="bg-white/90 border border-gray-100 rounded-2xl shadow-xl px-6 py-5 text-center max-w-md w-full">
          <p className="text-sm font-semibold text-gray-900 mb-1">
            Chargement des tâches du service…
          </p>
          <p className="text-xs text-gray-500 animate-pulse">
            Merci de patienter un instant.
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
              Tâches liées à un service
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 break-words">
                📋 Tâches du service #{id}
              </h1>

              {/* Badge UX — sans impact backend */}
              {isMaster && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[0.7rem] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  MASTER
                </span>
              )}
              {isAdmin && !isMaster && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[0.7rem] font-bold bg-slate-50 text-slate-700 border border-slate-200">
                  ADMIN
                </span>
              )}
              {isAgent && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[0.7rem] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  AGENT
                </span>
              )}
              {isClient && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[0.7rem] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  CLIENT
                </span>
              )}
            </div>

            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Visualisez les tâches associées à ce service et accédez aux preuves
              détaillées pour chaque action.
            </p>
          </div>

          <button
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg shadow-sm bg-slate-900 text-white hover:bg-slate-800 transition"
          >
            <span>← Retour</span>
          </button>
        </div>

        {/* Message d'erreur */}
        {errorMsg && (
          <div className="mb-6 rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 flex gap-2 items-start">
            <span className="mt-[2px]">⚠️</span>
            <p className="break-words">{errorMsg}</p>
          </div>
        )}

              {/* Liste vide */}
        {tasks.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-3">
              <span className="text-xl">🗂️</span>
            </div>
            <p className="text-sm font-semibold text-gray-800 mb-1">
              Aucune tâche enregistrée pour ce service.
            </p>
            <p className="text-xs text-gray-500 max-w-sm">
              Vous pourrez créer des tâches depuis la page principale des tâches
              ou via les services associés pour suivre vos actions.
            </p>
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
  const statusClass =
    task.status === "created"
      ? "bg-gray-100 text-gray-700 border border-gray-200"
      : task.status === "in_progress"
      ? "bg-blue-50 text-blue-700 border border-blue-100"
      : task.status === "completed"
      ? "bg-green-50 text-green-700 border border-green-100"
      : task.status === "validated"
      ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
      : "bg-gray-100 text-gray-500 border border-gray-200";

  const statusIcon =
    task.status === "created"
      ? "🕓"
      : task.status === "in_progress"
      ? "⚙️"
      : task.status === "completed"
      ? "✅"
      : task.status === "validated"
      ? "✔️"
      : "⏺";

  const creatorLabel =
    task.creator?.email ||
    task.creator?.name ||
    task.creatorLabel ||
    (task.creator
      ? `${task.creator.firstName || ""} ${task.creator.lastName || ""}`.trim()
      : "") ||
    "—";

  const assigneeLabel = task.assignee
    ? (
        `${task.assignee.firstName || ""} ${task.assignee.lastName || ""}`.trim() ||
        task.assignee.email
      )
    : "Non assigné";

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
              {task.title || `Tâche #${task.id}`}
            </h3>

            {/* Badge rôle (UX only) */}
            {isMaster && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                MASTER
              </span>
            )}
            {userRole === "admin" && !isMaster && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-slate-50 text-slate-700 border border-slate-200">
                ADMIN
              </span>
            )}
            {userRole === "agent" && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                AGENT
              </span>
            )}
            {userRole === "client" && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                CLIENT
              </span>
            )}
          </div>

          <p className="text-xs sm:text-sm text-gray-600 break-words mt-1">
            {task.description || "Aucune description fournie."}
          </p>
        </div>

        <div
          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[0.7rem] font-semibold whitespace-nowrap ${statusClass}`}
        >
          <span>{statusIcon}</span>
          <span>{task.statusLabel || (task.status ? task.status.replace("_", " ") : "—")}</span>
        </div>
      </div>

      {/* Détails */}
      <div className="mt-4 sm:mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm text-gray-700">
        <div className="break-words">
          <span className="font-semibold text-gray-800">Type :</span>{" "}
          {task.typeLabel || task.type || "—"}
        </div>

        <div className="break-words">
          <span className="font-semibold text-gray-800">Créateur :</span>{" "}
          {creatorLabel}
        </div>

        <div className="break-words">
          <span className="font-semibold text-gray-800">Assigné à :</span>{" "}
          {assigneeLabel}
        </div>

        <div className="break-words">
          <span className="font-semibold text-gray-800">ID tâche :</span>{" "}
          {task.id}
        </div>

        {task.createdAt && (
          <div className="break-words">
            <span className="font-semibold text-gray-800">Créée le :</span>{" "}
            {new Date(task.createdAt).toLocaleString("fr-FR")}
          </div>
        )}

        {task.updatedAt && (
          <div className="break-words">
            <span className="font-semibold text-gray-800">
              Dernière mise à jour :
            </span>{" "}
            {new Date(task.updatedAt).toLocaleString("fr-FR")}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-5 sm:mt-6">
        <button
          onClick={() => navigate(`/tasks/${task.id}/evidences`)}
          className="
            w-full sm:w-auto inline-flex items-center justify-center gap-1
            px-4 py-2 text-xs sm:text-sm font-medium
            bg-blue-600 text-white rounded-lg
            hover:bg-blue-700 active:bg-blue-800 transition
          "
        >
          <span>📎</span>
          <span>Voir preuves</span>
        </button>
      </div>
    </div>
  );
}

