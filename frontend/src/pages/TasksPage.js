// ============================================================================
// Contexte: gestion des taches.
// Contexte: gestion des taches.
// ============================================================================

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { me, getAuthHeader } from '../services/auth';
import { useGeo } from '../contexts/GeoContext';
import PaginationBar from '../components/PaginationBar';
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
  const { user, countryId, regionId } = useGeo();
  const location = useLocation();
  return <Interventions key={JSON.stringify([user?.id, user?.role, countryId, regionId, new URLSearchParams(location.search).get('propertyId')])}
    countryId={user?.role === 'admin' ? countryId : null} regionId={user?.role === 'admin' ? regionId : null} />;
}

function Interventions({ countryId, regionId }) {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const propertyId = params.get('propertyId');
  const page = Math.max(1, Number.parseInt(params.get('page'), 10) || 1);
  const [data, setData] = useState(null);
  const [services, setServices] = useState([]);
  const [agents, setAgents] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [creating, setCreating] = useState(false);
  const sending = useRef(false);
  const generation = useRef(0);
  const alive = useRef(true);
  const queryKey = params.toString();
  const currentQuery = useRef(queryKey); currentQuery.current = queryKey;
  const visible = data?.key === queryKey ? data : null;
  const filtered = visible?.tasks || [];
  const total = visible?.total ?? 0;

  const [showForm, setShowForm] = useState(() => {
    const saved = localStorage.getItem('teranga_tasks_showForm');
    return saved === '1';
  });

  const navigate = useNavigate();

  // ========================================================================
 // Contexte: gestion des taches.
  // =========================================================================
  const role = normalizeRole(user?.role);
  const isAdmin = role === 'admin';
  const isMaster = isMasterUser(user); // UX uniquement
  const isAdminLike = isAdmin; // MASTER traite comme admin cote UI.
  const canCreateTask = !propertyId && (role === 'client' || isAdminLike);

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
    currency: '',
    assignedTo: '',
  });

  // ========================================================================
  // Filtres
  // =========================================================================
  const filters = useMemo(() => Object.fromEntries(Object.keys(DEFAULT_FILTERS).map((key) => [key, params.get(key) || ''])), [params]);
  const setFilters = (next) => {
    const value = new URLSearchParams(params);
    Object.entries(next).forEach(([key, item]) => { if (item) value.set(key, item); else value.delete(key); });
    value.delete('page'); setParams(value, { replace: true });
  };
  const setPage = (next) => {
    const value = new URLSearchParams(params);
    value.set('page', String(next)); setParams(value);
  };

  const resetFilters = () => {
    setFilters({ ...DEFAULT_FILTERS });
  };

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
    const version = ++generation.current;
    setLoading(true);
    try {
      const values = new URLSearchParams(queryKey);
      const { data } = await api.get('/tasks', {
        headers: authHeader,
        params: {
          page, limit: 20,
          q: values.get('q') || undefined,
          type: values.get('type') || undefined,
          status: values.get('status') || undefined,
          priority: values.get('priority') || undefined,
          serviceId: values.get('service') || undefined,
          assignedTo: values.get('agent') || undefined,
          propertyId: values.get('propertyId') ?? undefined,
          ...(countryId ? { countryId } : {}),
          ...(regionId ? { regionId } : {}),
        },
      });
      if (!alive.current || version !== generation.current || currentQuery.current !== queryKey) return;
      const enriched = (data.tasks || []).map((t) => applyLabels(t, 'task'));
      const total = data.pagination?.total ?? enriched.length;
      if (page > 1 && (page - 1) * 20 >= total) {
        const value = new URLSearchParams(queryKey); value.set('page', String(Math.max(1, Math.ceil(total / 20)))); setParams(value, { replace: true }); return;
      }
      setData({ key: queryKey, tasks: enriched, total });
      setLoadError('');
    } catch (err) {
      if (!alive.current || version !== generation.current || currentQuery.current !== queryKey) return;
      if ([401, 403, 404].includes(err?.response?.status)) setData(null);
      setLoadError(t('tasksPage.alerts.loadError'));
    } finally {
      if (alive.current && version === generation.current) setLoading(false);
    }
  }, [authHeader, t, page, queryKey, setParams, countryId, regionId]);

  useEffect(() => {
    alive.current = true; loadTasks();
    return () => { alive.current = false; generation.current += 1; };
  }, [loadTasks]);

  // ========================================================================
  // Initialisation
  // =========================================================================
  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const { user: u } = await me();
        if (!active) return;
        if (!u) {
          window.location.href = '/login';
          return;
        }
        setUser(u);

        // CLIENT
        if (u.role === 'client') {
          const servs = await getMyServices();
          if (!active) return;
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
            if (!active) return;

            const enrichedServices = (allServices?.services || []).map((s) =>
              applyLabels(s, 'service')
            );

            setServices(enrichedServices);
            setAgents(agentsRes?.users || []);
          } catch (err) {
            console.error('TasksPage load services and agents error:', err);
          }
        }

      } catch (err) {
        if (!active) return;
        if (err?.response?.status === 401) {
          localStorage.removeItem('teranga_token');
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
      }
    }

    init();
    return () => { active = false; };
  }, [authHeader]);

  useEffect(() => {
    localStorage.setItem('teranga_tasks_showForm', showForm ? '1' : '0');
  }, [showForm]);

    // ========================================================================
 // Contexte: gestion des taches.
  // =========================================================================
  async function createTask(e) {
    e.preventDefault();
    if (sending.current) return;
    sending.current = true; setCreating(true);
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
        currency: form.currency ? form.currency.toUpperCase() : undefined,
        assignedTo: form.assignedTo ? parseInt(form.assignedTo, 10) : null,
      };

      await api.post('/tasks', payload, { headers: authHeader });
      if (!alive.current) return;

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
        currency: '',
        assignedTo: '',
      });

      await loadTasks();
    } catch (err) {
      if (!alive.current) return;
      console.error('TasksPage create task error:', err);
      setNotice({
        type: 'error',
        message:
          err?.response?.data?.error || t('tasksPage.alerts.createError'),
      });
    } finally {
      sending.current = false;
      if (alive.current) setCreating(false);
    }
  }

  // ========================================================================
  // UI
  // =========================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-3 py-8 sm:px-4 sm:py-10">
      <div className="max-w-6xl mx-auto bg-surface-card/95 shadow-2xl rounded-3xl p-4 sm:p-8 border border-border/70">
        <Link to="/operations" className="mb-4 inline-flex min-h-11 items-center text-sm underline">{t('workspaceQueue.back')}</Link>
        {propertyId && <p className="mb-4 rounded-xl border border-border p-3 text-sm">{t('nav.propertyContext', { id: propertyId })} <Link to={isAdminLike ? '/admin/properties' : '/properties'} className="inline-flex min-h-11 items-center underline">{t('nav.properties')}</Link></p>}
        {/* HEADER */}
        <Header
          showForm={showForm}
          setShowForm={setShowForm}
          loadTasks={loadTasks}
          loading={loading}
          total={total}
          isMaster={isMaster}
          canCreate={canCreateTask}
        />
        {loading && <p role="status" className="mb-4">{t('workspaceQueue.loading')}</p>}
        {loadError && <p role="alert" className="app-alert app-alert-error">{loadError} <button type="button" onClick={loadTasks} className="min-h-11 underline">{t('serviceOrders.retry')}</button></p>}

        {notice && (
          <div
            role={notice.type === 'error' ? 'alert' : 'status'}
            aria-live={notice.type === 'error' ? 'assertive' : 'polite'}
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
          filteredCount={total}
          isAdminLike={isAdminLike}
          onReset={resetFilters}
        />

        {/* FORMULAIRE */}
        {showForm && canCreateTask && (
          <fieldset disabled={creating}>
          <TaskForm
            form={form}
            setForm={setForm}
            services={services}
            agents={agents}
            user={user}
            createTask={createTask}
            isAdminLike={isAdminLike}
          />
          </fieldset>
        )}

        {/* LISTE */}
        {!loading && !loadError && visible && filtered.length === 0 ? (
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
        ) : visible ? (
          <TaskList
            tasks={filtered}
            navigate={navigate}
            from={location.pathname + location.search}
          />
        ) : null}
        {visible && <PaginationBar page={page} pageSize={20} totalItems={total} onPageChange={setPage} showPageSize={false} />}
      </div>
    </div>
  );
}

// ============================================================================
// Contexte: gestion des taches.
// ============================================================================

function Header({ showForm, setShowForm, loadTasks, loading, total, isMaster, canCreate }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-7 pb-4 border-b border-border/70">
      <div className="max-w-full break-words">
        <p className="page-kicker">
          {t('tasksPage.kicker')}
        </p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary">
          {t('nav.interventions')}
        </h1>
        <p className="text-sm sm:text-base text-text-secondary mt-1">
          {t('nav.interventionsHint')}
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
        {canCreate && <button
          onClick={() => setShowForm((v) => !v)}
          className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold rounded-lg shadow-sm app-btn-neutral transition"
        >
          {showForm
            ? t('tasksPage.buttons.hideForm')
            : t('tasksPage.buttons.newTask')}
        </button>}

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
          aria-label={t('tasksPage.filters.searchPlaceholder')}
          maxLength={200}
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
          aria-label={t('tasksPage.filters.typeAll')}
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
          aria-label={t('tasksPage.filters.statusAll')}
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
          aria-label={t('tasksPage.filters.priorityAll')}
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
          aria-label={t('tasksPage.filters.serviceAll')}
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
  const serviceCurrency = services.find((service) => String(service.id) === String(form.serviceId))?.currency;
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
            onChange={(e) => setForm({ ...form, serviceId: e.target.value, currency: '' })}
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

        <details className="col-span-1 rounded-xl border border-border bg-surface-card/50 px-3 py-2 sm:col-span-2">
          <summary className="cursor-pointer text-sm font-semibold text-text-primary">
            {t('tasksPage.form.advancedDetails')}
          </summary>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">

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
            <option value="">{t('common.currencyFromService')}{serviceCurrency ? ` (${serviceCurrency})` : ''}</option>
            {[...new Set([...TASK_CURRENCY_CODES, serviceCurrency, form.currency].filter(Boolean))].map((code) => (
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

          </div>
        </details>

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

function TaskList({ tasks, navigate, from }) {
  const { t } = useTranslation();
  return <div className="grid gap-4">{tasks.map((task) => <article key={task.id} aria-labelledby={`intervention-${task.id}`} className="rounded-2xl border border-border bg-surface-card p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <h2 id={`intervention-${task.id}`} className="font-bold text-text-primary">{task.title}</h2>
      <Badge tone={getTaskStatusTone(task.status)}>{TASK_STATUSES[task.status] || task.status}</Badge>
    </div>
    {task.description && <p className="mt-2 line-clamp-2 text-sm text-text-secondary">{task.description}</p>}
    <p className="mt-3 text-sm text-text-secondary">{task.service?.title || task.property?.title || t('nav.standaloneIntervention')}</p>
    {task.assignee && <p className="mt-1 text-sm text-text-secondary">{[task.assignee.firstName, task.assignee.lastName].filter(Boolean).join(' ') || task.assignee.email}</p>}
    <button type="button" onClick={() => navigate(`/tasks/${task.id}`, { state: { from } })} className="app-btn-primary mt-4 min-h-11">{t('nav.openIntervention')}</button>
  </article>)}</div>;
}
