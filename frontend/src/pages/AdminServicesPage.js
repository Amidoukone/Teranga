import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { me } from '../services/auth';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'created', label: 'Créés' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'completed', label: 'Terminés' },
  { value: 'validated', label: 'Validés' },
];

export default function AdminServicesPage() {
  const navigate = useNavigate();

  const [isAdmin, setIsAdmin] = useState(null);
  const [services, setServices] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filtres
  const [status, setStatus] = useState('all');
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [q, setQ] = useState('');

  // Pagination simple
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);

  const authHeaders = useMemo(
    () => ({
      headers: {
        Authorization: `Bearer ${
          localStorage.getItem('teranga_token') || localStorage.getItem('token')
        }`,
      },
    }),
    []
  );

  // Vérifie si admin
  useEffect(() => {
    me()
      .then(({ user }) => {
        if (!user || user.role !== 'admin') {
          navigate('/dashboard');
        } else {
          setIsAdmin(true);
        }
      })
      .catch(() => navigate('/login'));
  }, [navigate]);

  // --- fonctions stabilisées pour satisfaire react-hooks/exhaustive-deps ---

  const loadAgents = useCallback(async () => {
    try {
      const { data } = await api.get('/users?role=agent', authHeaders);
      setAgents(data.users || []);
    } catch (err) {
      console.error('❌ Erreur chargement agents:', err);
      setAgents([]);
    }
  }, [authHeaders]);

  const loadServices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== 'all') params.set('status', status);
      if (onlyUnassigned) params.set('unassigned', '1');
      if (q.trim()) params.set('q', q.trim());
      params.set('limit', String(limit));
      params.set('offset', String(offset));

      const { data } = await api.get(`/services?${params.toString()}`, authHeaders);
      setServices(data.services || []);
    } catch (e) {
      console.error('❌ Erreur chargement services:', e);
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, status, onlyUnassigned, q, limit, offset]);

  // Charger agents une fois admin validé
  useEffect(() => {
    if (isAdmin) {
      loadAgents();
    }
  }, [isAdmin, loadAgents]);

  // Charger services quand filtres/pagination changent
  useEffect(() => {
    if (isAdmin) {
      loadServices();
    }
  }, [isAdmin, loadServices]);

  async function handleAssign(serviceId, agentId) {
    if (!agentId) return;
    try {
      await api.post('/services/assign', { serviceId, agentId }, authHeaders);
      await loadServices();
    } catch (e) {
      console.error('❌ Erreur assignation:', e);
      alert("Erreur lors de l’assignation ❌");
    }
  }

  function displayUser(u) {
    if (!u) return '—';
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
    return name ? `${name} (${u.email})` : u.email;
  }

  function canReassign(s) {
    return s.status !== 'completed' && s.status !== 'validated';
  }

  if (isAdmin === null)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-500 text-lg animate-pulse">Chargement…</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 py-10">
      <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
        {/* 🧭 En-tête */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <h1 className="text-2xl font-bold text-gray-900">
            🧩 Gestion des Services (Admin)
          </h1>
          <button
            onClick={loadServices}
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

        {/* 🔍 Filtres */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={onlyUnassigned}
              onChange={(e) => setOnlyUnassigned(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            Non assignés
          </label>

          <input
            placeholder="🔎 Recherche (titre, client...)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={limit}
            onChange={(e) => {
              setLimit(parseInt(e.target.value, 10));
              setOffset(0);
            }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                Limite : {n}
              </option>
            ))}
          </select>
        </div>

        {/* 🧾 Tableau Services */}
        <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-gray-700 font-semibold">
              <tr>
                <th className="px-4 py-3 text-left">Titre / Type</th>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-left">Agent</th>
                <th className="px-4 py-3 text-left">Statut</th>
                <th className="px-4 py-3 text-left">Assigner / Réassigner</th>
              </tr>
            </thead>
            <tbody>
              {services.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center py-6 text-gray-500 italic"
                  >
                    Aucun service pour ces filtres.
                  </td>
                </tr>
              ) : (
                services.map((s) => (
                  <tr
                    key={s.id}
                    className="border-t border-gray-100 hover:bg-gray-50 transition"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">
                        {s.title}
                      </div>
                      <div className="text-xs text-gray-500">
                        {s.type} • Budget : {s.budget ?? '—'}
                      </div>
                      {s.description && (
                        <div className="text-xs text-gray-400 mt-1">
                          {s.description}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">{displayUser(s.client)}</td>
                    <td className="px-4 py-3">
                      {s.agent ? displayUser(s.agent) : 'Non assigné'}
                    </td>
                    <td className="px-4 py-3 capitalize text-gray-700">
                      {s.status.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        disabled={!canReassign(s) || agents.length === 0}
                        value={s.agent?.id || ''}
                        onChange={(e) => handleAssign(s.id, e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">— Choisir un agent —</option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.firstName} {a.lastName} ({a.email})
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 📄 Pagination */}
        <div className="flex justify-between items-center mt-6 text-sm">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0 || loading}
            className={`px-4 py-2 rounded-lg transition ${
              offset === 0 || loading
                ? 'bg-gray-200 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            ← Précédent
          </button>

          <span className="text-gray-600">
            Offset : {offset} • Limite : {limit}
          </span>

          <button
            onClick={() => setOffset(offset + limit)}
            disabled={loading || services.length < limit}
            className={`px-4 py-2 rounded-lg transition ${
              loading || services.length < limit
                ? 'bg-gray-200 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            Suivant →
          </button>
        </div>
      </div>
    </div>
  );
}
