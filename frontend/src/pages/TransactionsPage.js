// ============================================================================
// TransactionsPage.jsx — VERSION PRODUCTION SAFE (TERANGA)
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
// 🌍 Helpers URL Production — FICHIERS (proofFile, images…)
// ============================================================================

const FILE_BASE =
  (typeof window !== 'undefined' && window.__TERANGA_FILE_BASE_URL) ||
  (typeof window !== 'undefined' &&
  window.__TERANGA_API_BASE_URL
    ? window.__TERANGA_API_BASE_URL.replace(/\/api\/?$/, '')
    : 'http://localhost:5000');

/** Construit une URL absolue propre pour tout fichier */
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
  // États initiaux
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


    // ==========================================================================
  // 🔹 Initialisation utilisateur + données
  // ==========================================================================
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

  // ==========================================================================
  // 🔹 Charger services selon rôle
  // ==========================================================================
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

  // ==========================================================================
  // 🔹 Charger transactions
  // ==========================================================================
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

  // ==========================================================================
  // 🔹 Service → tâches
  // ==========================================================================
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

  // ==========================================================================
  // 🔹 Soumettre une transaction
  // ==========================================================================
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

      // Auto-complete si pas d’objet lié
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

  // ==========================================================================
  // 🔹 Format nom utilisateur
  // ==========================================================================
  function getUserDisplayName(u) {
    if (!u) return '—';
    const full = `${u.firstName || u.firstname || ''} ${u.lastName || u.lastname || ''}`.trim();
    if (full) return full;
    if (u.name) return u.name;
    if (u.email) return u.email;
    return '—';
  }

  // ==========================================================================
  // 🔍 Filtres premium
  // ==========================================================================
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
      arr = arr.filter((t) => (t.paymentMethod || '').toLowerCase().includes(filters.payment));
    if (filters.service) arr = arr.filter((t) => t.service?.id === Number(filters.service));
    if (filters.order) arr = arr.filter((t) => t.order?.id === Number(filters.order));
    if (filters.project) arr = arr.filter((t) => t.project?.id === Number(filters.project));

    // tri
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


  // ==========================================================================
  // 🔹 UI PRINCIPALE
  // ==========================================================================
  if (!user)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-600 text-lg animate-pulse">Chargement…</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-3 sm:px-4 py-10">
      <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-2xl p-6 sm:p-8 border border-gray-100">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-2">
              💰 Transactions
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Suivi & gestion de vos opérations financières.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowForm((v) => !v)}
              className="px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-slate-800 text-white hover:bg-slate-900 transition"
            >
              {showForm ? '➖ Masquer' : '➕ Nouvelle transaction'}
            </button>

            <button
              onClick={loadTransactions}
              disabled={loading}
              className={`px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition ${
                loading
                  ? 'bg-blue-300 cursor-not-allowed'
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
// 🔹 Filtres Composant
// ============================================================================
function TransactionFilters({ filters, setFilters, services, filteredCount }) {
  return (
    <div className="mb-8 bg-gray-50 border border-gray-200 rounded-xl p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-3">

        <input
          placeholder="🔎 Rechercher"
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm col-span-2 focus:ring-2 focus:ring-blue-500"
        />

        <select
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">Type</option>
          {Object.entries(TRANSACTION_TYPES).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        <input
          placeholder="Mode paiement"
          value={filters.payment}
          onChange={(e) => setFilters({ ...filters, payment: e.target.value.toLowerCase() })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
        />

        <select
          value={filters.service}
          onChange={(e) => setFilters({ ...filters, service: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">Service</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>

        <select
          value={filters.sort}
          onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white col-span-2"
        >
          <option value="-createdAt">Plus récentes</option>
          <option value="createdAt">Plus anciennes</option>
          <option value="amount">Montant croissant</option>
          <option value="-amount">Montant décroissant</option>
        </select>
      </div>

      <div className="flex justify-between text-xs text-gray-500">
        <span>{filteredCount} transaction(s)</span>
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
          className="px-3 py-1.5 bg-gray-200 rounded-md hover:bg-gray-300"
        >
          Réinitialiser
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 🔹 Formulaire
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
      <h2 className="text-lg font-semibold text-gray-900 mb-4">➕ Nouvelle transaction</h2>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-5 rounded-xl border"
      >
        {/* type */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Type</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full border px-3 py-2 rounded-lg bg-white"
          >
            {Object.entries(TRANSACTION_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* montant */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Montant</label>
          <input
            type="number"
            step="0.01"
            required
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="w-full border px-3 py-2 rounded-lg bg-white"
          />
        </div>

        {/* devise */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Devise</label>
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className="w-full border px-3 py-2 rounded-lg bg-white"
          >
            {Object.entries(CURRENCY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* méthode paiement */}
        <input
          placeholder="Mode paiement"
          value={form.paymentMethod}
          onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
          className="sm:col-span-2 border px-3 py-2 rounded-lg bg-white"
        />

        {/* service */}
        <select
          value={selectedService}
          onChange={handleServiceChange}
          className="sm:col-span-2 border px-3 py-2 rounded-lg bg-white"
        >
          <option value="">— Sans service —</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>

        {/* tâches */}
        {tasks.length > 0 && (
          <select
            value={form.taskId}
            onChange={(e) => setForm({ ...form, taskId: e.target.value })}
            className="sm:col-span-2 border px-3 py-2 rounded-lg bg-white"
          >
            <option value="">Aucune tâche</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        )}

        {/* projet */}
        {(user.role === 'admin' || user.role === 'agent') && (
          <input
            type="number"
            placeholder="ID Projet"
            value={form.projectId}
            onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            className="sm:col-span-2 border px-3 py-2 rounded-lg bg-white"
          />
        )}

        {/* commande */}
        {(user.role === 'admin' || user.role === 'agent') && (
          <input
            type="number"
            placeholder="ID Commande"
            value={form.orderId}
            onChange={(e) => setForm({ ...form, orderId: e.target.value })}
            className="sm:col-span-2 border px-3 py-2 rounded-lg bg-white"
          />
        )}

        {/* description */}
        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="sm:col-span-2 border px-3 py-2 rounded-lg bg-white"
        />

        {/* preuve fichier */}
        <input
          type="file"
          accept=".jpg,.jpeg,.png,.pdf"
          onChange={(e) => setForm({ ...form, proofFile: e.target.files?.[0] || null })}
          className="sm:col-span-2 border px-3 py-2 rounded-lg bg-white"
        />

        {/* bouton */}
        <div className="sm:col-span-2 text-right">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300"
          >
            {loading ? 'Enregistrement…' : '💾 Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// 🔹 Liste Transactions
// ============================================================================
function TransactionList({ transactions, loading, getUserDisplayName }) {
  if (loading)
    return (
      <p className="text-gray-500 italic text-center py-6">Chargement…</p>
    );

  if (transactions.length === 0)
    return (
      <p className="text-gray-500 italic text-center py-6">
        Aucune transaction trouvée.
      </p>
    );

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {transactions.map((t) => (
        <div
          key={t.id}
          className="bg-white border rounded-xl shadow-sm p-5 hover:shadow-md transition flex flex-col"
        >
          <div className="mb-3">
            <h3 className="text-lg font-semibold text-gray-900">
              {t.typeLabel} — {Number(t.amount).toLocaleString()} {t.currencyLabel}
            </h3>

            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded-full">
              {t.statusLabel}
            </span>

            <p className="text-sm text-gray-600 mt-2">
              {t.description || 'Aucune description'}
            </p>
          </div>

          <div className="flex-1 text-sm text-gray-700 space-y-2">
            {t.service && (
              <p>🔗 <strong>Service :</strong> {t.service.title}</p>
            )}

            {t.task && (
              <p>🔧 <strong>Tâche :</strong> {t.task.title}</p>
            )}

            {t.project && (
              <p>
                🏗️ <strong>Projet :</strong>{' '}
                <Link to={`/projects/${t.project.id}`} className="text-blue-600 hover:underline">
                  {t.project.title}
                </Link>
              </p>
            )}

            {t.order && (
              <p>
                🧾 <strong>Commande :</strong>{' '}
                <Link to={`/orders/${t.order.id}`} className="text-blue-600 hover:underline">
                  {t.order.code || `#${t.order.id}`}
                </Link>
              </p>
            )}

            {t.proofFile?.path && (
              <p>
                📎{' '}
                <a
                  href={toAbsUrl(t.proofFile.path)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Voir la pièce jointe
                </a>
              </p>
            )}
          </div>

          <div className="mt-4 text-xs text-gray-500">
            <p>
              Créée le <strong>{new Date(t.createdAt).toLocaleDateString()}</strong>
            </p>
            <p>
              Par <strong>{getUserDisplayName(t.user)}</strong>
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
