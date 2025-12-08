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

  function statusBadgeClass(st) {
    switch (st) {
      case 'created':
        return 'bg-slate-100 text-slate-700 border border-slate-200';
      case 'in_progress':
        return 'bg-blue-50 text-blue-700 border border-blue-100';
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
      case 'validated':
        return 'bg-indigo-50 text-indigo-700 border border-indigo-100';
      default:
        return 'bg-gray-50 text-gray-600 border border-gray-200';
    }
  }

  if (isAdmin === null)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-500 text-lg animate-pulse">Chargement…</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-3 sm:px-4 py-8 sm:py-10">
      <div className="max-w-6xl mx-auto bg-white/90 backdrop-blur-sm shadow-xl rounded-2xl border border-gray-100 px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

        {/* 🧭 En-tête Apple Light */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
              🧩 Gestion des services
            </h1>
            <p className="text-sm text-slate-500 max-w-xl">
              Vue administrateur pour suivre, filtrer et assigner les services aux agents.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
            <button
              onClick={loadServices}
              disabled={loading}
              className={`inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-full shadow-sm transition ${
                loading
                  ? 'bg-blue-200 text-white cursor-not-allowed'
                  : 'bg-slate-900 text-white hover:bg-black'
              }`}
            >
              {loading ? 'Chargement…' : '🔄 Rafraîchir la liste'}
            </button>
          </div>
        </div>

        {/* 🎛️ Filtres Apple-style */}
        <section className="mb-8 bg-slate-50/80 border border-slate-200 rounded-2xl px-4 sm:px-5 py-4 sm:py-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">

            {/* Statut */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">
                Statut du service
              </label>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setOffset(0);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Non assignés */}
            <div className="flex flex-col justify-end">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={onlyUnassigned}
                  onChange={(e) => {
                    setOnlyUnassigned(e.target.checked);
                    setOffset(0);
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Afficher uniquement les non assignés</span>
              </label>
            </div>

            {/* Recherche */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">
                Recherche
              </label>
              <input
                placeholder="Titre, client, description…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setOffset(0);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Limite */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">
                Limite par page
              </label>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(parseInt(e.target.value, 10));
                  setOffset(0);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n} services
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500">
            <span>
              {services.length === 0
                ? 'Aucun service pour ces filtres.'
                : `${services.length} service(s) chargé(s) pour cette page`}
            </span>
            <button
              type="button"
              onClick={() => {
                setStatus('all');
                setOnlyUnassigned(false);
                setQ('');
                setLimit(25);
                setOffset(0);
              }}
              className="self-start sm:self-auto inline-flex items-center px-3 py-1.5 rounded-full bg-slate-200 hover:bg-slate-300 text-[11px] font-medium transition"
            >
              Réinitialiser les filtres
            </button>
          </div>
        </section>

        {/* 🧾 Tableau Services Apple Light */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/80 text-slate-600">
              <tr>
                <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                  Titre / Type
                </th>
                <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                  Client
                </th>
                <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                  Agent
                </th>
                <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                  Statut
                </th>
                <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                  Assigner / réassigner
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {services.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center py-8 text-slate-400 text-sm italic"
                  >
                    Aucun service pour ces filtres.
                  </td>
                </tr>
              ) : (
                services.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    {/* Titre / Type / Description */}
                    <td className="px-4 sm:px-5 py-3 align-top">
                      <div className="font-medium text-slate-900 break-words">
                        {s.title || `Service #${s.id}`}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {s.type || 'Type inconnu'} • Budget :{' '}
                        <span className="font-medium text-slate-700">
                          {s.budget ?? '—'}
                        </span>
                      </div>
                      {s.description && (
                        <div className="mt-1 text-xs text-slate-400 line-clamp-2">
                          {s.description}
                        </div>
                      )}
                    </td>

                    {/* Client */}
                    <td className="px-4 sm:px-5 py-3 align-top">
                      <div className="text-sm text-slate-800 break-words">
                        {displayUser(s.client)}
                      </div>
                    </td>

                    {/* Agent */}
                    <td className="px-4 sm:px-5 py-3 align-top">
                      <div className="text-sm text-slate-800 break-words">
                        {s.agent ? displayUser(s.agent) : 'Non assigné'}
                      </div>
                    </td>

                    {/* Statut badge */}
                    <td className="px-4 sm:px-5 py-3 align-top">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium capitalize ${statusBadgeClass(
                          s.status
                        )}`}
                      >
                        {s.status.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Select agent */}
                    <td className="px-4 sm:px-5 py-3 align-top">
                      <select
                        disabled={!canReassign(s) || agents.length === 0}
                        value={s.agent?.id || ''}
                        onChange={(e) => handleAssign(s.id, e.target.value)}
                        className={`w-full rounded-xl border px-2.5 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          !canReassign(s) || agents.length === 0
                            ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <option value="">— Choisir un agent —</option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.firstName} {a.lastName} ({a.email})
                          </option>
                        ))}
                      </select>
                      {!canReassign(s) && (
                        <p className="mt-1 text-[11px] text-slate-400">
                          Réassignation désactivée (service clôturé).
                        </p>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 📄 Pagination minimaliste */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-600">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0 || loading}
            className={`inline-flex items-center justify-center px-4 py-2 rounded-full border text-sm font-medium transition ${
              offset === 0 || loading
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
            }`}
          >
            ← Précédent
          </button>

          <span className="text-xs sm:text-sm text-slate-500">
            Offset : <span className="font-medium">{offset}</span> • Limite :{' '}
            <span className="font-medium">{limit}</span>
          </span>

          <button
            onClick={() => setOffset(offset + limit)}
            disabled={loading || services.length < limit}
            className={`inline-flex items-center justify-center px-4 py-2 rounded-full border text-sm font-medium transition ${
              loading || services.length < limit
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
            }`}
          >
            Suivant →
          </button>
        </div>
      </div>
    </div>
  );
}
