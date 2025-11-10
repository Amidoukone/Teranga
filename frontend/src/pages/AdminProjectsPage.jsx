import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { me } from '../services/auth';
import { getProjects, assignAgentToProject, updateProject } from '../services/projects';

// Options de typologie et de statuts (réutilisées dans filtres + édition de statut)
const PROJECT_TYPES = [
  { value: 'immobilier', label: 'Immobilier' },
  { value: 'agricole', label: 'Agricole' },
  { value: 'commerce', label: 'Commerce' },
  { value: 'autre', label: 'Autre' },
];

const PROJECT_STATUSES = [
  { value: 'created', label: 'Créé' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'completed', label: 'Terminé' },
  { value: 'validated', label: 'Validé' },
  { value: 'cancelled', label: 'Annulé' },
];

export default function AdminProjectsPage() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(null);
  const [projects, setProjects] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);

  // 🔹 États pour les filtres
  const [filters, setFilters] = useState({
    q: '',          // texte libre (titre ou description)
    status: 'all',  // statut projet
    type: 'all',    // type de projet
  });

  // 🔹 Headers d’authentification
  const authHeaders = useMemo(() => {
    const token =
      localStorage.getItem('teranga_token') || localStorage.getItem('token');
    return { headers: { Authorization: token ? `Bearer ${token}` : '' } };
  }, []);

  // Vérifie si l’utilisateur est admin
  useEffect(() => {
    me()
      .then(({ user }) => {
        if (user.role !== 'admin') navigate('/dashboard');
        else setIsAdmin(true);
      })
      .catch(() => navigate('/login'));
  }, [navigate]);

  // 🔹 Charge la liste des agents
  const loadAgents = useCallback(async () => {
    try {
      const { data } = await api.get('/users?role=agent', authHeaders);
      setAgents(data.users || []);
    } catch (err) {
      console.error('❌ Erreur chargement agents:', err);
      setAgents([]);
    }
  }, [authHeaders]);

  // 🔹 Charge la liste des projets
  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getProjects();
      setProjects(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('❌ Erreur chargement projets:', err);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialisation
  useEffect(() => {
    if (isAdmin) {
      loadProjects();
      loadAgents();
    }
  }, [isAdmin, loadProjects, loadAgents]);

  // 🔹 Assignation d’un agent à un projet
  async function handleAssign(projectId, agentId) {
    try {
      await assignAgentToProject(projectId, agentId);
      await loadProjects();
      alert('✅ Agent assigné avec succès');
    } catch (err) {
      console.error('❌ Erreur assignation agent:', err);
      alert("Erreur lors de l'assignation");
    }
  }

  // 🔹 Changement direct de statut dans le tableau
  async function handleStatusChange(projectId, newStatus) {
    try {
      await updateProject(projectId, { status: newStatus });
      await loadProjects();
      alert('✅ Statut mis à jour avec succès');
    } catch (err) {
      console.error('❌ Erreur mise à jour statut:', err);
      alert("Erreur lors de la mise à jour du statut");
    }
  }

  // 🔹 Application des filtres (texte, statut, type)
  const filteredProjects = useMemo(() => {
    let arr = [...projects];

    if (filters.q.trim()) {
      const q = filters.q.trim().toLowerCase();
      arr = arr.filter(
        (p) =>
          (p.title || '').toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q)
      );
    }

    if (filters.status !== 'all') {
      arr = arr.filter((p) => p.status === filters.status);
    }

    if (filters.type !== 'all') {
      arr = arr.filter((p) => p.type === filters.type);
    }

    // Tri implicite: plus récents d'abord si createdAt existe
    arr.sort((a, b) => {
      const da = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });

    return arr;
  }, [projects, filters]);

  if (isAdmin === null)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-500 text-lg animate-pulse">Chargement…</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 py-10">
      <div className="max-w-7xl mx-auto bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
        {/* ============================================================
            🔹 En-tête
        ============================================================ */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <h1 className="text-2xl font-bold text-gray-900">🧩 Gestion des Projets</h1>
          <button
            onClick={loadProjects}
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

        {/* ============================================================
            🔹 Barre de filtres
        ============================================================ */}
        <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              value={filters.q}
              onChange={(e) =>
                setFilters((f) => ({ ...f, q: e.target.value }))
              }
              placeholder="Rechercher (titre ou description)…"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />

            <select
              value={filters.status}
              onChange={(e) =>
                setFilters((f) => ({ ...f, status: e.target.value }))
              }
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tous les statuts</option>
              {PROJECT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            <select
              value={filters.type}
              onChange={(e) =>
                setFilters((f) => ({ ...f, type: e.target.value }))
              }
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tous les types</option>
              {PROJECT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>

            <button
              onClick={() =>
                setFilters({ q: '', status: 'all', type: 'all' })
              }
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-gray-200 hover:bg-gray-300 transition"
            >
              Réinitialiser
            </button>
          </div>
        </div>

        {/* ============================================================
            🔹 Tableau des projets
        ============================================================ */}
        <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-gray-700 font-semibold">
              <tr>
                <th className="px-4 py-3 text-left">Titre / Type</th>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-left">Agent</th>
                <th className="px-4 py-3 text-left">Statut</th>
                <th className="px-4 py-3 text-left">Assigner Agent</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center py-6 text-gray-500 italic"
                  >
                    Aucun projet correspondant aux filtres.
                  </td>
                </tr>
              ) : (
                filteredProjects.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-gray-100 hover:bg-gray-50 transition"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">
                        {p.title}
                      </div>
                      <div className="text-xs text-gray-500">
                        {p.type || '—'} • Budget :{' '}
                        {p.budget ? `${Number(p.budget).toLocaleString()} XOF` : '—'}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {p.client
                        ? `${p.client.firstName} ${p.client.lastName}`
                        : '—'}
                    </td>

                    <td className="px-4 py-3">
                      {p.agent
                        ? `${p.agent.firstName} ${p.agent.lastName}`
                        : 'Non assigné'}
                    </td>

                    {/* ✅ Sélecteur de statut inline pour l’admin */}
                    <td className="px-4 py-3 text-gray-700">
                      <select
                        value={p.status}
                        onChange={(e) => handleStatusChange(p.id, e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        {PROJECT_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      {/* Affichage du label existant si utile */}
                      {p.statusLabel && (
                        <div className="text-xs text-gray-400 mt-1">
                          Libellé: {p.statusLabel}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <select
                        value={p.agent?.id || ''}
                        onChange={(e) => handleAssign(p.id, e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">— Choisir un agent —</option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.firstName} {a.lastName}
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
      </div>
    </div>
  );
}
