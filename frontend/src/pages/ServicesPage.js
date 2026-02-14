// frontend/src/pages/ServicesPage.jsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { me } from '../services/auth';
import { getMyServices, createService } from '../services/services';
import { getProperties } from '../services/properties';
import { applyLabels, SERVICE_TYPES, SERVICE_STATUSES } from '../utils/labels';
import PaginationBar from '../components/PaginationBar';
import { useLocale } from '../i18n/useLocale';
import { useTranslation } from 'react-i18next';

const DEFAULT_FILTERS = {
  q: '',
  type: '',
  status: '',
  property: '',
  sort: '-createdAt',
};

/* ============================================================
   🧠 Page Services — Premium Pro 2025 (responsive & production-ready)
   - Gestion des services (client + admin/master)
   - Création / édition / suppression
   - Filtres avancés + tri
   ✅ Multi-pays MASTER: UI uniquement (backend applique le scope)
============================================================ */
export default function ServicesPage() {
  const { formatDate } = useLocale();
  const { t } = useTranslation();
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
   ✅ Helpers MASTER (frontend-only)
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
     ✅ Auth headers
  ========================================== */
  const authHeaders = useMemo(() => {
    const token =
      localStorage.getItem('teranga_token') || localStorage.getItem('token');
    return {
      headers: { Authorization: token ? `Bearer ${token}` : '' },
    };
  }, []);

  /* ==========================================
     🔹 Loaders
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

      // Toujours recalculer les labels via i18n (évite les labels FR renvoyés par le backend)
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
      console.error('❌ Load services:', e);
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
        console.error('❌ Erreur chargement biens client:', e);
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
      console.error('❌ Load properties (me):', e);
      setNotice({
        type: 'error',
        message: t("services.alerts.loadPropertiesError"),
      });
    }
  }, [t]);

  const loadClients = useCallback(async () => {
    try {
      // ✅ backend filtre automatiquement via scope (admin global = tous, master = scope)
      const { data } = await api.get('/users?role=client', authHeaders);
      setClients(data.users || []);
    } catch (e) {
      console.error('❌ Erreur chargement clients:', e);
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

        // ? admin global OU master (toujours role=admin, scope g?r? c?t? backend)
        if (u.role === 'admin') {
          await loadClients();
        } else {
          await loadMyProperties();
        }
      } catch (err) {
        console.error('? Erreur init ServicesPage:', err);
        navigate('/login');
      }
    }
    init();
  }, [loadClients, loadMyProperties, navigate]);

  useEffect(() => {
    if (!user) return;
    loadServices();
  }, [user, loadServices]);

  // Lorsqu’un admin/master choisit un client, charger ses biens
  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    if (form.clientId) {
      loadClientProperties(form.clientId);
    } else {
      setProperties([]);
    }
  }, [form.clientId, user, loadClientProperties]);

  // Persister l’état d’affichage du formulaire
  useEffect(() => {
    localStorage.setItem('teranga_services_showForm', showForm ? '1' : '0');
  }, [showForm]);

  /* ==========================================
     🔹 Handlers CRUD
  ========================================== */
  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setNotice(null);
      setLoading(true);

      // ✅ IMPORTANT : ne pas injecter countryId/regionId ici
      // Backend applique le scope sur base de req.user
      const payload = { ...form };

      // ⚠️ sécurité UI : admin/master => clientId obligatoire (backend l’exige)
      if (user?.role === 'admin' && !payload.clientId) {
        setNotice({
          type: 'error',
          message: t("services.alerts.selectClient"),
        });
        return;
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
      console.error('❌ createService:', e);
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

      // ✅ admin/master : clientId autorisé si renseigné (backend supporte)
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
      console.error('❌ Erreur mise à jour service:', e);
      setNotice({
        type: 'error',
        message: e?.response?.data?.error || t("services.alerts.updateError"),
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm(t("services.alerts.deleteConfirm"))) return;
    try {
      await api.delete(`/services/${id}`, authHeaders);
      await loadServices();
      setNotice({
        type: 'success',
        message: t("services.alerts.deleteSuccess"),
      });
    } catch (e) {
      console.error('❌ Erreur suppression service:', e);
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-3 sm:px-4 lg:px-6 py-8 lg:py-10">
      <div className="max-w-6xl mx-auto bg-white/95 shadow-2xl rounded-3xl border border-gray-100 p-4 sm:p-8 lg:p-10 overflow-hidden space-y-8">
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
            className={`rounded-2xl border px-4 py-3 text-xs sm:text-sm flex gap-2 items-start ${
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
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 break-words">
            📋 {t("services.listTitle")}
          </h2>
          <span className="text-xs sm:text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-3 py-1">
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
          <div className="py-10 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-3">
              <span className="text-xl">🗂️</span>
            </div>
            <p className="text-sm font-semibold text-gray-800 mb-1">
              {emptyTitle}
            </p>
            <p className="text-xs text-gray-500 max-w-sm">
              {emptySubtitle}
            </p>
            <div className="mt-4 flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg shadow-sm bg-gray-200 hover:bg-gray-300"
                >
                  {t("services.filters.reset")}
                </button>
              )}
              {!showForm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg shadow-sm bg-blue-600 text-white hover:bg-blue-700 transition"
                >
                  ➕ {t("services.buttons.newService")}
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
   🧩 HEADER (responsive, mobile-first, plus pro)
============================================================ */
function Header({ showForm, setShowForm, loading, loadServices, totalCount, roleLabel, roleVariant, user }) {
  const { t } = useTranslation();
  const scopeText = (() => {
    if (!user || user.role !== 'admin') return null;
    const c = user.countryId != null ? `countryId=${user.countryId}` : null;
    const r = user.regionId != null ? `regionId=${user.regionId}` : null;
    if (!c && !r) return null;
    return [c, r].filter(Boolean).join(' • ');
  })();

  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 pb-4 border-b border-gray-100">
      <div className="space-y-1 min-w-0">
        <p className="text-[0.7rem] uppercase tracking-wide text-blue-600 font-semibold">
          {t("services.kicker")}
        </p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 break-words">
          🛠️ {t("services.title")}
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          {t("services.subtitle")}
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
            {t("services.totalCount", { count: totalCount })}
          </span>

          {roleLabel && (
            <span
              className={`inline-flex items-center gap-2 text-xs sm:text-sm px-3 py-1.5 rounded-full border ${
                roleVariant === 'master'
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                  : roleVariant === 'admin'
                  ? 'bg-slate-50 text-slate-700 border-slate-200'
                  : 'bg-gray-50 text-gray-600 border-gray-200'
              }`}
            >
              {roleLabel}
            </span>
          )}

          {!!scopeText && (
            <span className="inline-flex items-center text-xs sm:text-sm px-3 py-1.5 rounded-full border bg-white text-gray-600 border-gray-200">
              🌍 {scopeText}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold rounded-lg shadow-sm bg-slate-900 text-white hover:bg-slate-800 transition"
        >
          {showForm ? `➖ ${t("services.buttons.hideForm")}` : `➕ ${t("services.buttons.newService")}`}
        </button>

        <button
          onClick={loadServices}
          disabled={loading}
          className={`w-full sm:w-auto px-4 py-2.5 text-sm font-semibold rounded-lg shadow-sm transition ${
            loading
              ? 'bg-blue-300 cursor-not-allowed text-white'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
          }`}
        >
          {loading ? t("services.buttons.refreshLoading") : `🔄 ${t("services.buttons.refresh")}`}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   🧩 FILTRES (grid mobile-first, labels + meilleure lisibilité)
============================================================ */
function Filters({ filters, setFilters, properties, filteredCount, onReset }) {
  const { t } = useTranslation();
  return (
    <div className="mb-6 bg-gray-50 border border-gray-200 rounded-2xl p-4 sm:p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Recherche */}
        <div className="col-span-1 sm:col-span-2 lg:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {t("services.filters.searchLabel")}
          </label>
          <input
            placeholder={`🔎 ${t("services.filters.searchPlaceholder")}`}
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 w-full"
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {t("services.filters.typeLabel")}
          </label>
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 w-full bg-white"
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
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {t("services.filters.statusLabel")}
          </label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 w-full bg-white"
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
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {t("services.filters.propertyLabel")}
          </label>
          <select
            value={filters.property}
            onChange={(e) => setFilters({ ...filters, property: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 w-full bg-white"
          >
            <option value="">{t("services.filters.propertyAll")}</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} — {p.city}
              </option>
            ))}
          </select>
        </div>

        {/* Tri */}
        <div className="col-span-1 sm:col-span-2 lg:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {t("services.filters.sortLabel")}
          </label>
          <select
            value={filters.sort}
            onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 w-full bg-white"
          >
            <option value="-createdAt">{t("services.filters.sortNewest")}</option>
            <option value="createdAt">{t("services.filters.sortOldest")}</option>
            <option value="title">{t("services.filters.sortTitleAsc")}</option>
            <option value="-title">{t("services.filters.sortTitleDesc")}</option>
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="text-xs sm:text-sm text-gray-500">
          {t("services.filters.filteredCount", { count: filteredCount })}
        </div>
        <button
          onClick={onReset}
          className="text-xs sm:text-sm px-3 py-1.5 bg-gray-200 rounded-md hover:bg-gray-300 font-medium transition w-full sm:w-auto text-center"
        >
          {t("services.filters.reset")}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   🧾 FORMULAIRE DE CRÉATION / ÉDITION
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
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 break-words">
          {editingId ? `✏️ ${t("services.form.titleEdit")}` : `➕ ${t("services.form.titleCreate")}`}
        </h2>
        <p className="text-xs sm:text-sm text-gray-500">
          {t("services.form.subtitle")}
        </p>
      </div>

      <form
        onSubmit={(e) => (editingId ? handleUpdate(e) : handleSubmit(e))}
        className="
          grid grid-cols-1 sm:grid-cols-2 gap-4
          bg-gray-50 p-4 sm:p-5 rounded-2xl border border-gray-200
        "
      >
        {/* ADMIN/MASTER : sélection client */}
        {isAdminOrMaster && (
          <div className="col-span-1 sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("services.form.clientLabel")} <span className="text-red-500">*</span>
            </label>
            <select
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              required
              className="
                w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                focus:ring-2 focus:ring-blue-500 bg-white
              "
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

        {/* Biens — optionnel */}
        <div className="col-span-1 sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("services.form.propertyLabel")}
          </label>
          <select
            value={form.propertyId}
            onChange={(e) => setForm({ ...form, propertyId: e.target.value })}
            disabled={isAdminOrMaster && !form.clientId}
            className="
              w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
              focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 bg-white
            "
          >
            <option value="">
              {isAdminOrMaster && !form.clientId
                ? t("services.form.propertyPlaceholderSelectClient")
                : t("services.form.propertyPlaceholderNone")}
            </option>

            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} — {p.city} ({p.type})
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
              className="
                w-full sm:w-auto px-4 py-2 bg-gray-300 rounded-lg
                text-sm font-semibold hover:bg-gray-400 transition
              "
            >
              {t("services.buttons.cancel")}
            </button>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`
              w-full sm:w-auto px-5 py-2.5 text-sm font-semibold rounded-lg shadow-sm transition
              ${
                loading
                  ? 'bg-blue-300 cursor-not-allowed text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
              }
            `}
          >
            {editingId ? `💾 ${t("services.buttons.update")}` : t("services.buttons.create")}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ============================================================
   🧩 Champs internes du formulaire
============================================================ */
function ServiceFormFields({ form, setForm }) {
  const { t } = useTranslation();
  return (
    <>
      {/* Type */}
      <div className="w-full">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("services.form.typeLabel")}
        </label>
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          className="
            w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
            focus:ring-2 focus:ring-blue-500 bg-white
          "
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
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("services.form.titleLabel")} <span className="text-red-500">*</span>
        </label>
        <input
          placeholder={t("services.form.titlePlaceholder")}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
          className="
            w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
            focus:ring-2 focus:ring-blue-500
          "
        />
      </div>

      {/* Description */}
      <div className="col-span-1 sm:col-span-2 w-full">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("services.form.descriptionLabel")}
        </label>
        <textarea
          placeholder={t("services.form.descriptionPlaceholder")}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
          className="
            w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
            focus:ring-2 focus:ring-blue-500
          "
        />
      </div>

      {/* Personne de contact */}
      <div className="w-full">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("services.form.contactLabel")}
        </label>
        <input
          value={form.contactPerson}
          onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
          placeholder={t("services.form.contactPlaceholder")}
          className="
            w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
            focus:ring-2 focus:ring-blue-500
          "
        />
      </div>

      {/* Téléphone */}
      <div className="w-full">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("services.form.phoneLabel")}
        </label>
        <input
          value={form.contactPhone}
          onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
          placeholder="+223 70 00 00 00"
          className="
            w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
            focus:ring-2 focus:ring-blue-500
          "
        />
      </div>

      {/* Adresse */}
      <div className="col-span-1 sm:col-span-2 w-full">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("services.form.addressLabel")}
        </label>
        <input
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          placeholder={t("services.form.addressPlaceholder")}
          className="
            w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
            focus:ring-2 focus:ring-blue-500
          "
        />
      </div>

      {/* Budget */}
      <div className="w-full">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("services.form.budgetLabel")}
        </label>
        <input
          type="number"
          step="0.01"
          placeholder={t("services.form.budgetPlaceholder")}
          value={form.budget}
          onChange={(e) => setForm({ ...form, budget: e.target.value })}
          className="
            w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
            focus:ring-2 focus:ring-blue-500
          "
        />
      </div>
    </>
  );
}

/* ============================================================
   🔍 ServiceCard (Affichage – Optimisé mobile/desktop)
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
          icon: '🆕',
          badge: 'bg-slate-100 text-slate-700 border-slate-200',
          accent: 'border-l-slate-200',
        }
      : s.status === 'in_progress'
      ? {
          icon: '⏳',
          badge: 'bg-blue-50 text-blue-700 border-blue-100',
          accent: 'border-l-blue-200',
        }
      : s.status === 'completed'
      ? {
          icon: '✅',
          badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          accent: 'border-l-emerald-200',
        }
      : {
          icon: '✔️',
          badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          accent: 'border-l-emerald-200',
        };

  const propertyLabel = s.property?.title
    ? `${s.property.title}${s.property.city ? ` — ${s.property.city}` : ''}`
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
        bg-gradient-to-br from-white via-white to-slate-50
        border border-gray-200 rounded-2xl shadow-sm p-4 sm:p-5
        hover:shadow-md hover:border-blue-100 transition
        w-full max-w-full
        border-l-4 ${statusMeta.accent}
      `}
    >
      {/* ENTÊTE (titre + statut) */}
      <div className="flex flex-col sm:flex-row sm:justify-between gap-2 sm:items-start">
        <div className="min-w-0 break-words">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900 break-words">
              {s.title}
            </h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-semibold bg-white text-slate-700 border border-slate-200">
              {typeLabel}
            </span>
          </div>

          <p className="text-sm text-gray-600 mt-1 whitespace-normal break-words">
            {s.description || t("services.card.noDescription")}
          </p>
        </div>

        <div
          className={`
            mt-1 sm:mt-0 px-3 py-1 rounded-full text-xs font-semibold
            whitespace-nowrap self-start border ${statusMeta.badge}
          `}
        >
          <span className="mr-1">{statusMeta.icon}</span>
          {statusLabel}
        </div>
      </div>

      {/* META */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm text-gray-700">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">
            {t("services.card.property")}
          </div>
          <div className="text-sm text-gray-900 break-words">
            {propertyLabel}
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">
            {t("services.card.contact")}
          </div>
          <div className="text-sm text-gray-900 break-words">
            {contactLabel} <span className="text-gray-500">({contactPhone})</span>
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">
            {t("services.card.address")}
          </div>
          <div className="text-sm text-gray-900 break-words">
            {addressLabel}
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">
            {t("services.card.budget")}
          </div>
          <div className="text-sm text-gray-900 break-words">
            {budgetValue}
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">
            {t("services.card.agent")}
          </div>
          <div className="text-sm text-gray-900 break-words">
            {agentLabel}
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">
            {t("services.card.createdAt")}
          </div>
          <div className="text-sm text-gray-900 break-words">
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
          className="
            w-full sm:w-auto px-4 py-2 text-sm font-medium bg-blue-600 text-white
            rounded-lg hover:bg-blue-700 transition
          "
        >
          📋 {t("services.buttons.viewTasks")}
        </button>

        {isAdminOrMaster && (
          <>
            <button
              onClick={() => startEdit(s)}
              className="
                w-full sm:w-auto px-4 py-2 text-sm font-medium
                bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition
              "
            >
              ✏️ {t("services.buttons.edit")}
            </button>

            <button
              onClick={() => handleDelete(s.id)}
              className="
                w-full sm:w-auto px-4 py-2 text-sm font-medium
                bg-red-600 text-white rounded-lg hover:bg-red-700 transition
              "
            >
              🗑 {t("services.buttons.delete")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

