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
import { createTransaction } from '../services/transactions';
import api from '../services/api';
import { applyLabels, CURRENCY_LABELS } from '../utils/labels';

/* ============================================================
   🔧 Config UI
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

// Badges style
const STATUS_STYLES = {
  created: { bg: 'bg-slate-100', text: 'text-slate-700', ring: 'ring-slate-200' },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', ring: 'ring-blue-200' },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  validated: { bg: 'bg-indigo-100', text: 'text-indigo-700', ring: 'ring-indigo-200' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', ring: 'ring-red-200' },
};

/* ============================================================
   Helpers autorisations
============================================================ */
function isWithinOneHour(date) {
  if (!date) return false;
  const ts = new Date(date).getTime();
  return Number.isFinite(ts) && Date.now() - ts <= 3600000;
}

function canEditDelete(project, user) {
  if (!user || !project) return false;
  if (user.role === 'admin') return true;

  if (user.role === 'client')
    return project.clientId === user.id && isWithinOneHour(project.createdAt);

  return false;
}

function canCreateProjectTransaction(project, user) {
  if (!user || !project) return false;

  // Admin → OK
  if (user.role === 'admin') return true;

  // Client propriétaire du projet → OK
  if (user.role === 'client' && project.client?.id === user.id) return true;

  // Agent → NON (sur cette page)
  return false;
}

/* ============================================================
   UI Elements
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
    'inline-flex items-center justify-center font-semibold rounded-xl shadow-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed whitespace-normal break-words text-center';

  const sizesMap = {
    md: 'text-sm px-4 py-2',
    sm: 'text-sm px-3 py-1.5',
    xs: 'text-xs px-2.5 py-1',
  };
  const sizes = sizesMap[size] || sizesMap.md;

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
  const style = STATUS_STYLES[value] || STATUS_STYLES['created'];
  const label =
    PROJECT_STATUSES.find((s) => s.value === value)?.label || value;

  return (
    <span
      className={`inline-flex items-center gap-1 ${style.bg} ${style.text} ${style.ring} ring-1 px-2.5 py-0.5 rounded-full text-xs font-medium`}
    >
      ● {label}
    </span>
  );
}

function FieldRow({ children }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>;
}

/* ============================================================
   Inline Transaction Form (fix FILE_BASE inside)
============================================================ */
function TransactionInlineForm({ project, currentUser, onClose, onSuccess }) {
  const [form, setForm] = useState({
    type: 'expense',
    amount: '',
    currency: 'XOF',
    paymentMethod: '',
    description: '',
    orderId: '',
    proofFile: null,
  });
  const [saving, setSaving] = useState(false);

  const canSeeOrder =
    currentUser?.role === 'admin' || currentUser?.role === 'agent';

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setSaving(true);

      const payload = {
        projectId: Number(project.id),
        type: form.type,
        amount: form.amount === '' ? undefined : Number(form.amount),
        currency: form.currency || 'XOF',
        paymentMethod: form.paymentMethod || undefined,
        description: form.description || undefined,
        orderId: form.orderId ? Number(form.orderId) : undefined,
        proofFile: form.proofFile || undefined,
      };

      await createTransaction(payload);

      alert('✅ Transaction liée au projet créée avec succès');
      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error('❌ Erreur création transaction projet:', err);
      alert(
        err?.response?.data?.error ||
          err?.message ||
          'Erreur lors de la création de la transaction.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl p-4">
      <h4 className="text-sm font-semibold text-gray-800 mb-3">
        💰 Nouvelle transaction pour le projet{' '}
        <span className="font-bold">{project?.title || `#${project?.id}`}</span>
      </h4>

      {/* ---- FORM START ---- */}
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        {/* Type */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Type
          </label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="expense">Dépense</option>
            <option value="revenue">Revenu</option>
            <option value="commission">Commission</option>
            <option value="adjustment">Ajustement</option>
          </select>
        </div>

        {/* Montant */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Montant
          </label>
          <input
            type="number"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {/* Devise */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Devise
          </label>
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {Object.entries(CURRENCY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Méthode paiement */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Méthode de paiement
          </label>
          <input
            value={form.paymentMethod}
            onChange={(e) =>
              setForm({ ...form, paymentMethod: e.target.value })
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Ex : Orange Money"
          />
        </div>

        {/* OrderId visible pour admin/agent */}
        {canSeeOrder && (
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              ID Commande (optionnel)
            </label>
            <input
              type="number"
              value={form.orderId}
              onChange={(e) =>
                setForm({ ...form, orderId: e.target.value })
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        )}

        {/* Description */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {/* ProofFile */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Preuve (image/PDF)
          </label>
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            onChange={(e) =>
              setForm({ ...form, proofFile: e.target.files?.[0] || null })
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          />
        </div>

        {/* Buttons */}
        <div className="sm:col-span-2 flex justify-end gap-2">
          <Btn type="button" variant="secondary" size="sm" onClick={onClose}>
            Annuler
          </Btn>

          <Btn type="submit" variant="primary" size="sm" disabled={saving}>
            {saving ? 'Enregistrement…' : '💾 Enregistrer'}
          </Btn>
        </div>
      </form>
      {/* ---- FORM END ---- */}
    </div>
  );
}

/* ============================================================
   PAGE PRINCIPALE — DEBUT
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

  const [openTrxProjectId, setOpenTrxProjectId] = useState(null);

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
      const normalized = Array.isArray(list)
        ? list.map(applyLabels)
        : [];
      if (isMounted.current) setProjects(normalized);
    } catch (e) {
      console.error('❌ Erreur chargement projets:', e);
      setErrorMsg(
        e?.response?.data?.error ||
          e?.message ||
          'Erreur lors du chargement des projets.'
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
        setErrorMsg("Erreur lors du chargement de l’utilisateur.");
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
     🔹 Handlers CRUD (création / édition / suppression)
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
      await assignAgentToProject(
        projectId,
        agentId ? Number(agentId) : null
      );
      alert('✅ Agent assigné avec succès');
      await loadForUser(user);
    } catch (err) {
      console.error('❌ Erreur assignation agent:', err);
      alert("Erreur lors de l’assignation.");
    }
  }

  async function handleStatusChange(projectId, newStatus) {
    try {
      const proj = projects.find((p) => p.id === projectId);
      if (!proj) return;

      const payload = {
        title: proj.title || '',
        description: proj.description || '',
        budget: proj.budget ?? '',
        status: newStatus,
        type: proj.type || 'autre',
        clientId: proj.clientId ?? proj.client?.id ?? undefined,
        agentId: proj.agentId ?? proj.agent?.id ?? undefined,
      };

      await updateProject(projectId, payload);
      await loadForUser(user);
      alert('✅ Statut mis à jour avec succès');
    } catch (err) {
      console.error('❌ Erreur mise à jour du statut:', err);
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
        "⏱️ Vous ne pouvez plus modifier ce projet (limité à 1h pour les clients)."
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
     🔹 Filtres et tri
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

    if (filters.status) {
      arr = arr.filter((p) => p.status === filters.status);
    }

    const sortKey = filters.sort.replace(/^-/, '');
    const sign = filters.sort.startsWith('-') ? -1 : 1;

    arr.sort((a, b) => {
      const va = a?.[sortKey];
      const vb = b?.[sortKey];

      if (sortKey === 'createdAt' || sortKey === 'updatedAt') {
        return (
          (new Date(va).getTime() - new Date(vb).getTime()) * sign
        );
      }

      if (typeof va === 'number' || typeof vb === 'number') {
        return ((Number(va) || 0) - (Number(vb) || 0)) * sign;
      }

      return (va || '').toString().localeCompare(vb || '') * sign;
    });

    return arr;
  }, [projects, filters]);

  /* ============================================================
     🔹 Rendu principal
  ============================================================ */
  if (loading)
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-50 to-gray-100">
        <p className="text-blue-700 text-lg animate-pulse">
          ⏳ Chargement des projets…
        </p>
      </div>
    );

  const canCreate = Boolean(user?.role && user.role !== 'agent');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 py-10">
      <div className="max-w-6xl mx-auto bg-white shadow-2xl rounded-3xl p-8 border border-gray-100">
        
        {/* ================= HEADER ================= */}
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
                : 'Vos projets personnels.'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {canCreate && (
              <Btn
                onClick={() => setShowForm((v) => !v)}
                variant="ghost"
                size="sm"
              >
                {showForm ? '➖ Masquer' : '➕ Nouveau projet'}
              </Btn>
            )}
            <Btn
              onClick={() => loadForUser(user)}
              disabled={loading || !user}
              variant="primary"
              size="sm"
            >
              🔄 Rafraîchir
            </Btn>
          </div>
        </div>

        {/* ================= FILTRES ================= */}
        <div className="mb-6 bg-gray-50 p-4 rounded-2xl border border-gray-200 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              value={filters.q}
              onChange={(e) =>
                setFilters((f) => ({ ...f, q: e.target.value }))
              }
              placeholder="Rechercher…"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />

            <select
              value={filters.status}
              onChange={(e) =>
                setFilters((f) => ({ ...f, status: e.target.value }))
              }
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
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
              onChange={(e) =>
                setFilters((f) => ({ ...f, sort: e.target.value }))
              }
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="-createdAt">Plus récents</option>
              <option value="createdAt">Plus anciens</option>
              <option value="-updatedAt">Maj récentes</option>
              <option value="updatedAt">Maj anciennes</option>
              <option value="title">Titre A→Z</option>
              <option value="-title">Titre Z→A</option>
            </select>

            <Btn
              onClick={() =>
                setFilters({ q: '', status: '', sort: '-createdAt' })
              }
              variant="secondary"
              size="sm"
            >
              Réinitialiser
            </Btn>
          </div>
        </div>

        {/* ================= FORM CREATION / EDIT ================= */}
        {showForm && canCreate && (
          <form
            onSubmit={handleSubmit}
            className="space-y-4 bg-gray-50 p-6 rounded-2xl border border-gray-200 mb-8 shadow-sm"
          >
            {user.role === 'admin' && (
              <FieldRow>
                <select
                  value={form.clientId}
                  onChange={(e) =>
                    setForm({ ...form, clientId: e.target.value })
                  }
                  required
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">— Choisir un client —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                    </option>
                  ))}
                </select>

                <select
                  value={form.agentId}
                  onChange={(e) =>
                    setForm({ ...form, agentId: e.target.value })
                  }
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">— Aucun agent —</option>
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
                onChange={(e) =>
                  setForm({ ...form, title: e.target.value })
                }
                required
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />

              <select
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value })
                }
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
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
                onChange={(e) =>
                  setForm({ ...form, budget: e.target.value })
                }
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />

              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value })
                }
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {PROJECT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </FieldRow>

            <textarea
              placeholder="Description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />

            <div className="flex justify-end gap-2">
              {editId && (
                <Btn variant="secondary" size="sm" onClick={resetForm}>
                  Annuler
                </Btn>
              )}
              <Btn type="submit" variant="primary" size="sm">
                {editId ? 'Enregistrer' : 'Créer'}
              </Btn>
            </div>
          </form>
        )}

        {/* ================= LISTE DES PROJETS ================= */}
        {filtered.length === 0 ? (
          <p className="text-gray-500 italic text-center py-6">
            Aucun projet trouvé.
          </p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((p) => {
              const allowEditDelete = canEditDelete(p, user);
              const canChangeStatus = user?.role === 'admin';
              const canCreateTrx = canCreateProjectTransaction(p, user);
              const isTrxOpen = openTrxProjectId === p.id;

              return (
                <div
                  key={p.id}
                  className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-lg transition p-5 flex flex-col"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold text-gray-900 break-words flex-1">
                      {p.title}
                    </h3>

                    {/* statut */}
                    <div>
                      {canChangeStatus ? (
                        <select
                          value={p.status}
                          onChange={(e) =>
                            handleStatusChange(p.id, e.target.value)
                          }
                          className="border border-gray-300 rounded-md px-2 py-1 text-sm"
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

                  {p.client && (
                    <p className="text-xs text-gray-700 mt-2">
                      👤 Client : {p.client.firstName} {p.client.lastName}
                    </p>
                  )}

                  {p.agent && (
                    <p className="text-xs text-gray-700 mt-1">
                      🧑‍💼 Agent : {p.agent.firstName} {p.agent.lastName}
                    </p>
                  )}

                  {p.description && (
                    <p className="text-sm text-gray-700 mt-3">
                      {p.description}
                    </p>
                  )}

                  {p.budget && (
                    <p className="text-sm text-gray-800 mt-2">
                      💰 Budget :{' '}
                      {Number(p.budget).toLocaleString('fr-FR')} XOF
                    </p>
                  )}

                  {/* ACTIONS */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {user?.role === 'admin' && (
                      <select
                        value={p.agent?.id || ''}
                        onChange={(e) =>
                          handleAssign(p.id, e.target.value)
                        }
                        className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
                      >
                        <option value="">— Assigner agent —</option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.firstName} {a.lastName}
                          </option>
                        ))}
                      </select>
                    )}

                    <div className="ml-auto flex flex-wrap gap-2">
                      <Btn
                        onClick={() => navigate(`/projects/${p.id}`)}
                        variant="primary"
                        size="sm"
                      >
                        📂 Détails
                      </Btn>

                      {canCreateTrx && (
                        <Btn
                          onClick={() =>
                            setOpenTrxProjectId(isTrxOpen ? null : p.id)
                          }
                          variant="ghost"
                          size="sm"
                        >
                          {isTrxOpen ? '➖ Annuler' : '💰 Transaction'}
                        </Btn>
                      )}

                      {(user?.role === 'admin' || allowEditDelete) && (
                        <>
                          <Btn
                            onClick={() => handleEditClick(p)}
                            variant="warning"
                            size="xs"
                          >
                            ✏️ Modifier
                          </Btn>

                          <Btn
                            onClick={() => handleDelete(p.id)}
                            variant="danger"
                            size="xs"
                          >
                            ❌ Supprimer
                          </Btn>
                        </>
                      )}
                    </div>
                  </div>

                  {isTrxOpen && canCreateTrx && (
                    <TransactionInlineForm
                      project={p}
                      currentUser={user}
                      onClose={() => setOpenTrxProjectId(null)}
                      onSuccess={() => {}}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
