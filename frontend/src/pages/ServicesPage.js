// frontend/src/pages/ServicesPage.jsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { me } from '../services/auth';
import { getMyServices, createService } from '../services/services';
import { getProperties } from '../services/properties';
import { applyLabels, SERVICE_TYPES, SERVICE_STATUSES } from '../utils/labels';

/* ============================================================
   🧠 Page Services — Premium Pro 2025 (responsive & production-ready)
   - Gestion des services (client + admin)
   - Création / édition / suppression
   - Filtres avancés + tri
============================================================ */
export default function ServicesPage() {
  const [services, setServices] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [properties, setProperties] = useState([]);
  const [clients, setClients] = useState([]);
  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [showForm, setShowForm] = useState(() => {
    const saved = localStorage.getItem('teranga_services_showForm');
    return saved === null ? true : saved === '1';
  });

  const [filters, setFilters] = useState({
    q: '',
    type: '',
    status: '',
    property: '',
    sort: '-createdAt',
  });

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
      const servs = await getMyServices();

      // 🏷️ Ajouter les labels français si backend ne les fournit pas déjà
      const list = Array.isArray(servs) ? servs : servs?.services || [];
      const enriched = list.map((s) => ({
        ...s,
        ...(s.statusLabel && s.typeLabel ? {} : applyLabels(s)),
      }));

      setServices(enriched);
    } catch (e) {
      console.error('❌ Load services:', e);
      alert(
        e?.response?.data?.error || 'Erreur lors du chargement des services.'
      );
    }
  }, []);

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
        alert('Erreur lors du chargement des biens du client.');
      }
    },
    [authHeaders]
  );

  const loadMyProperties = useCallback(async () => {
    try {
      const props = await getProperties();
      setProperties(Array.isArray(props) ? props : props?.properties || []);
    } catch (e) {
      console.error('❌ Load properties (me):', e);
      alert('Erreur lors du chargement des biens.');
    }
  }, []);

  const loadClients = useCallback(async () => {
    try {
      const { data } = await api.get('/users?role=client', authHeaders);
      setClients(data.users || []);
    } catch (e) {
      console.error('❌ Erreur chargement clients:', e);
      setClients([]);
    }
  }, [authHeaders]);

  /* ==========================================
     🔹 Initialisation
  ========================================== */
  useEffect(() => {
    async function init() {
      try {
        const { user: u } = await me();
        if (!u) {
          navigate('/login');
          return;
        }

        setUser(u);
        await loadServices();

        if (u.role === 'admin') {
          await loadClients();
        } else {
          await loadMyProperties();
        }
      } catch (err) {
        console.error('❌ Erreur init ServicesPage:', err);
        navigate('/login');
      }
    }
    init();
  }, [loadClients, loadMyProperties, loadServices, navigate]);

  // Lorsqu’un admin choisit un client, charger ses biens
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
      setLoading(true);

      // 👉 On ne force plus la sélection d’un bien.
      // Le helper createService s’occupe déjà de :
      // - ignorer propertyId si vide
      // - caster budget correctement
      const payload = { ...form };

      await createService(payload);
      alert('✅ Service créé avec succès !');
      resetForm();
      await loadServices();

      if (user?.role === 'admin' && form.clientId) {
        await loadClientProperties(form.clientId);
      } else {
        await loadMyProperties();
      }
    } catch (e) {
      console.error('❌ createService:', e);
      alert(
        e?.response?.data?.error || 'Erreur lors de la création du service.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(e) {
    e.preventDefault();
    try {
      setLoading(true);

      if (!editingId) {
        alert('Aucun service à modifier.');
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
        // 👉 côté backend, propertyId n’est pas encore updatable,
        // mais on laisse ce champ si tu décides de le gérer plus tard.
        propertyId: form.propertyId ? parseInt(form.propertyId, 10) : null,
      };

      if (user?.role === 'admin' && form.clientId) {
        payload.clientId = parseInt(form.clientId, 10);
      }

      await api.put(`/services/${editingId}`, payload, authHeaders);
      alert('✅ Service mis à jour avec succès !');
      resetForm();
      setEditingId(null);
      await loadServices();
    } catch (e) {
      console.error('❌ Erreur mise à jour service:', e);
      alert(
        e?.response?.data?.error ||
          'Erreur lors de la mise à jour du service.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Confirmer la suppression de ce service ?')) return;
    try {
      await api.delete(`/services/${id}`, authHeaders);
      await loadServices();
    } catch (e) {
      console.error('❌ Erreur suppression service:', e);
      alert(
        e?.response?.data?.error ||
          'Erreur lors de la suppression du service ❌'
      );
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
     🔹 Filtrage + Tri (local)
  ========================================== */
  useEffect(() => {
    let arr = [...services];

    if (filters.q.trim()) {
      const q = filters.q.trim().toLowerCase();
      arr = arr.filter((s) =>
        [
          s.title,
          s.description,
          s.contactPerson,
          s.contactPhone,
          s.address,
          s.typeLabel,
          s.statusLabel,
          s.property?.title,
          s.property?.city,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }

    if (filters.type) arr = arr.filter((s) => s.type === filters.type);
    if (filters.status) arr = arr.filter((s) => s.status === filters.status);

    if (filters.property) {
      const pid = parseInt(filters.property, 10);
      arr = arr.filter((s) => s.property?.id === pid);
    }

    const by = filters.sort || '-createdAt';
    const sign = by.startsWith('-') ? -1 : 1;
    const key = by.replace(/^-/, '');

    arr.sort((a, b) => {
      let va = a[key];
      let vb = b[key];

      if (key === 'createdAt') {
        va = new Date(a.createdAt).getTime();
        vb = new Date(b.createdAt).getTime();
      } else if (key === 'title') {
        va = (a.title || '').toLowerCase();
        vb = (b.title || '').toLowerCase();
      }

      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      return 0;
    });

    setFiltered(arr);
  }, [filters, services]);

  /* ==========================================
     🔹 UI principale
  ========================================== */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-3 py-8 sm:px-4 sm:py-10">
      <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-2xl p-4 sm:p-8 border border-gray-100 overflow-hidden">
        {/* HEADER */}
        <Header
          showForm={showForm}
          setShowForm={setShowForm}
          loading={loading}
          loadServices={loadServices}
        />

        {/* FILTRES */}
        <Filters
          filters={filters}
          setFilters={setFilters}
          properties={properties}
          filteredCount={filtered.length}
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

        <h2 className="text-xl font-semibold text-gray-900 mb-4 break-words">
          📋 Mes services existants
        </h2>

        {filtered.length === 0 ? (
          <p className="text-gray-500 italic text-center py-6">
            Aucun service correspondant.
          </p>
        ) : (
          <div className="grid gap-6">
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
   🧩 HEADER (responsive, mobile-first)
============================================================ */
function Header({ showForm, setShowForm, loading, loadServices }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div className="max-w-full break-words">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          🛠️ Mes Services
        </h1>
        <p className="text-sm text-gray-500">
          Créez, suivez et gérez vos services en toute simplicité.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="w-full sm:w-auto px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-slate-800 text-white hover:bg-slate-900 transition"
        >
          {showForm ? '➖ Masquer le formulaire' : '➕ Nouveau service'}
        </button>

        <button
          onClick={loadServices}
          disabled={loading}
          className={`w-full sm:w-auto px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition ${
            loading
              ? 'bg-blue-300 cursor-not-allowed text-white'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
          }`}
        >
          {loading ? 'Chargement…' : '🔄 Rafraîchir'}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   🧩 FILTRES (grid mobile-first)
============================================================ */
function Filters({ filters, setFilters, properties, filteredCount }) {
  return (
    <div className="mb-8 bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Recherche */}
        <input
          placeholder="🔎 Rechercher un service"
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 col-span-1 sm:col-span-2 lg:col-span-2 w-full"
        />

        {/* Type */}
        <select
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 w-full"
        >
          <option value="">Type (tous)</option>
          {Object.entries(SERVICE_TYPES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        {/* Statut */}
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 w-full"
        >
          <option value="">Statut (tous)</option>
          {Object.entries(SERVICE_STATUSES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        {/* Bien */}
        <select
          value={filters.property}
          onChange={(e) => setFilters({ ...filters, property: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 w-full"
        >
          <option value="">Bien (tous)</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} — {p.city}
            </option>
          ))}
        </select>

        {/* Tri */}
        <select
          value={filters.sort}
          onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 col-span-1 sm:col-span-2 lg:col-span-2 w-full"
        >
          <option value="-createdAt">Plus récents</option>
          <option value="createdAt">Plus anciens</option>
          <option value="title">Titre A→Z</option>
          <option value="-title">Titre Z→A</option>
        </select>
      </div>

      <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="text-xs text-gray-500">{filteredCount} service(s)</div>
        <button
          onClick={() =>
            setFilters({
              q: '',
              type: '',
              status: '',
              property: '',
              sort: '-createdAt',
            })
          }
          className="text-xs px-3 py-1.5 bg-gray-200 rounded-md hover:bg-gray-300 font-medium transition w-full sm:w-auto text-center"
        >
          Réinitialiser
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   🧾 FORMULAIRE DE CRÉATION / ÉDITION (mobile-friendly)
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
  return (
    <div className="mb-10">
      <h2 className="text-lg font-semibold text-gray-800 mb-4 break-words">
        {editingId ? '✏️ Modifier le service' : '➕ Créer un nouveau service'}
      </h2>

      <form
        onSubmit={(e) => (editingId ? handleUpdate(e) : handleSubmit(e))}
        className="
          grid grid-cols-1 sm:grid-cols-2 gap-4
          bg-gray-50 p-4 sm:p-5 rounded-xl border border-gray-200
        "
      >
        {/* ADMIN : sélection client */}
        {user?.role === 'admin' && (
          <div className="col-span-1 sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client associé *
            </label>
            <select
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              required
              className="
                w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                focus:ring-2 focus:ring-blue-500
              "
            >
              <option value="">— Sélectionner un client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName} ({c.email})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Biens — 👇 ici on le rend optionnel */}
        <div className="col-span-1 sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bien associé (optionnel)
          </label>
          <select
            value={form.propertyId}
            onChange={(e) => setForm({ ...form, propertyId: e.target.value })}
            disabled={user?.role === 'admin' && !form.clientId}
            className="
              w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
              focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100
            "
          >
            <option value="">
              {user?.role === 'admin' && !form.clientId
                ? '— Choisir un client d’abord —'
                : '— Aucun bien (service général) —'}
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
              Annuler
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
            {editingId ? '💾 Mettre à jour' : 'Créer Service'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ============================================================
   🧩 Champs internes du formulaire (mobile-first)
============================================================ */
function ServiceFormFields({ form, setForm }) {
  return (
    <>
      {/* Type */}
      <div className="w-full">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Type de service
        </label>
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          className="
            w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
            focus:ring-2 focus:ring-blue-500
          "
        >
          {Object.entries(SERVICE_TYPES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Titre */}
      <div className="w-full">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Titre *
        </label>
        <input
          placeholder="Ex: Paiement facture SENELEC"
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
          Description
        </label>
        <textarea
          placeholder="Détail du service…"
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
          Personne de contact
        </label>
        <input
          value={form.contactPerson}
          onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
          placeholder="Nom du contact"
          className="
            w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
            focus:ring-2 focus:ring-blue-500
          "
        />
      </div>

      {/* Téléphone */}
      <div className="w-full">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Téléphone du contact
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
          Adresse
        </label>
        <input
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          placeholder="Adresse du lieu"
          className="
            w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
            focus:ring-2 focus:ring-blue-500
          "
        />
      </div>

      {/* Budget */}
      <div className="w-full">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Budget estimé (FCFA)
        </label>
        <input
          type="number"
          step="0.01"
          placeholder="Ex: 15000"
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
  return (
    <div
      className="
        bg-white border border-gray-200 rounded-xl shadow-sm p-4 sm:p-5
        hover:shadow-md transition
        w-full max-w-full
      "
    >
      {/* ENTÊTE (titre + statut) */}
      <div className="flex flex-col sm:flex-row sm:justify-between gap-2 sm:items-start">
        <div className="min-w-0 break-words">
          <h3 className="text-lg font-semibold text-gray-900 break-words">
            {s.title}{' '}
            <span className="text-sm text-gray-500">
              ({s.typeLabel || s.type})
            </span>
          </h3>

          <p className="text-sm text-gray-600 mt-1 whitespace-normal break-words">
            {s.description || 'Aucune description'}
          </p>
        </div>

        <div
          className={`
            mt-1 sm:mt-0 px-3 py-1 rounded-full text-xs font-semibold
            whitespace-nowrap self-start
            ${
              s.status === 'created'
                ? 'bg-gray-100 text-gray-700'
                : s.status === 'in_progress'
                ? 'bg-blue-100 text-blue-700'
                : s.status === 'completed'
                ? 'bg-green-100 text-green-700'
                : 'bg-emerald-100 text-emerald-700'
            }
          `}
        >
          {s.statusLabel || s.status.replace('_', ' ')}
        </div>
      </div>

      {/* META */}
      <div className="mt-4 text-sm text-gray-700 space-y-2">
        <p className="break-words">
          <strong>Bien :</strong>{' '}
          {s.property?.title
            ? `${s.property.title} — ${s.property.city}`
            : 'Aucun (service indépendant)'}
        </p>

        <p className="break-words">
          <strong>Contact :</strong> {s.contactPerson || 'N/A'} (
          {s.contactPhone || '-'})
        </p>

        <p className="break-words">
          <strong>Adresse :</strong> {s.address || 'N/A'}
        </p>

        <p>
          <strong>Budget :</strong>{' '}
          {s.budget != null ? `${s.budget} FCFA` : 'Non précisé'}
        </p>

        <p className="break-words">
          <strong>Agent :</strong>{' '}
          {s.agent
            ? `${s.agent.firstName} ${s.agent.lastName}`
            : 'Non assigné'}
        </p>
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
          📋 Voir tâches
        </button>

        {user?.role === 'admin' && (
          <>
            <button
              onClick={() => startEdit(s)}
              className="
                w-full sm:w-auto px-4 py-2 text-sm font-medium
                bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition
              "
            >
              ✏️ Modifier
            </button>

            <button
              onClick={() => handleDelete(s.id)}
              className="
                w-full sm:w-auto px-4 py-2 text-sm font-medium
                bg-red-600 text-white rounded-lg hover:bg-red-700 transition
              "
            >
              🗑 Supprimer
            </button>
          </>
        )}
      </div>
    </div>
  );
}
