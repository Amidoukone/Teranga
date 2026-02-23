// frontend/src/pages/AdminProjectsPage.jsx
// ============================================================================
// AdminProjectsPage.jsx ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â VERSION PRODUCTION READY (Apple Light PRO)
// Admin GLOBAL + MASTER (admin + geo scope) ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ZÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°RO RÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°GRESSION
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
import { useLocale } from '../i18n/useLocale';
import { useTranslation } from 'react-i18next';
import { notify } from '../utils/notify';
import {
  normalizeRole,
  isMasterUser,
} from '../utils/role';
import {
  AdminActionsRow,
  AdminField,
  AdminFilterBar,
  AdminPageHeader,
} from '../components/admin/AdminFormUi';

/* ============================================================
   ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â§ Typologies et statuts
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
   ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢Ãƒâ€šÃ‚Â° Formulaire transaction projet (inchangÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©)
============================================================ */
function ProjectTransactionForm({ project, onClose, onSuccess }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    type: 'expense',
    amount: '',
    currency: 'XOF',
    paymentMethod: '',
    description: '',
    proofFile: null,
  });
  const [loading, setLoading] = useState(false);
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
      setLoading(true);

      const payload = {
        ...form,
        amount: form.amount === '' ? undefined : Number(form.amount),
        projectId: Number(project.id),
      };

      await createTransaction(payload);

      notify(t('projects.transaction.alerts.createSuccess'));
      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error('ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€¦Ã¢â‚¬â„¢ Erreur crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ation transaction projet:', err);
      notify(
        err?.response?.data?.error ||
          err?.message ||
          t('projects.transaction.alerts.createError')
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-surface-main/80 border border-border rounded-xl p-4 mt-3 shadow-sm">
      <h4 className="text-sm font-semibold text-text-primary mb-2 break-words">
        {t('projects.transaction.titleFor')}{' '}
        <span className="font-bold text-text-primary">
          {project.title || t('projects.itemFallback', { id: project.id })}
        </span>
      </h4>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Type */}
        <AdminField label={t('projects.transaction.typeLabel')}>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="app-input"
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
        </AdminField>

        {/* Montant */}
        <AdminField label={t('projects.transaction.amountLabel')}>
          <input
            type="number"
            placeholder={t('projects.transaction.amountPlaceholder')}
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
            className="app-input"
          />
        </AdminField>

        {/* Devise */}
        <AdminField label={t('projects.transaction.currencyLabel')}>
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className="app-input"
          >
            {currencyOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
              ))}
          </select>
        </AdminField>

        {/* MÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©thode paiement */}
        <AdminField label={t('projects.transaction.paymentMethodLabelOptional')}>
          <input
            value={form.paymentMethod}
            onChange={(e) =>
              setForm({ ...form, paymentMethod: e.target.value })
            }
            className="app-input"
          />
        </AdminField>

        {/* Description */}
        <div className="sm:col-span-2">
          <textarea
            rows={2}
            placeholder={t('projects.transaction.descriptionPlaceholder')}
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            className="app-input"
          />
        </div>

        {/* Boutons */}
        <AdminActionsRow className="sm:col-span-2 mt-1 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-surface-main/80"
          >
            {t('projects.transaction.cancel')}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="app-btn-primary px-4 py-2 text-xs"
          >
            {loading
              ? t('projects.transaction.saving')
              : t('projects.transaction.save')}
          </button>
        </AdminActionsRow>
      </form>
    </div>
  );
}

/* ============================================================
   ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â§Ãƒâ€šÃ‚Â  Page principale : Administration des projets (Admin only)
   - ADMIN GLOBAL et MASTER (admin + scope)
   - AUCUN filtre geo cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© frontend : le backend est source de vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ritÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©
============================================================ */
export default function AdminProjectsPage() {
  const { formatNumber, formatDate } = useLocale();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [isAdmin, setIsAdmin] = useState(null);
  const [projects, setProjects] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openTrxProjectId, setOpenTrxProjectId] = useState(null);

  // ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€¦Ã‚Â½ Infos session (me)
  const [currentUser, setCurrentUser] = useState(null);

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

  // MASTER = admin + scope geo (dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©duction frontend)
  const isMaster = useMemo(() => isMasterUser(currentUser), [currentUser]);
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

  /* ============================================================
     ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“Ãƒâ€šÃ‚Â® VÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rification admin via /auth/me
     - MASTER passe comme admin (role backend = 'admin')
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

        const role = normalizeRole(user?.role);

        // IMPORTANT: MASTER est admin (role === 'admin')
        if (role !== 'admin') {
          navigate('/dashboard');
          return;
        }

        setCurrentUser(user);
        setIsAdmin(true);
      } catch (err) {
        console.error('ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€¦Ã¢â‚¬â„¢ Erreur /auth/me (AdminProjectsPage):', err);
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
     ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“Ãƒâ€šÃ‚Â¥ Chargement des agents (admin)
     - Aucune rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©gression: mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªme endpoint, mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªme param role=agent
     - IMPORTANT: le backend applique le scope automatiquement si MASTER
============================================================ */
  const loadAgents = useCallback(async () => {
    try {
      const { data } = await api.get('/users', {
        ...authHeaders,
        params: { role: 'agent' },
      });
      setAgents(data?.users || []);
    } catch (err) {
      console.error('ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€¦Ã¢â‚¬â„¢ Erreur chargement agents:', err);
      setAgents([]);
    }
  }, [authHeaders]);

  /* ============================================================
     ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€šÃ‚Â Chargement des projets
     - Aucun filtre geo ajoutÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© (backend applique scope)
============================================================ */
  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getProjects();
      setProjects(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€¦Ã¢â‚¬â„¢ Erreur chargement projets:', err);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ============================================================
     ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â Initialisation quand on sait qu'on est admin
============================================================ */
  useEffect(() => {
    if (!isAdmin) return;
    loadProjects();
    loadAgents();
  }, [isAdmin, loadProjects, loadAgents]);

  /* ============================================================
     ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“Ãƒâ€šÃ‚Â¤ Assignation agent au projet
     - Pas de logique "master" en rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´le
     - Backend gÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨re le scope (si MASTER, la liste d'agents est dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©jÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  scope)
============================================================ */
  async function handleAssign(projectId, agentId) {
    try {
      const toSend = agentId ? Number(agentId) : null;
      await assignAgentToProject(projectId, toSend);
      await loadProjects();
      notify(t('projects.alerts.assignSuccess'));
    } catch (err) {
      console.error('ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€¦Ã¢â‚¬â„¢ Erreur assignation agent:', err);
      notify(t('projects.alerts.assignError'));
    }
  }

  /* ============================================================
     ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾ Changement de statut
     - Aucun changement de payload destructif
     - NOTE: on conserve exactement les champs utilisÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s en prod
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

      // IMPORTANT: pas d'ajout countryId/regionId ici
      // Le backend applique le scope et gÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨re la sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©curitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©.
      await updateProject(projectId, payload);

      await loadProjects();
      notify(t('projects.alerts.statusUpdateSuccess'));
    } catch (err) {
      console.error('ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€¦Ã¢â‚¬â„¢ Erreur mise ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  jour statut:', err);
      notify(t('projects.alerts.statusUpdateError'));
    }
  }

  /* ============================================================
     ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â§Ãƒâ€šÃ‚Â® Application des filtres (locaux, sans geo)
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

    // Tri du plus rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cent au plus ancien
    arr.sort((a, b) => {
      const da = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });

    return arr;
  }, [projects, filters]);

  /* ============================================================
     ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€šÃ‚Â³ ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°cran de chargement avant de savoir si admin
============================================================ */
  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-main">
        <p className="text-text-muted text-lg animate-pulse">
          {t('adminProjects.loading')}
        </p>
      </div>
    );
  }

  /* ============================================================
     ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½Ãƒâ€šÃ‚Â¨ Rendu principal ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â Apple Light Premium
============================================================ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-main via-surface-card to-blue-50 px-3 sm:px-4 py-8 sm:py-10">
      <div className="max-w-7xl mx-auto bg-surface-card shadow-xl rounded-2xl border border-border/70 px-4 sm:px-8 py-6 sm:py-8">
        {/* HEADER */}
        <AdminPageHeader
          className="mb-6 md:items-end"
          actionsClassName="w-full sm:w-auto flex-col sm:flex-row gap-2"
          titleClassName="font-bold"
          title={t('adminProjects.title')}
          subtitle={t('adminProjects.subtitle')}
          meta={
            currentUser && (
              <div className="mt-2 text-xs text-text-muted">
                <span className="inline-flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full border border-border bg-surface-main text-text-secondary">
                    {isMaster
                      ? t('adminProjects.scope.badge.master')
                      : t('adminProjects.scope.badge.admin')}
                  </span>
                  {isMaster && (
                    <span className="text-text-muted">
                      {t('adminProjects.scope.perimeter')}
                      {currentUser?.countryId != null
                        ? ` ${t('adminProjects.scope.country', {
                            id: currentUser.countryId,
                          })}`
                        : ''}
                      {currentUser?.regionId != null
                        ? ` Ã‚Â· ${t('adminProjects.scope.region', {
                            id: currentUser.regionId,
                          })}`
                        : ''}
                    </span>
                  )}
                </span>
              </div>
            )
          }
          actions={
            <button
              onClick={loadProjects}
              disabled={loading}
              className="app-btn-primary w-full sm:w-auto px-4 py-2 text-sm shadow-sm text-center"
            >
              {loading
                ? t('adminProjects.buttons.refreshLoading')
                : t('adminProjects.buttons.refresh')}
            </button>
          }
        />

        {/* FILTRES */}
        <AdminFilterBar className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Recherche */}
            <AdminField label={t('adminProjects.filters.searchLabel')} className="md:col-span-2">
              <input
                value={filters.q}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, q: e.target.value }))
                }
                placeholder={t('adminProjects.filters.searchPlaceholder')}
                className="app-input"
              />
            </AdminField>

            {/* Statut */}
            <AdminField label={t('adminProjects.filters.statusLabel')}>
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, status: e.target.value }))
                }
                className="app-input"
              >
                <option value="all">
                  {t('adminProjects.filters.statusAll')}
                </option>
                {projectStatusOptions.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </AdminField>

            {/* Type */}
            <AdminField label={t('adminProjects.filters.typeLabel')}>
              <select
                value={filters.type}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, type: e.target.value }))
                }
                className="app-input"
              >
                <option value="all">
                  {t('adminProjects.filters.typeAll')}
                </option>
                {projectTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </AdminField>
          </div>

          {/* Bas des filtres */}
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-text-muted">
            <div>
              {t('adminProjects.filters.count', {
                count: filteredProjects.length,
                total: projects.length,
              })}
            </div>
            <button
              onClick={() => setFilters({ q: '', status: 'all', type: 'all' })}
              className="w-full sm:w-auto px-3 py-1.5 bg-surface-main/80 rounded-md hover:bg-surface-main font-medium text-text-secondary text-center transition"
            >
              {t('adminProjects.filters.reset')}
            </button>
          </div>
        </AdminFilterBar>

        {/* TABLEAU PROJETS */}
        <div className="overflow-x-auto border border-border rounded-xl shadow-sm bg-surface-card">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-main text-text-secondary border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                  {t('adminProjects.table.project')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                  {t('adminProjects.table.client')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                  {t('adminProjects.table.agent')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                  {t('adminProjects.table.status')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                  {t('adminProjects.table.actions')}
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredProjects.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center py-8 text-text-muted italic"
                  >
                    {t('adminProjects.list.empty')}
                  </td>
                </tr>
              ) : (
                filteredProjects.map((p) => {
                  const trxOpen = openTrxProjectId === p.id;

                  const budgetLabel = p.budget
                    ? `${formatNumber(p.budget)} ${t(
                        'projects.card.currency',
                        { defaultValue: 'XOF' }
                      )}`
                    : t('common.dash');

                  const clientName = p.client
                    ? `${p.client.firstName || ''} ${p.client.lastName || ''}`
                        .trim() ||
                      p.client.email ||
                      t('common.dash')
                    : t('common.dash');

                  const agentName = p.agent
                    ? `${p.agent.firstName || ''} ${p.agent.lastName || ''}`
                        .trim() ||
                      p.agent.email ||
                      t('projects.card.unassigned')
                    : t('projects.card.unassigned');

                  return (
                    <tr
                      key={p.id}
                      className="border-t border-border/70 hover:bg-surface-main/80 transition-colors"
                    >
                      {/* Projet : titre / type / budget / description courte */}
                      <td className="px-4 py-3 align-top max-w-xs md:max-w-sm">
                        <div className="font-semibold text-text-primary break-words">
                          {p.title || t('projects.itemFallback', { id: p.id })}
                        </div>
                        <div className="mt-1 text-xs text-text-muted flex flex-wrap gap-2 items-center">
                          <span className="app-badge app-badge-info">
                            {p.type
                              ? getProjectTypeLabel(p.type)
                              : t('projects.type.unknown')}
                          </span>
                          <span className="text-[11px] text-text-muted">
                            {t('adminProjects.list.budgetLabel')}{' '}
                            <strong>{budgetLabel}</strong>
                          </span>
                          {p.createdAt && (
                            <span className="text-[11px] text-text-muted">
                              {t('adminProjects.list.createdAt')}{' '}
                              {formatDate(p.createdAt)}
                            </span>
                          )}
                        </div>
                        {p.description && (
                          <p className="mt-2 text-xs text-text-secondary break-words line-clamp-2">
                            {p.description}
                          </p>
                        )}
                      </td>

                      {/* Client */}
                      <td className="px-4 py-3 align-top max-w-[200px] break-words text-text-primary text-sm">
                        {clientName}
                      </td>

                      {/* Agent */}
                      <td className="px-4 py-3 align-top max-w-[200px] break-words text-text-primary text-sm">
                        {agentName}
                      </td>

                      {/* Statut */}
                      <td className="px-4 py-3 align-top">
                        <select
                          value={p.status || 'created'}
                          onChange={(e) =>
                            handleStatusChange(p.id, e.target.value)
                          }
                          className="app-input-compact w-full"
                        >
                          {projectStatusOptions.map((s) => (
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
                            onChange={(e) => handleAssign(p.id, e.target.value)}
                            className="app-input-compact"
                          >
                            <option value="">
                              {t('projects.actions.assignAgentPlaceholder')}
                            </option>
                            {agents.map((a) => (
                              <option key={a.id} value={a.id}>
                                {`${a.firstName || ''} ${a.lastName || ''}`
                                  .trim() || a.email}
                              </option>
                            ))}
                          </select>

                          {/* Transaction liÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e */}
                          <button
                            onClick={() =>
                              setOpenTrxProjectId(trxOpen ? null : p.id)
                            }
                            className={`text-xs sm:text-sm px-3 py-1.5 text-center ${
                              trxOpen ? 'app-btn-tonal-danger' : 'app-btn-tonal-success'
                            }`}
                          >
                            {trxOpen
                              ? t('adminProjects.actions.closeTransaction')
                              : t('adminProjects.actions.addTransaction')}
                          </button>

                          {/* Formulaire transaction liÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e */}
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






