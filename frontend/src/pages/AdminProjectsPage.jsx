// frontend/src/pages/AdminProjectsPage.jsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { me } from '../services/auth';
import {
  getProjects,
  assignAgentToProject,
  updateProject,
} from '../services/projects';
import { createTransaction } from '../services/transactions';
import { CURRENCY_LABELS } from '../utils/labels';

/* ============================================================
   🔧 Typologies et statuts (inchangés)
============================================================ */
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

/* ============================================================
   🧩 Composant Formulaire de transaction liée à un projet
============================================================ */
function ProjectTransactionForm({ project, onClose, onSuccess }) {
  const [form, setForm] = useState({
    type: 'expense',
    amount: '',
    currency: 'XOF',
    paymentMethod: '',
    description: '',
    proofFile: null,
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setLoading(true);
      const payload = {
        ...form,
        amount: form.amount === '' ? undefined : Number(form.amount),
        projectId: Number(project.id),
      };
      await createTransaction(payload);
      alert('✅ Transaction enregistrée avec succès');
      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error('❌ Erreur création transaction projet:', err);
      alert(
        err?.response?.data?.error ||
          err?.message ||
          "Erreur lors de la création de la transaction."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-2 shadow-sm overflow-hidden max-w-full">
      <h4 className="text-sm font-semibold text-gray-800 mb-2 whitespace-normal break-words">
        💰 Nouvelle transaction pour le projet :{' '}
        <span className="font-bold">{project.title}</span>
      </h4>
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 whitespace-normal break-words"
        >
          <option value="expense">Dépense</option>
          <option value="revenue">Revenu</option>
          <option value="commission">Commission</option>
          <option value="adjustment">Ajustement</option>
        </select>

        <input
          type="number"
          placeholder="Montant"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          required
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        />

        <select
          value={form.currency}
          onChange={(e) => setForm({ ...form, currency: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 whitespace-normal break-words"
        >
          {Object.entries(CURRENCY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <input
          placeholder="Méthode de paiement"
          value={form.paymentMethod}
          onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 whitespace-normal break-words"
        />

        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={2}
          className="sm:col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 whitespace-normal break-words"
        />

        <input
          type="file"
          accept=".jpg,.jpeg,.png,.pdf"
          onChange={(e) =>
            setForm({ ...form, proofFile: e.target.files?.[0] || null })
          }
          className="sm:col-span-2 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 bg-white"
        />

        <div className="sm:col-span-2 flex justify-end gap-2 flex-wrap">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-gray-200 hover:bg-gray-300 rounded-lg whitespace-normal break-words text-center"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className={`px-4 py-2 text-xs font-semibold rounded-lg text-white whitespace-normal break-words text-center ${
              loading
                ? 'bg-blue-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Enregistrement…' : '💾 Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ============================================================
   🧠 Page principale : Administration des projets
============================================================ */
export default function AdminProjectsPage() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(null);
  const [projects, setProjects] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openTrxProjectId, setOpenTrxProjectId] = useState(null);

  // 🔹 Filtres
  const [filters, setFilters] = useState({
    q: '',
    status: 'all',
    type: 'all',
  });

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

  // Chargement des agents
  const loadAgents = useCallback(async () => {
    try {
      const { data } = await api.get('/users?role=agent', authHeaders);
      setAgents(data.users || []);
    } catch (err) {
      console.error('❌ Erreur chargement agents:', err);
      setAgents([]);
    }
  }, [authHeaders]);

  // Chargement des projets
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

  // Assignation agent
  async function handleAssign(projectId, agentId) {
    try {
      await assignAgentToProject(projectId, agentId ? Number(agentId) : null);
      await loadProjects();
      alert('✅ Agent assigné avec succès');
    } catch (err) {
      console.error('❌ Erreur assignation agent:', err);
      alert("Erreur lors de l'assignation");
    }
  }

  // Changement statut (✅ envoi payload complet pour ne pas écraser budget & co)
  async function handleStatusChange(projectId, newStatus) {
    try {
      const proj = projects.find((p) => p.id === projectId);
      if (!proj) return;

      const payload = {
        // Aligné avec ProjectsPage.jsx (form)
        title: proj.title || '',
        description: proj.description || '',
        budget: proj.budget ?? '',
        status: newStatus,
        type: proj.type || 'autre',
        clientId: proj.clientId ?? proj.client?.id ?? undefined,
        agentId: proj.agentId ?? proj.agent?.id ?? undefined,
      };

      await updateProject(projectId, payload);
      await loadProjects();
      alert('✅ Statut mis à jour avec succès');
    } catch (err) {
      console.error('❌ Erreur mise à jour statut:', err);
      alert('Erreur lors de la mise à jour du statut');
    }
  }

  // Application filtres
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
    if (filters.status !== 'all') arr = arr.filter((p) => p.status === filters.status);
    if (filters.type !== 'all') arr = arr.filter((p) => p.type === filters.type);

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

  /* ============================================================
     🔹 Rendu principal
  ============================================================ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 py-10">
      <div className="max-w-7xl mx-auto bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
        {/* En-tête */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <h1 className="text-2xl font-bold text-gray-900 whitespace-normal break-words">
            🧩 Gestion des Projets
          </h1>
          <button
            onClick={loadProjects}
            disabled={loading}
            className={`px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition whitespace-normal break-words text-center ${
              loading
                ? 'bg-blue-300 text-white cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
            }`}
          >
            {loading ? 'Chargement…' : '🔄 Rafraîchir'}
          </button>
        </div>

        {/* Filtres */}
        <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="Rechercher (titre ou description)…"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 whitespace-normal break-words"
            />

            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 whitespace-normal break-words"
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
              onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 whitespace-normal break-words"
            >
              <option value="all">Tous les types</option>
              {PROJECT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => setFilters({ q: '', status: 'all', type: 'all' })}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-gray-200 hover:bg-gray-300 transition whitespace-normal break-words text-center"
            >
              Réinitialiser
            </button>
          </div>
        </div>

        {/* Tableau */}
        <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-gray-700 font-semibold">
              <tr>
                <th className="px-4 py-3 text-left whitespace-normal break-words">
                  Titre / Type
                </th>
                <th className="px-4 py-3 text-left whitespace-normal break-words">
                  Client
                </th>
                <th className="px-4 py-3 text-left whitespace-normal break-words">
                  Agent
                </th>
                <th className="px-4 py-3 text-left whitespace-normal break-words">
                  Statut
                </th>
                <th className="px-4 py-3 text-left whitespace-normal break-words">
                  Actions
                </th>
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
                filteredProjects.map((p) => {
                  const trxOpen = openTrxProjectId === p.id;
                  return (
                    <tr
                      key={p.id}
                      className="border-t border-gray-100 hover:bg-gray-50 transition"
                    >
                      <td className="px-4 py-3 align-top max-w-xs md:max-w-sm">
                        <div className="font-semibold text-gray-900 whitespace-normal break-words">
                          {p.title}
                        </div>
                        <div className="text-xs text-gray-500 whitespace-normal break-words mt-1">
                          {p.type || '—'} • Budget :{' '}
                          {p.budget
                            ? `${Number(p.budget).toLocaleString('fr-FR')} XOF`
                            : '—'}
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top whitespace-normal break-words max-w-[180px]">
                        {p.client
                          ? `${p.client.firstName} ${p.client.lastName}`
                          : '—'}
                      </td>

                      <td className="px-4 py-3 align-top whitespace-normal break-words max-w-[180px]">
                        {p.agent
                          ? `${p.agent.firstName} ${p.agent.lastName}`
                          : 'Non assigné'}
                      </td>

                      <td className="px-4 py-3 align-top">
                        <select
                          value={p.status}
                          onChange={(e) =>
                            handleStatusChange(p.id, e.target.value)
                          }
                          className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 whitespace-normal break-words"
                        >
                          {PROJECT_STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-col gap-2 max-w-xs whitespace-normal break-words">
                          <select
                            value={p.agent?.id || ''}
                            onChange={(e) =>
                              handleAssign(p.id, e.target.value)
                            }
                            className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 whitespace-normal break-words"
                          >
                            <option value="">— Assigner agent —</option>
                            {agents.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.firstName} {a.lastName}
                              </option>
                            ))}
                          </select>

                          <button
                            onClick={() =>
                              setOpenTrxProjectId(trxOpen ? null : p.id)
                            }
                            className={`text-sm font-medium px-3 py-1.5 rounded-lg transition whitespace-normal break-words text-center ${
                              trxOpen
                                ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            {trxOpen ? '➖ Annuler' : '💰 Transaction'}
                          </button>

                          {trxOpen && (
                            <ProjectTransactionForm
                              project={p}
                              onClose={() => setOpenTrxProjectId(null)}
                              onSuccess={loadProjects}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
