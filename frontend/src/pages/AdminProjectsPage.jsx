// frontend/src/pages/AdminProjectsPage.jsx
// ============================================================================
// AdminProjectsPage.jsx — VERSION PRODUCTION READY (Apple Light PRO)
// Admin GLOBAL + MASTER (admin + geo scope) — ZÉRO RÉGRESSION
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
import {
  normalizeRole,
  isMasterUser,
} from '../utils/role';

/* ============================================================
   🔧 Typologies et statuts
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
   💰 Formulaire transaction projet (inchangé)
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

      alert(t('projects.transaction.alerts.createSuccess'));
      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error('❌ Erreur création transaction projet:', err);
      alert(
        err?.response?.data?.error ||
          err?.message ||
          t('projects.transaction.alerts.createError')
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-gray-50/80 border border-gray-200 rounded-xl p-4 mt-3 shadow-sm">
      <h4 className="text-sm font-semibold text-gray-900 mb-2 break-words">
        💰 {t('projects.transaction.titleFor')}{' '}
        <span className="font-bold text-slate-900">
          {project.title || t('projects.itemFallback', { id: project.id })}
        </span>
      </h4>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        {/* Type */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {t('projects.transaction.typeLabel')}
          </label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
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

        {/* Montant */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {t('projects.transaction.amountLabel')}
          </label>
          <input
            type="number"
            placeholder={t('projects.transaction.amountPlaceholder')}
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Devise */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {t('projects.transaction.currencyLabel')}
          </label>
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
          >
            {currencyOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Méthode paiement */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {t('projects.transaction.paymentMethodLabelOptional')}
          </label>
          <input
            value={form.paymentMethod}
            onChange={(e) =>
              setForm({ ...form, paymentMethod: e.target.value })
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Description */}
        <div className="sm:col-span-2">
          <textarea
            rows={2}
            placeholder={t('projects.transaction.descriptionPlaceholder')}
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Boutons */}
        <div className="sm:col-span-2 flex justify-end gap-2 mt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-200"
          >
            {t('projects.transaction.cancel')}
          </button>
          <button
            type="submit"
            disabled={loading}
            className={`px-4 py-2 text-xs font-semibold rounded-lg text-white ${
              loading ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading
              ? t('projects.transaction.saving')
              : `💾 ${t('projects.transaction.save')}`}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ============================================================
   🧠 Page principale : Administration des projets (Admin only)
   - ADMIN GLOBAL et MASTER (admin + scope)
   - AUCUN filtre geo côté frontend : le backend est source de vérité
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

  // 🔎 Infos session (me)
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

  // MASTER = admin + scope geo (déduction frontend)
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
     👮 Vérification admin via /auth/me
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
        console.error('❌ Erreur /auth/me (AdminProjectsPage):', err);
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
     👥 Chargement des agents (admin)
     - Aucune régression: même endpoint, même param role=agent
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
      console.error('❌ Erreur chargement agents:', err);
      setAgents([]);
    }
  }, [authHeaders]);

  /* ============================================================
     📁 Chargement des projets
     - Aucun filtre geo ajouté (backend applique scope)
============================================================ */
  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getProjects();
      setProjects(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('❌ Erreur chargement projets:', err);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ============================================================
     🔁 Initialisation quand on sait qu'on est admin
============================================================ */
  useEffect(() => {
    if (!isAdmin) return;
    loadProjects();
    loadAgents();
  }, [isAdmin, loadProjects, loadAgents]);

  /* ============================================================
     👤 Assignation agent au projet
     - Pas de logique "master" en rôle
     - Backend gère le scope (si MASTER, la liste d'agents est déjà scope)
============================================================ */
  async function handleAssign(projectId, agentId) {
    try {
      const toSend = agentId ? Number(agentId) : null;
      await assignAgentToProject(projectId, toSend);
      await loadProjects();
      alert(t('projects.alerts.assignSuccess'));
    } catch (err) {
      console.error('❌ Erreur assignation agent:', err);
      alert(t('projects.alerts.assignError'));
    }
  }

  /* ============================================================
     🔄 Changement de statut
     - Aucun changement de payload destructif
     - NOTE: on conserve exactement les champs utilisés en prod
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
      // Le backend applique le scope et gère la sécurité.
      await updateProject(projectId, payload);

      await loadProjects();
      alert(t('projects.alerts.statusUpdateSuccess'));
    } catch (err) {
      console.error('❌ Erreur mise à jour statut:', err);
      alert(t('projects.alerts.statusUpdateError'));
    }
  }

  /* ============================================================
     🧮 Application des filtres (locaux, sans geo)
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

    // Tri du plus récent au plus ancien
    arr.sort((a, b) => {
      const da = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });

    return arr;
  }, [projects, filters]);

  /* ============================================================
     ⏳ Écran de chargement avant de savoir si admin
============================================================ */
  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-500 text-lg animate-pulse">
          {t('adminProjects.loading')}
        </p>
      </div>
    );
  }

  /* ============================================================
     🎨 Rendu principal — Apple Light Premium
============================================================ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 px-3 sm:px-4 py-8 sm:py-10">
      <div className="max-w-7xl mx-auto bg-white shadow-xl rounded-2xl border border-gray-100 px-4 sm:px-8 py-6 sm:py-8">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 break-words">
              🧩 {t('adminProjects.title')}
            </h1>
            <p className="text-sm text-gray-600 mt-1 break-words">
              {t('adminProjects.subtitle')}
            </p>

            {/* ✅ Info scope (UX seulement, aucun filtre frontend) */}
            {currentUser && (
              <div className="mt-2 text-xs text-gray-500">
                <span className="inline-flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-700">
                    {isMaster
                      ? t('adminProjects.scope.badge.master')
                      : t('adminProjects.scope.badge.admin')}
                  </span>
                  {isMaster && (
                    <span className="text-gray-500">
                      {t('adminProjects.scope.perimeter')}
                      {currentUser?.countryId != null
                        ? ` ${t('adminProjects.scope.country', {
                            id: currentUser.countryId,
                          })}`
                        : ''}
                      {currentUser?.regionId != null
                        ? ` · ${t('adminProjects.scope.region', {
                            id: currentUser.regionId,
                          })}`
                        : ''}
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              onClick={loadProjects}
              disabled={loading}
              className={`w-full sm:w-auto px-4 py-2 text-sm font-semibold rounded-lg shadow-sm text-center transition ${
                loading
                  ? 'bg-blue-300 text-white cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
              }`}
            >
              {loading
                ? t('adminProjects.buttons.refreshLoading')
                : `🔄 ${t('adminProjects.buttons.refresh')}`}
            </button>
          </div>
        </div>

        {/* FILTRES */}
        <div className="mb-6 bg-gray-50/80 border border-gray-200 rounded-xl p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Recherche */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('adminProjects.filters.searchLabel')}
              </label>
              <input
                value={filters.q}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, q: e.target.value }))
                }
                placeholder={t('adminProjects.filters.searchPlaceholder')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Statut */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('adminProjects.filters.statusLabel')}
              </label>
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, status: e.target.value }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
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
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('adminProjects.filters.typeLabel')}
              </label>
              <select
                value={filters.type}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, type: e.target.value }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
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
            </div>
          </div>

          {/* Bas des filtres */}
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-gray-500">
            <div>
              {t('adminProjects.filters.count', {
                count: filteredProjects.length,
                total: projects.length,
              })}
            </div>
            <button
              onClick={() => setFilters({ q: '', status: 'all', type: 'all' })}
              className="w-full sm:w-auto px-3 py-1.5 bg-gray-200 rounded-md hover:bg-gray-300 font-medium text-gray-700 text-center transition"
            >
              {t('adminProjects.filters.reset')}
            </button>
          </div>
        </div>

        {/* TABLEAU PROJETS */}
        <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
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
                    className="text-center py-8 text-gray-500 italic"
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
                      className="border-t border-gray-100 hover:bg-gray-50/80 transition-colors"
                    >
                      {/* Projet : titre / type / budget / description courte */}
                      <td className="px-4 py-3 align-top max-w-xs md:max-w-sm">
                        <div className="font-semibold text-gray-900 break-words">
                          {p.title || t('projects.itemFallback', { id: p.id })}
                        </div>
                        <div className="mt-1 text-xs text-gray-500 flex flex-wrap gap-2 items-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                            {p.type
                              ? getProjectTypeLabel(p.type)
                              : t('projects.type.unknown')}
                          </span>
                          <span className="text-[11px] text-gray-500">
                            {t('adminProjects.list.budgetLabel')}{' '}
                            <strong>{budgetLabel}</strong>
                          </span>
                          {p.createdAt && (
                            <span className="text-[11px] text-gray-400">
                              {t('adminProjects.list.createdAt')}{' '}
                              {formatDate(p.createdAt)}
                            </span>
                          )}
                        </div>
                        {p.description && (
                          <p className="mt-2 text-xs text-gray-600 break-words line-clamp-2">
                            {p.description}
                          </p>
                        )}
                      </td>

                      {/* Client */}
                      <td className="px-4 py-3 align-top max-w-[200px] break-words text-gray-800 text-sm">
                        {clientName}
                      </td>

                      {/* Agent */}
                      <td className="px-4 py-3 align-top max-w-[200px] break-words text-gray-800 text-sm">
                        {agentName}
                      </td>

                      {/* Statut */}
                      <td className="px-4 py-3 align-top">
                        <select
                          value={p.status || 'created'}
                          onChange={(e) =>
                            handleStatusChange(p.id, e.target.value)
                          }
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-blue-500"
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
                            className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-blue-500"
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

                          {/* Transaction liée */}
                          <button
                            onClick={() =>
                              setOpenTrxProjectId(trxOpen ? null : p.id)
                            }
                            className={`text-xs sm:text-sm font-medium px-3 py-1.5 rounded-lg transition text-center ${
                              trxOpen
                                ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            {trxOpen
                              ? t('adminProjects.actions.closeTransaction')
                              : t('adminProjects.actions.addTransaction')}
                          </button>

                          {/* Formulaire transaction liée */}
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

