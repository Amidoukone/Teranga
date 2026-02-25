// frontend/src/pages/ServicesPage.jsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { me, getAuthHeader } from '../services/auth';
import { getMyServices, createService } from '../services/services';
import { getProperties } from '../services/properties';
import { applyLabels, SERVICE_TYPES, SERVICE_STATUSES } from '../utils/labels';
import PaginationBar from '../components/PaginationBar';
import { useLocale } from '../i18n/useLocale';
import { useTranslation } from 'react-i18next';
import { useDeleteConfirm } from '../hooks/useDeleteConfirm';

const DEFAULT_FILTERS = {
  q: '',
  type: '',
  status: '',
  property: '',
  sort: '-createdAt',
};

/* ============================================================
   ?? Page Services ï¿½ Premium Pro 2025 (responsive & production-ready)
   - Gestion des services (client + admin/master)
   - Crï¿½ation / ï¿½dition / suppression
   - Filtres avancï¿½s + tri
   ? Multi-pays MASTER: UI uniquement (backend applique le scope)
============================================================ */
export default function ServicesPage() {
  const { t } = useTranslation();
  const { confirmDelete } = useDeleteConfirm();
  const [services, setServices] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [properties, setProperties] = useState([]);
  const [clients, setClients] = useState([]);
  const [user, setUser] = useState(null);
  const [notice, setNotice] = useState(null);

  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [showForm, setShowForm] = useState(() => {
    const saved = localStorage.getItem('teranga_services_showForm');
    return saved === null ? true : saved === '1';
  });

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [pagination, setPagination] = useState({ page: 1, limit: 8, total: 0 });

  const navigate = useNavigate();

  const [form, setForm] = useState({
    clientId: '',
    propertyId: '',
    type: 'other',
    title: '',
    description: '',
    contactPerson: '',
    contactPhone: '',
    address: '',
    budget: '',
  });

/* ==========================================
   ? Helpers MASTER (frontend-only)
   MASTER = admin avec scope (countryId || regionId)
========================================== */
const isMasterUser = useCallback((u) => {
  if (!u) return false;
  return u.role === 'admin' && (u.countryId != null || u.regionId != null);
}, []);

const roleVariant = useMemo(() => {
  if (!user) return '';
  if (user.role === 'admin') return isMasterUser(user) ? 'master' : 'admin';
  if (user.role === 'agent') return 'agent';
  return 'client';
}, [user, isMasterUser]);

  const roleLabel = useMemo(() => {
    if (!user) return '';
    if (user.role === 'admin') return isMasterUser(user) ? t("roles.master") : t("roles.admin");
    if (user.role === 'agent') return t("roles.agent");
    return t("roles.client");
  }, [user, isMasterUser, t]);

  const resetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
  }, []);

  const hasActiveFilters = useMemo(() => {
    return (
      Boolean(filters.q?.trim()) ||
      Boolean(filters.type) ||
      Boolean(filters.status) ||
      Boolean(filters.property) ||
      filters.sort !== DEFAULT_FILTERS.sort
    );
  }, [filters]);


  /* ==========================================
     ? Auth headers
  ========================================== */
  const authHeaders = useMemo(() => {
    return { headers: getAuthHeader() };
  }, []);

  /* ==========================================
     ?? Loaders
  ========================================== */
  const loadServices = useCallback(async () => {
    try {
      const params = {
        page,
        limit: pageSize,
        q: filters.q?.trim() || undefined,
        type: filters.type || undefined,
        status: filters.status || undefined,
        propertyId: filters.property || undefined,
        sort: filters.sort || undefined,
      };

      const res = await getMyServices(params, { withPagination: true });
      const list = Array.isArray(res?.items)
        ? res.items
        : Array.isArray(res)
        ? res
        : res?.services || [];

 // Toujours recalculer les labels via i18n (i12vite les labels FR renvoyi12s par le backend)
      const enriched = list.map((s) => applyLabels(s, 'service'));

      setServices(enriched);
      setFiltered(enriched);

      const pg = res?.pagination || null;
      setPagination(
        pg
          ? {
              page: pg.page ?? page,
              limit: pg.limit ?? pageSize,
              total: pg.total ?? pg.count ?? enriched.length,
            }
          : { page, limit: pageSize, total: enriched.length }
      );
    } catch (e) {
      console.error('INFO Load services:', e);
      setNotice({
        type: 'error',
        message: e?.response?.data?.error || t("services.alerts.loadError"),
      });
      setServices([]);
      setFiltered([]);
      setPagination({ page, limit: pageSize, total: 0 });
    }
  }, [filters, page, pageSize, t]);

  const loadClientProperties = useCallback(
    async (clientId) => {
      try {
        if (!clientId) {
          setProperties([]);
          return;
        }
        const { data } = await api.get(
          `/properties?clientId=${clientId}`,
          authHeaders
        );
        setProperties(data.properties || []);
      } catch (e) {
        console.error('INFO Erreur chargement biens client:', e);
        setNotice({
          type: 'error',
          message: t("services.alerts.loadClientPropertiesError"),
        });
      }
    },
    [authHeaders, t]
  );

  const loadMyProperties = useCallback(async () => {
    try {
      const props = await getProperties();
      setProperties(Array.isArray(props) ? props : props?.properties || []);
    } catch (e) {
      console.error('INFO Load properties (me):', e);
      setNotice({
        type: 'error',
        message: t("services.alerts.loadPropertiesError"),
      });
    }
  }, [t]);

  const loadClients = useCallback(async () => {
    try {
      // INFO backend filtre automatiquement via scope (admin global = tous, master = scope)
      const { data } = await api.get('/users?role=client', authHeaders);
      setClients(data.users || []);
    } catch (e) {
      console.error('INFO Erreur chargement clients:', e);
      setClients([]);
    }
  }, [authHeaders]);

  /* ==========================================
     ?? Initialisation
  ========================================== */
  useEffect(() => {
    async function init() {
      try {
        const { user: u } = await me();
        if (!u) {
          navigate('/login');
          return;
        }

        // Cette page = client + admin (donc admin global + master)
        if (!['client', 'admin'].includes(u.role)) {
          navigate('/dashboard');
          return;
        }

        setUser(u);

        // INFO admin global OU master (toujours role=admin, scope gINFOrINFO cINFOtINFO backend)
        if (u.role === 'admin') {
          await loadClients();
        } else {
          await loadMyProperties();
        }
      } catch (err) {
        console.error('INFO Erreur init ServicesPage:', err);
        navigate('/login');
      }
    }
    init();
  }, [loadClients, loadMyProperties, navigate]);

  useEffect(() => {
    if (!user) return;
    loadServices();
  }, [user, loadServices]);

 // Lorsqui12un admin/master choisit un client, charger ses biens
  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    if (form.clientId) {
      loadClientProperties(form.clientId);
    } else {
      setProperties([]);
    }
  }, [form.clientId, user, loadClientProperties]);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    if (!form.propertyId) return;
    const exists = properties.some(
      (p) => String(p.id) === String(form.propertyId)
    );
    if (!exists) {
      setForm((prev) => ({ ...prev, propertyId: '' }));
    }
  }, [properties, form.propertyId, user]);

 // Persister li12i12tat di12affichage du formulaire
  useEffect(() => {
    localStorage.setItem('teranga_services_showForm', showForm ? '1' : '0');
  }, [showForm]);

  /* ==========================================
     ?? Handlers CRUD
  ========================================== */
  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setNotice(null);
      setLoading(true);

      // INFO IMPORTANT: ne pas injecter countryId/regionId ici
      // Backend applique le scope sur base de req.user
      const payload = { ...form };

      // INFOINFO si12curiti12 UI: admin/master => clientId obligatoire (backend li12exige)
      if (user?.role === 'admin' && !payload.clientId) {
        setNotice({
          type: 'error',
          message: t("services.alerts.selectClient"),
        });
        return;
      }

      if (payload.propertyId) {
        const propertyExists = properties.some(
          (p) => String(p.id) === String(payload.propertyId)
        );
        if (!propertyExists) {
          setNotice({
            type: 'error',
            message: t("services.alerts.propertyOutdated"),
          });
          return;
        }
      }

      await createService(payload);
      setNotice({
        type: 'success',
        message: t("services.alerts.createSuccess"),
      });
      resetForm();
      await loadServices();

      if (user?.role === 'admin' && form.clientId) {
        await loadClientProperties(form.clientId);
      } else {
        await loadMyProperties();
      }
    } catch (e) {
      console.error('INFO createService:', e);
      setNotice({
        type: 'error',
        message: e?.response?.data?.error || t("services.alerts.createError"),
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(e) {
    e.preventDefault();
    try {
      setNotice(null);
      setLoading(true);

      if (!editingId) {
        setNotice({
          type: 'error',
          message: t("services.alerts.noEditTarget"),
        });
        return;
      }

      const payload = {
        title: form.title,
        description: form.description,
        contactPerson: form.contactPerson,
        contactPhone: form.contactPhone,
        address: form.address,
        budget: form.budget === '' ? null : parseFloat(form.budget),
        type: form.type,
        propertyId: form.propertyId ? parseInt(form.propertyId, 10) : null,
      };

      // INFO admin/master: clientId autorisi12 si renseigni12 (backend supporte)
      if (user?.role === 'admin' && form.clientId) {
        payload.clientId = parseInt(form.clientId, 10);
      }

      await api.put(`/services/${editingId}`, payload, authHeaders);
      setNotice({
        type: 'success',
        message: t("services.alerts.updateSuccess"),
      });
      resetForm();
      setEditingId(null);
      await loadServices();
    } catch (e) {
      console.error('INFO Erreur mise i12 jour service:', e);
      setNotice({
        type: 'error',
        message: e?.response?.data?.error || t("services.alerts.updateError"),
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    const ok = await confirmDelete("service");
    if (!ok) return;
    try {
      await api.delete(`/services/${id}`, authHeaders);
      await loadServices();
      setNotice({
        type: 'success',
        message: t("services.alerts.deleteSuccess"),
      });
    } catch (e) {
      console.error('INFO Erreur suppression service:', e);
      setNotice({
        type: 'error',
        message: e?.response?.data?.error || t("services.alerts.deleteError"),
      });
    }
  }

  function startEdit(service) {
    setEditingId(service.id);
    setShowForm(true);
    setForm({
      clientId: service.client?.id || '',
      propertyId: service.property?.id || '',
      type: service.type || 'other',
      title: service.title || '',
      description: service.description || '',
      contactPerson: service.contactPerson || '',
      contactPhone: service.contactPhone || '',
      address: service.address || '',
      budget:
        service.budget === null || service.budget === undefined
          ? ''
          : service.budget,
    });
  }

  function resetForm() {
    setForm({
      clientId: '',
      propertyId: '',
      type: 'other',
      title: '',
      description: '',
      contactPerson: '',
      contactPhone: '',
      address: '',
      budget: '',
    });
    setEditingId(null);
  }
  /* ==========================================
     Pagination (server-side)
  ========================================== */
  const totalServices = useMemo(
    () => pagination?.total ?? pagination?.count ?? services.length,
    [pagination, services.length]
  );
  const emptyTitle = hasActiveFilters
    ? t("services.emptyFilteredTitle")
    : t("services.emptyTitle");
  const emptySubtitle = hasActiveFilters
    ? t("services.emptyFilteredSubtitle")
    : t("services.emptySubtitle");

  useEffect(() => {
    setPage(1);
  }, [filters.q, filters.type, filters.status, filters.property, filters.sort, pageSize]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalServices / pageSize));
    if (page > totalPages) setPage(totalPages);
  }, [totalServices, pageSize, page]);

  /* ==========================================
     UI principale
  ========================================== */
  return (
    <div className="app-page-wrap">
      <div className="app-page-shell overflow-hidden space-y-8">
        {/* HEADER */}
        <Header
          showForm={showForm}
          setShowForm={setShowForm}
          loading={loading}
          loadServices={loadServices}
          totalCount={totalServices}
          roleLabel={roleLabel}
          roleVariant={roleVariant}
          user={user}
        />

        {notice && (
          <div
            className={`app-alert flex gap-2 items-start ${
              notice.type === 'error'
                ? 'app-alert-error'
                : 'app-alert-success'
            }`}
          >
            <span className="mt-[1px]">
              {notice.type === 'error' ? '!' : 'i'}
            </span>
            <p className="break-words">{notice.message}</p>
          </div>
        )}

        {/* FILTRES */}
        <Filters
          filters={filters}
          setFilters={setFilters}
          properties={properties}
          filteredCount={totalServices}
          onReset={resetFilters}
        />

        {/* FORMULAIRE */}
        {showForm && (
          <ServiceForm
            user={user}
            clients={clients}
            form={form}
            setForm={setForm}
            editingId={editingId}
            handleSubmit={handleSubmit}
            handleUpdate={handleUpdate}
            resetForm={resetForm}
            loading={loading}
            properties={properties}
          />
        )}

        {/* LISTE DES SERVICES */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-lg sm:text-xl font-semibold text-text-primary break-words">
            {t("services.listTitle")}
          </h2>
          <span className="app-toolbar-pill">
            {t("services.listCount", { count: filtered.length })}
          </span>
        </div>

        <PaginationBar
          page={page}
          pageSize={pageSize}
          totalItems={totalServices}
          pageSizeOptions={[6, 12, 24]}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          className="mb-4"
        />

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border/70 bg-surface-card/70 py-10 text-center">
            <div className="app-icon-badge-info">
              <span className="text-xl">i</span>
            </div>
            <p className="mb-1 text-sm font-semibold text-text-primary">
              {emptyTitle}
            </p>
            <p className="max-w-sm text-xs text-text-secondary">
              {emptySubtitle}
            </p>
            <div className="mt-4 flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="app-btn-soft"
                >
                  {t("services.filters.reset")}
                </button>
              )}
              {!showForm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="app-btn-primary"
                >
                  {t("services.buttons.newService")}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {filtered.map((s) => (
              <ServiceCard
                key={s.id}
                s={s}
                user={user}
                startEdit={startEdit}
                handleDelete={handleDelete}
                navigate={navigate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   ?? HEADER (responsive, mobile-first, plus pro)
============================================================ */
function Header({ showForm, setShowForm, loading, loadServices, totalCount, roleLabel, roleVariant, user }) {
  const { t } = useTranslation();
  const scopeText = (() => {
    if (!user || user.role !== 'admin') return null;
    const c = user.countryId != null ? `countryId=${user.countryId}` : null;
    const r = user.regionId != null ? `regionId=${user.regionId}` : null;
    if (!c && !r) return null;
    return [c, r].filter(Boolean).join(' - ');
  })();

  return (
    <div className="flex flex-col gap-4 border-b border-border/70 pb-4 md:flex-row md:items-end md:justify-between">
      <div className="space-y-1 min-w-0">
        <p className="page-kicker">
          {t("services.kicker")}
        </p>
        <h1 className="app-page-headline break-words">
          {t("services.title")}
        </h1>
        <p className="app-page-subtitle">
          {t("services.subtitle")}
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="app-toolbar-pill inline-flex items-center gap-2">
            <span className="app-status-dot-success" />
            {t("services.totalCount", { count: totalCount })}
          </span>

          {roleLabel && (
            <span
              className={`inline-flex items-center gap-2 text-xs sm:text-sm px-3 py-1.5 rounded-full border ${
                roleVariant === 'master'
                  ? 'bg-surface-main text-text-secondary border-border'
                  : roleVariant === 'admin'
                  ? 'bg-surface-main text-text-secondary border-border'
                  : 'bg-surface-main text-text-secondary border-border'
              }`}
            >
              {roleLabel}
            </span>
          )}

          {!!scopeText && (
            <span className="inline-flex items-center rounded-full border border-border/80 bg-surface-card px-3 py-1.5 text-xs text-text-secondary sm:text-sm">
              {scopeText}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="app-btn-neutral w-full sm:w-auto"
        >
          {showForm ? t("services.buttons.hideForm") : t("services.buttons.newService")}
        </button>

        <button
          onClick={loadServices}
          disabled={loading}
          className="app-btn-primary w-full sm:w-auto rounded-lg px-4 py-2.5 text-sm"
        >
          {loading ? t("services.buttons.refreshLoading") : t("services.buttons.refresh")}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   ?? FILTRES (grid mobile-first, labels + meilleure lisibilitï¿½)
============================================================ */
function Filters({ filters, setFilters, properties, filteredCount, onReset }) {
  const { t } = useTranslation();
  return (
    <div className="mb-6 rounded-2xl border border-border/70 bg-surface-main/55 p-4 sm:p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Recherche */}
        <div className="col-span-1 sm:col-span-2 lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            {t("services.filters.searchLabel")}
          </label>
          <input
            placeholder={t("services.filters.searchPlaceholder")}
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
          />
        </div>

        {/* Type */}
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            {t("services.filters.typeLabel")}
          </label>
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
          >
            <option value="">{t("services.filters.typeAll")}</option>
            {Object.keys(SERVICE_TYPES).map((key) => (
              <option key={key} value={key}>
                {t(`services.type.${key}`)}
              </option>
            ))}
          </select>
        </div>

        {/* Statut */}
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            {t("services.filters.statusLabel")}
          </label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
          >
            <option value="">{t("services.filters.statusAll")}</option>
            {Object.keys(SERVICE_STATUSES).map((key) => (
              <option key={key} value={key}>
                {t(`services.status.${key}`)}
              </option>
            ))}
          </select>
        </div>

        {/* Bien */}
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            {t("services.filters.propertyLabel")}
          </label>
          <select
            value={filters.property}
            onChange={(e) => setFilters({ ...filters, property: e.target.value })}
            className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
          >
            <option value="">{t("services.filters.propertyAll")}</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} - {p.city}
              </option>
            ))}
          </select>
        </div>

        {/* Tri */}
        <div className="col-span-1 sm:col-span-2 lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            {t("services.filters.sortLabel")}
          </label>
          <select
            value={filters.sort}
            onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
            className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
          >
            <option value="-createdAt">{t("services.filters.sortNewest")}</option>
            <option value="createdAt">{t("services.filters.sortOldest")}</option>
            <option value="title">{t("services.filters.sortTitleAsc")}</option>
            <option value="-title">{t("services.filters.sortTitleDesc")}</option>
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="text-xs text-text-secondary sm:text-sm">
          {t("services.filters.filteredCount", { count: filteredCount })}
        </div>
        <button
          onClick={onReset}
          className="app-btn-soft w-full text-center sm:w-auto"
        >
          {t("services.filters.reset")}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   ?? FORMULAIRE DE CRï¿½ATION / ï¿½DITION
============================================================ */
function ServiceForm({
  user,
  clients,
  form,
  setForm,
  editingId,
  handleSubmit,
  handleUpdate,
  resetForm,
  loading,
  properties,
}) {
  const { t } = useTranslation();
  const isAdminOrMaster = user?.role === 'admin';

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h2 className="text-lg sm:text-xl font-semibold text-text-primary break-words">
          {editingId ? t("services.form.titleEdit") : t("services.form.titleCreate")}
        </h2>
        <p className="text-xs sm:text-sm text-text-secondary">
          {t("services.form.subtitle")}
        </p>
      </div>

      <form
        onSubmit={(e) => (editingId ? handleUpdate(e) : handleSubmit(e))}
        className="
          grid grid-cols-1 sm:grid-cols-2 gap-4
          bg-surface-main/55 p-4 sm:p-5 rounded-2xl border border-border/70
        "
      >
 {/* ADMIN/MASTER : si12lection client */}
        {isAdminOrMaster && (
          <div className="col-span-1 sm:col-span-2">
            <label className="block text-sm font-medium text-text-secondary mb-1">
              {t("services.form.clientLabel")} <span className="app-required">*</span>
            </label>
            <select
              value={form.clientId}
              onChange={(e) =>
                setForm({
                  ...form,
                  clientId: e.target.value,
                  propertyId: '',
                })
              }
              required
              className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
            >
              <option value="">{t("services.form.clientPlaceholder")}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName} ({c.email})
                </option>
              ))}
            </select>
          </div>
        )}

 {/* Biens i12 optionnel */}
        <div className="col-span-1 sm:col-span-2">
          <label className="block text-sm font-medium text-text-secondary mb-1">
            {t("services.form.propertyLabel")}
          </label>
          <select
            value={form.propertyId}
            onChange={(e) => setForm({ ...form, propertyId: e.target.value })}
            disabled={isAdminOrMaster && !form.clientId}
            className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary disabled:bg-surface-main/80"
          >
            <option value="">
              {isAdminOrMaster && !form.clientId
                ? t("services.form.propertyPlaceholderSelectClient")
                : t("services.form.propertyPlaceholderNone")}
            </option>

            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} - {p.city} ({p.type})
              </option>
            ))}
          </select>
        </div>

        {/* Champs internes */}
        <ServiceFormFields form={form} setForm={setForm} />

        {/* Boutons */}
        <div className="col-span-1 sm:col-span-2 flex flex-col sm:flex-row justify-end gap-2 pt-2">
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="app-btn-soft w-full sm:w-auto"
            >
              {t("services.buttons.cancel")}
            </button>
          )}

          <button
            type="submit"
            disabled={loading}
            className="app-btn-primary w-full sm:w-auto rounded-lg px-5 py-2.5 text-sm"
          >
            {editingId ? t("services.buttons.update") : t("services.buttons.create")}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ============================================================
   ?? Champs internes du formulaire
============================================================ */
function ServiceFormFields({ form, setForm }) {
  const { t } = useTranslation();
  return (
    <>
      {/* Type */}
      <div className="w-full">
        <label className="block text-sm font-medium text-text-secondary mb-1">
          {t("services.form.typeLabel")}
        </label>
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
        >
          {Object.keys(SERVICE_TYPES).map((key) => (
            <option key={key} value={key}>
              {t(`services.type.${key}`)}
            </option>
          ))}
        </select>
      </div>

      {/* Titre */}
      <div className="w-full">
        <label className="block text-sm font-medium text-text-secondary mb-1">
          {t("services.form.titleLabel")} <span className="app-required">*</span>
        </label>
        <input
          placeholder={t("services.form.titlePlaceholder")}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
          className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
        />
      </div>

      {/* Description */}
      <div className="col-span-1 sm:col-span-2 w-full">
        <label className="block text-sm font-medium text-text-secondary mb-1">
          {t("services.form.descriptionLabel")}
        </label>
        <textarea
          placeholder={t("services.form.descriptionPlaceholder")}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
          className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
        />
      </div>

      {/* Personne de contact */}
      <div className="w-full">
        <label className="block text-sm font-medium text-text-secondary mb-1">
          {t("services.form.contactLabel")}
        </label>
        <input
          value={form.contactPerson}
          onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
          placeholder={t("services.form.contactPlaceholder")}
          className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
        />
      </div>

 {/* Ti12li12phone */}
      <div className="w-full">
        <label className="block text-sm font-medium text-text-secondary mb-1">
          {t("services.form.phoneLabel")}
        </label>
        <input
          value={form.contactPhone}
          onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
          placeholder="+223 70 00 00 00"
          className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
        />
      </div>

      {/* Adresse */}
      <div className="col-span-1 sm:col-span-2 w-full">
        <label className="block text-sm font-medium text-text-secondary mb-1">
          {t("services.form.addressLabel")}
        </label>
        <input
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          placeholder={t("services.form.addressPlaceholder")}
          className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
        />
      </div>

      {/* Budget */}
      <div className="w-full">
        <label className="block text-sm font-medium text-text-secondary mb-1">
          {t("services.form.budgetLabel")}
        </label>
        <input
          type="number"
          step="0.01"
          placeholder={t("services.form.budgetPlaceholder")}
          value={form.budget}
          onChange={(e) => setForm({ ...form, budget: e.target.value })}
          className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
        />
      </div>
    </>
  );
}

/* ============================================================
   ?? ServiceCard (Affichage ï¿½ Optimisï¿½ mobile/desktop)
============================================================ */
function ServiceCard({ s, user, startEdit, handleDelete, navigate }) {
  const { formatDate, formatNumber } = useLocale();
  const { t } = useTranslation();
  const isAdminOrMaster = user?.role === 'admin';
  const typeLabel = SERVICE_TYPES[s.type] || s.type || t("common.dash");
  const statusLabel =
    SERVICE_STATUSES[s.status] ||
    (s.status ? String(s.status).replace("_", " ") : t("common.dash"));

  const statusMeta =
    s.status === 'created'
      ? {
          icon: '',
          badge: 'bg-surface-main/80 text-text-secondary border-border',
          accent: 'border-l-border',
        }
      : s.status === 'in_progress'
      ? {
          icon: '',
          badge: 'app-badge app-badge-info',
          accent: 'border-l-blue-400/50',
        }
      : s.status === 'completed'
      ? {
          icon: '',
          badge: 'app-badge app-badge-success',
          accent: 'border-l-emerald-400/50',
        }
      : {
          icon: '',
          badge: 'app-badge app-badge-success',
          accent: 'border-l-emerald-400/50',
        };

  const propertyLabel = s.property?.title
    ? `${s.property.title}${s.property.city ? ` - ${s.property.city}` : ''}`
    : t("services.card.noProperty");

  const contactLabel = s.contactPerson || t("services.card.contactFallback");
  const contactPhone = s.contactPhone || t("common.dash");
  const addressLabel = s.address || t("services.card.contactFallback");
  const budgetValue =
    s.budget != null && Number.isFinite(Number(s.budget))
      ? `${formatNumber(Number(s.budget))} FCFA`
      : t("services.card.budgetUnknown");
  const agentLabel = s.agent
    ? `${s.agent.firstName || ''} ${s.agent.lastName || ''}`.trim() ||
      s.agent.email ||
      t("services.card.unassigned")
    : t("services.card.unassigned");
  const createdLabel = s.createdAt ? formatDate(s.createdAt) : t("common.dash");

  return (
    <div
      className={`
        bg-gradient-to-br from-surface-main via-surface-card to-surface-main
        border border-border/70 rounded-2xl shadow-sm p-4 sm:p-5
        hover:shadow-md app-card-hover-accent
        w-full max-w-full
        border-l-4 ${statusMeta.accent}
      `}
    >
 {/* ENTi12TE (titre + statut) */}
      <div className="flex flex-col sm:flex-row sm:justify-between gap-2 sm:items-start">
        <div className="min-w-0 break-words">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-text-primary break-words">
              {s.title}
            </h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.75rem] font-semibold bg-surface-card text-text-secondary border border-border">
              {typeLabel}
            </span>
          </div>

          <p className="mt-1 whitespace-normal break-words text-sm text-text-secondary">
            {s.description || t("services.card.noDescription")}
          </p>
        </div>

        <div
          className={`
            mt-1 sm:mt-0 px-3 py-1 rounded-full text-xs font-semibold
            whitespace-normal leading-tight text-center self-start border ${statusMeta.badge}
          `}
        >
          <span className="mr-1">{statusMeta.icon}</span>
          {statusLabel}
        </div>
      </div>

      {/* META */}
      <div className="mt-4 grid grid-cols-1 gap-3 text-xs text-text-secondary sm:grid-cols-2 sm:text-sm">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-text-muted">
            {t("services.card.property")}
          </div>
          <div className="text-sm text-text-primary break-words">
            {propertyLabel}
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-text-muted">
            {t("services.card.contact")}
          </div>
          <div className="text-sm text-text-primary break-words">
            {contactLabel} <span className="text-text-muted">({contactPhone})</span>
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-text-muted">
            {t("services.card.address")}
          </div>
          <div className="text-sm text-text-primary break-words">
            {addressLabel}
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-text-muted">
            {t("services.card.budget")}
          </div>
          <div className="text-sm text-text-primary break-words">
            {budgetValue}
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-text-muted">
            {t("services.card.agent")}
          </div>
          <div className="text-sm text-text-primary break-words">
            {agentLabel}
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-text-muted">
            {t("services.card.createdAt")}
          </div>
          <div className="text-sm text-text-primary break-words">
            {createdLabel}
          </div>
        </div>
      </div>

      {/* ACTIONS */}
      <div
        className="
          mt-5 flex flex-col sm:flex-row flex-wrap gap-2
          w-full sm:w-auto
        "
      >
        <button
          onClick={() => navigate(`/services/${s.id}/tasks`)}
          className="app-btn-primary w-full sm:w-auto"
        >
          {t("services.buttons.viewTasks")}
        </button>

        {isAdminOrMaster && (
          <>
            <button
              onClick={() => startEdit(s)}
              className="app-btn-warning w-full sm:w-auto px-4 py-2 text-sm font-medium"
            >
              {t("services.buttons.edit")}
            </button>

            <button
              onClick={() => handleDelete(s.id)}
              className="app-btn-danger w-full sm:w-auto px-4 py-2 text-sm font-medium"
            >
              {t("services.buttons.delete")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
