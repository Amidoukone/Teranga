// ============================================================================
// TransactionsPage.jsx — VERSION PREMIUM 2025 (TERANGA)
// Master / Multi-pays READY — ZERO régression
// ============================================================================

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

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

// ============================================================================
// 🌍 FILE_BASE — Standard Teranga (Render / Netlify / CDN safe)
// ============================================================================
const FILE_BASE =
  (typeof window !== 'undefined' && window.__TERANGA_FILE_BASE_URL) ||
  (typeof window !== 'undefined' && window.__TERANGA_API_BASE_URL
    ? window.__TERANGA_API_BASE_URL.replace(/\/api\/?$/, '')
    : '');

// Normalisation URL fichier
function toAbsUrl(path = '') {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${FILE_BASE}${clean}`.replace(/([^:]\/)\/+/g, '$1');
}

function stripUrlParams(url = '') {
  return String(url || '').split('?')[0].split('#')[0];
}

function inferProofKind(pf, proofHref = '') {
  const mime = (pf?.mimeType || '').toLowerCase();
  const name = pf?.originalName || pf?.fileName || pf?.name || '';
  const cleanUrl = stripUrlParams(proofHref);

  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';

  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name) || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(cleanUrl)) {
    return 'image';
  }
  if (/\.pdf$/i.test(name) || /\.pdf$/i.test(cleanUrl)) return 'pdf';
  return 'other';
}

function getProofExtLabel(pf, proofHref = '', fallback = 'FILE') {
  const name = pf?.originalName || pf?.fileName || pf?.name || '';
  const cleanUrl = stripUrlParams(proofHref);
  const candidate = name || (cleanUrl.split('/').pop() || '');
  if (!candidate) return fallback;
  const parts = candidate.split('.');
  if (parts.length < 2) return fallback;
  const ext = parts[parts.length - 1].slice(0, 6).toUpperCase();
  return ext || fallback;
}

// 📂 PAGE PRINCIPALE
// ============================================================================
export default function TransactionsPage() {
  const [user, setUser] = useState(null);

  const [transactions, setTransactions] = useState([]);
  const [filtered, setFiltered] = useState([]);

  const [services, setServices] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [selectedService, setSelectedService] = useState('');

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const [showForm, setShowForm] = useState(() => {
    const saved = localStorage.getItem('teranga_transactions_showForm');
    return saved === null ? true : saved === '1';
  });

  // --------------------------------------------------------------------------
  // FORM STATE
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // FILTER STATE
  // --------------------------------------------------------------------------
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
  // 🔐 INIT USER + DATA
  // ========================================================================
  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const userData = await me();
        if (!active) return;

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
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(
      'teranga_transactions_showForm',
      showForm ? '1' : '0'
    );
  }, [showForm]);

  // ========================================================================
  // 🔹 SERVICES SELON RÔLE (client / agent / admin / master)
  // ========================================================================
  async function loadServicesByRole(u) {
    try {
      let servs = [];

      if (u.role === 'client') {
        servs = await getMyServices();
      } else if (u.role === 'agent') {
        servs = await getAgentServices();
      } else if (u.role === 'admin' || u.role === 'master') {
        servs = await getAllServicesAdmin();
      }

      setServices(servs || []);
    } catch (e) {
      console.error('❌ Erreur services:', e);
      setServices([]);
    }
  }

  // ========================================================================
  // 🔹 TRANSACTIONS
  // ========================================================================
  async function loadTransactions() {
    setLoading(true);
    try {
      const data = await getTransactions();
      const labeled = (data || []).map((t) =>
        t.statusLabel ? t : applyLabels(t)
      );
      setTransactions(labeled);
    } catch (e) {
      console.error('❌ loadTransactions:', e);
      alert('Erreur lors du chargement des transactions.');
    } finally {
      setLoading(false);
    }
  }

  // ========================================================================
  // 🔹 SERVICE → TASKS
  // ========================================================================
  async function handleServiceChange(e) {
    const serviceId = e.target.value;
    setSelectedService(serviceId);

    setForm((f) => ({
      ...f,
      serviceId,
      taskId: '',
    }));

    if (!serviceId) {
      setTasks([]);
      return;
    }

    try {
      const { data } = await api.get(`/tasks/service/${serviceId}`);
      setTasks(data.tasks || []);
    } catch (e) {
      console.error('❌ load tasks:', e);
      setTasks([]);
    }
  }

  // ========================================================================
  // 🔹 SUBMIT TRANSACTION (ANTI DOUBLE-SUBMIT)
  // ========================================================================
  async function handleSubmit(e) {
    e.preventDefault();
    if (creating) return;

    try {
      setCreating(true);

      const payload = {
        ...form,
        amount: form.amount ? Number(form.amount) : undefined,
        serviceId: form.serviceId ? Number(form.serviceId) : undefined,
        taskId: form.taskId ? Number(form.taskId) : undefined,
        orderId: form.orderId ? Number(form.orderId) : undefined,
        projectId: form.projectId ? Number(form.projectId) : undefined,
      };

      // Transaction indépendante → completed
      if (!payload.orderId && !payload.projectId) {
        payload.status = 'completed';
      }

      const created = await createTransaction(payload);
      const labeled = applyLabels(created);

      setTransactions((prev) => [labeled, ...prev]);

      alert('✅ Transaction ajoutée');
      resetForm();
    } catch (e) {
      console.error('❌ createTransaction:', e);
      alert("Erreur lors de l'ajout de la transaction.");
    } finally {
      setCreating(false);
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
  // 🔹 USER DISPLAY
  // ========================================================================
  function getUserDisplayName(u) {
    if (!u) return '—';
    const full = `${u.firstName || u.firstname || ''} ${
      u.lastName || u.lastname || ''
    }`.trim();
    return full || u.name || u.email || '—';
  }

  // ========================================================================
  // 🔍 FILTERING & SORTING
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
          t.order?.code || (t.order ? `#${t.order.id}` : ''),
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
    if (filters.service)
      arr = arr.filter((t) => t.service?.id === Number(filters.service));
    if (filters.order)
      arr = arr.filter((t) => t.order?.id === Number(filters.order));
    if (filters.project)
      arr = arr.filter((t) => t.project?.id === Number(filters.project));

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
  // ⏳ LOADING
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

  // ========================================================================
  // 🖥️ UI PRINCIPALE
  // ========================================================================
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
              Centralisation complète des opérations financières (services, commandes, projets).
            </p>
            <span className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200 mt-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
              {transactions.length} transaction(s)
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
            creating={creating}
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
// 🔍 FILTRES
// ============================================================================
function TransactionFilters({ filters, setFilters, services, filteredCount }) {
  return (
    <div className="mb-8 bg-gray-50 border border-gray-200 rounded-2xl p-4 sm:p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="lg:col-span-2">
          <label className="text-xs font-medium text-gray-600 mb-1 block">
            Recherche
          </label>
          <input
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            placeholder="Type, service, commande, projet…"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">
            Type
          </label>
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
          >
            <option value="">Tous</option>
            {Object.entries(TRANSACTION_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">
            Paiement
          </label>
          <input
            value={filters.payment}
            onChange={(e) => setFilters({ ...filters, payment: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">
            Service
          </label>
          <select
            value={filters.service}
            onChange={(e) => setFilters({ ...filters, service: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
          >
            <option value="">Tous</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label className="text-xs font-medium text-gray-600 mb-1 block">
            Tri
          </label>
          <select
            value={filters.sort}
            onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
          >
            <option value="-createdAt">Plus récentes</option>
            <option value="createdAt">Plus anciennes</option>
            <option value="-amount">Montant ↓</option>
            <option value="amount">Montant ↑</option>
          </select>
        </div>
      </div>

      <div className="mt-4 flex justify-between text-xs text-gray-500">
        <span>{filteredCount} résultat(s)</span>
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
          className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
        >
          Réinitialiser
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 🧾 FORMULAIRE
// ============================================================================
function TransactionForm({
  form,
  setForm,
  selectedService,
  handleServiceChange,
  tasks,
  services,
  handleSubmit,
  creating,
  user,
}) {
  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-5 rounded-2xl border border-gray-200"
    >
      {/* Type */}
      <select
        value={form.type}
        onChange={(e) => setForm({ ...form, type: e.target.value })}
        className="border rounded px-3 py-2"
      >
        {Object.entries(TRANSACTION_TYPES).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>

      {/* Montant */}
      <input
        type="number"
        value={form.amount}
        onChange={(e) => setForm({ ...form, amount: e.target.value })}
        placeholder="Montant"
        required
        className="border rounded px-3 py-2"
      />

      {/* Devise */}
      <select
        value={form.currency}
        onChange={(e) => setForm({ ...form, currency: e.target.value })}
        className="border rounded px-3 py-2"
      >
        {Object.entries(CURRENCY_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>

      {/* Paiement */}
      <input
        value={form.paymentMethod}
        onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
        placeholder="Méthode de paiement"
        className="border rounded px-3 py-2"
      />

      {/* Service */}
      <select
        value={selectedService}
        onChange={handleServiceChange}
        className="border rounded px-3 py-2 sm:col-span-2"
      >
        <option value="">— Aucun service —</option>
        {services.map((s) => (
          <option key={s.id} value={s.id}>{s.title}</option>
        ))}
      </select>

      {/* Task */}
      {tasks.length > 0 && (
        <select
          value={form.taskId}
          onChange={(e) => setForm({ ...form, taskId: e.target.value })}
          className="border rounded px-3 py-2 sm:col-span-2"
        >
          <option value="">— Aucune tâche —</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
      )}

      {/* Projet / Commande */}
      {(user.role === 'admin' || user.role === 'agent' || user.role === 'master') && (
        <>
          <input
            type="number"
            placeholder="ID Projet"
            value={form.projectId}
            onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            className="border rounded px-3 py-2"
          />
          <input
            type="number"
            placeholder="ID Commande"
            value={form.orderId}
            onChange={(e) => setForm({ ...form, orderId: e.target.value })}
            className="border rounded px-3 py-2"
          />
        </>
      )}

      {/* Description */}
      <textarea
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        placeholder="Description"
        className="border rounded px-3 py-2 sm:col-span-2"
      />

      {/* File */}
      <input
        type="file"
        onChange={(e) =>
          setForm({ ...form, proofFile: e.target.files?.[0] || null })
        }
        className="sm:col-span-2"
      />

      <div className="sm:col-span-2 text-right">
        <button
          disabled={creating}
          className={`px-5 py-2 rounded text-white ${
            creating ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {creating ? 'Enregistrement…' : '💾 Enregistrer'}
        </button>
      </div>
    </form>
  );
}

// ============================================================================
// 📋 LISTE
// ============================================================================
function TransactionList({ transactions, loading, getUserDisplayName }) {
  if (loading) {
    return <p className="text-center text-gray-500">Chargement...</p>;
  }

  if (!transactions.length) {
    return <p className="text-center text-gray-500">Aucune transaction.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {transactions.map((t) => {
        const proof =
          t?.proofFile?.url ||
          (t?.proofFile?.path ? toAbsUrl(t.proofFile.path) : '');
        const proofKind = inferProofKind(t?.proofFile, proof);
        const proofLabel =
          t?.proofFile?.originalName ||
          t?.proofFile?.fileName ||
          t?.proofFile?.name ||
          '';
        const proofExt = getProofExtLabel(
          t?.proofFile,
          proof,
          proofKind === 'pdf' ? 'PDF' : 'FILE'
        );

        return (
          <div
            key={t.id}
            className="border rounded-2xl bg-white shadow-sm overflow-hidden"
          >
            {proof && (
              <a
                href={proof}
                target="_blank"
                rel="noreferrer"
                className="relative block aspect-[4/3] bg-gradient-to-br from-slate-50 via-white to-slate-100 border-b border-slate-200"
              >
                {proofKind === 'image' ? (
                  <img
                    src={proof}
                    alt="Preuve"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-xs font-semibold text-slate-700 bg-white/80 border border-slate-200 px-2 py-1 rounded-full inline-flex">
                        {proofExt}
                      </div>
                    </div>
                  </div>
                )}

                <span
                  className={`absolute top-3 left-3 text-[0.7rem] font-semibold px-2.5 py-1 rounded-full border ${
                    proofKind === 'image'
                      ? 'bg-blue-50 text-blue-700 border-blue-100'
                      : proofKind === 'pdf'
                      ? 'bg-red-50 text-red-700 border-red-100'
                      : 'bg-gray-50 text-gray-700 border-gray-200'
                  }`}
                >
                  {proofKind === 'image' ? 'IMAGE' : proofKind === 'pdf' ? 'PDF' : 'FICHIER'}
                </span>
              </a>
            )}

            <div className="p-4">
              <div className="font-bold">
                {Number(t.amount).toLocaleString('fr-FR')} {t.currencyLabel || t.currency}
              </div>

              <div className="text-xs text-gray-500 mt-1">
                {t.typeLabel} ? {t.statusLabel}
              </div>

              <p className="text-sm mt-2">{t.description || '?'}</p>

              {t.order && (
                <Link to={`/orders/${t.order.id}`} className="text-blue-600 text-sm">
                  Commande {t.order.code || `#${t.order.id}`}
                </Link>
              )}

              {t.project && (
                <Link to={`/projects/${t.project.id}`} className="text-blue-600 text-sm">
                  Projet {t.project.title || `#${t.project.id}`}
                </Link>
              )}

              {proof && (
                <a
                  href={proof}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center text-sm font-semibold text-blue-600 hover:underline mt-2 break-all"
                >
                  {proofLabel || 'Pi\u00e8ce jointe'}
                </a>
              )}

              <div className="text-xs text-gray-400 mt-3">
                Par {getUserDisplayName(t.user)} ?{' '}
                {new Date(t.createdAt).toLocaleDateString('fr-FR')}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
