import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { applyLabels, SERVICE_STATUSES, SERVICE_TYPES } from '../utils/labels';

const TOKEN_KEY = 'teranga_token';

/**
 * 🧑‍🔧 Page AgentServicesPage
 * =============================
 * - Affiche tous les services assignés à l’agent connecté.
 * - Permet de démarrer / terminer un service.
 * - Entièrement en français, cohérent avec backend et labels.js.
 */
export default function AgentServicesPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState(null);

  /* ============================================================
     🔹 Chargement des services assignés
  ============================================================ */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const { data } = await api.get('/services/agent/services', {
        headers: { Authorization: `Bearer ${token}` },
      });

      // 🏷️ Ajout des labels français
      const enriched = (data.services || []).map((s) =>
        s.statusLabel ? s : applyLabels(s)
      );
      setServices(enriched);
    } catch (err) {
      console.error('❌ Erreur chargement services agent:', err);
      setServices([]);
      alert('Erreur lors du chargement des services assignés ❌');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* ============================================================
     🔹 Mise à jour du statut (start / complete)
  ============================================================ */
  const updateStatus = async (id, action) => {
    try {
      setActingId(id);
      const token = localStorage.getItem(TOKEN_KEY);

      let endpoint = '';
      if (action === 'start') endpoint = `/services/agent/services/${id}/start`;
      if (action === 'complete')
        endpoint = `/services/agent/services/${id}/complete`;
      if (!endpoint) return;

      await api.post(
        endpoint,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      await load(); // recharger la liste
    } catch (err) {
      console.error('❌ Erreur mise à jour statut service:', err);
      alert("Erreur lors de la mise à jour du statut ❌");
    } finally {
      setActingId(null);
    }
  };

  /* ============================================================
     🔹 Formatage utilisateur
  ============================================================ */
  const displayUser = (u) => {
    if (!u) return '—';
    return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
  };

  /* ============================================================
     🔹 Interface utilisateur
  ============================================================ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 py-10">
      <div className="max-w-5xl mx-auto bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
        {/* 🧭 En-tête */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              🧑‍🔧 Mes Services assignés
            </h1>
            <p className="text-sm text-gray-500">
              Gérez les services qui vous ont été confiés.
            </p>
          </div>

          <button
            onClick={load}
            disabled={loading}
            className={`px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition ${
              loading
                ? 'bg-blue-300 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
            }`}
          >
            {loading ? 'Chargement…' : '🔄 Rafraîchir'}
          </button>
        </div>

        {/* 📦 Liste des services */}
        {loading ? (
          <div className="text-center py-10 text-gray-500 animate-pulse">
            Chargement des services…
          </div>
        ) : services.length === 0 ? (
          <p className="text-center text-gray-500 italic py-8">
            Aucun service assigné pour le moment.
          </p>
        ) : (
          <div className="grid gap-6">
            {services.map((s) => (
              <div
                key={s.id}
                className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 hover:shadow-md transition"
              >
                {/* ===================== */}
                {/* Titre / informations */}
                {/* ===================== */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      {s.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {s.typeLabel || SERVICE_TYPES[s.type] || s.type} •{' '}
                      <span className="font-medium text-gray-700">
                        Budget : {s.budget ?? '—'} FCFA
                      </span>
                    </p>
                    {s.description && (
                      <p className="text-sm text-gray-600 mt-2">
                        {s.description}
                      </p>
                    )}
                  </div>

                  {/* 🏷️ Statut visuel */}
                  <div
                    className={`mt-3 sm:mt-0 px-3 py-1 rounded-full text-xs font-semibold ${
                      s.status === 'created'
                        ? 'bg-gray-100 text-gray-700'
                        : s.status === 'in_progress'
                        ? 'bg-blue-100 text-blue-700'
                        : s.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : s.status === 'validated'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {s.statusLabel ||
                      SERVICE_STATUSES[s.status] ||
                      s.status.replace('_', ' ')}
                  </div>
                </div>

                {/* ===================== */}
                {/* Détails supplémentaires */}
                {/* ===================== */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700">
                  <div>
                    <span className="font-semibold">Client :</span>{' '}
                    {displayUser(s.client)}
                  </div>
                  <div>
                    <span className="font-semibold">Bien associé :</span>{' '}
                    {s.property?.title
                      ? `${s.property.title} — ${s.property.city}`
                      : '—'}
                  </div>
                  <div>
                    <span className="font-semibold">Personne de contact :</span>{' '}
                    {s.contactPerson || '—'}
                  </div>
                  <div>
                    <span className="font-semibold">Téléphone :</span>{' '}
                    {s.contactPhone || '—'}
                  </div>
                  <div>
                    <span className="font-semibold">Adresse :</span>{' '}
                    {s.address || '—'}
                  </div>
                  <div>
                    <span className="font-semibold">Date création :</span>{' '}
                    {new Date(s.createdAt).toLocaleString()}
                  </div>
                </div>

                {/* ===================== */}
                {/* Actions de l’agent */}
                {/* ===================== */}
                <div className="mt-6 flex gap-3 flex-wrap">
                  {s.status === 'created' && (
                    <button
                      onClick={() => updateStatus(s.id, 'start')}
                      disabled={actingId === s.id}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition shadow-sm ${
                        actingId === s.id
                          ? 'bg-blue-300 cursor-not-allowed text-white'
                          : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                      }`}
                    >
                      ▶️ Démarrer
                    </button>
                  )}

                  {s.status === 'in_progress' && (
                    <button
                      onClick={() => updateStatus(s.id, 'complete')}
                      disabled={actingId === s.id}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition shadow-sm ${
                        actingId === s.id
                          ? 'bg-green-300 cursor-not-allowed text-white'
                          : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
                      }`}
                    >
                      ✅ Terminer
                    </button>
                  )}

                  {s.status === 'completed' && (
                    <span className="text-sm italic text-gray-500">
                      ✅ Service terminé — en attente de validation
                    </span>
                  )}

                  {s.status === 'validated' && (
                    <span className="text-sm italic text-green-700">
                      🏁 Service validé et clôturé
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
