// frontend/src/pages/AdminProjectsPage.jsx
// ============================================================================
// AdminProjectsPage.jsx — VERSION PRODUCTION READY (Option A Apple Light)
// Table Premium, design cohérent avec le backoffice Teranga
// ============================================================================

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
   🔧 Typologies et statuts
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
   💰 Formulaire de transaction liée à un projet
   - Utilise createTransaction (service global)
   - Conserve proofFile pour compat backend
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
      if (typeof onSuccess === 'function') onSuccess();
      if (typeof onClose === 'function') onClose();
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
    <div className="bg-gray-50/80 border border-gray-200 rounded-xl p-4 mt-3 shadow-sm">
      <h4 className="text-sm font-semibold text-gray-900 mb-2 break-words">
        💰 Nouvelle transaction pour&nbsp;
        <span className="font-bold text-slate-900">
          {project.title || `Projet #${project.id}`}
        </span>
      </h4>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        {/* Type */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Type
          </label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="expense">Dépense</option>
            <option value="revenue">Revenu</option>
            <option value="commission">Commission</option>
            <option value="adjustment">Ajustement</option>
          </select>
        </div>

        {/* Montant */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Montant
          </label>
          <input
            type="number"
            placeholder="Ex : 250000"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Devise */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Devise
          </label>
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
          >
            {Object.entries(CURRENCY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Méthode de paiement */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Méthode de paiement (optionnel)
          </label>
          <input
            placeholder="Ex : MoMo, Virement..."
            value={form.paymentMethod}
            onChange={(e) =>
              setForm({ ...form, paymentMethod: e.target.value })
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Description */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Description (optionnelle)
          </label>
          <textarea
            rows={2}
            placeholder="Détail de la transaction..."
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Pièce jointe */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Pièce jointe (optionnelle)
          </label>
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            onChange={(e) =>
              setForm({ ...form, proofFile: e.target.files?.[0] || null })
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Boutons */}
        <div className="sm:col-span-2 flex justify-end gap-2 flex-wrap mt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 transition"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className={`px-4 py-2 text-xs font-semibold rounded-lg text-white transition ${
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
   🧠 Page principale : Administration des projets (Admin only)
============================================================ */
export default function AdminProjectsPage() {
  const navigate = useNavigate();

  const [isAdmin, setIsAdmin] = useState(null);
  const [projects, setProjects] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openTrxProjectId, setOpenTrxProjectId] = useState(null);

  // Filtres locaux
  const [filters, setFilters] = useState({
    q: '',
    status: 'all',
    type: 'all',
  });

  // Headers auth (compat teranga_token / token)
  const authHeaders = useMemo(() => {
    const token =
      localStorage.getItem('teranga_token') || localStorage.getItem('token');
    return token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : { headers: {} };
  }, []);

  /* ============================================================
     👮 Vérification admin via /auth/me
  ============================================================ */
  useEffect(() => {
    let active = true;

    async function checkAdmin() {
      try {
        const res = await me();
        if (!active) return;

        const user = res?.user;
        if (!user) {
          navigate('/login');
          return;
        }

        if (user.role !== 'admin') {
          navigate('/dashboard');
          return;
        }

        setIsAdmin(true);
      } catch (err) {
        console.error('❌ Erreur /auth/me (AdminProjectsPage):', err);
        if (!active) return;
        navigate('/login');
      }
    }

    checkAdmin();
    return () => {
      active = false;
    };
  }, [navigate]);

  /* ============================================================
     👥 Chargement des agents (admin)
  ============================================================ */
  const loadAgents = useCallback(async () => {
    try {
      const { data } = await api.get('/users', {
        ...authHeaders,
        params: { role: 'agent' },
      });
      setAgents(data?.users || []);
    } catch (err) {
      console.error('❌ Erreur chargement agents:', err);
      setAgents([]);
    }
  }, [authHeaders]);

  /* ============================================================
     📁 Chargement des projets
  ============================================================ */
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

  /* ============================================================
     🔁 Initialisation quand on sait qu'on est admin
  ============================================================ */
  useEffect(() => {
    if (!isAdmin) return;
    loadProjects();
    loadAgents();
  }, [isAdmin, loadProjects, loadAgents]);

  /* ============================================================
     👤 Assignation agent au projet
  ============================================================ */
  async function handleAssign(projectId, agentId) {
    try {
      const toSend = agentId ? Number(agentId) : null;
      await assignAgentToProject(projectId, toSend);
      await loadProjects();
      alert('✅ Agent assigné avec succès');
    } catch (err) {
      console.error('❌ Erreur assignation agent:', err);
      alert("Erreur lors de l'assignation");
    }
  }

  /* ============================================================
     🔄 Changement de statut
  ============================================================ */
  async function handleStatusChange(projectId, newStatus) {
    try {
      const proj = projects.find((p) => p.id === projectId);
      if (!proj) return;

      const payload = {
        title: proj.title || '',
        description: proj.description || '',
        budget:
          proj.budget === '' || proj.budget === null || proj.budget === undefined
            ? ''
            : proj.budget,
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

  /* ============================================================
     🧮 Application des filtres
  ============================================================ */
  const filteredProjects = useMemo(() => {
    let arr = [...projects];

    if (filters.q.trim()) {
      const q = filters.q.trim().toLowerCase();
      arr = arr.filter((p) =>
        [
          p.title,
          p.description,
          p.type,
          p.client?.firstName,
          p.client?.lastName,
          p.agent?.firstName,
          p.agent?.lastName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }

    if (filters.status !== 'all') {
      arr = arr.filter((p) => p.status === filters.status);
    }

    if (filters.type !== 'all') {
      arr = arr.filter((p) => p.type === filters.type);
    }

    // Tri du plus récent au plus ancien
    arr.sort((a, b) => {
      const da = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });

    return arr;
  }, [projects, filters]);

  /* ============================================================
     ⏳ Écran de chargement avant de savoir si admin
  ============================================================ */
  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-500 text-lg animate-pulse">Chargement…</p>
      </div>
    );
  }

  /* ============================================================
     🎨 Rendu principal — Apple Light Premium
  ============================================================ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 px-3 sm:px-4 py-8 sm:py-10">
      <div className="max-w-7xl mx-auto bg-white shadow-xl rounded-2xl border border-gray-100 px-4 sm:px-8 py-6 sm:py-8">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 break-words">
              🧩 Gestion des Projets
            </h1>
            <p className="text-sm text-gray-600 mt-1 break-words">
              Suivi des projets clients, assignation des agents et gestion des
              transactions liées.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              onClick={loadProjects}
              disabled={loading}
              className={`w-full sm:w-auto px-4 py-2 text-sm font-semibold rounded-lg shadow-sm text-center transition ${
                loading
                  ? 'bg-blue-300 text-white cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
              }`}
            >
              {loading ? 'Chargement…' : '🔄 Rafraîchir'}
            </button>
          </div>
        </div>

        {/* FILTRES */}
        <div className="mb-6 bg-gray-50/80 border border-gray-200 rounded-xl p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Recherche */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Recherche
              </label>
              <input
                value={filters.q}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, q: e.target.value }))
                }
                placeholder="Titre, client, agent, description…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Statut */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Statut
              </label>
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, status: e.target.value }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tous les statuts</option>
                {PROJECT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Type
              </label>
              <select
                value={filters.type}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, type: e.target.value }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tous les types</option>
                {PROJECT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Bas des filtres */}
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-gray-500">
            <div>
              {filteredProjects.length} projet(s) affiché(s) sur{' '}
              {projects.length}
            </div>
            <button
              onClick={() =>
                setFilters({ q: '', status: 'all', type: 'all' })
              }
              className="w-full sm:w-auto px-3 py-1.5 bg-gray-200 rounded-md hover:bg-gray-300 font-medium text-gray-700 text-center transition"
            >
              Réinitialiser les filtres
            </button>
          </div>
        </div>

        {/* TABLEAU PROJETS */}
        <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                  Projet
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                  Client
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                  Agent
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                  Statut
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center py-8 text-gray-500 italic"
                  >
                    Aucun projet correspondant aux filtres.
                  </td>
                </tr>
              ) : (
                filteredProjects.map((p) => {
                  const trxOpen = openTrxProjectId === p.id;

                  const budgetLabel = p.budget
                    ? `${Number(p.budget).toLocaleString('fr-FR')} XOF`
                    : '—';

                  const clientName = p.client
                    ? `${p.client.firstName || ''} ${p.client.lastName || ''}`.trim() ||
                      p.client.email ||
                      '—'
                    : '—';

                  const agentName = p.agent
                    ? `${p.agent.firstName || ''} ${p.agent.lastName || ''}`.trim() ||
                      p.agent.email ||
                      'Non assigné'
                    : 'Non assigné';

                  return (
                    <tr
                      key={p.id}
                      className="border-t border-gray-100 hover:bg-gray-50/80 transition-colors"
                    >
                      {/* Projet : titre / type / budget / description courte */}
                      <td className="px-4 py-3 align-top max-w-xs md:max-w-sm">
                        <div className="font-semibold text-gray-900 break-words">
                          {p.title || `Projet #${p.id}`}
                        </div>
                        <div className="mt-1 text-xs text-gray-500 flex flex-wrap gap-2 items-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                            {p.type || 'Type non défini'}
                          </span>
                          <span className="text-[11px] text-gray-500">
                            Budget : <strong>{budgetLabel}</strong>
                          </span>
                          {p.createdAt && (
                            <span className="text-[11px] text-gray-400">
                              Créé le{' '}
                              {new Date(p.createdAt).toLocaleDateString('fr-FR')}
                            </span>
                          )}
                        </div>
                        {p.description && (
                          <p className="mt-2 text-xs text-gray-600 break-words line-clamp-2">
                            {p.description}
                          </p>
                        )}
                      </td>

                      {/* Client */}
                      <td className="px-4 py-3 align-top max-w-[200px] break-words text-gray-800 text-sm">
                        {clientName}
                      </td>

                      {/* Agent */}
                      <td className="px-4 py-3 align-top max-w-[200px] break-words text-gray-800 text-sm">
                        {agentName}
                      </td>

                      {/* Statut */}
                      <td className="px-4 py-3 align-top">
                        <select
                          value={p.status || 'created'}
                          onChange={(e) =>
                            handleStatusChange(p.id, e.target.value)
                          }
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-blue-500"
                        >
                          {PROJECT_STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Actions : assignation + transaction */}
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-col gap-2 max-w-xs">
                          {/* Assignation agent */}
                          <select
                            value={p.agent?.id || ''}
                            onChange={(e) =>
                              handleAssign(p.id, e.target.value)
                            }
                            className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">— Assigner un agent —</option>
                            {agents.map((a) => (
                              <option key={a.id} value={a.id}>
                                {`${a.firstName || ''} ${a.lastName || ''}`.trim() ||
                                  a.email}
                              </option>
                            ))}
                          </select>

                          {/* Transaction liée */}
                          <button
                            onClick={() =>
                              setOpenTrxProjectId(trxOpen ? null : p.id)
                            }
                            className={`text-xs sm:text-sm font-medium px-3 py-1.5 rounded-lg transition text-center ${
                              trxOpen
                                ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            {trxOpen ? '➖ Fermer la transaction' : '💰 Ajouter une transaction'}
                          </button>

                          {/* Formulaire transaction liée */}
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
