import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { me } from '../services/auth';
import { normalizeRole, isMasterUser } from '../utils/role';
import { useTranslation } from 'react-i18next';
import { notify } from '../utils/notify';
import {
  AdminField,
  AdminFilterBar,
  AdminPageHeader,
} from '../components/admin/AdminFormUi';

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
     ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â VÃƒÆ’Ã‚Â©rification ADMIN / MASTER
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
     ÃƒÂ°Ã…Â¸Ã¢â‚¬ËœÃ‚Â¥ Chargement agents (admin/master)
     ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Aucun filtrage frontend ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â backend scope only
  ============================================================ */
  const loadAgents = useCallback(async () => {
    try {
      const { data } = await api.get('/users?role=agent', authHeaders);
      setAgents(data?.users || []);
    } catch (err) {
      console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erreur chargement agents:', err);
      setAgents([]);
    }
  }, [authHeaders]);

  /* ============================================================
     ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Å¾ Chargement services
     ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â IMPORTANT :
     - PAS de countryId / regionId en query
     - Le backend applique dÃƒÆ’Ã‚Â©jÃƒÆ’Ã‚Â  le scope
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
      console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erreur chargement services:', e);
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, status, onlyUnassigned, q, limit, offset]);

  /* ============================================================
     ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â Initialisation
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
     ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬Å¾ Assignation agent
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
      console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erreur assignation:', e);
      notify(t('adminServicesPage.alerts.assignError'));
    }
  }

  /* ============================================================
     ÃƒÂ°Ã…Â¸Ã‚Â§Ã‚Â  Helpers UI
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
        return 'bg-surface-main/80 text-text-secondary border border-border';
      case 'in_progress':
        return 'app-badge app-badge-info';
      case 'completed':
        return 'app-badge app-badge-success';
      case 'validated':
        return 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30';
      default:
        return 'bg-surface-main text-text-secondary border border-border';
    }
  }

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-main">
        <p className="text-text-muted text-lg animate-pulse">
          {t('adminServicesPage.loading')}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-3 sm:px-4 py-8 sm:py-10">
      <div className="max-w-6xl mx-auto bg-surface-card/90 backdrop-blur-sm shadow-xl rounded-2xl border border-border/70 px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* ÃƒÂ°Ã…Â¸Ã‚Â§Ã‚Â­ En-tÃƒÆ’Ã‚Âªte Apple Light */}
        <AdminPageHeader
          title={t('adminServicesPage.title')}
          subtitle={t('adminServicesPage.subtitle')}
          subtitleClassName="max-w-xl text-text-muted"
          meta={
            currentUser && (
              <div className="pt-2 text-xs text-text-muted">
                <span className="inline-flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full border border-border bg-surface-card text-text-secondary">
                    {isMaster
                      ? t('adminServicesPage.badges.master')
                      : t('adminServicesPage.badges.admin')}
                  </span>
                  {isMaster ? (
                    <span className="text-text-muted">
                      {t('adminServicesPage.labels.perimeter')}
                      {currentUser?.countryId != null
                        ? ` ${t('adminServicesPage.labels.countryId', {
                            id: currentUser.countryId,
                          })}`
                        : ''}
                      {currentUser?.regionId != null
                        ? ` - ${t('adminServicesPage.labels.regionId', {
                            id: currentUser.regionId,
                          })}`
                        : ''}
                    </span>
                  ) : (
                    <span className="text-text-muted">
                      {t('adminServicesPage.labels.globalAccess')}
                    </span>
                  )}
                </span>
              </div>
            )
          }
          actionsClassName="justify-start sm:justify-end"
          actions={
            <button
              onClick={loadServices}
              disabled={loading}
              className="app-btn-primary inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-full shadow-sm"
            >
              {loading
                ? t('adminServicesPage.loading')
                : t('adminServicesPage.buttons.refresh')}
            </button>
          }
        />

        {/* ÃƒÂ°Ã…Â¸Ã…Â½Ã¢â‚¬ÂºÃƒÂ¯Ã‚Â¸Ã‚Â Filtres Apple-style */}
        <AdminFilterBar className="mb-8 rounded-2xl px-4 sm:px-5 py-4 sm:py-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Statut */}
            <AdminField
              label={t('adminServicesPage.filters.statusLabel')}
              className="flex flex-col gap-1"
            >
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setOffset(0);
                }}
                className="app-input"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </AdminField>

            {/* Non assignÃƒÆ’Ã‚Â©s */}
            <div className="flex flex-col justify-end">
              <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={onlyUnassigned}
                  onChange={(e) => {
                    setOnlyUnassigned(e.target.checked);
                    setOffset(0);
                  }}
                  className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
                />
                <span>{t('adminServicesPage.filters.onlyUnassigned')}</span>
              </label>
            </div>

            {/* Recherche */}
            <AdminField
              label={t('adminServicesPage.filters.searchLabel')}
              className="flex flex-col gap-1"
            >
              <input
                placeholder={t('adminServicesPage.filters.searchPlaceholder')}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setOffset(0);
                }}
                className="app-input"
              />
            </AdminField>

            {/* Limite */}
            <AdminField
              label={t('adminServicesPage.filters.limitLabel')}
              className="flex flex-col gap-1"
            >
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(parseInt(e.target.value, 10));
                  setOffset(0);
                }}
                className="app-input"
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {t('adminServicesPage.filters.limitOption', { count: n })}
                  </option>
                ))}
              </select>
            </AdminField>
          </div>

          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-text-muted">
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
              className="self-start sm:self-auto inline-flex items-center px-3 py-1.5 rounded-full bg-surface-main/80 hover:bg-surface-main text-[11px] font-medium transition"
            >
              {t('adminServicesPage.buttons.resetFilters')}
            </button>
          </div>
        </AdminFilterBar>

        {/* ÃƒÂ°Ã…Â¸Ã‚Â§Ã‚Â¾ Tableau Services Apple Light */}
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface-card shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-main/80 text-text-secondary">
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


            <tbody className="divide-y divide-border/60">
              {services.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center py-8 text-text-muted text-sm italic"
                  >
                    {t('adminServicesPage.empty')}
                  </td>
                </tr>
              ) : (
                services.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-surface-main/70 transition-colors"
                  >
                    {/* Titre / Type / Description */}
                    <td className="px-4 sm:px-5 py-3 align-top">
                      <div className="font-medium text-text-primary break-words">
                        {s.title ||
                          t('adminServicesPage.table.serviceFallback', { id: s.id })}
                      </div>
                      <div className="mt-0.5 text-xs text-text-muted">
                        {s.type || t('adminServicesPage.table.typeUnknown')} - {' '}
                        {t('adminServicesPage.table.budgetLabel')}{' '}
                        <span className="font-medium text-text-secondary">
                          {s.budget ?? t('adminServicesPage.table.emptyValue')}
                        </span>
                      </div>
                      {s.description && (
                        <div className="mt-1 text-xs text-text-muted line-clamp-2">
                          {s.description}
                        </div>
                      )}
                    </td>

                    {/* Client */}
                    <td className="px-4 sm:px-5 py-3 align-top">
                      <div className="text-sm text-text-primary break-words">
                        {displayUser(s.client)}
                      </div>
                    </td>

                    {/* Agent */}
                    <td className="px-4 sm:px-5 py-3 align-top">
                      <div className="text-sm text-text-primary break-words">
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
                            ? 'bg-surface-main text-text-muted border-border cursor-not-allowed'
                            : 'bg-surface-card text-text-primary border-border'
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
                        <p className="mt-1 text-[11px] text-text-muted">
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

        {/* ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Å¾ Pagination minimaliste */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-text-secondary">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0 || loading}
            className={`inline-flex items-center justify-center px-4 py-2 rounded-full border text-sm font-medium transition ${
              offset === 0 || loading
                ? 'bg-surface-main/80 text-text-muted border-border cursor-not-allowed'
                : 'bg-surface-card text-text-primary border-border hover:bg-surface-main'
            }`}
          >
            {t('adminServicesPage.pagination.prev')}
          </button>

          <span className="text-xs sm:text-sm text-text-muted">
            {t('adminServicesPage.pagination.offsetLabel')}{' '}
            <span className="font-medium">{offset}</span> - {' '}
            {t('adminServicesPage.pagination.limitLabel')}{' '}
            <span className="font-medium">{limit}</span>
          </span>

          <button
            onClick={() => setOffset(offset + limit)}
            disabled={loading || services.length < limit}
            className={`inline-flex items-center justify-center px-4 py-2 rounded-full border text-sm font-medium transition ${
              loading || services.length < limit
                ? 'bg-surface-main/80 text-text-muted border-border cursor-not-allowed'
                : 'bg-surface-card text-text-primary border-border hover:bg-surface-main'
            }`}
          >
            {t('adminServicesPage.pagination.next')}
          </button>
        </div>
      </div>
    </div>
  );
}




