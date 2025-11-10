// frontend/src/pages/ProjectsPage.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { me } from '../services/auth';
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  assignAgentToProject,
} from '../services/projects';
import api from '../services/api';
import { applyLabels } from '../utils/labels';

/* ============================================================
   🔧 Config UI (labels + styles)
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

// Couleurs de badges pour statuts
const STATUS_STYLES = {
  created:    { bg: 'bg-slate-100',   text: 'text-slate-700',   ring: 'ring-slate-200' },
  in_progress:{ bg: 'bg-blue-100',    text: 'text-blue-700',    ring: 'ring-blue-200' },
  completed:  { bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  validated:  { bg: 'bg-indigo-100',  text: 'text-indigo-700',  ring: 'ring-indigo-200' },
  cancelled:  { bg: 'bg-red-100',     text: 'text-red-700',     ring: 'ring-red-200' },
};

/** ⏱️ Helper : vrai si la date est dans la dernière heure */
function isWithinOneHour(date) {
  if (!date) return false;
  const created = new Date(date).getTime();
  return Number.isFinite(created) && Date.now() - created <= 3600000;
}

/** 🔐 Helper : l’utilisateur peut-il modifier/supprimer le projet ? */
function canEditDelete(project, user) {
  if (!user || !project) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'client')
    return project.clientId === user.id && isWithinOneHour(project.createdAt);
  return false;
}

/* ============================================================
   🧩 Composants UI
============================================================ */
function Btn({
  children,
  onClick,
  type = 'button',
  title,
  disabled,
  className = '',
  variant = 'primary',
  size = 'md',
}) {
  const base =
    'inline-flex items-center justify-center font-semibold rounded-xl shadow-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed';

  const sizes = size === 'sm' ? 'text-sm px-3 py-1.5' : 'text-sm px-4 py-2';

  const variants = {
    primary:
      'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white focus-visible:ring-blue-500',
    secondary:
      'bg-gray-100 hover:bg-gray-200 text-gray-900 focus-visible:ring-gray-400',
    ghost:
      'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 focus-visible:ring-gray-400',
    warning:
      'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-600 hover:to-amber-500 text-white focus-visible:ring-amber-400',
    danger:
      'bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 text-white focus-visible:ring-rose-500',
  };

  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ value }) {
  const s = STATUS_STYLES[value] || STATUS_STYLES['created'];
  const label = PROJECT_STATUSES.find((st) => st.value === value)?.label || value;
  return (
    <span
      className={`inline-flex items-center gap-1 ${s.bg} ${s.text} ${s.ring} ring-1 px-2.5 py-0.5 rounded-full text-xs font-medium shadow-sm`}
      aria-label={`Statut ${label}`}
    >
      ● {label}
    </span>
  );
}

function FieldRow({ children }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>;
}

/* ============================================================
   🧠 Page principale
============================================================ */
export default function ProjectsPage() {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [, setErrorMsg] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    clientId: '',
    agentId: '',
    budget: '',
    status: 'created',
    type: 'autre',
  });

  const [filters, setFilters] = useState({
    q: '',
    status: '',
    sort: '-createdAt',
  });

  const navigate = useNavigate();
  const isMounted = useRef(true);

  const getToken = useCallback(
    () => localStorage.getItem('teranga_token') || localStorage.getItem('token'),
    []
  );

  /* ============================================================
     🔹 Chargement des données
  ============================================================ */
  const loadClients = useCallback(async () => {
    try {
      const { data } = await api.get('/users?role=client');
      setClients(data.users || []);
    } catch (e) {
      console.error('❌ Erreur chargement clients:', e);
      setClients([]);
    }
  }, []);

  const loadAgents = useCallback(async () => {
    try {
      const { data } = await api.get('/users?role=agent');
      setAgents(data.users || []);
    } catch (e) {
      console.error('❌ Erreur chargement agents:', e);
      setAgents([]);
    }
  }, []);

  const loadForUser = useCallback(async (u) => {
    if (!u) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const list = await getProjects({});
      const normalized = Array.isArray(list) ? list.map(applyLabels) : [];
      if (isMounted.current) setProjects(normalized);
    } catch (e) {
      console.error('❌ Erreur chargement projets:', e);
      setErrorMsg(
        e?.response?.data?.error || e?.message || 'Erreur lors du chargement des projets.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  /* ============================================================
     🔹 Initialisation
  ============================================================ */
  useEffect(() => {
    isMounted.current = true;
    const init = async () => {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { user: u } = await me();
        if (!isMounted.current) return;
        setUser(u);
        await loadForUser(u);
        if (u.role === 'admin') {
          await loadClients();
          await loadAgents();
        }
      } catch (err) {
        console.error('❌ Erreur chargement user:', err);
        setUser(null);
        setErrorMsg('Erreur lors du chargement de l’utilisateur.');
      } finally {
        setLoading(false);
      }
    };
    init();
    return () => {
      isMounted.current = false;
    };
  }, [getToken, loadForUser, loadClients, loadAgents]);

  /* ============================================================
     🔹 Handlers CRUD + statut
  ============================================================ */
  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        clientId: user?.role === 'admin' ? form.clientId : undefined,
        agentId: user?.role === 'admin' ? form.agentId : undefined,
      };
      if (editId) {
        await updateProject(editId, payload);
        alert('✅ Projet mis à jour avec succès');
      } else {
        await createProject(payload);
        alert('✅ Projet créé avec succès');
      }
      resetForm();
      await loadForUser(user);
    } catch (err) {
      console.error('❌ Erreur sauvegarde projet:', err);
      alert(
        err?.response?.data?.error ||
          err?.message ||
          'Erreur lors de la sauvegarde du projet.'
      );
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Supprimer ce projet ?')) return;
    try {
      await deleteProject(id);
      alert('✅ Projet supprimé');
      await loadForUser(user);
    } catch (err) {
      console.error('❌ Erreur suppression projet:', err);
      alert(err?.response?.data?.error || 'Erreur lors de la suppression.');
    }
  }

  async function handleAssign(projectId, agentId) {
    try {
      await assignAgentToProject(projectId, agentId);
      alert('✅ Agent assigné avec succès');
      await loadForUser(user);
    } catch (err) {
      console.error('❌ Erreur assignation agent:', err);
      alert('Erreur lors de l’assignation.');
    }
  }

  async function handleStatusChange(projectId, newStatus) {
    try {
      await updateProject(projectId, { status: newStatus });
      await loadForUser(user);
      alert('✅ Statut mis à jour avec succès');
    } catch (err) {
      console.error('❌ Erreur mise à jour statut:', err);
      alert('Erreur lors de la mise à jour du statut.');
    }
  }

  function handleEditClick(p) {
    if (!user) return;
    if (user.role === 'admin' || canEditDelete(p, user)) {
      setEditId(p.id);
      setForm({
        title: p.title || '',
        description: p.description || '',
        budget: p.budget || '',
        status: p.status || 'created',
        type: p.type || 'autre',
        clientId: p.client?.id || '',
        agentId: p.agent?.id || '',
      });
      setShowForm(true);
    } else {
      alert(
        "⏱️ Vous ne pouvez plus modifier ce projet. Les clients ne peuvent modifier leur projet que dans l'heure suivant sa création."
      );
    }
  }

  function resetForm() {
    setForm({
      title: '',
      description: '',
      clientId: '',
      agentId: '',
      budget: '',
      status: 'created',
      type: 'autre',
    });
    setEditId(null);
    setShowForm(false);
  }

  /* ============================================================
     🔹 Filtres & tri
  ============================================================ */
  const filtered = useMemo(() => {
    let arr = [...projects];
    if (filters.q.trim()) {
      const q = filters.q.trim().toLowerCase();
      arr = arr.filter(
        (p) =>
          (p.title || '').toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q)
      );
    }
    if (filters.status) arr = arr.filter((p) => p.status === filters.status);

    const sortKey = filters.sort.replace(/^-/, '');
    const sign = filters.sort.startsWith('-') ? -1 : 1;
    arr.sort((a, b) => {
      const va = a?.[sortKey];
      const vb = b?.[sortKey];
      if (sortKey === 'createdAt' || sortKey === 'updatedAt')
        return (new Date(va).getTime() - new Date(vb).getTime()) * sign;
      if (typeof va === 'number' || typeof vb === 'number')
        return ((Number(va) || 0) - (Number(vb) || 0)) * sign;
      return (va || '').toString().localeCompare(vb || '') * sign;
    });
    return arr;
  }, [projects, filters]);

  /* ============================================================
     🔹 Rendu
  ============================================================ */
  if (loading)
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-50 to-gray-100">
        <p className="text-blue-700 text-lg animate-pulse" role="status" aria-live="polite">
          ⏳ Chargement des projets…
        </p>
      </div>
    );

  const canCreate = Boolean(user?.role && user.role !== 'agent');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 py-10">
      <div className="max-w-6xl mx-auto bg-white shadow-2xl rounded-3xl p-8 border border-gray-100">
        {/* ====================================================
            🔹 En-tête + actions
        ==================================================== */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-2">
              📁 Projets
            </h1>
            <p className="text-sm text-gray-500">
              {user?.role === 'admin'
                ? 'Gérez tous les projets des clients.'
                : user?.role === 'agent'
                ? 'Projets qui vous sont assignés.'
                : user
                ? 'Vos projets personnels.'
                : 'Connectez-vous pour accéder à vos projets.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canCreate && (
              <Btn
                onClick={() => setShowForm((v) => !v)}
                variant="ghost"
                title={showForm ? 'Masquer le formulaire' : 'Créer un nouveau projet'}
              >
                {showForm ? '➖ Masquer' : '➕ Nouveau projet'}
              </Btn>
            )}
            <Btn
              onClick={() => loadForUser(user)}
              disabled={loading || !user}
              variant="primary"
              title="Rafraîchir la liste"
            >
              🔄 Rafraîchir
            </Btn>
          </div>
        </div>

        {/* ====================================================
            🔹 Filtres
        ==================================================== */}
        <div className="mb-6 bg-gray-50 p-4 rounded-2xl border border-gray-200 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="Rechercher (titre, description)…"
              aria-label="Recherche"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />

            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              aria-label="Filtrer par statut"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous les statuts</option>
              {PROJECT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            <select
              value={filters.sort}
              onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}
              aria-label="Trier"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="-createdAt">Tri: plus récents</option>
              <option value="createdAt">Tri: plus anciens</option>
              <option value="-updatedAt">Maj: plus récents</option>
              <option value="updatedAt">Maj: plus anciens</option>
              <option value="title">Titre A→Z</option>
              <option value="-title">Titre Z→A</option>
            </select>

            <Btn
              onClick={() => setFilters({ q: '', status: '', sort: '-createdAt' })}
              variant="secondary"
              title="Réinitialiser les filtres"
            >
              Réinitialiser
            </Btn>
          </div>
        </div>

        {/* ====================================================
            🔹 Formulaire création / édition
        ==================================================== */}
        {showForm && canCreate && (
          <form
            onSubmit={handleSubmit}
            className="space-y-4 bg-gray-50 p-6 rounded-2xl border border-gray-200 mb-8 shadow-sm"
          >
            {user.role === 'admin' && (
              <FieldRow>
                {/* ✅ Liste clients sans e-mail */}
                <select
                  value={form.clientId}
                  onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                  required
                  aria-label="Choisir un client"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Choisir un client —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                    </option>
                  ))}
                </select>

                {/* ✅ Liste agents sans e-mail */}
                <select
                  value={form.agentId}
                  onChange={(e) => setForm({ ...form, agentId: e.target.value })}
                  aria-label="Assigner un agent"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Aucun agent assigné —</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.firstName} {a.lastName}
                    </option>
                  ))}
                </select>
              </FieldRow>
            )}

            <FieldRow>
              <input
                placeholder="Titre *"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                aria-label="Titre du projet"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />

              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                required
                aria-label="Type de projet"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                {PROJECT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </FieldRow>

            <FieldRow>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Budget (XOF)"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
                aria-label="Budget"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />

              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                aria-label="Statut"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                {PROJECT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </FieldRow>

            <div>
              <textarea
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                aria-label="Description"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              {editId && (
                <Btn
                  type="button"
                  onClick={resetForm}
                  variant="secondary"
                  title="Annuler la modification"
                >
                  Annuler
                </Btn>
              )}
              <Btn type="submit" variant="primary" title="Enregistrer le projet">
                {editId ? '💾 Enregistrer' : '➕ Créer'}
              </Btn>
            </div>
          </form>
        )}

        {/* ====================================================
            🔹 Liste des projets
        ==================================================== */}
        {filtered.length === 0 ? (
          <p className="text-gray-500 italic text-center py-6">Aucun projet trouvé.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((p) => {
              const allowEditDelete = canEditDelete(p, user);
              const canChangeStatus =
                user?.role === 'admin' ||
                (user?.role === 'agent' && p.agent?.id === user.id);

              return (
                <div
                  key={p.id}
                  className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-lg transition-all p-5 flex flex-col"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold text-gray-900 break-words">
                      {p.title}
                    </h3>

                    {/* ✅ Statut (édition si autorisé, sinon badge) */}
                    <div className="shrink-0">
                      {canChangeStatus ? (
                        <select
                          value={p.status}
                          onChange={(e) => handleStatusChange(p.id, e.target.value)}
                          aria-label="Changer le statut"
                          className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                          title="Changer le statut"
                        >
                          {PROJECT_STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <StatusBadge value={p.status} />
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-gray-400 mt-1">
                    Créé le{' '}
                    {p.createdAt
                      ? new Date(p.createdAt).toLocaleString('fr-FR')
                      : '—'}
                  </p>

                  {/* ✅ Noms sans e-mail */}
                  {p.client && (
                    <p className="text-xs text-gray-700 mt-2">
                      👤 <span className="font-medium">Client</span> : {p.client.firstName}{' '}
                      {p.client.lastName}
                    </p>
                  )}
                  {p.agent && (
                    <p className="text-xs text-gray-700 mt-1">
                      🧑‍💼 <span className="font-medium">Agent</span> : {p.agent.firstName}{' '}
                      {p.agent.lastName}
                    </p>
                  )}

                  {p.description && (
                    <p className="text-sm text-gray-700 mt-3">{p.description}</p>
                  )}

                  {p.budget && (
                    <p className="text-sm text-gray-800 mt-2">
                      💰 <span className="font-medium">Budget</span> :{' '}
                      {Number(p.budget).toLocaleString('fr-FR')} XOF
                    </p>
                  )}

                  {/* 🔹 Actions */}
                  <div className="mt-4 flex flex-wrap gap-2 justify-end items-center">
                    <div className="mr-auto">
                      {/* ✅ Sélecteur d’agent pour admin (noms sans e-mail) */}
                      {user?.role === 'admin' && (
                        <select
                          value={p.agent?.id || ''}
                          onChange={(e) => handleAssign(p.id, e.target.value)}
                          aria-label="Assigner un agent"
                          className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                          title="Assigner un agent"
                        >
                          <option value="">— Assigner agent —</option>
                          {agents.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.firstName} {a.lastName}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <Btn
                      onClick={() => navigate(`/projects/${p.id}`)}
                      variant="primary"
                      size="sm"
                      title="Voir les détails du projet"
                    >
                      📂 Détails
                    </Btn>

                    {(user?.role === 'admin' || allowEditDelete) && (
                      <>
                        <Btn
                          onClick={() => handleEditClick(p)}
                          variant="warning"
                          size="sm"
                          title="Modifier ce projet"
                        >
                          ✏️ Modifier
                        </Btn>
                        <Btn
                          onClick={() => handleDelete(p.id)}
                          variant="danger"
                          size="sm"
                          title="Supprimer ce projet"
                        >
                          ❌ Supprimer
                        </Btn>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
