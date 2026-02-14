// ============================================================================
// TasksPage.jsx — VERSION PREMIUM 2025
// MASTER SAFE — Multi-pays backend-driven — PARTIE 1 / 2
// ============================================================================

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { me } from '../services/auth';
import { getMyServices } from '../services/services';
import {
  TASK_TYPES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  SERVICE_TYPES,
  applyLabels,
} from '../utils/labels';
import { normalizeRole, isMasterUser } from '../utils/role';
import { useTranslation } from 'react-i18next';

const DEFAULT_FILTERS = {
  q: '',
  type: '',
  status: '',
  priority: '',
  service: '',
  agent: '',
};

// ============================================================================
// 🧩 PAGE PRINCIPALE
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
  // 🔐 Rôles (MASTER SAFE)
  // =========================================================================
  const role = normalizeRole(user?.role);
  const isAdmin = role === 'admin';
  const isMaster = isMasterUser(user); // UX uniquement
  const isAdminLike = isAdmin; // MASTER = admin côté UI
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
    const token =
      localStorage.getItem('teranga_token') ||
      localStorage.getItem('token');

    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  // ========================================================================
  // Chargement des tâches (backend applique le scope geo)
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
      console.error('❌ Erreur chargement tâches:', err);
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
        setUser(u);

        // CLIENT
        if (u.role === 'client') {
          const servs = await getMyServices();
          setServices(servs || []);
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
            console.error(
              '❌ Erreur chargement services/agents (admin/master):',
              err
            );
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
  // Création d'une tâche (CLIENT + ADMIN/MASTER)
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
        assignedTo: '',
      });

      await loadTasks();
    } catch (err) {
      console.error('❌ Erreur création tâche:', err);
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
      console.error('❌ Erreur maj statut:', err);
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
      console.error('❌ Erreur assignation tâche:', err);
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-3 py-8 sm:px-4 sm:py-10">
      <div className="max-w-6xl mx-auto bg-white/95 shadow-2xl rounded-3xl p-4 sm:p-8 border border-gray-100">
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
                ? 'bg-rose-50 border-rose-200 text-rose-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}
          >
            <span className="mt-[1px]">
              {notice.type === 'error' ? '⚠️' : '✅'}
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
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-3">
              <span className="text-xl">🗂️</span>
            </div>
            <p className="text-sm font-semibold text-gray-800 mb-1">
              {hasActiveFilters
                ? t('tasksPage.emptyFilteredTitle')
                : t('tasksPage.emptyTitle')}
            </p>
            <p className="text-xs text-gray-500 max-w-sm">
              {hasActiveFilters
                ? t('tasksPage.emptyFilteredSubtitle')
                : t('tasksPage.emptySubtitle')}
            </p>
            <div className="mt-4 flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg shadow-sm bg-gray-200 hover:bg-gray-300"
                >
                  {t('tasksPage.filters.reset')}
                </button>
              )}
              {canCreateTask && !showForm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg shadow-sm bg-blue-600 text-white hover:bg-blue-700 transition"
                >
                  ➕ {t('tasksPage.buttons.newTask')}
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
// 🧩 SOUS-COMPOSANTS (UI premium & responsive)
// ============================================================================

function Header({ showForm, setShowForm, loadTasks, loading, total, isMaster }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-7 pb-4 border-b border-gray-100">
      <div className="max-w-full break-words">
        <p className="text-[0.7rem] uppercase tracking-wide text-blue-600 font-semibold">
          {t('tasksPage.kicker')}
        </p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
          📋 {t('tasksPage.title')}
        </h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">
          {t('tasksPage.subtitle')}
        </p>

        <div className="mt-2 flex flex-wrap gap-2 items-center">
          <p className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
            {t('tasksPage.count', { count: total })}
          </p>

          {isMaster && (
            <p className="inline-flex items-center gap-2 text-xs sm:text-sm text-amber-800 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
              ⭐ {t('roles.master')}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold rounded-lg shadow-sm bg-slate-900 text-white hover:bg-slate-800 transition"
        >
          {showForm
            ? `➖ ${t('tasksPage.buttons.hideForm')}`
            : `➕ ${t('tasksPage.buttons.newTask')}`}
        </button>

        <button
          onClick={loadTasks}
          disabled={loading}
          className={`w-full sm:w-auto px-4 py-2.5 text-sm font-semibold rounded-lg shadow-sm transition ${
            loading
              ? 'bg-blue-300 cursor-not-allowed text-white'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {loading
            ? t('tasksPage.buttons.refreshLoading')
            : `🔄 ${t('tasksPage.buttons.refresh')}`}
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
    <div className="mb-8 bg-gray-50 border border-gray-200 rounded-2xl p-4 sm:p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Recherche */}
        <input
          placeholder={`🔎 ${t('tasksPage.filters.searchPlaceholder')}`}
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          className="
            border border-gray-300 rounded-lg px-3 py-2.5 text-sm sm:text-base
            focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            col-span-1 sm:col-span-2 lg:col-span-3 break-words
          "
        />

        {/* Type */}
        <select
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
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
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t('tasksPage.filters.statusAll')}</option>
          {Object.entries(TASK_STATUSES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        {/* Priorité */}
        <select
          value={filters.priority}
          onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
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
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t('tasksPage.filters.serviceAll')}</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} — {SERVICE_TYPES[s.type] || s.type || t('common.dash')}
            </option>
          ))}
        </select>

        {/* Agent (admin/master uniquement) */}
        {isAdminLike && (
          <select
            value={filters.agent}
            onChange={(e) => setFilters({ ...filters, agent: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
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
        <div className="text-xs sm:text-sm text-gray-500">
          {t('tasksPage.filters.foundCount', { count: filteredCount })}
        </div>
        <button
          onClick={onReset}
          className="
            text-xs sm:text-sm px-3 py-1.5 bg-gray-200 rounded-md
            hover:bg-gray-300 w-full sm:w-auto text-center
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
      <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3">
        ➕ {t('tasksPage.form.title')}
      </h2>
      <p className="text-xs sm:text-sm text-gray-500 mb-4">
        {t('tasksPage.form.subtitle')}
      </p>

      <form
        onSubmit={createTask}
        className="
          grid grid-cols-1 sm:grid-cols-2 gap-4
          bg-gray-50 p-4 sm:p-5 rounded-2xl border border-gray-200
        "
      >
        {/* Service lié */}
        <div className="w-full">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            {t('tasksPage.form.serviceLabel')} <span className="text-red-500">*</span>
          </label>
          <select
            value={form.serviceId}
            onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
            required
            className="
              w-full border border-gray-300 rounded-lg px-3 py-2
              text-sm sm:text-base focus:ring-2 focus:ring-blue-500
            "
          >
            <option value="">{t('tasksPage.form.servicePlaceholder')}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({SERVICE_TYPES[s.type] || s.type || t('common.dash')})
              </option>
            ))}
          </select>
        </div>

        {/* Type de tâche */}
        <div className="w-full">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            {t('tasksPage.form.typeLabel')}
          </label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            required
            className="
              w-full border border-gray-300 rounded-lg px-3 py-2
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
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            {t('tasksPage.form.titleLabel')} <span className="text-red-500">*</span>
          </label>
          <input
            placeholder={t('tasksPage.form.titlePlaceholder')}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            className="
              w-full border border-gray-300 rounded-lg px-3 py-2
              text-sm sm:text-base focus:ring-2 focus:ring-blue-500 break-words
            "
          />
        </div>

        {/* Description */}
        <div className="w-full col-span-1 sm:col-span-2">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            {t('tasksPage.form.descriptionLabel')}
          </label>
          <textarea
            placeholder={t('tasksPage.form.descriptionPlaceholder')}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="
              w-full border border-gray-300 rounded-lg px-3 py-2
              text-sm sm:text-base focus:ring-2 focus:ring-blue-500 break-words
            "
          />
        </div>

        {/* Priorité */}
        <div className="w-full">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            {t('tasksPage.form.priorityLabel')}
          </label>
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
            className="
              w-full border border-gray-300 rounded-lg px-3 py-2
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

        {/* Date d’échéance */}
        <div className="w-full">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            {t('tasksPage.form.dueDateLabel')}
          </label>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            className="
              w-full border border-gray-300 rounded-lg px-3 py-2
              text-sm sm:text-base focus:ring-2 focus:ring-blue-500
            "
          />
        </div>

        {/* Coût estimé */}
        <div className="w-full">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            {t('tasksPage.form.estimatedCostLabel')}
          </label>
          <input
            type="number"
            step="0.01"
            placeholder={t('tasksPage.form.estimatedCostPlaceholder')}
            value={form.estimatedCost}
            onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })}
            className="
              w-full border border-gray-300 rounded-lg px-3 py-2
              text-sm sm:text-base focus:ring-2 focus:ring-blue-500
            "
          />
        </div>

        {/* Assignation (admin/master uniquement) */}
        {isAdminLike && (
          <div className="w-full">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              {t('tasksPage.form.assignedLabel')}
            </label>
            <select
              value={form.assignedTo}
              onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
              className="
                w-full border border-gray-300 rounded-lg px-3 py-2
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
              w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white rounded-lg
              text-sm sm:text-base font-semibold hover:bg-blue-700 transition
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
      <p className="text-gray-500 italic text-center py-8">
        {t('tasksPage.list.empty')}
      </p>
    );
  }

  return (
    <div className="grid gap-5">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="
            bg-white border border-gray-200 rounded-2xl shadow-sm
            p-4 sm:p-5 hover:shadow-md transition
          "
        >
          {/* En-tête : titre + statut */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
            <div className="min-w-0 break-words">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 break-words">
                {task.title}
              </h3>
              <p className="text-sm sm:text-base text-gray-600 mt-1 break-words">
                {task.description || t('tasksPage.list.noDescription')}
              </p>
            </div>

            <div
              className={`
                mt-1 sm:mt-0 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold
                whitespace-nowrap self-start
                ${
                  task.status === 'created'
                    ? 'bg-gray-100 text-gray-700'
                    : task.status === 'in_progress'
                    ? 'bg-blue-100 text-blue-700'
                    : task.status === 'completed'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-emerald-100 text-emerald-700'
                }
              `}
            >
              {TASK_STATUSES[task.status] || task.status || t('common.dash')}
            </div>
          </div>

          {/* Meta infos */}
          <div className="mt-4 text-sm sm:text-base text-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-2">
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
              onClick={() => navigate(`/tasks/${task.id}/evidences`)}
              className="
                w-full sm:w-auto px-4 py-2 bg-blue-600 text-white text-sm sm:text-base
                font-medium rounded-lg hover:bg-blue-700 transition
              "
            >
              📎 {t('tasksPage.list.viewEvidences')}
            </button>

            {/* Assignation (admin/master) */}
            {isAdminLike && !task.assignee && task.status === 'created' && (
              <select
                onChange={(e) => updateAssignment(task.id, e.target.value)}
                defaultValue=""
                className="
                  w-full sm:w-auto border border-gray-300 rounded-lg px-3 py-2
                  text-sm sm:text-base
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

            {/* Agent → Démarrer */}
            {role === 'agent' && task.status === 'created' && (
              <button
                onClick={() => updateStatus(task.id, 'in_progress')}
                className="
                  w-full sm:w-auto px-4 py-2 bg-yellow-500 text-white text-sm sm:text-base
                  font-medium rounded-lg hover:bg-yellow-600 transition
                "
              >
                ▶️ {t('tasksPage.list.start')}
              </button>
            )}

            {/* Agent → Terminer */}
            {role === 'agent' && task.status === 'in_progress' && (
              <button
                onClick={() => updateStatus(task.id, 'completed')}
                className="
                  w-full sm:w-auto px-4 py-2 bg-green-600 text-white text-sm sm:text-base
                  font-medium rounded-lg hover:bg-green-700 transition
                "
              >
                ✅ {t('tasksPage.list.finish')}
              </button>
            )}

            {/* Admin/master UI → Valider (backend reste la vérité : admin only) */}
            {isAdminLike && role === 'admin' && task.status === 'completed' && (
              <button
                onClick={() => updateStatus(task.id, 'validated')}
                className="
                  w-full sm:w-auto px-4 py-2 bg-emerald-600 text-white text-sm sm:text-base
                  font-medium rounded-lg hover:bg-emerald-700 transition
                "
              >
                ✔️ {t('tasksPage.list.validate')}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
