// frontend/src/pages/TransactionsPage.jsx
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

/**
 * ============================================================
 * 💰 TransactionsPage — VERSION PREMIUM RESPONSIVE (Option B)
 * ============================================================
 * - Design mobile-first 100% optimisé
 * - Cartes verticales lisibles (type mobile banking)
 * - Layout premium cohérent Clean Shop
 * - Affectations : services / tâches / commandes / projets
 * - Identité utilisateur fallback : first+last → name → email → "—"
 * ============================================================
 */

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

  /* ============================================================
     🔹 Initialisation
  ============================================================ */
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

  /* ============================================================
     🔹 Services selon rôle
  ============================================================ */
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

  /* ============================================================
     🔹 Transactions
  ============================================================ */
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

  /* ============================================================
     🔹 Service → tâches dynamiques
  ============================================================ */
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

  /* ============================================================
     🔹 Soumission transaction
  ============================================================ */
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

  /* ============================================================
     🔹 Fallback identité
  ============================================================ */
  function getUserDisplayName(u) {
    if (!u) return '—';
    const fn = u.firstName || u.firstname || '';
    const ln = u.lastName || u.lastname || '';
    const full = `${fn} ${ln}`.trim();
    if (full) return full;
    if (u.name) return u.name;
    if (u.email) return u.email;
    return '—';
  }

  /* ============================================================
     🔍 Filtres premium
  ============================================================ */
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

  /* ============================================================
     🔹 UI PRINCIPALE — PREMIUM RESPONSIVE
  ============================================================ */
  if (!user)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-600 text-lg animate-pulse">Chargement…</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-3 sm:px-4 py-10">
      <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-2xl p-6 sm:p-8 border border-gray-100">

        {/* HEADER PREMIUM */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-2">
              💰 Transactions
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Suivi & gestion de toutes vos opérations financières.
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
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
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

        {/* LISTE RESPONSIVE PREMIUM */}
        <TransactionList
          transactions={filtered}
          loading={loading}
          getUserDisplayName={getUserDisplayName}
        />
      </div>
    </div>
  );
}

/* ============================================================
   🔹 FILTRES PREMIUM RESPONSIVE
============================================================ */
function TransactionFilters({ filters, setFilters, services, filteredCount }) {
  return (
    <div className="mb-8 bg-gray-50 border border-gray-200 rounded-xl p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-3">

        <input
          placeholder="🔎 Rechercher une transaction"
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm col-span-2 focus:ring-2 focus:ring-blue-500"
        />

        <select
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Type</option>
          {Object.entries(TRANSACTION_TYPES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <input
          placeholder="Paiement (ex: orange money)"
          value={filters.payment}
          onChange={(e) => setFilters({ ...filters, payment: e.target.value.toLowerCase() })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
        />

        <select
          value={filters.service}
          onChange={(e) => setFilters({ ...filters, service: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Service</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>

        <select
          value={filters.sort}
          onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white col-span-2 focus:ring-2 focus:ring-blue-500"
        >
          <option value="-createdAt">Plus récentes</option>
          <option value="createdAt">Plus anciennes</option>
          <option value="amount">Montant croissant</option>
          <option value="-amount">Montant décroissant</option>
        </select>
      </div>

      <div className="flex justify-between items-center text-xs text-gray-500">
        <span>{filteredCount} transaction(s) trouvée(s)</span>

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
          className="px-3 py-1.5 bg-gray-200 rounded-md hover:bg-gray-300 font-medium transition"
        >
          Réinitialiser
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   🔹 FORMULAIRE PREMIUM RESPONSIVE
============================================================ */
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
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        ➕ Nouvelle transaction
      </h2>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-5 rounded-xl border border-gray-200"
      >
        {/* TYPE */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Type de transaction
          </label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-blue-500"
          >
            {Object.entries(TRANSACTION_TYPES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* MONTANT */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Montant
          </label>
          <input
            type="number"
            step="0.01"
            placeholder="Ex : 25000"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* DEVISE */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Devise
          </label>
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-blue-500"
          >
            {Object.entries(CURRENCY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* MÉTHODE PAIEMENT */}
        <input
          placeholder="Méthode de paiement (optionnel)"
          value={form.paymentMethod}
          onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
          className="sm:col-span-2 border border-gray-300 rounded-lg px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-blue-500"
        />

        {/* SERVICE */}
        <select
          value={selectedService}
          onChange={handleServiceChange}
          className="sm:col-span-2 border border-gray-300 rounded-lg px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— Transaction indépendante —</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} ({s.type})
            </option>
          ))}
        </select>

        {/* TÂCHES */}
        {tasks.length > 0 && (
          <select
            value={form.taskId}
            onChange={(e) => setForm({ ...form, taskId: e.target.value })}
            className="sm:col-span-2 border border-gray-300 rounded-lg px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— Aucune tâche —</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        )}

        {/* PROJET */}
        {(user.role === 'admin' || user.role === 'agent') && (
          <input
            type="number"
            placeholder="ID Projet (optionnel)"
            value={form.projectId}
            onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            className="sm:col-span-2 border border-gray-300 rounded-lg px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-blue-500"
          />
        )}

        {/* COMMANDE */}
        {(user.role === 'admin' || user.role === 'agent') && (
          <input
            type="number"
            placeholder="ID Commande (optionnel)"
            value={form.orderId}
            onChange={(e) => setForm({ ...form, orderId: e.target.value })}
            className="sm:col-span-2 border border-gray-300 rounded-lg px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-blue-500"
          />
        )}

        {/* DESCRIPTION */}
        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
          className="sm:col-span-2 border border-gray-300 rounded-lg px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-blue-500"
        />

        {/* PREUVE */}
        <input
          type="file"
          accept=".jpg,.jpeg,.png,.pdf"
          onChange={(e) => setForm({ ...form, proofFile: e.target.files?.[0] || null })}
          className="sm:col-span-2 border border-gray-300 rounded-lg px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-blue-500"
        />

        {/* BOUTON */}
        <div className="col-span-2 text-right">
          <button
            type="submit"
            className={`px-5 py-2.5 text-sm font-semibold rounded-lg shadow-sm transition ${
              loading
                ? 'bg-blue-300 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
            }`}
          >
            {loading ? 'Enregistrement…' : '💾 Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ============================================================
   🔹 LISTE PREMIUM RESPONSIVE (Mobile-first)
============================================================ */
function TransactionList({ transactions, loading, getUserDisplayName }) {
  if (loading)
    return (
      <p className="text-gray-500 italic text-center py-6">
        Chargement des transactions…
      </p>
    );

  if (transactions.length === 0)
    return (
      <p className="text-gray-500 italic text-center py-6">
        Aucune transaction trouvée.
      </p>
    );

  return (
    <div className="grid gap-5 sm:gap-6 sm:grid-cols-2">
      {transactions.map((t) => (
        <div
          key={t.id}
          className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 hover:shadow-md transition flex flex-col"
        >
          {/* ENTÊTE TRANSACTION */}
          <div className="flex flex-col gap-1 mb-3">
            <h3 className="text-lg font-semibold text-gray-900 leading-snug">
              {t.typeLabel || t.type} —{' '}
              {Number(t.amount || 0).toLocaleString()} {t.currencyLabel || t.currency}
            </h3>

            <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 w-fit">
              {t.statusLabel || '—'}
            </span>

            <p className="text-sm text-gray-600 mt-1 line-clamp-3">
              {t.description || 'Aucune description'}
            </p>
          </div>

          {/* INFOS ASSOCIÉES */}
          <div className="flex-1 text-sm text-gray-700 space-y-2">

            {t.service && (
              <p className="flex items-center gap-2">
                <span>🔗</span>
                <span>
                  <strong>Service :</strong> {t.service.title}
                </span>
              </p>
            )}

            {t.task && (
              <p className="flex items-center gap-2">
                <span>🔧</span>
                <span>
                  <strong>Tâche :</strong> {t.task.title}
                </span>
              </p>
            )}

            {t.project && (
              <p className="flex items-center gap-2">
                <span>🏗️</span>
                <span>
                  <strong>Projet :</strong>{' '}
                  <Link
                    to={`/projects/${t.project.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {t.project.title || `#${t.project.id}`}
                  </Link>
                </span>
              </p>
            )}

            {t.order && (
              <p className="flex items-center gap-2">
                <span>🧾</span>
                <span>
                  <strong>Commande :</strong>{' '}
                  <Link
                    to={`/orders/${t.order.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {t.order.code || t.order.reference || `#${t.order.id}`}
                  </Link>
                </span>
              </p>
            )}

            {t.proofFile?.path && (
              <p className="flex items-center gap-2">
                <span>📎</span>
                <a
                  href={`http://localhost:5000${t.proofFile.path}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline truncate"
                >
                  Voir la pièce jointe
                </a>
              </p>
            )}
          </div>

          {/* PIED DE CARTE */}
          <div className="mt-4 text-xs text-gray-500 flex flex-col gap-1">
            <span>
              Créée le{' '}
              <strong>{new Date(t.createdAt).toLocaleDateString()}</strong>
            </span>
            <span>
              Par <strong>{getUserDisplayName(t.user)}</strong>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
