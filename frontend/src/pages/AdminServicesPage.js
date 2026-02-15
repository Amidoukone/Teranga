import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { me } from '../services/auth';
import { normalizeRole, isMasterUser } from '../utils/role';
import { useTranslation } from 'react-i18next';

export default function AdminServicesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(null);
  const [isMaster, setIsMaster] = useState(false);

  const [services, setServices] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filtres
  const [status, setStatus] = useState('all');
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [q, setQ] = useState('');

  // Pagination
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);

  const authHeaders = useMemo(
    () => ({
      headers: {
        Authorization: `Bearer ${
          localStorage.getItem('teranga_token') ||
          localStorage.getItem('token')
        }`,
      },
    }),
    []
  );

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('adminServicesPage.filters.statusAll') },
      { value: 'created', label: t('services.status.created') },
      { value: 'in_progress', label: t('services.status.in_progress') },
      { value: 'completed', label: t('services.status.completed') },
      { value: 'validated', label: t('services.status.validated') },
    ],
    [t]
  );

  /* ============================================================
     🔐 Vérification ADMIN / MASTER
  ============================================================ */
  useEffect(() => {
    let active = true;

    async function checkAccess() {
      try {
        const { user } = await me();
        if (!active) return;

        if (!user) {
          navigate('/login');
          return;
        }

        if (normalizeRole(user.role) !== 'admin') {
          navigate('/dashboard');
          return;
        }

        setCurrentUser(user);
        setIsAdmin(true);
        setIsMaster(isMasterUser(user));
      } catch (e) {
        navigate('/login');
      }
    }

    checkAccess();
    return () => {
      active = false;
    };
  }, [navigate]);

  /* ============================================================
     👥 Chargement agents (admin/master)
     ⚠️ Aucun filtrage frontend — backend scope only
  ============================================================ */
  const loadAgents = useCallback(async () => {
    try {
      const { data } = await api.get('/users?role=agent', authHeaders);
      setAgents(data?.users || []);
    } catch (err) {
      console.error('❌ Erreur chargement agents:', err);
      setAgents([]);
    }
  }, [authHeaders]);

  /* ============================================================
     📄 Chargement services
     ⚠️ IMPORTANT :
     - PAS de countryId / regionId en query
     - Le backend applique déjà le scope
  ============================================================ */
  const loadServices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (status !== 'all') params.set('status', status);
      if (onlyUnassigned) params.set('unassigned', '1');
      if (q.trim()) params.set('q', q.trim());

      params.set('limit', String(limit));
      params.set('offset', String(offset));

      const { data } = await api.get(
        `/services?${params.toString()}`,
        authHeaders
      );

      setServices(data?.services || []);
    } catch (e) {
      console.error('❌ Erreur chargement services:', e);
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, status, onlyUnassigned, q, limit, offset]);

  /* ============================================================
     🔁 Initialisation
  ============================================================ */
  useEffect(() => {
    if (isAdmin) {
      loadAgents();
    }
  }, [isAdmin, loadAgents]);

  useEffect(() => {
    if (isAdmin) {
      loadServices();
    }
  }, [isAdmin, loadServices]);

  /* ============================================================
     🔄 Assignation agent
  ============================================================ */
  async function handleAssign(serviceId, agentId) {
    if (!agentId) return;
    try {
      await api.post(
        '/services/assign',
        { serviceId, agentId },
        authHeaders
      );
      await loadServices();
    } catch (e) {
      console.error('❌ Erreur assignation:', e);
      alert(t('adminServicesPage.alerts.assignError'));
    }
  }

  /* ============================================================
     🧠 Helpers UI
  ============================================================ */
  function displayUser(u) {
    if (!u) return t('adminServicesPage.table.emptyValue');
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
    return name ? `${name} (${u.email})` : u.email;
  }

  function canReassign(s) {
    return s.status !== 'completed' && s.status !== 'validated';
  }

  function statusBadgeClass(st) {
    switch (st) {
      case 'created':
        return 'bg-slate-100 text-slate-700 border border-slate-200';
      case 'in_progress':
        return 'bg-blue-50 text-blue-700 border border-blue-100';
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
      case 'validated':
        return 'bg-indigo-50 text-indigo-700 border border-indigo-100';
      default:
        return 'bg-gray-50 text-gray-600 border border-gray-200';
    }
  }

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-500 text-lg animate-pulse">
          {t('adminServicesPage.loading')}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-3 sm:px-4 py-8 sm:py-10">
      <div className="max-w-6xl mx-auto bg-white/90 backdrop-blur-sm shadow-xl rounded-2xl border border-gray-100 px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* 🧭 En-tête Apple Light */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
              {t('adminServicesPage.title')}
            </h1>
            <p className="text-sm text-slate-500 max-w-xl">
              {t('adminServicesPage.subtitle')}
            </p>

            {/* ✅ Badge scope (UX only, backend = source de vérité) */}
            {currentUser && (
              <div className="pt-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full border border-slate-200 bg-white text-slate-700">
                    {isMaster
                      ? t('adminServicesPage.badges.master')
                      : t('adminServicesPage.badges.admin')}
                  </span>
                  {isMaster ? (
                    <span className="text-slate-500">
                      {t('adminServicesPage.labels.perimeter')}
                      {currentUser?.countryId != null
                        ? ` ${t('adminServicesPage.labels.countryId', {
                            id: currentUser.countryId,
                          })}`
                        : ''}
                      {currentUser?.regionId != null
                        ? ` · ${t('adminServicesPage.labels.regionId', {
                            id: currentUser.regionId,
                          })}`
                        : ''}
                    </span>
                  ) : (
                    <span className="text-slate-500">
                      {t('adminServicesPage.labels.globalAccess')}
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
            <button
              onClick={loadServices}
              disabled={loading}
              className={`inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-full shadow-sm transition ${
                loading
                  ? 'bg-blue-200 text-white cursor-not-allowed'
                  : 'bg-slate-900 text-white hover:bg-black'
              }`}
            >
              {loading
                ? t('adminServicesPage.loading')
                : t('adminServicesPage.buttons.refresh')}
            </button>
          </div>
        </div>

        {/* 🎛️ Filtres Apple-style */}
        <section className="mb-8 bg-slate-50/80 border border-slate-200 rounded-2xl px-4 sm:px-5 py-4 sm:py-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Statut */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">
                {t('adminServicesPage.filters.statusLabel')}
              </label>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setOffset(0);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Non assignés */}
            <div className="flex flex-col justify-end">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={onlyUnassigned}
                  onChange={(e) => {
                    setOnlyUnassigned(e.target.checked);
                    setOffset(0);
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>{t('adminServicesPage.filters.onlyUnassigned')}</span>
              </label>
            </div>

            {/* Recherche */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">
                {t('adminServicesPage.filters.searchLabel')}
              </label>
              <input
                placeholder={t('adminServicesPage.filters.searchPlaceholder')}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setOffset(0);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Limite */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">
                {t('adminServicesPage.filters.limitLabel')}
              </label>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(parseInt(e.target.value, 10));
                  setOffset(0);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {t('adminServicesPage.filters.limitOption', { count: n })}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500">
            <span>
              {services.length === 0
                ? t('adminServicesPage.empty')
                : t('adminServicesPage.loadedCount', { count: services.length })}
            </span>
            <button
              type="button"
              onClick={() => {
                setStatus('all');
                setOnlyUnassigned(false);
                setQ('');
                setLimit(25);
                setOffset(0);
              }}
              className="self-start sm:self-auto inline-flex items-center px-3 py-1.5 rounded-full bg-slate-200 hover:bg-slate-300 text-[11px] font-medium transition"
            >
              {t('adminServicesPage.buttons.resetFilters')}
            </button>
          </div>
        </section>

        {/* 🧾 Tableau Services Apple Light */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/80 text-slate-600">
              <tr>
                <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                  {t('adminServicesPage.table.headers.titleType')}
                </th>
                <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                  {t('adminServicesPage.table.headers.client')}
                </th>
                <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                  {t('adminServicesPage.table.headers.agent')}
                </th>
                <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                  {t('adminServicesPage.table.headers.status')}
                </th>
                <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                  {t('adminServicesPage.table.headers.assign')}
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {services.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center py-8 text-slate-400 text-sm italic"
                  >
                    {t('adminServicesPage.empty')}
                  </td>
                </tr>
              ) : (
                services.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    {/* Titre / Type / Description */}
                    <td className="px-4 sm:px-5 py-3 align-top">
                      <div className="font-medium text-slate-900 break-words">
                        {s.title ||
                          t('adminServicesPage.table.serviceFallback', { id: s.id })}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {s.type || t('adminServicesPage.table.typeUnknown')} •{' '}
                        {t('adminServicesPage.table.budgetLabel')}{' '}
                        <span className="font-medium text-slate-700">
                          {s.budget ?? t('adminServicesPage.table.emptyValue')}
                        </span>
                      </div>
                      {s.description && (
                        <div className="mt-1 text-xs text-slate-400 line-clamp-2">
                          {s.description}
                        </div>
                      )}
                    </td>

                    {/* Client */}
                    <td className="px-4 sm:px-5 py-3 align-top">
                      <div className="text-sm text-slate-800 break-words">
                        {displayUser(s.client)}
                      </div>
                    </td>

                    {/* Agent */}
                    <td className="px-4 sm:px-5 py-3 align-top">
                      <div className="text-sm text-slate-800 break-words">
                        {s.agent
                          ? displayUser(s.agent)
                          : t('adminServicesPage.table.unassigned')}
                      </div>
                    </td>

                    {/* Statut badge */}
                    <td className="px-4 sm:px-5 py-3 align-top">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium capitalize ${statusBadgeClass(
                          s.status
                        )}`}
                      >
                        {s.status
                          ? t(`services.status.${s.status}`, {
                              defaultValue: String(s.status).replace('_', ' '),
                            })
                          : t('adminServicesPage.table.statusUnknown')}
                      </span>
                    </td>

                    {/* Select agent */}
                    <td className="px-4 sm:px-5 py-3 align-top">
                      <select
                        disabled={!canReassign(s) || agents.length === 0}
                        value={s.agent?.id || ''}
                        onChange={(e) => handleAssign(s.id, e.target.value)}
                        className={`w-full rounded-xl border px-2.5 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          !canReassign(s) || agents.length === 0
                            ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <option value="">
                          {t('adminServicesPage.assign.placeholder')}
                        </option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.firstName} {a.lastName} ({a.email})
                          </option>
                        ))}
                      </select>
                      {!canReassign(s) && (
                        <p className="mt-1 text-[11px] text-slate-400">
                          {t('adminServicesPage.assign.locked')}
                        </p>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 📄 Pagination minimaliste */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-600">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0 || loading}
            className={`inline-flex items-center justify-center px-4 py-2 rounded-full border text-sm font-medium transition ${
              offset === 0 || loading
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {t('adminServicesPage.pagination.prev')}
          </button>

          <span className="text-xs sm:text-sm text-slate-500">
            {t('adminServicesPage.pagination.offsetLabel')}{' '}
            <span className="font-medium">{offset}</span> •{' '}
            {t('adminServicesPage.pagination.limitLabel')}{' '}
            <span className="font-medium">{limit}</span>
          </span>

          <button
            onClick={() => setOffset(offset + limit)}
            disabled={loading || services.length < limit}
            className={`inline-flex items-center justify-center px-4 py-2 rounded-full border text-sm font-medium transition ${
              loading || services.length < limit
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {t('adminServicesPage.pagination.next')}
          </button>
        </div>
      </div>
    </div>
  );
}
