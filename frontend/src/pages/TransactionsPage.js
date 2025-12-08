// ============================================================================
// TransactionsPage.jsx — VERSION PREMIUM 2025 (TERANGA) — UX & DESIGN PRO
// ============================================================================

import { useEffect, useState } from 'react';
import { getTransactions, createTransaction } from '../services/transactions';
import { me } from '../services/auth';
import {
  getMyServices,
  getAgentServices,
  getAllServicesAdmin,
} from '../services/services';
import api from '../services/api';
import {
  applyLabels,
  TRANSACTION_TYPES,
  CURRENCY_LABELS,
} from '../utils/labels';
import { Link } from 'react-router-dom';

// ============================================================================
// 🌍 Helpers URL Production — FICHIERS
// ============================================================================
const FILE_BASE =
  (typeof window !== 'undefined' && window.__TERANGA_FILE_BASE_URL) ||
  (typeof window !== 'undefined' && window.__TERANGA_API_BASE_URL
    ? window.__TERANGA_API_BASE_URL.replace(/\/api\/?$/, '')
    : 'http://localhost:5000');

function toAbsUrl(path = '') {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${FILE_BASE}${normalized}`.replace(/([^:]\/)\/+/g, '$1');
}

// ============================================================================
// 📂 Page principale
// ============================================================================
export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [services, setServices] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedService, setSelectedService] = useState('');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  const [showForm, setShowForm] = useState(() => {
    const saved = localStorage.getItem('teranga_transactions_showForm');
    return saved === null ? true : saved === '1';
  });

  const [form, setForm] = useState({
    type: 'expense',
    amount: '',
    currency: 'XOF',
    paymentMethod: '',
    description: '',
    serviceId: '',
    taskId: '',
    orderId: '',
    projectId: '',
    proofFile: null,
  });

  const [filters, setFilters] = useState({
    q: '',
    type: '',
    payment: '',
    service: '',
    order: '',
    project: '',
    sort: '-createdAt',
  });

  // ========================================================================
  // 🔹 Initialisation utilisateur + données
  // ========================================================================
  useEffect(() => {
    async function init() {
      try {
        const userData = await me();
        setUser(userData.user);
        await loadServicesByRole(userData.user);
        await loadTransactions();
      } catch (err) {
        if (err?.response?.status === 401) {
          localStorage.removeItem('teranga_token');
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
      }
    }
    init();
  }, []);

  useEffect(() => {
    localStorage.setItem('teranga_transactions_showForm', showForm ? '1' : '0');
  }, [showForm]);

  // ========================================================================
  // 🔹 Services selon rôle
  // ========================================================================
  async function loadServicesByRole(u) {
    try {
      let servs = [];
      if (u.role === 'client') servs = await getMyServices();
      else if (u.role === 'agent') servs = await getAgentServices();
      else if (u.role === 'admin') servs = await getAllServicesAdmin();
      setServices(servs || []);
    } catch {
      setServices([]);
    }
  }

  // ========================================================================
  // 🔹 Transactions
  // ========================================================================
  async function loadTransactions() {
    setLoading(true);
    try {
      const data = await getTransactions();
      const labeled = data.map((t) => (t.statusLabel ? t : applyLabels(t)));
      setTransactions(labeled);
    } catch {
      alert('Erreur lors du chargement des transactions.');
    } finally {
      setLoading(false);
    }
  }

  // ========================================================================
  // 🔹 Service → Tâches
  // ========================================================================
  async function handleServiceChange(e) {
    const serviceId = e.target.value;
    setSelectedService(serviceId);
    setForm((f) => ({ ...f, serviceId, taskId: '' }));
    if (!serviceId) return setTasks([]);

    try {
      const { data } = await api.get(`/tasks/service/${serviceId}`);
      setTasks(data.tasks || []);
    } catch {
      setTasks([]);
    }
  }

  // ========================================================================
  // 🔹 Soumission formulaire
  // ========================================================================
  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        amount: form.amount ? Number(form.amount) : undefined,
        serviceId: form.serviceId ? Number(form.serviceId) : undefined,
        taskId: form.taskId ? Number(form.taskId) : undefined,
        orderId: form.orderId ? Number(form.orderId) : undefined,
        projectId: form.projectId ? Number(form.projectId) : undefined,
      };

      // Si pas lié à une commande ni projet → on force completed
      if (!payload.orderId && !payload.projectId) {
        payload.status = 'completed';
      }

      const created = await createTransaction(payload);
      const labeled = applyLabels(created);
      setTransactions((prev) => [labeled, ...prev]);

      alert('✅ Transaction ajoutée avec succès');
      resetForm();
    } catch {
      alert("Erreur lors de l'ajout de la transaction.");
    }
  }

  function resetForm() {
    setForm({
      type: 'expense',
      amount: '',
      currency: 'XOF',
      paymentMethod: '',
      description: '',
      serviceId: '',
      taskId: '',
      orderId: '',
      projectId: '',
      proofFile: null,
    });
    setTasks([]);
    setSelectedService('');
  }

  // ========================================================================
  // 🔹 Affichage utilisateur
  // ========================================================================
  function getUserDisplayName(u) {
    if (!u) return '—';
    const full = `${u.firstName || u.firstname || ''} ${
      u.lastName || u.lastname || ''
    }`.trim();
    if (full) return full;
    if (u.name) return u.name;
    if (u.email) return u.email;
    return '—';
  }

  // ========================================================================
  // 🔍 Filtres premium (optimisés)
  // ========================================================================
  useEffect(() => {
    let arr = [...transactions];
    const q = filters.q.trim().toLowerCase();

    if (q) {
      arr = arr.filter((t) =>
        [
          t.typeLabel,
          t.statusLabel,
          t.description,
          t.paymentMethod,
          getUserDisplayName(t.user),
          t.service?.title,
          t.task?.title,
          t.order?.code || t.order?.reference || (t.order ? `#${t.order.id}` : ''),
          t.project?.title || (t.project ? `#${t.project.id}` : ''),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }

    if (filters.type) arr = arr.filter((t) => t.type === filters.type);
    if (filters.payment)
      arr = arr.filter((t) =>
        (t.paymentMethod || '').toLowerCase().includes(filters.payment)
      );
    if (filters.service) arr = arr.filter((t) => t.service?.id === Number(filters.service));
    if (filters.order) arr = arr.filter((t) => t.order?.id === Number(filters.order));
    if (filters.project) arr = arr.filter((t) => t.project?.id === Number(filters.project));

    const by = filters.sort || '-createdAt';
    arr.sort((a, b) => {
      const sign = by.startsWith('-') ? -1 : 1;
      const key = by.replace(/^-/, '');
      let va = a[key];
      let vb = b[key];

      if (key === 'createdAt') {
        va = new Date(a.createdAt).getTime();
        vb = new Date(b.createdAt).getTime();
      } else if (key === 'amount') {
        va = Number(a.amount);
        vb = Number(b.amount);
      }

      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      return 0;
    });

    setFiltered(arr);
  }, [transactions, filters]);

  // ========================================================================
  // 🔹 UI PRINCIPALE
  // ========================================================================
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100">
        <p className="text-gray-600 text-lg animate-pulse">
          Chargement des transactions…
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-3 sm:px-4 lg:px-6 py-8 lg:py-10">
      <div className="max-w-6xl mx-auto bg-white/95 shadow-2xl rounded-3xl border border-gray-100 p-5 sm:p-8 lg:p-10 space-y-8">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 pb-4 border-b border-gray-100">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-2">
              💰 Gestion des transactions
            </h1>
            <p className="text-sm sm:text-base text-slate-600">
              Suivez et centralisez l’ensemble de vos opérations financières.
            </p>
            <span className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200 mt-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
              {transactions.length} transaction(s) enregistrée(s).
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              onClick={() => setShowForm((v) => !v)}
              className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold rounded-lg shadow-sm bg-slate-900 text-white hover:bg-slate-800 transition"
            >
              {showForm ? '➖ Masquer le formulaire' : '➕ Nouvelle transaction'}
            </button>

            <button
              onClick={loadTransactions}
              disabled={loading}
              className={`w-full sm:w-auto px-4 py-2.5 text-sm font-semibold rounded-lg shadow-sm transition ${
                loading
                  ? 'bg-blue-300 cursor-not-allowed text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {loading ? 'Chargement…' : '🔄 Rafraîchir'}
            </button>
          </div>
        </div>

        {/* FILTRES */}
        <TransactionFilters
          filters={filters}
          setFilters={setFilters}
          services={services}
          filteredCount={filtered.length}
        />

        {/* FORMULAIRE */}
        {showForm && (
          <TransactionForm
            form={form}
            setForm={setForm}
            selectedService={selectedService}
            handleServiceChange={handleServiceChange}
            tasks={tasks}
            services={services}
            handleSubmit={handleSubmit}
            loading={loading}
            user={user}
          />
        )}

        {/* LISTE */}
        <TransactionList
          transactions={filtered}
          loading={loading}
          getUserDisplayName={getUserDisplayName}
        />
      </div>
    </div>
  );
}

// ============================================================================
// 🔹 Filtres Composant — UX + lisibilité
// ============================================================================

function TransactionFilters({ filters, setFilters, services, filteredCount }) {
  return (
    <div className="mb-8 bg-gray-50 border border-gray-200 rounded-2xl p-4 sm:p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">

        {/* Recherche globale */}
        <div className="lg:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Recherche
          </label>
          <input
            placeholder="🔎 Rechercher (type, description, service, commande...)"
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Type
          </label>
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white w-full focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous les types</option>
            {Object.entries(TRANSACTION_TYPES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Mode de paiement */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Mode de paiement
          </label>
          <input
            placeholder="Ex : Mobile Money"
            value={filters.payment}
            onChange={(e) =>
              setFilters({ ...filters, payment: e.target.value.toLowerCase() })
            }
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white w-full focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Service lié */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Service
          </label>
          <select
            value={filters.service}
            onChange={(e) => setFilters({ ...filters, service: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white w-full focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous les services</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>

        {/* Tri */}
        <div className="lg:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Tri
          </label>
          <select
            value={filters.sort}
            onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white w-full focus:ring-2 focus:ring-blue-500"
          >
            <option value="-createdAt">Plus récentes d’abord</option>
            <option value="createdAt">Plus anciennes d’abord</option>
            <option value="amount">Montant croissant</option>
            <option value="-amount">Montant décroissant</option>
          </select>
        </div>
      </div>

      {/* Bas des filtres */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs sm:text-sm text-gray-500">
        <span>{filteredCount} transaction(s) après filtrage.</span>

        <button
          onClick={() =>
            setFilters({
              q: '',
              type: '',
              payment: '',
              service: '',
              order: '',
              project: '',
              sort: '-createdAt',
            })
          }
          className="px-3 py-1.5 bg-gray-200 rounded-md hover:bg-gray-300 w-full sm:w-auto text-center font-medium"
        >
          Réinitialiser tous les filtres
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 🔹 Formulaire Transaction — Design premium
// ============================================================================

function TransactionForm({
  form,
  setForm,
  selectedService,
  handleServiceChange,
  tasks,
  services,
  handleSubmit,
  loading,
  user,
}) {
  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
          ➕ Nouvelle transaction
        </h2>
        <p className="text-xs sm:text-sm text-gray-500">
          Renseignez les champs ci-dessous pour enregistrer une opération.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 sm:p-5 rounded-2xl border border-gray-200"
      >
        {/* Type */}
        <div>
          <label className="text-xs sm:text-sm font-medium text-gray-700 mb-1 block">
            Type
          </label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
          >
            {Object.entries(TRANSACTION_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {/* Montant */}
        <div>
          <label className="text-xs sm:text-sm font-medium text-gray-700 mb-1 block">
            Montant <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            required
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Devise */}
        <div>
          <label className="text-xs sm:text-sm font-medium text-gray-700 mb-1 block">
            Devise
          </label>
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
          >
            {Object.entries(CURRENCY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {/* Mode de paiement */}
        <div className="sm:col-span-1">
          <label className="text-xs sm:text-sm font-medium text-gray-700 mb-1 block">
            Mode de paiement
          </label>
          <input
            placeholder="Ex : Mobile Money, Espèces…"
            value={form.paymentMethod}
            onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Service lié */}
        <div className="sm:col-span-2">
          <label className="text-xs sm:text-sm font-medium text-gray-700 mb-1 block">
            Service associé
          </label>
          <select
            value={selectedService}
            onChange={handleServiceChange}
            className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— Sans service —</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>

        {/* Tâche liée */}
        {tasks.length > 0 && (
          <div className="sm:col-span-2">
            <label className="text-xs sm:text-sm font-medium text-gray-700 mb-1 block">
              Tâche liée (optionnel)
            </label>
            <select
              value={form.taskId}
              onChange={(e) => setForm({ ...form, taskId: e.target.value })}
              className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Aucune tâche</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Projet lié (admin/agent) */}
        {(user.role === 'admin' || user.role === 'agent') && (
          <div className="sm:col-span-2">
            <label className="text-xs sm:text-sm font-medium text-gray-700 mb-1 block">
              ID Projet (optionnel)
            </label>
            <input
              type="number"
              placeholder="ID du projet"
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
              className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Commande liée (admin/agent) */}
        {(user.role === 'admin' || user.role === 'agent') && (
          <div className="sm:col-span-2">
            <label className="text-xs sm:text-sm font-medium text-gray-700 mb-1 block">
              ID Commande (optionnel)
            </label>
            <input
              type="number"
              placeholder="ID de la commande"
              value={form.orderId}
              onChange={(e) => setForm({ ...form, orderId: e.target.value })}
              className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Description */}
        <div className="sm:col-span-2">
          <label className="text-xs sm:text-sm font-medium text-gray-700 mb-1 block">
            Description
          </label>
          <textarea
            placeholder="Ajoutez un commentaire ou un contexte (facultatif)…"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
        </div>

        {/* Pièce jointe */}
        <div className="sm:col-span-2">
          <label className="text-xs sm:text-sm font-medium text-gray-700 mb-1 block">
            Pièce jointe (image / PDF)
          </label>
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            onChange={(e) =>
              setForm({ ...form, proofFile: e.target.files?.[0] || null })
            }
            className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm sm:text-base cursor-pointer focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Bouton submit */}
        <div className="sm:col-span-2 text-right mt-2">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm sm:text-base font-semibold hover:bg-blue-700 disabled:bg-blue-300 transition"
          >
            {loading ? 'Enregistrement…' : '💾 Enregistrer la transaction'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// 🔹 Liste Transactions — cartes pro & lisibles
// ============================================================================

function TransactionList({ transactions, loading, getUserDisplayName }) {
  if (loading) {
    return (
      <p className="text-gray-500 italic text-center py-6">
        Chargement des transactions…
      </p>
    );
  }

  if (transactions.length === 0) {
    return (
      <p className="text-gray-500 italic text-center py-6">
        Aucune transaction trouvée pour ces critères.
      </p>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {transactions.map((t) => {
        // URL pièce jointe : compatibilité ancienne/nouvelle structure
        const proofUrl =
          t?.proofFile?.url ||
          (t?.proofFile?.path ? toAbsUrl(t.proofFile.path) : '');

        // Couleur selon type
        const isRevenue = t.type === 'revenue';
        const typeChipClasses = isRevenue
          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
          : 'bg-red-50 text-red-700 border-red-100';

        const amountClasses = isRevenue ? 'text-emerald-700' : 'text-red-700';

        return (
          <div
            key={t.id}
            className="
              bg-white border border-gray-200 rounded-2xl shadow-sm
              hover:shadow-md transition
              p-4 sm:p-5 flex flex-col
              w-full max-w-full min-w-0 overflow-hidden
            "
          >
            {/* HEADER */}
            <div className="mb-3 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className={`text-lg font-bold ${amountClasses} break-words`}>
                    {Number(t.amount).toLocaleString('fr-FR')}{' '}
                    {t.currencyLabel || t.currency}
                  </div>
                  <div
                    className={`
                      inline-flex items-center mt-1 px-2 py-0.5 rounded-full 
                      text-[0.7rem] font-semibold border ${typeChipClasses}
                    `}
                  >
                    {t.typeLabel}
                  </div>
                </div>

                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.7rem] font-medium bg-blue-50 text-blue-700 border border-blue-100 whitespace-nowrap">
                  {t.statusLabel}
                </span>
              </div>

              <p className="text-sm text-gray-600 mt-2 break-words whitespace-normal">
                {t.description || 'Aucune description.'}
              </p>
            </div>

            {/* META */}
            <div className="flex-1 text-sm text-gray-700 space-y-1.5 min-w-0 break-words">
              {t.service && (
                <p className="break-words whitespace-normal">
                  🔗 <span className="font-medium">Service :</span> {t.service.title}
                </p>
              )}

              {t.task && (
                <p className="break-words whitespace-normal">
                  🔧 <span className="font-medium">Tâche :</span> {t.task.title}
                </p>
              )}

              {t.project && (
                <p className="break-words whitespace-normal">
                  🏗️ <span className="font-medium">Projet :</span>{' '}
                  <Link
                    to={`/projects/${t.project.id}`}
                    className="text-blue-600 hover:underline break-words"
                  >
                    {t.project.title}
                  </Link>
                </p>
              )}

              {t.order && (
                <p className="break-words whitespace-normal">
                  🧾 <span className="font-medium">Commande :</span>{' '}
                  <Link
                    to={`/orders/${t.order.id}`}
                    className="text-blue-600 hover:underline break-words"
                  >
                    {t.order.code || `#${t.order.id}`}
                  </Link>
                </p>
              )}

              {proofUrl && (
                <p className="break-words whitespace-normal">
                  📎{' '}
                  <a
                    href={proofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline break-words"
                  >
                    Voir la pièce jointe
                  </a>
                </p>
              )}
            </div>

            {/* FOOTER */}
            <div className="mt-4 text-[0.75rem] text-gray-500 border-t border-gray-100 pt-2">
              <p>
                Créée le{' '}
                <span className="font-medium">
                  {new Date(t.createdAt).toLocaleDateString('fr-FR')}
                </span>
              </p>
              <p>
                Par{' '}
                <span className="font-medium">
                  {getUserDisplayName(t.user)}
                </span>
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
