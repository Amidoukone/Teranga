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

  // 🆕 Champs liés aux commandes et projets
  const [form, setForm] = useState({
    type: 'expense',
    amount: '',
    currency: 'XOF',
    paymentMethod: '',
    description: '',
    serviceId: '',
    taskId: '',
    orderId: '',
    projectId: '', // 🆕 Nouveau champ projet
    proofFile: null,
  });

  const [filters, setFilters] = useState({
    q: '',
    type: '',
    payment: '',
    service: '',
    order: '',
    project: '', // 🆕 Nouveau filtre projet
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
        await loadServicesForRole(userData.user);
        await loadTransactions();
      } catch (err) {
        const status = err?.response?.status;
        if (status === 401) {
          localStorage.removeItem('teranga_token');
          localStorage.removeItem('token');
          window.location.href = '/login';
        } else {
          console.error('❌ Erreur init TransactionsPage:', err);
        }
      }
    }
    init();
  }, []);

  useEffect(() => {
    localStorage.setItem('teranga_transactions_showForm', showForm ? '1' : '0');
  }, [showForm]);

  /* ============================================================
     🔹 Chargement dynamique
  ============================================================ */
  async function loadServicesForRole(u) {
    try {
      if (u.role === 'client') {
        const servs = await getMyServices();
        setServices(servs || []);
      } else if (u.role === 'agent') {
        const servs = await getAgentServices();
        setServices(servs || []);
      } else if (u.role === 'admin') {
        const servs = await getAllServicesAdmin();
        setServices(servs || []);
      }
    } catch {
      console.warn('ℹ️ Pas de liste services pour ce rôle.');
      setServices([]);
    }
  }

  async function loadTransactions() {
    setLoading(true);
    try {
      const data = await getTransactions();
      const labeled = data.map((t) => (t.statusLabel ? t : applyLabels(t)));
      setTransactions(labeled);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) {
        localStorage.removeItem('teranga_token');
        localStorage.removeItem('token');
        window.location.href = '/login';
      } else {
        console.error('❌ Erreur chargement transactions:', err);
        alert('Erreur lors du chargement des transactions.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleServiceChange(e) {
    const serviceId = e.target.value;
    setSelectedService(serviceId);
    setForm((f) => ({ ...f, serviceId, taskId: '' }));

    if (serviceId) {
      try {
        const { data } = await api.get(`/tasks/service/${serviceId}`);
        setTasks(data.tasks || []);
      } catch {
        setTasks([]);
      }
    } else {
      setTasks([]);
    }
  }

  /* ============================================================
     🔹 Soumission formulaire
  ============================================================ */
  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        amount: form.amount === '' ? undefined : Number(form.amount),
        serviceId: form.serviceId ? Number(form.serviceId) : undefined,
        taskId: form.taskId ? Number(form.taskId) : undefined,
        orderId: form.orderId ? Number(form.orderId) : undefined,
        projectId: form.projectId ? Number(form.projectId) : undefined,
      };

      // 🧠 Statut : transaction indépendante (aucune commande/projet) → "completed"
      if (!payload.orderId && !payload.projectId) {
        payload.status = 'completed';
      }

      const created = await createTransaction(payload);
      const labeled = applyLabels(created);

      setTransactions((prev) => [labeled, ...prev]);
      alert('✅ Transaction ajoutée avec succès');
      resetForm();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) {
        localStorage.removeItem('teranga_token');
        localStorage.removeItem('token');
        window.location.href = '/login';
      } else {
        console.error('❌ Erreur ajout transaction:', err);
        alert("Erreur lors de l'ajout de la transaction");
      }
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
    setSelectedService('');
    setTasks([]);
  }

  /* ============================================================
     🧾 Helper : nom d’affichage de l’utilisateur (prénom + nom ou email)
  ============================================================ */
  function getUserDisplayName(userObj) {
    if (!userObj) return 'Système';
    const fullName = `${userObj.firstName || ''} ${userObj.lastName || ''}`.trim();
    if (fullName) return fullName;
    if (userObj.email) return userObj.email;
    return 'Système';
  }

  /* ============================================================
     🔍 Filtres dynamiques
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
          // 🆕 On inclut aussi le nom complet dans la recherche
          t.user?.email,
          `${t.user?.firstName || ''} ${t.user?.lastName || ''}`,
          t.service?.title,
          t.task?.title,
          t.order?.reference || t.order?.code || (t.order ? `#${t.order.id}` : ''),
          t.project?.title || (t.project ? `#${t.project.id}` : ''), // 🆕 recherche par projet
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
    if (filters.service)
      arr = arr.filter((t) => t.service?.id === parseInt(filters.service, 10));
    if (filters.order)
      arr = arr.filter((t) => t.order?.id === parseInt(filters.order, 10));
    if (filters.project)
      arr = arr.filter((t) => t.project?.id === parseInt(filters.project, 10)); // 🆕

    const by = filters.sort || '-createdAt';
    arr.sort((a, b) => {
      const sign = by.startsWith('-') ? -1 : 1;
      const key = by.replace(/^-/, '');
      let va, vb;
      if (key === 'createdAt') {
        va = new Date(a.createdAt).getTime();
        vb = new Date(b.createdAt).getTime();
      } else if (key === 'amount') {
        va = Number(a.amount || 0);
        vb = Number(b.amount || 0);
      } else {
        va = a[key];
        vb = b[key];
      }
      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      return 0;
    });

    setFiltered(arr);
  }, [transactions, filters]);

  /* ============================================================
     🔹 UI principale
  ============================================================ */
  if (!user)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-600 text-lg animate-pulse">Chargement…</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 py-10">
      <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
        {/* 🧭 En-tête */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">💰 Transactions</h1>
            <p className="text-sm text-gray-600 mt-1">
              Connecté en tant que <strong>{user.email}</strong> ({user.role})
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowForm((v) => !v)}
              className="px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-slate-800 text-white hover:bg-slate-900 transition"
            >
              {showForm ? '➖ Masquer le formulaire' : '➕ Nouvelle transaction'}
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

        <TransactionFilters
          filters={filters}
          setFilters={setFilters}
          services={services}
          filteredCount={filtered.length}
        />

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
   🔹 Sous-composants
============================================================ */
function TransactionFilters({ filters, setFilters, services, filteredCount }) {
  return (
    <div className="mb-8 bg-gray-50 border border-gray-200 rounded-xl p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <input
          placeholder="🔎 Rechercher une transaction"
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 col-span-2"
        />

        <select
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Type (tous)</option>
          {Object.entries(TRANSACTION_TYPES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <input
          placeholder="Méthode paiement"
          value={filters.payment}
          onChange={(e) =>
            setFilters({ ...filters, payment: e.target.value.toLowerCase() })
          }
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        />

        <select
          value={filters.service}
          onChange={(e) => setFilters({ ...filters, service: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Service (tous)</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>

        <select
          value={filters.sort}
          onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 col-span-2"
        >
          <option value="-createdAt">Plus récentes</option>
          <option value="createdAt">Plus anciennes</option>
          <option value="amount">Montant croissant</option>
          <option value="-amount">Montant décroissant</option>
        </select>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-gray-500">{filteredCount} transaction(s)</div>
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
          className="text-xs px-3 py-1.5 bg-gray-200 rounded-md hover:bg-gray-300 font-medium transition"
        >
          Réinitialiser
        </button>
      </div>
    </div>
  );
}

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
      <h2 className="text-lg font-semibold text-gray-800 mb-4">➕ Nouvelle transaction</h2>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-5 rounded-xl border border-gray-200"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type de transaction
          </label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          >
            {Object.entries(TRANSACTION_TYPES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Montant</label>
          <input
            type="number"
            step="0.01"
            placeholder="Ex : 25000"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Devise</label>
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          >
            {Object.entries(CURRENCY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <input
          placeholder="Méthode de paiement (optionnel)"
          value={form.paymentMethod}
          onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
          className="sm:col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        />

        <select
          value={selectedService}
          onChange={handleServiceChange}
          className="sm:col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— Transaction indépendante —</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} ({s.type})
            </option>
          ))}
        </select>

        {tasks.length > 0 && (
          <select
            value={form.taskId}
            onChange={(e) => setForm({ ...form, taskId: e.target.value })}
            className="sm:col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— Aucune tâche —</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        )}

        {/* 🆕 Champ projet (visible admin/agent) */}
        {(user.role === 'admin' || user.role === 'agent') && (
          <input
            type="number"
            placeholder="ID Projet (optionnel)"
            value={form.projectId}
            onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            className="sm:col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          />
        )}

        {(user.role === 'admin' || user.role === 'agent') && (
          <input
            type="number"
            placeholder="ID Commande (optionnel)"
            value={form.orderId}
            onChange={(e) => setForm({ ...form, orderId: e.target.value })}
            className="sm:col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          />
        )}

        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
          className="sm:col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        />

        <input
          type="file"
          accept=".jpg,.jpeg,.png,.pdf"
          onChange={(e) => setForm({ ...form, proofFile: e.target.files?.[0] || null })}
          className="sm:col-span-2 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 bg-white"
        />

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
    <div className="grid gap-6">
      {transactions.map((t) => (
        <div
          key={t.id}
          className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 hover:shadow-md transition"
        >
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {t.typeLabel || t.type} —{' '}
                {Number(t.amount || 0).toLocaleString()} {t.currencyLabel || t.currency}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Statut : <strong>{t.statusLabel || '—'}</strong>
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {t.description || 'Aucune description'}
              </p>
            </div>
            <div className="mt-2 sm:mt-0 text-xs text-gray-500">
              {new Date(t.createdAt).toLocaleString()}
            </div>
          </div>

          <div className="mt-3 text-sm text-gray-700">
            {t.service && (
              <p>
                🔗 <strong>Service :</strong> {t.service.title}
              </p>
            )}
            {t.task && (
              <p>
                🔧 <strong>Tâche :</strong> {t.task.title}
              </p>
            )}
            {t.project && (
              <p>
                🏗️ <strong>Projet :</strong>{' '}
                <Link
                  to={`/projects/${t.project.id}`}
                  className="text-blue-600 hover:underline"
                >
                  {t.project.title || `#${t.project.id}`}
                </Link>
              </p>
            )}
            {t.order && (
              <p>
                🧾 <strong>Commande :</strong>{' '}
                <Link
                  to={`/orders/${t.order.id}`}
                  className="text-blue-600 hover:underline"
                >
                  {t.order.code || t.order.reference || `#${t.order.id}`}
                </Link>
              </p>
            )}
            {t.proofFile?.path && (
              <p className="mt-1">
                📎{' '}
                <a
                  href={`http://localhost:5000${t.proofFile.path}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Voir la pièce jointe
                </a>
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Créée le{' '}
              <strong>{new Date(t.createdAt).toLocaleDateString()}</strong> par{' '}
              <strong>{getUserDisplayName(t.user)}</strong>
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
