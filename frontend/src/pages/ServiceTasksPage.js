import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function ServiceTasksPage() {
  const { id } = useParams(); // serviceId depuis l’URL
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  // ✅ Auth header commun
  function authHeader() {
    const token =
      localStorage.getItem('teranga_token') || localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get(`/tasks/service/${id}`, {
          headers: authHeader(),
        });
        setTasks(data.tasks || []);
      } catch (e) {
        console.error('❌ Erreur chargement tâches du service:', e);
        setTasks([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // ✅ État de chargement
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-500 text-lg animate-pulse">Chargement des tâches…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 py-10">
      <div className="max-w-5xl mx-auto bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
        {/* 🧭 En-tête */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            📋 Tâches du service #{id}
          </h1>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition"
          >
            ← Retour
          </button>
        </div>

        {/* Liste vide */}
        {tasks.length === 0 ? (
          <p className="text-center text-gray-500 italic py-6">
            Aucune tâche enregistrée pour ce service.
          </p>
        ) : (
          <div className="grid gap-6">
            {tasks.map((t) => (
              <div
                key={t.id}
                className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 hover:shadow-md transition"
              >
                {/* Titre et statut */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      {t.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {t.description || 'Aucune description fournie.'}
                    </p>
                  </div>

                  {/* Statut coloré */}
                  <div
                    className={`mt-3 sm:mt-0 px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                      t.status === 'created'
                        ? 'bg-gray-100 text-gray-700'
                        : t.status === 'in_progress'
                        ? 'bg-blue-100 text-blue-700'
                        : t.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : t.status === 'validated'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {t.status.replace('_', ' ')}
                  </div>
                </div>

                {/* Informations */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700">
                  <div>
                    <span className="font-semibold">Type :</span> {t.type}
                  </div>
                  <div>
                    <span className="font-semibold">Créateur :</span>{' '}
                    {t.creator?.email || '—'}
                  </div>
                  <div>
                    <span className="font-semibold">Assigné à :</span>{' '}
                    {t.assignee
                      ? `${t.assignee.firstName} ${t.assignee.lastName}`
                      : 'Non assigné'}
                  </div>
                  <div>
                    <span className="font-semibold">ID tâche :</span> {t.id}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6">
                  <button
                    onClick={() => navigate(`/tasks/${t.id}/evidences`)}
                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    📎 Voir preuves
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
