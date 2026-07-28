// frontend/src/pages/ProjectsPage.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { me, getLocalUser, getToken as getAuthToken } from '../services/auth';
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  assignAgentToProject,
} from '../services/projects';
import { createTransaction } from '../services/transactions';
import api from '../services/api';
import { applyLabels, CURRENCY_LABELS, getProjectStatusTone } from '../utils/labels';
import { useLocale } from '../i18n/useLocale';
import { useTranslation } from 'react-i18next';

// INFO MASTER-safe helpers (pas de rle "master", seulement admin + scope)
import { normalizeRole, isMasterUser } from '../utils/role';
import { notify } from '../utils/notify';
import { useDeleteConfirm } from '../hooks/useDeleteConfirm';
import LocationAutocompleteInput from '../features/mission-creation/LocationAutocompleteInput';
import { Badge } from '../components/ui';

/* ============================================================
   Module: gestion des projets.
============================================================ */
const CURRENCY_CODES = Object.keys(CURRENCY_LABELS);
const PROJECT_TYPE_VALUES = ['immobilier', 'agricole', 'commerce', 'autre'];
const PROJECT_STATUS_VALUES = [
  'created',
  'in_progress',
  'completed',
  'validated',
  'cancelled',
];

/* ============================================================
   ? Permissions
   Module: gestion des projets.
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
   Module: gestion des projets.
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
    'inline-flex items-center justify-center whitespace-normal break-words rounded-lg font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

  const sizes = {
    md: 'px-4 py-2.5 text-sm',
    sm: 'px-4 py-2 text-sm',
    xs: 'px-3 py-1.5 text-xs',
  }[size];

  const variants = {
    primary: 'app-btn-primary',
    secondary: 'app-btn-neutral',
    ghost: 'app-btn-soft',
    warning: 'app-btn-warning',
    danger: 'app-btn-danger',
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
function StatusBadge({ value, label }) {
  return <Badge tone={getProjectStatusTone(value)}>{label || value}</Badge>;
}

/* ============================================================
   Contexte: gestion des projets.
============================================================ */
function FieldRow({ children }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

/* ============================================================
   Inline Transaction Form (Premium B)
============================================================ */
function TransactionInlineForm({ project, currentUser, onClose, onSuccess }) {
  const { t } = useTranslation();
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

  // INFO MASTER-safe: master logique = admin => normalizeRole couvre tout
  const canSeeOrder =
    normalizeRole(currentUser?.role) === 'admin' ||
    normalizeRole(currentUser?.role) === 'agent';

  const currencyOptions = useMemo(
    () =>
      CURRENCY_CODES.map((code) => ({
        value: code,
        label: t(`currency.${code}`, { defaultValue: code }),
      })),
    [t]
  );

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

      notify(t('projects.transaction.alerts.createSuccess'));
      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error('ProjectsPage create transaction error:', err);
      notify(t('projects.transaction.alerts.createError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="mt-4 w-full min-w-0 max-w-full rounded-2xl border border-border/70 bg-surface-main/55 p-4 shadow-sm"
    >
      <h4 className="mb-3 text-sm font-semibold text-text-primary">
        {t('projects.transaction.title')}
      </h4>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            {t('projects.transaction.typeLabel')}
          </label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="min-w-0 w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
          >
            <option value="expense">{t('transactions.type.expense')}</option>
            <option value="revenue">{t('transactions.type.revenue')}</option>
            <option value="commission">
              {t('transactions.type.commission')}
            </option>
            <option value="adjustment">
              {t('transactions.type.adjustment')}
            </option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            {t('projects.transaction.amountLabel')}
          </label>
          <input
            type="number"
            step="0.01"
            placeholder={t('projects.transaction.amountPlaceholder')}
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="min-w-0 w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            {t('projects.transaction.currencyLabel')}
          </label>
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className="min-w-0 w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
          >
            {currencyOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            {t('projects.transaction.paymentMethodLabel')}
          </label>
          <input
            value={form.paymentMethod}
            onChange={(e) =>
              setForm({ ...form, paymentMethod: e.target.value })
            }
            className="min-w-0 w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
            placeholder={t('projects.transaction.paymentMethodPlaceholder')}
          />
        </div>

        {canSeeOrder && (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              {t('projects.transaction.orderIdLabel')}
            </label>
            <input
              type="number"
              value={form.orderId}
              onChange={(e) =>
                setForm({ ...form, orderId: e.target.value })
              }
              className="min-w-0 w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
            />
          </div>
        )}

        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            {t('projects.transaction.descriptionLabel')}
          </label>
          <textarea
            rows={3}
            placeholder={t('projects.transaction.descriptionPlaceholder')}
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            className="min-w-0 w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            {t('projects.transaction.proofLabel')}
          </label>
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx"
            onChange={(e) =>
              setForm({ ...form, proofFile: e.target.files?.[0] || null })
            }
            className="min-w-0 w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
          />
        </div>

        <div className="sm:col-span-2 flex justify-end gap-2">
          <Btn variant="secondary" size="sm" onClick={onClose}>
            {t('projects.transaction.cancel')}
          </Btn>
          <Btn variant="primary" size="sm" type="submit" disabled={saving}>
            {saving
              ? t('projects.transaction.saving')
              : t('projects.transaction.save')}
          </Btn>
        </div>
      </form>
    </div>
  );
}

/* ============================================================
   Sous-composant formulaire.
============================================================ */
export default function ProjectsPage() {
  const { formatDateTime, formatNumber } = useLocale();
  const { t } = useTranslation();
  const { confirmDelete } = useDeleteConfirm();
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
    address: '',
    city: '',
    latitude: null,
    longitude: null,
  });

  const [filters, setFilters] = useState({
    q: '',
    status: '',
    sort: '-createdAt',
  });

  const [openTrxProjectId, setOpenTrxProjectId] = useState(null);

  const navigate = useNavigate();
  const isMounted = useRef(true);
  const initStartedRef = useRef(false);

  // INFO MASTER-safe flags (UX only pas de filtre frontend)
  const isAdmin = useMemo(() => normalizeRole(user?.role) === 'admin', [user]);
  const isMaster = useMemo(() => isMasterUser(user), [user]);
  const projectTypeOptions = useMemo(
    () =>
      PROJECT_TYPE_VALUES.map((value) => ({
        value,
        label: t(`projects.type.${value}`, { defaultValue: value }),
      })),
    [t]
  );
  const projectStatusOptions = useMemo(
    () =>
      PROJECT_STATUS_VALUES.map((value) => ({
        value,
        label: t(`projects.status.${value}`, { defaultValue: value }),
      })),
    [t]
  );
  const getProjectTypeLabel = useCallback(
    (value) => {
      if (!value) return t('common.dash');
      return t(`projects.type.${value}`, { defaultValue: value });
    },
    [t]
  );
  const getProjectStatusLabel = useCallback(
    (value) => {
      if (!value) return t('common.dash');
      return t(`projects.status.${value}`, { defaultValue: value });
    },
    [t]
  );

  /* ============================================================
     Contexte: gestion des projets.
  ============================================================= */
  const loadClients = useCallback(async () => {
    try {
      const { data } = await api.get('/users?role=client');
      setClients(Array.isArray(data.users) ? data.users : []);
    } catch (e) {
      console.error('ProjectsPage load clients error:', e);
      setClients([]);
    }
  }, []);

  const loadAgents = useCallback(async () => {
    try {
      const { data } = await api.get('/users?role=agent');
      setAgents(Array.isArray(data.users) ? data.users : []);
    } catch (e) {
      console.error('ProjectsPage load agents error:', e);
      setAgents([]);
    }
  }, []);

  const loadForUser = useCallback(async (u) => {
    if (!u) return;
    setLoading(true);
    setErrorMsg('');

    try {
      // INFO IMPORTANT: aucun filtre geo ct frontend
      const list = await getProjects({});
      const normalized = Array.isArray(list) ? list.map(applyLabels) : [];
      if (isMounted.current) setProjects(normalized);
    } catch (e) {
      console.error('ProjectsPage load projects error:', e);
      setErrorMsg(
        e?.response?.data?.error ||
          e?.message ||
          t('projects.alerts.loadError')
      );
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [t]);
  /* ============================================================
     ?? Initialisation
     Initialisation au montage.
  ============================================================= */
  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;
    isMounted.current = true;

    const init = async () => {
      const hasSession = Boolean(getAuthToken() || getLocalUser());
      if (!hasSession) {
        setLoading(false);
        navigate('/login');
        return;
      }

      try {
        const { user: u } = await me();
        if (!isMounted.current) return;

        if (!u) {
          navigate('/login');
          return;
        }
        setUser(u);
        await loadForUser(u);

        // ADMIN GLOBAL ou MASTER (admin + scope)
        if (normalizeRole(u?.role) === 'admin') {
          await Promise.all([loadClients(), loadAgents()]);
        }
      } catch (err) {
        console.error('ProjectsPage load user error:', err);
        setUser(null);
        setErrorMsg(t('projects.alerts.userLoadError'));
      } finally {
        if (isMounted.current) setLoading(false);
      }
    };

    init();

    return () => {
      isMounted.current = false;
      initStartedRef.current = false;
    };
  }, [loadForUser, loadClients, loadAgents, navigate, t]);

  /* ============================================================
     ?? Handlers CRUD
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
        notify(t('projects.alerts.updateSuccess'));
      } else {
        await createProject(payload);
        notify(t('projects.alerts.createSuccess'));
      }

      resetForm();
      await loadForUser(user);
    } catch (err) {
      console.error('ProjectsPage save project error:', err);
      const fallback = editId
        ? t('projects.alerts.updateError')
        : t('projects.alerts.createError');
      notify(err?.response?.data?.error || err?.message || fallback);
    }
  }

  async function handleDelete(id) {
    const ok = await confirmDelete("project");
    if (!ok) return;
    try {
      await deleteProject(id);
      notify(t('projects.alerts.deleteSuccess'));
      await loadForUser(user);
    } catch (err) {
      console.error('ProjectsPage delete project error:', err);
      notify(
        err?.response?.data?.error || t('projects.alerts.deleteError')
      );
    }
  }

  async function handleAssign(projectId, agentId) {
    try {
      await assignAgentToProject(
        projectId,
        agentId ? Number(agentId) : null
      );
      notify(t('projects.alerts.assignSuccess'));
      await loadForUser(user);
    } catch (err) {
      console.error('ProjectsPage assign agent error:', err);
      notify(t('projects.alerts.assignError'));
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
      notify(t('projects.alerts.statusUpdateSuccess'));
    } catch (err) {
      console.error('ProjectsPage update status error:', err);
      notify(t('projects.alerts.statusUpdateError'));
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
        address: p.address || '',
        city: p.city || '',
        latitude: p.latitude ?? null,
        longitude: p.longitude ?? null,
      });
      setShowForm(true);
    } else {
      notify(t('projects.alerts.editWindowExpired'));
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
      address: '',
      city: '',
      latitude: null,
      longitude: null,
    });
    setEditId(null);
    setShowForm(false);
  }

  /* ============================================================
     ?? Filtres & Tri (100% locaux, aucun filtre geo)
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
     ?? Rendu
  ============================================================= */
  if (loading) {
    return (
      <div className="app-page-wrap flex min-h-screen items-center justify-center">
        <p className="px-4 text-center text-base text-text-secondary animate-pulse sm:text-lg">
          {t('projects.loading')}
        </p>
      </div>
    );
  }

  const role = normalizeRole(user?.role);
  const canCreate = Boolean(user?.role && role !== 'agent');

  return (
    <div className="app-page-wrap overflow-x-hidden">
      <div className="app-page-shell mx-auto w-full max-w-6xl border border-border/70 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">

        {/* ================= HEADER ================= */}
        <div className="w-full flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="space-y-1 min-w-0">
            <h1 className="app-page-headline flex items-center gap-2">
              {t('projects.title')}
            </h1>
            <p className="text-xs sm:text-sm text-text-secondary">
              {isAdmin
                ? t('projects.subtitle.admin')
                : role === 'agent'
                ? t('projects.subtitle.agent')
                : t('projects.subtitle.client')}
            </p>

            {/* UX info MASTER (non bloquant, informatif) */}
            {isMaster && (
              <p className="mt-1 text-[11px] text-text-muted">
                {t('projects.masterInfo')}
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
                {showForm
                  ? t('projects.buttons.hideForm')
                  : t('projects.buttons.newProject')}
              </Btn>
            )}
            <Btn
              onClick={() => loadForUser(user)}
              disabled={!user}
              variant="primary"
              size="sm"
            >
              {t('common.refresh')}
            </Btn>
          </div>
        </div>

        {/* ================= FILTRES ================= */}
        <div className="mb-6 rounded-2xl border border-border/70 bg-surface-main/55 p-3 shadow-sm sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              value={filters.q}
              onChange={(e) =>
                setFilters((f) => ({ ...f, q: e.target.value }))
              }
              placeholder={t('projects.filters.searchPlaceholder')}
              className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
            />

            <select
              value={filters.status}
              onChange={(e) =>
                setFilters((f) => ({ ...f, status: e.target.value }))
              }
              className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
            >
              <option value="">{t('projects.filters.statusAll')}</option>
              {projectStatusOptions.map((s) => (
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
              className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
            >
              <option value="-createdAt">
                {t('projects.filters.sortNewest')}
              </option>
              <option value="createdAt">{t('projects.filters.sortOldest')}</option>
              <option value="-updatedAt">
                {t('projects.filters.sortUpdatedNewest')}
              </option>
              <option value="updatedAt">
                {t('projects.filters.sortUpdatedOldest')}
              </option>
              <option value="title">{t('projects.filters.sortTitleAsc')}</option>
              <option value="-title">
                {t('projects.filters.sortTitleDesc')}
              </option>
            </select>

            <Btn
              onClick={() =>
                setFilters({ q: '', status: '', sort: '-createdAt' })
              }
              variant="secondary"
              size="sm"
              className="w-full"
            >
              {t('projects.filters.reset')}
            </Btn>
          </div>
        </div>

        {/* ================= FORM CREATION / EDIT ================= */}
        {showForm && canCreate && (
          <form
            onSubmit={handleSubmit}
            className="mb-8 space-y-4 rounded-2xl border border-border/70 bg-surface-main/55 p-4 shadow-sm sm:p-6"
          >
            {isAdmin && (
              <FieldRow>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    {t('projects.form.clientLabel')} *
                  </label>
                  <select
                    value={form.clientId}
                    onChange={(e) =>
                      setForm({ ...form, clientId: e.target.value })
                    }
                    required
                    className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
                  >
                    <option value="">
                      {t('projects.form.clientPlaceholder')}
                    </option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    {t('projects.form.agentLabel')}
                  </label>
                  <select
                    value={form.agentId}
                    onChange={(e) =>
                      setForm({ ...form, agentId: e.target.value })
                    }
                    className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
                  >
                    <option value="">
                      {t('projects.form.agentPlaceholder')}
                    </option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.firstName} {a.lastName}
                      </option>
                    ))}
                  </select>
                </div>
              </FieldRow>
            )}

            <FieldRow>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  {t('projects.form.titleLabel')} *
                </label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
                  placeholder={t('projects.form.titlePlaceholder')}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  {t('projects.form.typeLabel')}
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
                >
                  {projectTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </FieldRow>

            <FieldRow>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  {t('projects.form.budgetLabel')}
                </label>
                <input
                  type="number"
                  value={form.budget}
                  onChange={(e) => setForm({ ...form, budget: e.target.value })}
                  className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  {t('projects.form.statusLabel')}
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  disabled={!isAdmin}
                  className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary disabled:bg-surface-main/80"
                >
                  {projectStatusOptions.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </FieldRow>

            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                {t('projects.form.addressLabel')}
              </label>
              <LocationAutocompleteInput
                className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
                placeholder={t('projects.form.addressPlaceholder')}
                value={form.address}
                onChange={(value) =>
                  setForm({ ...form, address: value, latitude: null, longitude: null })
                }
                onPlaceSelected={({ address, latitude, longitude }) =>
                  setForm({ ...form, address, latitude, longitude })
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                {t('projects.form.descriptionLabel')}
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={4}
                className="w-full resize-y rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
                placeholder={t('projects.form.descriptionPlaceholder')}
              />
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              <Btn variant="secondary" size="sm" type="button" onClick={resetForm}>
                {t('projects.form.cancel')}
              </Btn>
              <Btn variant="primary" size="sm" type="submit">
                {editId
                  ? t('projects.form.update')
                  : t('projects.form.create')}
              </Btn>
            </div>
          </form>
        )}
{/* ================= LISTE DES PROJETS ================= */}
        {filtered.length === 0 ? (
          <p className="rounded-2xl border border-border/70 bg-surface-card/70 py-6 text-center text-sm italic text-text-secondary">
            {t('projects.list.empty')}
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
                    bg-surface-card border border-border/70 rounded-2xl shadow-sm
                    hover:shadow-lg transition-all duration-200
                    p-4 sm:p-5 flex flex-col h-full overflow-hidden
                  "
                >
                  {/* Header card */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3
                        className="
                          text-base sm:text-lg font-semibold text-text-primary
                          break-words whitespace-normal
                          w-full max-w-full
                        "
                      >
                        {p.title}
                      </h3>
                      <p className="mt-1 text-[11px] sm:text-xs text-text-muted">
                        {t('projects.card.createdAt')}{' '}
                        {p.createdAt
                          ? formatDateTime(p.createdAt)
                          : t('common.dash')}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {canChangeStatus ? (
                        <select
                          value={p.status}
                          onChange={(e) =>
                            handleStatusChange(p.id, e.target.value)
                          }
                          className="app-input-compact max-w-[148px]"
                        >
                          {projectStatusOptions.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <StatusBadge
                          value={p.status}
                          label={getProjectStatusLabel(p.status)}
                        />
                      )}
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="mt-2 space-y-1 text-xs text-text-secondary sm:text-[13px]">
                    {p.client && (
                      <p className="truncate w-full max-w-full">
                        {t('projects.card.client')}{' '}
                        <span className="font-medium">
                          {p.client.firstName} {p.client.lastName}
                        </span>
                      </p>
                    )}
                    {p.agent && (
                      <p className="truncate w-full max-w-full">
                        {t('projects.card.agent')}{' '}
                        <span className="font-medium">
                          {p.agent.firstName} {p.agent.lastName}
                        </span>
                      </p>
                    )}
                    {p.type && (
                      <p className="w-full max-w-full break-words text-text-muted">
                        {t('projects.card.type')}{' '}
                        <span className="font-medium">
                          {getProjectTypeLabel(p.type)}
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Description */}
                  {p.description && (
                    <p className="mt-3 line-clamp-4 break-words text-sm text-text-secondary">
                      {p.description}
                    </p>
                  )}

                  {/* Budget */}
                  {p.budget && (
                    <p className="mt-2 text-sm font-medium text-text-primary">
                      {t('projects.card.budget')}{' '}
                      {formatNumber(p.budget)}{' '}
                      {t('projects.card.currency', { defaultValue: 'XOF' })}
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
                        className="app-input-compact max-w-full"
                      >
                        <option value="">
                          {t('projects.actions.assignAgentPlaceholder')}
                        </option>
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
                        {t('projects.actions.details')}
                      </Btn>

                      {canCreateTrx && (
                        <Btn
                          onClick={() =>
                            setOpenTrxProjectId(isTrxOpen ? null : p.id)
                          }
                          variant="ghost"
                          size="xs"
                        >
                          {isTrxOpen
                            ? t('projects.actions.closeTransaction')
                            : t('projects.actions.openTransaction')}
                        </Btn>
                      )}

                      {(user?.role === 'admin' || allowEditDelete) && (
                        <>
                          <Btn
                            onClick={() => handleEditClick(p)}
                            variant="warning"
                            size="xs"
                          >
                            {t('projects.actions.edit')}
                          </Btn>
                          <Btn
                            onClick={() => handleDelete(p.id)}
                            variant="danger"
                            size="xs"
                          >
                            {t('projects.actions.delete')}
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
