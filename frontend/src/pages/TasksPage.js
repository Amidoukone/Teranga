// ============================================================================
// Contexte: gestion des taches.
// Contexte: gestion des taches.
// ============================================================================

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { me, getAuthHeader } from '../services/auth';
import { getMyServices } from '../services/services';
import {
  TASK_TYPES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  CURRENCY_LABELS,
  getServiceTypeLabel,
  getTaskStatusTone,
  applyLabels,
} from '../utils/labels';
import { normalizeRole, isMasterUser } from '../utils/role';
import { useTranslation } from 'react-i18next';
import { Badge } from '../components/ui';
import { getFeedbackIcon } from '../utils/feedback';

const DEFAULT_FILTERS = {
  q: '',
  type: '',
  status: '',
  priority: '',
  service: '',
  agent: '',
};
const TASK_CURRENCY_CODES = Object.keys(CURRENCY_LABELS);

// ============================================================================
// Contexte: gestion des taches.
// ============================================================================
export default function TasksPage() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [services, setServices] = useState([]);
  const [agents, setAgents] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  const [showForm, setShowForm] = useState(() => {
    const saved = localStorage.getItem('teranga_tasks_showForm');
    return saved === null ? true : saved === '1';
  });

  const navigate = useNavigate();

  // ========================================================================
 // Contexte: gestion des taches.
  // =========================================================================
  const role = normalizeRole(user?.role);
  const isAdmin = role === 'admin';
  const isMaster = isMasterUser(user); // UX uniquement
  const isAdminLike = isAdmin; // MASTER traite comme admin cote UI.
  const canCreateTask = role === 'client' || isAdminLike;

  // ========================================================================
  // Formulaire
  // =========================================================================
  const [form, setForm] = useState({
    serviceId: '',
    title: '',
    type: 'other',
    description: '',
    priority: 'normal',
    dueDate: '',
    estimatedCost: '',
    currency: 'XOF',
    assignedTo: '',
  });

  // ========================================================================
  // Filtres
  // =========================================================================
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const resetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
  }, []);

  const hasActiveFilters = useMemo(() => {
    return (
      Boolean(filters.q?.trim()) ||
      Boolean(filters.type) ||
      Boolean(filters.status) ||
      Boolean(filters.priority) ||
      Boolean(filters.service) ||
      Boolean(filters.agent)
    );
  }, [filters]);

  // ========================================================================
  // Auth header
  // =========================================================================
  const authHeader = useMemo(() => {
    return getAuthHeader();
  }, []);

  // ========================================================================
 // Contexte: gestion des taches.
  // =========================================================================
  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/tasks', {
        headers: authHeader,
      });

      const enriched = (data.tasks || []).map((t) => applyLabels(t, 'task'));

      setTasks(enriched);
    } catch (err) {
      console.error('TasksPage load tasks error:', err);
      setNotice({
        type: 'error',
        message: t('tasksPage.alerts.loadError'),
      });
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [authHeader, t]);

  // ========================================================================
  // Initialisation
  // =========================================================================
  useEffect(() => {
    async function init() {
      try {
        const { user: u } = await me();
        if (!u) {
          window.location.href = '/login';
          return;
        }
        setUser(u);

        // CLIENT
        if (u.role === 'client') {
          const servs = await getMyServices();
          const enrichedServices = (servs || []).map((s) =>
            applyLabels(s, 'service')
          );
          setServices(enrichedServices);
        }

        // ADMIN / MASTER
        else if (u.role === 'admin') {
          try {
            const [{ data: allServices }, { data: agentsRes }] =
              await Promise.all([
                api.get('/services', { headers: authHeader }),
                api.get('/users', {
                  params: { role: 'agent' },
                  headers: authHeader,
                }),
              ]);

            const enrichedServices = (allServices?.services || []).map((s) =>
              applyLabels(s, 'service')
            );

            setServices(enrichedServices);
            setAgents(agentsRes?.users || []);
          } catch (err) {
            console.error('TasksPage load services and agents error:', err);
          }
        }

        await loadTasks();
      } catch (err) {
        if (err?.response?.status === 401) {
          localStorage.removeItem('teranga_token');
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
      }
    }

    init();
  }, [loadTasks, authHeader]);

  useEffect(() => {
    localStorage.setItem('teranga_tasks_showForm', showForm ? '1' : '0');
  }, [showForm]);

    // ========================================================================
 // Contexte: gestion des taches.
  // =========================================================================
  async function createTask(e) {
    e.preventDefault();

    try {
      setNotice(null);
      const payload = {
        serviceId: form.serviceId ? parseInt(form.serviceId, 10) : null,
        title: form.title.trim(),
        type: form.type,
        description: form.description?.trim() || null,
        priority: form.priority,
        dueDate: form.dueDate ? new Date(form.dueDate) : null,
        estimatedCost:
          form.estimatedCost === '' ? null : parseFloat(form.estimatedCost),
        currency: String(form.currency || 'XOF').toUpperCase(),
        assignedTo: form.assignedTo ? parseInt(form.assignedTo, 10) : null,
      };

      await api.post('/tasks', payload, { headers: authHeader });

      setNotice({
        type: 'success',
        message: t('tasksPage.alerts.createSuccess'),
      });

      setForm({
        serviceId: '',
        title: '',
        type: 'other',
        description: '',
        priority: 'normal',
        dueDate: '',
        estimatedCost: '',
        currency: 'XOF',
        assignedTo: '',
      });

      await loadTasks();
    } catch (err) {
      console.error('TasksPage create task error:', err);
      setNotice({
        type: 'error',
        message:
          err?.response?.data?.error || t('tasksPage.alerts.createError'),
      });
    }
  }

  // ========================================================================
  // Changements de statut
  // =========================================================================
  async function updateStatus(id, status) {
    try {
      setNotice(null);
      await api.put(`/tasks/${id}/status`, { status }, { headers: authHeader });
      await loadTasks();
    } catch (err) {
      console.error('TasksPage update status error:', err);
      setNotice({
        type: 'error',
        message:
          err?.response?.data?.error ||
          t('tasksPage.alerts.updateStatusError'),
      });
    }
  }

  // ========================================================================
  // Assignation agent (ADMIN + MASTER)
  // =========================================================================
  async function updateAssignment(taskId, agentId) {
    if (!agentId) return;
    try {
      setNotice(null);
      await api.put(
        `/tasks/${taskId}/assign`,
        { agentId },
        { headers: authHeader }
      );
      setNotice({
        type: 'success',
        message: t('tasksPage.alerts.assignSuccess'),
      });
      await loadTasks();
    } catch (err) {
      console.error('TasksPage assign task error:', err);
      setNotice({
        type: 'error',
        message: err?.response?.data?.error || t('tasksPage.alerts.assignError'),
      });
    }
  }

  // ========================================================================
  // Affichage nom utilisateur
  // =========================================================================
  function displayUser(u) {
    if (!u) return t('common.dash');
    return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
  }

  // ========================================================================
  // Filtrage local
  // =========================================================================
  useEffect(() => {
    let arr = [...tasks];

    const q = filters.q.trim().toLowerCase();
    if (q) {
      arr = arr.filter((t) =>
        [
          t.title,
          t.description,
          t.typeLabel,
          t.priorityLabel,
          t.statusLabel,
          t.service?.title,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }

    if (filters.type) arr = arr.filter((t) => t.type === filters.type);
    if (filters.status) arr = arr.filter((t) => t.status === filters.status);
    if (filters.priority)
      arr = arr.filter((t) => t.priority === filters.priority);

    if (filters.service)
      arr = arr.filter((t) => t.service?.id === parseInt(filters.service, 10));

    if (filters.agent)
      arr = arr.filter((t) => t.assignee?.id === parseInt(filters.agent, 10));

    setFiltered(arr);
  }, [filters, tasks]);

  // ========================================================================
  // UI
  // =========================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-3 py-8 sm:px-4 sm:py-10">
      <div className="max-w-6xl mx-auto bg-surface-card/95 shadow-2xl rounded-3xl p-4 sm:p-8 border border-border/70">
        {/* HEADER */}
        <Header
          showForm={showForm}
          setShowForm={setShowForm}
          loadTasks={loadTasks}
          loading={loading}
          total={filtered.length}
          isMaster={isMaster}
        />

        {notice && (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3 text-xs sm:text-sm flex gap-2 items-start ${
              notice.type === 'error'
                ? 'app-alert app-alert-error'
                : 'app-alert app-alert-success'
            }`}
          >
            <span className="mt-[1px]">
              {getFeedbackIcon(notice.type)}
            </span>
            <p className="break-words">{notice.message}</p>
          </div>
        )}

        {/* FILTRES */}
        <TaskFilters
          filters={filters}
          setFilters={setFilters}
          services={services}
          agents={agents}
          user={user}
          filteredCount={filtered.length}
          isAdminLike={isAdminLike}
          onReset={resetFilters}
        />

        {/* FORMULAIRE */}
        {showForm && (role === 'client' || isAdminLike) && (
          <TaskForm
            form={form}
            setForm={setForm}
            services={services}
            agents={agents}
            user={user}
            createTask={createTask}
            isAdminLike={isAdminLike}
          />
        )}

        {/* LISTE */}
        {filtered.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center text-center">
            <div className="app-icon-badge-info">
              <span className="text-xl">i</span>
            </div>
            <p className="text-sm font-semibold text-text-primary mb-1">
              {hasActiveFilters
                ? t('tasksPage.emptyFilteredTitle')
                : t('tasksPage.emptyTitle')}
            </p>
            <p className="text-xs text-text-muted max-w-sm">
              {hasActiveFilters
                ? t('tasksPage.emptyFilteredSubtitle')
                : t('tasksPage.emptySubtitle')}
            </p>
            <div className="mt-4 flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg shadow-sm bg-surface-main/80 hover:bg-surface-main"
                >
                  {t('tasksPage.filters.reset')}
                </button>
              )}
              {canCreateTask && !showForm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="app-btn-primary px-4 py-2 text-xs sm:text-sm"
                >
                  {t('tasksPage.buttons.newTask')}
                </button>
              )}
            </div>
          </div>
        ) : (
          <TaskList
            tasks={filtered}
            user={user}
            role={role}
            isAdminLike={isAdminLike}
            updateStatus={updateStatus}
            updateAssignment={updateAssignment}
            navigate={navigate}
            displayUser={displayUser}
            agents={agents}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Contexte: gestion des taches.
// ============================================================================

function Header({ showForm, setShowForm, loadTasks, loading, total, isMaster }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-7 pb-4 border-b border-border/70">
      <div className="max-w-full break-words">
        <p className="page-kicker">
          {t('tasksPage.kicker')}
        </p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary">
          {t('tasksPage.title')}
        </h1>
        <p className="text-sm sm:text-base text-text-secondary mt-1">
          {t('tasksPage.subtitle')}
        </p>

        <div className="mt-2 flex flex-wrap gap-2 items-center">
          <p className="inline-flex items-center gap-2 text-xs sm:text-sm text-text-muted bg-surface-main px-3 py-1.5 rounded-full border border-border">
            <span className="app-status-dot-success" />
            {t('tasksPage.count', { count: total })}
          </p>

          {isMaster && (
            <p className="app-badge app-badge-warning gap-2 px-3 py-1.5 text-xs sm:text-sm">
              {t('roles.master')}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold rounded-lg shadow-sm app-btn-neutral transition"
        >
          {showForm
            ? t('tasksPage.buttons.hideForm')
            : t('tasksPage.buttons.newTask')}
        </button>

        <button
          onClick={loadTasks}
          disabled={loading}
          className="app-btn-primary w-full sm:w-auto px-4 py-2.5 text-sm"
        >
          {loading
            ? t('tasksPage.buttons.refreshLoading')
            : t('tasksPage.buttons.refresh')}
        </button>
      </div>
    </div>
  );
}

function TaskFilters({
  filters,
  setFilters,
  services,
  agents,
  user,
  filteredCount,
  isAdminLike,
  onReset,
}) {
  const { t } = useTranslation();
  return (
    <div className="mb-8 bg-surface-main border border-border rounded-2xl p-4 sm:p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Recherche */}
        <input
          placeholder={t('tasksPage.filters.searchPlaceholder')}
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          className="
            border border-border rounded-lg px-3 py-2.5 text-sm sm:text-base bg-surface-card text-text-primary
            focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            col-span-1 sm:col-span-2 lg:col-span-3 break-words
          "
        />

        {/* Type */}
        <select
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          className="border border-border rounded-lg px-3 py-2 text-sm sm:text-base bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t('tasksPage.filters.typeAll')}</option>
          {Object.entries(TASK_TYPES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        {/* Statut */}
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="border border-border rounded-lg px-3 py-2 text-sm sm:text-base bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t('tasksPage.filters.statusAll')}</option>
          {Object.entries(TASK_STATUSES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

 {/* Contexte: gestion des taches. */}
        <select
          value={filters.priority}
          onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
          className="border border-border rounded-lg px-3 py-2 text-sm sm:text-base bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t('tasksPage.filters.priorityAll')}</option>
          {Object.entries(TASK_PRIORITIES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        {/* Service */}
        <select
          value={filters.service}
          onChange={(e) => setFilters({ ...filters, service: e.target.value })}
          className="border border-border rounded-lg px-3 py-2 text-sm sm:text-base bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t('tasksPage.filters.serviceAll')}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} - {getServiceTypeLabel(s.type, t('common.dash'))}
              </option>
            ))}
        </select>

        {/* Agent (admin/master uniquement) */}
        {isAdminLike && (
          <select
            value={filters.agent}
            onChange={(e) => setFilters({ ...filters, agent: e.target.value })}
            className="border border-border rounded-lg px-3 py-2 text-sm sm:text-base bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{t('tasksPage.filters.agentAll')}</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.firstName} {a.lastName}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="text-xs sm:text-sm text-text-muted">
          {t('tasksPage.filters.foundCount', { count: filteredCount })}
        </div>
        <button
          onClick={onReset}
          className="
            text-xs sm:text-sm px-3 py-1.5 bg-surface-main/80 text-text-secondary rounded-md border border-border/70
            hover:bg-surface-main w-full sm:w-auto text-center
          "
        >
          {t('tasksPage.filters.reset')}
        </button>
      </div>
    </div>
  );
}

function TaskForm({ form, setForm, services, agents, user, createTask, isAdminLike }) {
  const { t } = useTranslation();
  return (
    <div className="mb-10">
      <h2 className="text-lg sm:text-xl font-semibold text-text-primary mb-3">
        {t('tasksPage.form.title')}
      </h2>
      <p className="text-xs sm:text-sm text-text-muted mb-4">
        {t('tasksPage.form.subtitle')}
      </p>

      <form
        onSubmit={createTask}
        className="
          grid grid-cols-1 sm:grid-cols-2 gap-4
          bg-surface-main p-4 sm:p-5 rounded-2xl border border-border
        "
      >
 {/* Contexte: gestion des taches. */}
        <div className="w-full">
          <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
            {t('tasksPage.form.serviceLabel')} <span className="app-required">*</span>
          </label>
          <select
            value={form.serviceId}
            onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
            required
            className="
              w-full border border-border rounded-lg px-3 py-2 bg-surface-card text-text-primary
              text-sm sm:text-base focus:ring-2 focus:ring-blue-500
            "
          >
            <option value="">{t('tasksPage.form.servicePlaceholder')}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({getServiceTypeLabel(s.type, t('common.dash'))})
              </option>
            ))}
          </select>
        </div>

 {/* Contexte: gestion des taches. */}
        <div className="w-full">
          <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
            {t('tasksPage.form.typeLabel')}
          </label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            required
            className="
              w-full border border-border rounded-lg px-3 py-2 bg-surface-card text-text-primary
              text-sm sm:text-base focus:ring-2 focus:ring-blue-500
            "
          >
            {Object.entries(TASK_TYPES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Titre */}
        <div className="w-full col-span-1 sm:col-span-2">
          <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
            {t('tasksPage.form.titleLabel')} <span className="app-required">*</span>
          </label>
          <input
            placeholder={t('tasksPage.form.titlePlaceholder')}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            className="
              w-full border border-border rounded-lg px-3 py-2 bg-surface-card text-text-primary
              text-sm sm:text-base focus:ring-2 focus:ring-blue-500 break-words
            "
          />
        </div>

        {/* Description */}
        <div className="w-full col-span-1 sm:col-span-2">
          <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
            {t('tasksPage.form.descriptionLabel')}
          </label>
          <textarea
            placeholder={t('tasksPage.form.descriptionPlaceholder')}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="
              w-full border border-border rounded-lg px-3 py-2 bg-surface-card text-text-primary
              text-sm sm:text-base focus:ring-2 focus:ring-blue-500 break-words
            "
          />
        </div>

 {/* Contexte: gestion des taches. */}
        <div className="w-full">
          <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
            {t('tasksPage.form.priorityLabel')}
          </label>
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
            className="
              w-full border border-border rounded-lg px-3 py-2 bg-surface-card text-text-primary
              text-sm sm:text-base focus:ring-2 focus:ring-blue-500
            "
          >
            {Object.entries(TASK_PRIORITIES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

 {/* Contexte: gestion des taches. */}
        <div className="w-full">
          <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
            {t('tasksPage.form.dueDateLabel')}
          </label>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            className="
              w-full border border-border rounded-lg px-3 py-2 bg-surface-card text-text-primary
              text-sm sm:text-base focus:ring-2 focus:ring-blue-500
            "
          />
        </div>

 {/* Contexte: gestion des taches. */}
        <div className="w-full">
          <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
            {t('tasksPage.form.estimatedCostLabel')}
          </label>
          <input
            type="number"
            step="0.01"
            placeholder={t('tasksPage.form.estimatedCostPlaceholder')}
            value={form.estimatedCost}
            onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })}
            className="
              w-full border border-border rounded-lg px-3 py-2
              text-sm sm:text-base focus:ring-2 focus:ring-blue-500
            "
          />
        </div>

        <div className="w-full">
          <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
            {t('tasksPage.form.currencyLabel')}
          </label>
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className="
              w-full border border-border rounded-lg px-3 py-2 bg-surface-card text-text-primary
              text-sm sm:text-base focus:ring-2 focus:ring-blue-500
            "
          >
            {TASK_CURRENCY_CODES.map((code) => (
              <option key={code} value={code}>
                {t(`currency.${code}`, { defaultValue: code })}
              </option>
            ))}
          </select>
        </div>

        {/* Assignation (admin/master uniquement) */}
        {isAdminLike && (
          <div className="w-full">
            <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
              {t('tasksPage.form.assignedLabel')}
            </label>
            <select
              value={form.assignedTo}
              onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
              className="
                w-full border border-border rounded-lg px-3 py-2 bg-surface-card text-text-primary
                text-sm sm:text-base focus:ring-2 focus:ring-blue-500
              "
            >
              <option value="">{t('tasksPage.form.assignedPlaceholder')}</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.firstName || a.lastName
                    ? `${a.firstName || ''} ${a.lastName || ''}`.trim()
                    : a.email}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Bouton de soumission */}
        <div className="col-span-1 sm:col-span-2 flex justify-end">
          <button
            type="submit"
            className="
              app-btn-primary w-full sm:w-auto px-5 py-2.5
              text-sm sm:text-base
            "
          >
            {t('tasksPage.form.submit')}
          </button>
        </div>
      </form>
    </div>
  );
}

function TaskList({
  tasks,
  user,
  role,
  isAdminLike,
  updateStatus,
  updateAssignment,
  navigate,
  displayUser,
  agents,
}) {
  const { t } = useTranslation();
  if (!tasks || tasks.length === 0) {
    return (
      <p className="text-text-muted italic text-center py-8">
        {t('tasksPage.list.empty')}
      </p>
    );
  }

  return (
    <div className="grid gap-5">
      {tasks.map((task) => {
        const linkedServiceId = task.service?.id || task.serviceId;
        return (
        <div
          key={task.id}
          className="
            bg-surface-card border border-border rounded-2xl shadow-sm
            p-4 sm:p-5 hover:shadow-md transition
          "
        >
 {/* Contexte: gestion des taches. */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
            <div className="min-w-0 break-words">
              <h3 className="text-lg sm:text-xl font-semibold text-text-primary break-words">
                {task.title}
              </h3>
              <p className="text-sm sm:text-base text-text-secondary mt-1 break-words">
                {task.description || t('tasksPage.list.noDescription')}
              </p>
            </div>

            <Badge
              tone={getTaskStatusTone(task.status)}
              className="mt-1 self-start whitespace-nowrap text-xs sm:mt-0 sm:text-sm"
            >
              {TASK_STATUSES[task.status] || task.status || t('common.dash')}
            </Badge>
          </div>

          {/* Meta infos */}
          <div className="mt-4 text-sm sm:text-base text-text-secondary grid grid-cols-1 sm:grid-cols-2 gap-2">
            <p className="break-words">
              <strong>{t('tasksPage.list.typeLabel')}:</strong>{' '}
              {TASK_TYPES[task.type] || task.type || t('common.dash')}
            </p>
            <p className="break-words">
              <strong>{t('tasksPage.list.priorityLabel')}:</strong>{' '}
              {TASK_PRIORITIES[task.priority] || task.priority || t('common.dash')}
            </p>
            <p className="break-words">
              <strong>{t('tasksPage.list.serviceLabel')}:</strong>{' '}
              {task.service?.title || task.serviceId}
            </p>
            <p className="break-words">
              <strong>{t('tasksPage.list.assigneeLabel')}:</strong>{' '}
              {displayUser(task.assignee)}
            </p>
          </div>

          {/* Actions */}
          <div className="mt-4 flex flex-col sm:flex-row flex-wrap gap-2 w-full sm:w-auto">
            {/* PREUVES */}
            <button
              onClick={() =>
                navigate(`/tasks/${task.id}/evidences`, {
                  state: linkedServiceId
                    ? { from: '/tasks', serviceId: linkedServiceId }
                    : { from: '/tasks' },
                })
              }
              className="
                app-btn-primary w-full sm:w-auto px-4 py-2 text-sm sm:text-base
                font-medium
              "
            >
              {t('tasksPage.list.viewEvidences')}
            </button>

            {linkedServiceId && (
              <button
                onClick={() =>
                  navigate(`/services/${linkedServiceId}/tasks`, {
                    state: { from: '/tasks' },
                  })
                }
                className="
                  app-btn-neutral w-full sm:w-auto px-4 py-2 text-sm sm:text-base
                  font-medium
                "
              >
                {t('services.buttons.viewTasks')}
              </button>
            )}

            {linkedServiceId && (
              <button
                onClick={() =>
                  navigate(`/services/${linkedServiceId}/transactions?taskId=${task.id}`, {
                    state: { from: '/tasks' },
                  })
                }
                className="
                  app-btn-neutral w-full sm:w-auto px-4 py-2 text-sm sm:text-base
                  font-medium
                "
              >
                {t('nav.transactions')}
              </button>
            )}

            {/* Assignation (admin/master) */}
            {isAdminLike && !task.assignee && task.status === 'created' && (
              <select
                onChange={(e) => updateAssignment(task.id, e.target.value)}
                defaultValue=""
                className="
                  w-full sm:w-auto border border-border rounded-lg px-3 py-2
                  text-sm sm:text-base bg-surface-card text-text-primary
                "
              >
                <option value="">{t('tasksPage.list.assignPlaceholder')}</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.firstName} {a.lastName}
                  </option>
                ))}
              </select>
            )}

 {/* Contexte: gestion des taches. */}
            {role === 'agent' && task.status === 'created' && (
              <button
                onClick={() => updateStatus(task.id, 'in_progress')}
                className="
                  app-btn-warning w-full sm:w-auto px-4 py-2 text-sm sm:text-base
                  font-medium
                "
              >
                {t('tasksPage.list.start')}
              </button>
            )}

 {/* Contexte: gestion des taches. */}
            {role === 'agent' && task.status === 'in_progress' && (
              <button
                onClick={() => updateStatus(task.id, 'completed')}
                className="
                  app-btn-success w-full sm:w-auto px-4 py-2 text-sm sm:text-base
                  font-medium
                "
              >
                {t('tasksPage.list.finish')}
              </button>
            )}

 {/* Contexte: gestion des taches. */}
            {isAdminLike && role === 'admin' && task.status === 'completed' && (
              <button
                onClick={() => updateStatus(task.id, 'validated')}
                className="
                  app-btn-success w-full sm:w-auto px-4 py-2 text-sm sm:text-base
                  font-medium
                "
              >
                {t('tasksPage.list.validate')}
              </button>
            )}
          </div>
        </div>
        );
      })}
    </div>
  );
}

