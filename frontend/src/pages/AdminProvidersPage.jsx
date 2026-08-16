// frontend/src/pages/AdminProvidersPage.jsx
// Onboarding admin des prestataires Teranga Pro (docs/DEV_SPEC_TERANGA_v3.md section 3/6) :
// un admin/master cree en une soumission le compte (role='provider') PUIS la fiche Provider
// (entreprise ou ouvrier independant), et fait progresser le statut pending -> probation -> active.
// Une fois actif, le prestataire devient assignable depuis AdminServicesPage pour les missions
// de sa filiere (executionType='provider').

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { me } from '../services/auth';
import { normalizeRole, isMasterUser } from '../utils/role';
import { notify } from '../utils/notify';
import { createUser } from '../services/users';
import { listProviders, createProvider, updateProviderStatus } from '../services/providers';
import { listTradeCategoriesAdmin } from '../services/tradeCategories';
import { AdminField, AdminPageHeader } from '../components/admin/AdminFormUi';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STATUS_VALUES = ['pending', 'probation', 'active', 'suspended', 'revoked'];

// Disponibilité déclarative (docs/DEV_SPEC_TERANGA_v5_PHASE2.md §3) — affichée seulement pour les
// prestataires couvrant la filière Mobilité (badge inline dans la colonne filières).
const AVAILABILITY_BADGE_TONE = {
  available: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  busy: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  offline: 'bg-surface-main text-text-muted border border-border',
};

// Miroir de backend/src/constants/providerStatus.js (PROVIDER_STATUS_TRANSITIONS) — pas de
// module partage front/back dans ce repo, meme convention que AdminServicesPage (etats de mission
// dupliques cote UI).
const STATUS_TRANSITIONS = {
  pending: ['probation', 'revoked'],
  probation: ['active', 'revoked'],
  active: ['suspended', 'revoked'],
  suspended: ['active', 'revoked'],
  revoked: [],
};

const TRANSITION_LABEL_KEY = {
  probation: 'toProbation',
  active: 'toActive',
  suspended: 'toSuspended',
  revoked: 'toRevoked',
};

const INITIAL_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  phone: '',
  country: '',
  type: 'independent',
  legalName: '',
  rccmNumber: '',
  displayFirstName: '',
  businessPhone: '',
  businessEmail: '',
  hasLiabilityInsurance: false,
  insuranceExpiresAt: '',
  plateNumber: '',
  circulationCardNumber: '',
  circulationCardVerified: false,
  tradeCategoryIds: [],
};

export default function AdminProvidersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(null);
  const [isMaster, setIsMaster] = useState(false);

  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [creating, setCreating] = useState(false);

  const [tradeCategories, setTradeCategories] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [transitioningId, setTransitioningId] = useState(null);

  /* ============================================================
     Garde d'acces : admin uniquement (couvre master ET super admin,
     meme garde qu'AdminServicesPage/AdminAgentsPage).
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

  const loadTradeCategories = useCallback(async () => {
    try {
      // listTradeCategoriesAdmin() (auth) plutôt que le catalogue public : renvoie les filières
      // globales + celles du périmètre du master connecté (jamais celles d'un autre pays/région,
      // voir tradeCategory.controller.js listForAdmin) — filtré aux actives ici, la page de
      // gestion (AdminTradeCategoriesPage) reste seule à afficher les inactives.
      const list = await listTradeCategoriesAdmin();
      setTradeCategories((list || []).filter((tc) => tc.isActive));
    } catch (err) {
      console.error('AdminProvidersPage load trade categories error:', err);
      setTradeCategories([]);
    }
  }, []);

  const loadProviders = useCallback(async () => {
    setLoadingProviders(true);
    try {
      const params = statusFilter === 'all' ? {} : { status: statusFilter };
      const list = await listProviders(params);
      setProviders(list);
    } catch (err) {
      console.error('AdminProvidersPage load providers error:', err);
      setProviders([]);
    } finally {
      setLoadingProviders(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (isAdmin) loadTradeCategories();
  }, [isAdmin, loadTradeCategories]);

  useEffect(() => {
    if (isAdmin) loadProviders();
  }, [isAdmin, loadProviders]);

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function toggleTradeCategory(id) {
    setForm((prev) => {
      const has = prev.tradeCategoryIds.includes(id);
      return {
        ...prev,
        tradeCategoryIds: has
          ? prev.tradeCategoryIds.filter((x) => x !== id)
          : [...prev.tradeCategoryIds, id],
      };
    });
    setErrors((prev) => ({ ...prev, tradeCategoryIds: undefined }));
  }

  function validate() {
    const e = {};

    if (!form.firstName.trim()) e.firstName = t('adminProvidersPage.validation.firstNameRequired');
    if (!form.lastName.trim()) e.lastName = t('adminProvidersPage.validation.lastNameRequired');

    const email = form.email.trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) e.email = t('adminProvidersPage.validation.emailInvalid');

    if (!form.password || String(form.password).length < 6) {
      e.password = t('adminProvidersPage.validation.passwordRequired');
    }

    const country = (form.country || '').trim().toUpperCase();
    if (!country || country.length !== 2) {
      e.country = t('adminProvidersPage.validation.countryInvalid');
    }

    if (!form.displayFirstName.trim()) {
      e.displayFirstName = t('adminProvidersPage.validation.displayFirstNameRequired');
    }
    if (!form.businessPhone.trim()) {
      e.businessPhone = t('adminProvidersPage.validation.businessPhoneRequired');
    }

    if (form.type === 'company') {
      if (!form.legalName.trim()) {
        e.legalName = t('adminProvidersPage.validation.legalNameRequired');
      }
      if (!form.rccmNumber.trim()) {
        e.rccmNumber = t('adminProvidersPage.validation.rccmNumberRequired');
      }
    }

    if (form.tradeCategoryIds.length === 0) {
      e.tradeCategoryIds = t('adminProvidersPage.validation.tradeCategoriesRequired');
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    setCreating(true);

    let newUser = null;
    try {
      newUser = await createUser({
        email: form.email.trim().toLowerCase(),
        password: String(form.password),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || undefined,
        country: form.country.trim().toUpperCase(),
        role: 'provider',
      });
    } catch (err) {
      console.error('AdminProvidersPage create user error:', err);
      notify(err?.response?.data?.error || t('adminProvidersPage.alerts.createUserError'));
      setCreating(false);
      return;
    }

    try {
      await createProvider({
        userId: newUser.id,
        type: form.type,
        legalName: form.type === 'company' ? form.legalName.trim() : undefined,
        displayFirstName: form.displayFirstName.trim(),
        rccmNumber: form.type === 'company' ? form.rccmNumber.trim() : undefined,
        phoneNumber: form.businessPhone.trim(),
        email: form.businessEmail.trim() || undefined,
        countryCode: form.country.trim().toUpperCase(),
        hasLiabilityInsurance: form.hasLiabilityInsurance,
        insuranceExpiresAt: form.insuranceExpiresAt || null,
        plateNumber: form.plateNumber || null,
        circulationCardNumber: form.circulationCardNumber || null,
        circulationCardVerified: form.circulationCardVerified,
        tradeCategoryIds: form.tradeCategoryIds,
      });

      notify.success(t('adminProvidersPage.alerts.createSuccess'));
      setForm(INITIAL_FORM);
      setErrors({});
      await loadProviders();
    } catch (err) {
      console.error('AdminProvidersPage create provider profile error:', err);
      notify(
        t('adminProvidersPage.alerts.createProfileError', {
          userId: newUser.id,
          error: err?.response?.data?.error || err.message,
        })
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleStatusTransition(provider, nextStatus) {
    setTransitioningId(provider.id);
    try {
      await updateProviderStatus(provider.id, nextStatus);
      notify.success(t('adminProvidersPage.alerts.statusUpdateSuccess'));
      await loadProviders();
    } catch (err) {
      console.error('AdminProvidersPage status update error:', err);
      notify(err?.response?.data?.error || t('adminProvidersPage.alerts.statusUpdateError'));
    } finally {
      setTransitioningId(null);
    }
  }

  const statusFilterOptions = useMemo(
    () => [
      { value: 'all', label: t('adminProvidersPage.filters.statusAll') },
      ...STATUS_VALUES.map((s) => ({ value: s, label: t(`adminProvidersPage.status.${s}`) })),
    ],
    [t]
  );

  // Checklist chauffeur (docs/DEV_SPEC_TERANGA_v5_PHASE2.md §2) — affichée seulement si la
  // filière Mobilité est sélectionnée, condition à passer au statut 'active' côté backend.
  const coversMobilite = useMemo(
    () =>
      tradeCategories.some(
        (tc) => tc.slug === 'mobilite' && form.tradeCategoryIds.includes(tc.id)
      ),
    [tradeCategories, form.tradeCategoryIds]
  );

  function statusBadgeClass(status) {
    switch (status) {
      case 'active':
        return 'app-badge app-badge-success';
      case 'pending':
        return 'bg-surface-main/80 text-text-secondary border border-border';
      case 'probation':
        return 'app-badge app-badge-info';
      case 'suspended':
        return 'app-badge app-badge-warning';
      case 'revoked':
        return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30';
      default:
        return 'bg-surface-main text-text-secondary border border-border';
    }
  }

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-main">
        <p className="text-text-muted text-lg animate-pulse">{t('adminProvidersPage.loading')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-3 sm:px-4 py-8 sm:py-10">
      <div className="max-w-6xl mx-auto bg-surface-card/90 backdrop-blur-sm shadow-xl rounded-2xl border border-border/70 px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <AdminPageHeader
          title={t('adminProvidersPage.title')}
          subtitle={t('adminProvidersPage.subtitle')}
          subtitleClassName="max-w-2xl text-text-muted"
          meta={
            currentUser && (
              <div className="pt-2 text-xs text-text-muted">
                <span className="px-2 py-0.5 rounded-full border border-border bg-surface-card text-text-secondary">
                  {isMaster
                    ? t('adminProvidersPage.badges.master')
                    : t('adminProvidersPage.badges.admin')}
                </span>
              </div>
            )
          }
          actionsClassName="justify-start sm:justify-end"
          actions={
            <button
              onClick={loadProviders}
              disabled={loadingProviders}
              className="app-btn-primary inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-full shadow-sm"
            >
              {loadingProviders
                ? t('adminProvidersPage.loading')
                : t('adminProvidersPage.buttons.refresh')}
            </button>
          }
        />

        {/* ================= FORMULAIRE ================= */}
        <form
          onSubmit={handleSubmit}
          className="mb-10 space-y-6 bg-surface-main border border-border rounded-2xl p-6 shadow-sm"
        >
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              {t('adminProvidersPage.account.title')}
            </h2>
            <p className="text-xs text-text-muted mt-1">{t('adminProvidersPage.account.hint')}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <AdminField label={t('adminProvidersPage.form.firstNameLabel')}>
                <input
                  className="app-input"
                  value={form.firstName}
                  onChange={(e) => handleChange('firstName', e.target.value)}
                />
              </AdminField>
              {errors.firstName && <p className="text-xs text-rose-600 -mt-3">{errors.firstName}</p>}

              <AdminField label={t('adminProvidersPage.form.lastNameLabel')}>
                <input
                  className="app-input"
                  value={form.lastName}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                />
              </AdminField>
              {errors.lastName && <p className="text-xs text-rose-600 -mt-3">{errors.lastName}</p>}

              <AdminField label={t('adminProvidersPage.form.emailLabel')}>
                <input
                  type="email"
                  className="app-input"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                />
              </AdminField>
              {errors.email && <p className="text-xs text-rose-600 -mt-3">{errors.email}</p>}

              <AdminField label={t('adminProvidersPage.form.passwordLabel')}>
                <input
                  type="password"
                  className="app-input"
                  value={form.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                />
              </AdminField>
              {errors.password && <p className="text-xs text-rose-600 -mt-3">{errors.password}</p>}

              <AdminField label={t('adminProvidersPage.form.phoneLabel')}>
                <input
                  className="app-input"
                  value={form.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                />
              </AdminField>

              <AdminField label={t('adminProvidersPage.form.countryLabel')}>
                <input
                  className="app-input"
                  maxLength={2}
                  value={form.country}
                  onChange={(e) => handleChange('country', e.target.value.toUpperCase().slice(0, 2))}
                />
              </AdminField>
              {errors.country && <p className="text-xs text-rose-600 -mt-3">{errors.country}</p>}
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <h2 className="text-lg font-semibold text-text-primary">
              {t('adminProvidersPage.profile.title')}
            </h2>
            <p className="text-xs text-text-muted mt-1">{t('adminProvidersPage.profile.hint')}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <AdminField label={t('adminProvidersPage.form.typeLabel')}>
                <select
                  className="app-input"
                  value={form.type}
                  onChange={(e) => handleChange('type', e.target.value)}
                >
                  <option value="independent">{t('adminProvidersPage.form.typeIndependent')}</option>
                  <option value="company">{t('adminProvidersPage.form.typeCompany')}</option>
                </select>
              </AdminField>

              <AdminField label={t('adminProvidersPage.form.displayFirstNameLabel')}>
                <input
                  className="app-input"
                  value={form.displayFirstName}
                  onChange={(e) => handleChange('displayFirstName', e.target.value)}
                />
              </AdminField>
              {errors.displayFirstName && (
                <p className="text-xs text-rose-600 -mt-3">{errors.displayFirstName}</p>
              )}

              {form.type === 'company' && (
                <>
                  <AdminField label={t('adminProvidersPage.form.legalNameLabel')}>
                    <input
                      className="app-input"
                      value={form.legalName}
                      onChange={(e) => handleChange('legalName', e.target.value)}
                    />
                  </AdminField>
                  {errors.legalName && <p className="text-xs text-rose-600 -mt-3">{errors.legalName}</p>}

                  <AdminField label={t('adminProvidersPage.form.rccmNumberLabel')}>
                    <input
                      className="app-input"
                      value={form.rccmNumber}
                      onChange={(e) => handleChange('rccmNumber', e.target.value)}
                    />
                  </AdminField>
                  {errors.rccmNumber && (
                    <p className="text-xs text-rose-600 -mt-3">{errors.rccmNumber}</p>
                  )}
                </>
              )}

              <AdminField label={t('adminProvidersPage.form.businessPhoneLabel')}>
                <input
                  className="app-input"
                  value={form.businessPhone}
                  onChange={(e) => handleChange('businessPhone', e.target.value)}
                />
              </AdminField>
              {errors.businessPhone && (
                <p className="text-xs text-rose-600 -mt-3">{errors.businessPhone}</p>
              )}

              <AdminField label={t('adminProvidersPage.form.businessEmailLabel')}>
                <input
                  type="email"
                  className="app-input"
                  value={form.businessEmail}
                  onChange={(e) => handleChange('businessEmail', e.target.value)}
                />
              </AdminField>

              <AdminField label={t('adminProvidersPage.form.insuranceExpiresAtLabel')}>
                <input
                  type="date"
                  className="app-input"
                  value={form.insuranceExpiresAt}
                  onChange={(e) => handleChange('insuranceExpiresAt', e.target.value)}
                />
              </AdminField>

              <div className="flex items-end pb-1">
                <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={form.hasLiabilityInsurance}
                    onChange={(e) => handleChange('hasLiabilityInsurance', e.target.checked)}
                    className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
                  />
                  <span>{t('adminProvidersPage.form.hasLiabilityInsuranceLabel')}</span>
                </label>
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-2 block text-xs font-medium text-text-secondary">
                {t('adminProvidersPage.form.tradeCategoriesLabel')}
              </p>
              {tradeCategories.length === 0 ? (
                <p className="text-xs text-text-muted italic">
                  {t('adminProvidersPage.form.tradeCategoriesEmpty')}{' '}
                  <Link
                    to="/admin/trade-categories"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="not-italic text-blue-600 underline hover:text-blue-700 dark:text-blue-400"
                  >
                    {t('adminProvidersPage.form.tradeCategoriesEmptyLink')}
                  </Link>
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {tradeCategories.map((tc) => {
                    const checked = form.tradeCategoryIds.includes(tc.id);
                    return (
                      <label
                        key={tc.id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition ${
                          checked
                            ? 'bg-blue-600/10 border-blue-500 text-blue-700 dark:text-blue-300'
                            : 'bg-surface-card border-border text-text-secondary hover:bg-surface-main'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={checked}
                          onChange={() => toggleTradeCategory(tc.id)}
                        />
                        {tc.name}
                        {tc.requiresCompany ? ' 🏢' : ''}
                        {tc.region?.name
                          ? ` · ${tc.region.name}`
                          : tc.country?.isoCode
                          ? ` · ${tc.country.isoCode}`
                          : ''}
                      </label>
                    );
                  })}
                </div>
              )}
              {errors.tradeCategoryIds && (
                <p className="text-xs text-rose-600 mt-1">{errors.tradeCategoryIds}</p>
              )}
            </div>

            {coversMobilite ? (
              <div className="mt-4 grid grid-cols-1 gap-4 rounded-xl border border-border bg-surface-main/60 p-4 sm:grid-cols-3">
                <p className="sm:col-span-3 text-xs font-medium text-text-secondary">
                  {t('adminProvidersPage.form.driverChecklistTitle')}
                </p>
                <AdminField label={t('adminProvidersPage.form.plateNumberLabel')}>
                  <input
                    type="text"
                    className="app-input"
                    value={form.plateNumber}
                    onChange={(e) => handleChange('plateNumber', e.target.value)}
                  />
                </AdminField>
                <AdminField label={t('adminProvidersPage.form.circulationCardNumberLabel')}>
                  <input
                    type="text"
                    className="app-input"
                    value={form.circulationCardNumber}
                    onChange={(e) => handleChange('circulationCardNumber', e.target.value)}
                  />
                </AdminField>
                <div className="flex items-end pb-1">
                  <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={form.circulationCardVerified}
                      onChange={(e) => handleChange('circulationCardVerified', e.target.checked)}
                      className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
                    />
                    <span>{t('adminProvidersPage.form.circulationCardVerifiedLabel')}</span>
                  </label>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className={`px-6 py-2.5 rounded-full shadow-sm text-white text-sm font-medium transition ${
                creating ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {creating
                ? t('adminProvidersPage.buttons.creating')
                : t('adminProvidersPage.buttons.createProvider')}
            </button>
          </div>
        </form>

        {/* ================= LISTE ================= */}
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-xl font-semibold text-text-primary">
            {t('adminProvidersPage.table.title')}
          </h2>
          <AdminField label={t('adminProvidersPage.filters.statusLabel')} className="w-full sm:w-56">
            <select
              className="app-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {statusFilterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </AdminField>
        </div>

        {loadingProviders ? (
          <p className="text-center text-text-muted italic py-6">
            {t('adminProvidersPage.loadingProviders')}
          </p>
        ) : providers.length === 0 ? (
          <p className="text-center text-text-muted italic py-6">
            {t('adminProvidersPage.table.empty')}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface-card shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-main/80 text-text-secondary">
                <tr>
                  <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                    {t('adminProvidersPage.table.headers.name')}
                  </th>
                  <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                    {t('adminProvidersPage.table.headers.account')}
                  </th>
                  <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                    {t('adminProvidersPage.table.headers.tradeCategories')}
                  </th>
                  <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                    {t('adminProvidersPage.table.headers.status')}
                  </th>
                  <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                    {t('adminProvidersPage.table.headers.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {providers.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-main/70 transition-colors">
                    <td className="px-4 sm:px-5 py-3 align-top">
                      <div className="font-medium text-text-primary break-words">
                        {p.displayFirstName}
                      </div>
                      <div className="mt-0.5 text-xs text-text-muted">
                        {p.type === 'company'
                          ? t('adminProvidersPage.table.typeCompany')
                          : t('adminProvidersPage.table.typeIndependent')}
                      </div>
                    </td>
                    <td className="px-4 sm:px-5 py-3 align-top text-text-secondary break-words">
                      {p.user?.email || t('adminProvidersPage.table.emptyValue')}
                    </td>
                    <td className="px-4 sm:px-5 py-3 align-top text-text-secondary">
                      {Array.isArray(p.tradeCategories) && p.tradeCategories.length > 0
                        ? p.tradeCategories.map((tc) => tc.name).join(', ')
                        : t('adminProvidersPage.table.emptyValue')}
                      {Array.isArray(p.tradeCategories) && p.tradeCategories.some((tc) => tc.slug === 'mobilite') ? (
                        <div className="mt-1">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              AVAILABILITY_BADGE_TONE[p.availabilityStatus] || AVAILABILITY_BADGE_TONE.offline
                            }`}
                          >
                            {t(`adminProvidersPage.availability.${p.availabilityStatus || 'offline'}`)}
                          </span>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 sm:px-5 py-3 align-top">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium ${statusBadgeClass(
                          p.status
                        )}`}
                      >
                        {t(`adminProvidersPage.status.${p.status}`, { defaultValue: p.status })}
                      </span>
                    </td>
                    <td className="px-4 sm:px-5 py-3 align-top">
                      <div className="flex flex-wrap gap-1.5">
                        {(STATUS_TRANSITIONS[p.status] || []).map((next) => (
                          <button
                            key={next}
                            type="button"
                            disabled={transitioningId === p.id}
                            onClick={() => handleStatusTransition(p, next)}
                            className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-500/10 dark:text-blue-300 disabled:opacity-50"
                          >
                            {t(`adminProvidersPage.actions.${TRANSITION_LABEL_KEY[next]}`)}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
