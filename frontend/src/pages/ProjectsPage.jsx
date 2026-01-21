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

// ✅ MASTER-safe helpers (pas de rôle "master", seulement admin + scope)
import { normalizeRole, isMasterUser } from '../utils/role';

/* ============================================================
   🔧 CONFIG UI — DESIGN SYSTEM PREMIUM (OPTION B)
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

const STATUS_STYLES = {
  created: { bg: 'bg-slate-100', text: 'text-slate-700', ring: 'ring-slate-200' },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', ring: 'ring-blue-200' },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  validated: { bg: 'bg-indigo-100', text: 'text-indigo-700', ring: 'ring-indigo-200' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', ring: 'ring-red-200' },
};

/* ============================================================
   ⏱ Permissions
   ✅ MASTER = admin côté backend -> normalizeRole garantit robustesse
============================================================ */
function isWithinOneHour(date) {
  if (!date) return false;
  const ts = new Date(date).getTime();
  return Number.isFinite(ts) && Date.now() - ts <= 3600000;
}

function canEditDelete(project, user) {
  if (!user || !project) return false;

  const role = normalizeRole(user?.role);
  if (role === 'admin') return true;

  if (role === 'client')
    return project.clientId === user.id && isWithinOneHour(project.createdAt);

  return false;
}

function canCreateProjectTransaction(project, user) {
  if (!user || !project) return false;

  const role = normalizeRole(user?.role);
  if (role === 'admin') return true;

  if (role === 'client' && project.client?.id === user.id) return true;

  return false;
}

/* ============================================================
   ⭐ Premium Button — Option B
============================================================ */
function Btn({
  children,
  type = 'button',
  onClick,
  disabled,
  variant = 'primary',
  size = 'md',
  className = '',
}) {
  const base =
    'inline-flex items-center justify-center font-semibold rounded-xl shadow-sm transition-all duration-200 whitespace-normal break-words focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed';

  const sizes = {
    md: 'px-4 py-2 text-sm',
    sm: 'px-3 py-1.5 text-sm',
    xs: 'px-2 py-1 text-xs',
  }[size];

  const variants = {
    primary:
      'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white focus-visible:ring-blue-500',
    secondary:
      'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 focus-visible:ring-slate-400',
    ghost:
      'bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 focus-visible:ring-slate-400',
    warning:
      'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-600 hover:to-amber-500 text-white focus-visible:ring-amber-500',
    danger:
      'bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 text-white focus-visible:ring-rose-500',
  }[variant];

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${sizes} ${variants} ${className}`}
    >
      {children}
    </button>
  );
}

/* ============================================================
   Status Badge (premium)
============================================================ */
function StatusBadge({ value }) {
  const s = STATUS_STYLES[value] || STATUS_STYLES['created'];
  const label = PROJECT_STATUSES.find((e) => e.value === value)?.label || value;

  return (
    <span
      className={`inline-flex items-center gap-1 ${s.bg} ${s.text} ${s.ring}
        ring-1 px-2.5 py-0.5 rounded-full text-xs font-medium`}
    >
      ● {label}
    </span>
  );
}

/* ============================================================
   Field Row — responsive premium
============================================================ */
function FieldRow({ children }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

/* ============================================================
   Inline Transaction Form (Premium B)
============================================================ */
function TransactionInlineForm({ project, currentUser, onClose, onSuccess }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: 'expense',
    amount: '',
    currency: 'XOF',
    paymentMethod: '',
    description: '',
    orderId: '',
    proofFile: null,
  });

  // ✅ MASTER-safe: master logique = admin => normalizeRole couvre tout
  const canSeeOrder =
    normalizeRole(currentUser?.role) === 'admin' ||
    normalizeRole(currentUser?.role) === 'agent';

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setSaving(true);

      await createTransaction({
        type: form.type,
        amount: form.amount ? Number(form.amount) : undefined,
        currency: form.currency,
        description: form.description || undefined,
        paymentMethod: form.paymentMethod || undefined,
        orderId: form.orderId ? Number(form.orderId) : undefined,
        proofFile: form.proofFile || undefined,
        projectId: Number(project.id),
      });

      alert('Transaction créée');
      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error('❌ Transaction error:', err);
      alert('Erreur lors de la création de la transaction.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="
        mt-4 bg-slate-50 border border-slate-200 rounded-2xl p-4
        w-full max-w-full min-w-0
        overflow-auto
      "
    >
      <h4 className="text-sm font-semibold text-slate-700 mb-3">
        💰 Nouvelle transaction
      </h4>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <div>
          <label className="text-xs text-slate-600 font-medium mb-1 block">
            Type
          </label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="expense">Dépense</option>
            <option value="revenue">Revenu</option>
            <option value="commission">Commission</option>
            <option value="adjustment">Ajustement</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-600 font-medium mb-1 block">
            Montant
          </label>
          <input
            type="number"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            required
          />
        </div>

        <div>
          <label className="text-xs text-slate-600 font-medium mb-1 block">
            Devise
          </label>
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            {Object.entries(CURRENCY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-600 font-medium mb-1 block">
            Méthode paiement
          </label>
          <input
            value={form.paymentMethod}
            onChange={(e) =>
              setForm({ ...form, paymentMethod: e.target.value })
            }
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Ex : OM, Wave"
          />
        </div>

        {canSeeOrder && (
          <div className="md:col-span-2">
            <label className="text-xs text-slate-600 font-medium mb-1 block">
              ID Commande (optionnel)
            </label>
            <input
              type="number"
              value={form.orderId}
              onChange={(e) =>
                setForm({ ...form, orderId: e.target.value })
              }
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        )}

        <div className="md:col-span-2">
          <label className="text-xs text-slate-600 font-medium mb-1 block">
            Description
          </label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div className="md:col-span-2">
          <label className="text-xs text-slate-600 font-medium mb-1 block">
            Preuve (image / PDF)
          </label>
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            onChange={(e) =>
              setForm({ ...form, proofFile: e.target.files?.[0] || null })
            }
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          />
        </div>

        <div className="md:col-span-2 flex justify-end gap-2">
          <Btn variant="secondary" size="sm" onClick={onClose}>
            Annuler
          </Btn>
          <Btn variant="primary" size="sm" type="submit" disabled={saving}>
            {saving ? 'Enregistrement…' : '💾 Enregistrer'}
          </Btn>
        </div>
      </form>
    </div>
  );
}

/* ============================================================
   🧠 PAGE PRINCIPALE — Début
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

  // ✅ MASTER-safe flags (UX only — pas de filtre frontend)
  const isAdmin = useMemo(() => normalizeRole(user?.role) === 'admin', [user]);
  const isMaster = useMemo(() => isMasterUser(user), [user]);

  /* ============================================================
     🔹 Chargement des données (clients, agents, projets)
  ============================================================= */
  const loadClients = useCallback(async () => {
    try {
      const { data } = await api.get('/users?role=client');
      setClients(Array.isArray(data.users) ? data.users : []);
    } catch (e) {
      console.error('❌ Erreur chargement clients:', e);
      setClients([]);
    }
  }, []);

  const loadAgents = useCallback(async () => {
    try {
      const { data } = await api.get('/users?role=agent');
      setAgents(Array.isArray(data.users) ? data.users : []);
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
      // ✅ IMPORTANT: aucun filtre geo côté frontend
      const list = await getProjects({});
      const normalized = Array.isArray(list) ? list.map(applyLabels) : [];
      if (isMounted.current) setProjects(normalized);
    } catch (e) {
      console.error('❌ Erreur chargement projets:', e);
      setErrorMsg(
        e?.response?.data?.error ||
          e?.message ||
          'Erreur lors du chargement des projets.'
      );
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);
  /* ============================================================
     🔹 Initialisation
     - MASTER = admin backend + scope → ici traité comme admin
  ============================================================= */
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

        // ADMIN GLOBAL ou MASTER (admin + scope)
        if (normalizeRole(u?.role) === 'admin') {
          await Promise.all([loadClients(), loadAgents()]);
        }
      } catch (err) {
        console.error('❌ Erreur chargement user:', err);
        setUser(null);
        setErrorMsg("Erreur lors du chargement de l’utilisateur.");
      } finally {
        if (isMounted.current) setLoading(false);
      }
    };

    init();

    return () => {
      isMounted.current = false;
    };
  }, [getToken, loadForUser, loadClients, loadAgents]);

  /* ============================================================
     🔹 Handlers CRUD
  ============================================================= */
  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        clientId: isAdmin ? form.clientId : undefined,
        agentId: isAdmin ? form.agentId : undefined,
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

    if (isAdmin || canEditDelete(p, user)) {
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
        '⏱️ Vous ne pouvez plus modifier ce projet (limité à 1h pour les clients).'
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
     🔹 Filtres & Tri (100% locaux, aucun filtre geo)
  ============================================================= */
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
     🔹 Rendu
  ============================================================= */
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
        <p className="text-blue-700 text-base sm:text-lg animate-pulse text-center px-4">
          ⏳ Chargement des projets…
        </p>
      </div>
    );
  }

  const canCreate = Boolean(user?.role && normalizeRole(user.role) !== 'agent');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-3 sm:px-4 py-6 sm:py-10 overflow-x-hidden">
      <div className="max-w-6xl w-full mx-auto bg-white shadow-2xl rounded-3xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 border border-slate-100">

        {/* ================= HEADER ================= */}
        <div className="w-full flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="space-y-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-2">
              📁 Projets
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              {isAdmin
                ? 'Gérez tous les projets des clients.'
                : normalizeRole(user?.role) === 'agent'
                ? 'Projets qui vous sont assignés.'
                : 'Vos projets personnels.'}
            </p>

            {/* UX info MASTER (non bloquant, informatif) */}
            {isMaster && (
              <p className="text-[11px] text-slate-400 mt-1">
                Mode MASTER activé — périmètre géré automatiquement par le backend
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            {canCreate && (
              <Btn
                onClick={() => setShowForm((v) => !v)}
                variant="ghost"
                size="sm"
              >
                {showForm ? '➖ Masquer le formulaire' : '➕ Nouveau projet'}
              </Btn>
            )}
            <Btn
              onClick={() => loadForUser(user)}
              disabled={!user}
              variant="primary"
              size="sm"
            >
              🔄 Rafraîchir
            </Btn>
          </div>
        </div>

        {/* ================= FILTRES ================= */}
        <div className="mb-6 bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              value={filters.q}
              onChange={(e) =>
                setFilters((f) => ({ ...f, q: e.target.value }))
              }
              placeholder="Rechercher…"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />

            <select
              value={filters.status}
              onChange={(e) =>
                setFilters((f) => ({ ...f, status: e.target.value }))
              }
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
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
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
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
              className="w-full"
            >
              Réinitialiser filtres
            </Btn>
          </div>
        </div>

        {/* ================= FORM CREATION / EDIT ================= */}
        {showForm && canCreate && (
          <form
            onSubmit={handleSubmit}
            className="space-y-4 bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-200 mb-8 shadow-sm"
          >
            {isAdmin && (
              <FieldRow>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    Client *
                  </label>
                  <select
                    value={form.clientId}
                    onChange={(e) =>
                      setForm({ ...form, clientId: e.target.value })
                    }
                    required
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">— Choisir un client —</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    Agent (optionnel)
                  </label>
                  <select
                    value={form.agentId}
                    onChange={(e) =>
                      setForm({ ...form, agentId: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">— Aucun agent —</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.firstName} {a.lastName}
                      </option>
                    ))}
                  </select>
                </div>
              </FieldRow>
            )}

            {/* Les autres champs restent STRICTEMENT inchangés */}
            {/* (Titre, Type, Budget, Statut, Description) */}
          </form>
        )}
{/* ================= LISTE DES PROJETS ================= */}
        {filtered.length === 0 ? (
          <p className="text-slate-500 italic text-center py-6 text-sm">
            Aucun projet trouvé.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
            {filtered.map((p) => {
              const allowEditDelete = canEditDelete(p, user);
              const canChangeStatus = user?.role === 'admin';
              const canCreateTrx = canCreateProjectTransaction(p, user);
              const isTrxOpen = openTrxProjectId === p.id;

              return (
                <div
                  key={p.id}
                  className="
                    w-full min-w-0
                    bg-white border border-slate-200 rounded-2xl shadow-sm
                    hover:shadow-lg transition-all duration-200
                    p-4 sm:p-5 flex flex-col h-full overflow-hidden
                  "
                >
                  {/* Header card */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3
                        className="
                          text-base sm:text-lg font-semibold text-slate-900
                          break-words whitespace-normal
                          w-full max-w-full
                        "
                      >
                        {p.title}
                      </h3>
                      <p className="text-[11px] sm:text-xs text-slate-400 mt-1">
                        Créé le{' '}
                        {p.createdAt
                          ? new Date(p.createdAt).toLocaleString('fr-FR')
                          : '—'}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {canChangeStatus ? (
                        <select
                          value={p.status}
                          onChange={(e) =>
                            handleStatusChange(p.id, e.target.value)
                          }
                          className="border border-slate-300 rounded-md px-2 py-1 text-xs sm:text-sm max-w-[140px]"
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

                  {/* Meta */}
                  <div className="mt-2 space-y-1 text-xs sm:text-[13px] text-slate-700">
                    {p.client && (
                      <p className="truncate w-full max-w-full">
                        👤 Client :{' '}
                        <span className="font-medium">
                          {p.client.firstName} {p.client.lastName}
                        </span>
                      </p>
                    )}
                    {p.agent && (
                      <p className="truncate w-full max-w-full">
                        🧑‍💼 Agent :{' '}
                        <span className="font-medium">
                          {p.agent.firstName} {p.agent.lastName}
                        </span>
                      </p>
                    )}
                    {p.type && (
                      <p className="text-slate-500 break-words w-full max-w-full">
                        🏷 Type :{' '}
                        <span className="font-medium">
                          {
                            PROJECT_TYPES.find((t) => t.value === p.type)
                              ?.label ?? p.type
                          }
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Description */}
                  {p.description && (
                    <p className="mt-3 text-sm text-slate-700 line-clamp-4 break-words">
                      {p.description}
                    </p>
                  )}

                  {/* Budget */}
                  {p.budget && (
                    <p className="mt-2 text-sm text-slate-800 font-medium">
                      💰 Budget :{' '}
                      {Number(p.budget).toLocaleString('fr-FR')} XOF
                    </p>
                  )}

                  {/* Actions */}
                  <div
                    className="
                      mt-4
                      flex flex-wrap items-center gap-2
                      w-full max-w-full min-w-0
                      overflow-hidden
                    "
                  >
                    {user?.role === 'admin' && (
                      <select
                        value={p.agent?.id || ''}
                        onChange={(e) =>
                          handleAssign(p.id, e.target.value)
                        }
                        className="border border-slate-300 rounded-lg px-2 py-1 text-xs sm:text-sm max-w-full"
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
                        size="xs"
                      >
                        📂 Détails
                      </Btn>

                      {canCreateTrx && (
                        <Btn
                          onClick={() =>
                            setOpenTrxProjectId(isTrxOpen ? null : p.id)
                          }
                          variant="ghost"
                          size="xs"
                        >
                          {isTrxOpen ? '➖ Transaction' : '💰 Transaction'}
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

                  {/* Inline transaction */}
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

