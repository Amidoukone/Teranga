import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { applyLabels, SERVICE_STATUSES, SERVICE_TYPES } from '../utils/labels';
import { getGeoParams } from '../services/geo';

const TOKEN_KEY = 'teranga_token';

/**
 * 🧑‍🔧 AgentServicesPage — Version Apple Light Minimal Premium
 * ------------------------------------------------------------
 * - Interface clean, douce, élégante
 * - Aucune logique modifiée
 * - 100% compatible avec ton backend & structure
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
        params: getGeoParams(),
      });

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
      if (action === 'complete') endpoint = `/services/agent/services/${id}/complete`;

      if (!endpoint) return;

      await api.post(
        endpoint,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      await load();
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
     🔹 UI Apple Light — Clean / Minimal / Premium
  ============================================================ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f5f5f7] via-white to-[#e5e5ea] px-4 py-10">
      <div className="max-w-5xl mx-auto bg-white/90 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.06)] rounded-3xl border border-[#e5e5ea] p-8">
        
        {/* 🧭 En-tête */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#111827] tracking-tight">
              🧑‍🔧 Mes Services assignés
            </h1>
            <p className="text-sm text-gray-500">
              Les services pour lesquels vous êtes responsable.
            </p>
          </div>

          <button
            onClick={load}
            disabled={loading}
            className={`
              px-5 py-2 text-sm font-medium rounded-full shadow-sm transition
              ${loading
                ? 'bg-[#bfdcff] cursor-not-allowed text-white'
                : 'bg-[#0a84ff] text-white hover:bg-[#0066cc] active:bg-[#004fa3]'}
            `}
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
                className="
                  bg-white border border-[#e5e7eb] rounded-3xl 
                  shadow-sm p-6 transition 
                  hover:shadow-md hover:-translate-y-0.5 
                  transform
                "
              >
                
                {/* ===================== */}
                {/* Titre / informations */}
                {/* ===================== */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
                  
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1 break-words">
                      {s.title}
                    </h3>

                    <p className="text-sm text-gray-600">
                      {s.typeLabel || SERVICE_TYPES[s.type]} •{' '}
                      <span className="font-medium text-gray-800">
                        Budget : {s.budget ?? '—'} FCFA
                      </span>
                    </p>

                    {s.description && (
                      <p className="text-sm text-gray-600 mt-2 break-words">
                        {s.description}
                      </p>
                    )}
                  </div>

                  {/* 🏷️ Badge statut */}
                  <div
                    className={`
                      mt-3 sm:mt-0 px-4 py-1 rounded-full text-xs font-semibold 
                      whitespace-nowrap text-center
                      ${
                        s.status === 'created'
                          ? 'bg-gray-100 text-gray-700'
                          : s.status === 'in_progress'
                          ? 'bg-[#cce4ff] text-[#0a84ff]'
                          : s.status === 'completed'
                          ? 'bg-green-100 text-green-600'
                          : s.status === 'validated'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-100 text-gray-500'
                      }
                    `}
                  >
                    {s.statusLabel || SERVICE_STATUSES[s.status]}
                  </div>
                </div>

                {/* ===================== */}
                {/* Détails supplémentaires */}
                {/* ===================== */}
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700">
                  
                  <div>
                    <span className="font-medium">Client :</span>{' '}
                    {displayUser(s.client)}
                  </div>

                  <div>
                    <span className="font-medium">Bien associé :</span>{' '}
                    {s.property?.title
                      ? `${s.property.title} — ${s.property.city}`
                      : '—'}
                  </div>

                  <div>
                    <span className="font-medium">Personne de contact :</span>{' '}
                    {s.contactPerson || '—'}
                  </div>

                  <div>
                    <span className="font-medium">Téléphone :</span>{' '}
                    {s.contactPhone || '—'}
                  </div>

                  <div className="sm:col-span-2">
                    <span className="font-medium">Adresse :</span>{' '}
                    {s.address || '—'}
                  </div>

                  <div>
                    <span className="font-medium">Date création :</span>{' '}
                    {new Date(s.createdAt).toLocaleString()}
                  </div>
                </div>

                {/* ===================== */}
                {/* Actions Agent */}
                {/* ===================== */}
                <div className="mt-6 flex gap-3 flex-wrap">
                  
                  {s.status === 'created' && (
                    <button
                      onClick={() => updateStatus(s.id, 'start')}
                      disabled={actingId === s.id}
                      className={`
                        px-5 py-2 rounded-full text-sm font-medium transition shadow-sm 
                        ${actingId === s.id
                          ? 'bg-[#9fc9ff] cursor-not-allowed text-white'
                          : 'bg-[#0a84ff] text-white hover:bg-[#0066cc] active:bg-[#004fa3]'}
                      `}
                    >
                      ▶️ Démarrer
                    </button>
                  )}

                  {s.status === 'in_progress' && (
                    <button
                      onClick={() => updateStatus(s.id, 'complete')}
                      disabled={actingId === s.id}
                      className={`
                        px-5 py-2 rounded-full text-sm font-medium transition shadow-sm 
                        ${actingId === s.id
                          ? 'bg-green-300 cursor-not-allowed text-white'
                          : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'}
                      `}
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
