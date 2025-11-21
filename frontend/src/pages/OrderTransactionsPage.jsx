// ============================================================
// OrderTransactionsPage.jsx — Teranga PRODUCTION READY (Option B)
// Clean Shop Premium + FILE_BASE + toAbsUrl + Optimisations
// ============================================================

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getOrderTransactions,
  createOrderTransaction,
} from '../services/transactions';
import { me } from '../services/auth';
import {
  applyLabels,
  TRANSACTION_TYPES,
  CURRENCY_LABELS,
} from '../utils/labels';

/* ============================================================
   🌍 PRODUCTION CONFIG — FILE_BASE / normalizePath / toAbsUrl()
   Compatible Render + Netlify, aucun localhost
============================================================ */
const FILE_BASE =
  (typeof window !== 'undefined' &&
    (window.__TERANGA_FILE_BASE_URL ||
      window.__TERANGA_API_BASE_URL ||
      '')) ||
  '';

function normalizePath(path = '') {
  if (!path) return '';
  const p = String(path).trim().replace(/\\/g, '/');
  if (/^https?:\/\//i.test(p)) return p;
  const start = p.startsWith('/') ? p : '/' + p;
  return start.replace(/\/{2,}/g, '/');
}

function toAbsUrl(path = '') {
  const norm = normalizePath(path);
  if (/^https?:\/\//i.test(norm)) return norm;

  return (
    FILE_BASE.replace(/\/$/, '') +
    '/' +
    norm.replace(/^\//, '')
  );
}

/* ============================================================
   Helpers
============================================================ */
function getUserDisplay(u) {
  if (!u) return '—';
  const first = u.firstName ?? u.firstname ?? '';
  const last = u.lastName ?? u.lastname ?? '';
  const full = `${first} ${last}`.trim();
  if (full) return full;
  if (u.name) return u.name;
  if (u.email) return u.email;
  return '—';
}

/* ============================================================
   ⭐ PAGE PRINCIPALE
============================================================ */
export default function OrderTransactionsPage() {
  const { id } = useParams(); // orderId
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  const [showForm, setShowForm] = useState(() => {
    const saved = localStorage.getItem('teranga_orderTransactions_showForm');
    return saved === null ? true : saved === '1';
  });

  const [form, setForm] = useState({
    type: 'revenue',
    amount: '',
    currency: 'XOF',
    paymentMethod: '',
    description: '',
    proofFile: null,
  });

  const [filters, setFilters] = useState({
    q: '',
    type: '',
    payment: '',
    sort: '-createdAt',
  });

  /* ============================================================
      Chargement transactions
  ============================================================ */
  const loadTransactions = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getOrderTransactions(id);
      const labeled = (data || []).map((t) =>
        t.statusLabel ? t : applyLabels(t)
      );
      setTransactions(labeled);
    } catch (err) {
      console.error('❌ Erreur chargement transactions commande:', err);
      alert('Erreur lors du chargement des transactions.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  /* ============================================================
      Init user + data
  ============================================================ */
  useEffect(() => {
    (async () => {
      try {
        const userData = await me();
        setUser(userData.user);
        await loadTransactions();
      } catch (err) {
        console.error('❌ Erreur init OrderTransactionsPage:', err);
        if (err?.response?.status === 401) {
          localStorage.removeItem('teranga_token');
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
      }
    })();
  }, [loadTransactions]);

  useEffect(() => {
    localStorage.setItem(
      'teranga_orderTransactions_showForm',
      showForm ? '1' : '0'
    );
  }, [showForm]);

  /* ============================================================
      ➕ Création transaction
  ============================================================ */
  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.amount || isNaN(parseFloat(form.amount))) {
      return alert('Montant invalide.');
    }
    try {
      const payload = {
        ...form,
        amount: parseFloat(form.amount),
      };
      await createOrderTransaction(id, payload);
      alert('✅ Transaction ajoutée');
      resetForm();
      await loadTransactions();
    } catch (err) {
      console.error('❌ Erreur ajout transaction:', err);
      alert("Erreur lors de l'ajout.");
    }
  }

  function resetForm() {
    setForm({
      type: 'revenue',
      amount: '',
      currency: 'XOF',
      paymentMethod: '',
      description: '',
      proofFile: null,
    });
  }

  /* ============================================================
      🔍 Filtres et tri
  ============================================================ */
  const filteredTransactions = useMemo(() => {
    let arr = [...transactions];

    if (filters.q.trim()) {
      const q = filters.q.trim().toLowerCase();
      arr = arr.filter((t) =>
        [
          t.typeLabel,
          t.statusLabel,
          t.description,
          t.paymentMethod,
          getUserDisplay(t.user),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }

    if (filters.type) {
      arr = arr.filter((t) => t.type === filters.type);
    }

    if (filters.payment) {
      const pay = filters.payment.toLowerCase();
      arr = arr.filter((t) =>
        (t.paymentMethod || '').toLowerCase().includes(pay)
      );
    }

    const by = filters.sort || '-createdAt';
    arr.sort((a, b) => {
      const sign = by.startsWith('-') ? -1 : 1;
      const key = by.replace(/^-/, '');
      let va;
      let vb;

      if (key === 'createdAt') {
        va = new Date(a.createdAt).getTime();
        vb = new Date(b.createdAt).getTime();
      } else if (key === 'amount') {
        va = Number(a.amount ?? 0);
        vb = Number(b.amount ?? 0);
      } else {
        va = a[key];
        vb = b[key];
      }

      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      return 0;
    });

    return arr;
  }, [transactions, filters]);

  /* ============================================================
      UI — État initial
  ============================================================ */
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-600 text-lg animate-pulse">Chargement…</p>
      </div>
    );
  }

  const canCreate = user.role === 'admin' || user.role === 'agent';

  /* ============================================================
      Rendu principal
  ============================================================ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 py-10">
      <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-2">
              💰 <span>Transactions de la commande #{id}</span>
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Suivi des paiements et mouvements financiers.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            {canCreate && (
              <button
                onClick={() => setShowForm((v) => !v)}
                className="px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-slate-800 text-white hover:bg-slate-900"
              >
                {showForm ? '➖ Masquer' : '➕ Nouvelle transaction'}
              </button>
            )}

            <button
              onClick={loadTransactions}
              disabled={loading}
              className={`px-4 py-2 text-sm font-semibold rounded-lg shadow-sm ${
                loading
                  ? 'bg-blue-300 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {loading ? 'Chargement…' : '🔄 Rafraîchir'}
            </button>

            <button
              onClick={() => navigate(`/orders/${id}`)}
              className="px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-gray-200 hover:bg-gray-300"
            >
              ← Retour
            </button>
          </div>
        </div>

        {/* FILTRES */}
        <TransactionFilters
          filters={filters}
          setFilters={setFilters}
          count={filteredTransactions.length}
        />

        {/* FORMULAIRE */}
        {canCreate && showForm && (
          <TransactionForm
            form={form}
            setForm={setForm}
            handleSubmit={handleSubmit}
            loading={loading}
          />
        )}

        {/* LISTE */}
        <TransactionList transactions={filteredTransactions} loading={loading} />
      </div>
    </div>
  );
}

/* ============================================================
   🔹 Sous-composants — Filtres / Formulaire / Liste
============================================================ */

function TransactionFilters({ filters, setFilters, count }) {
  return (
    <div className="mb-8 bg-gray-50 border border-gray-200 rounded-xl p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        
        {/* Recherche */}
        <input
          placeholder="🔎 Rechercher (type, statut, description...)"
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white"
        />

        {/* Type */}
        <select
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">Type (tous)</option>
          {Object.entries(TRANSACTION_TYPES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        {/* Méthode paiement */}
        <input
          placeholder="Méthode paiement"
          value={filters.payment}
          onChange={(e) =>
            setFilters({ ...filters, payment: e.target.value })
          }
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
        />

        {/* Tri */}
        <select
          value={filters.sort}
          onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
          className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="-createdAt">Plus récentes</option>
          <option value="createdAt">Plus anciennes</option>
          <option value="amount">Montant croissant</option>
          <option value="-amount">Montant décroissant</option>
        </select>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <div>{count} transaction(s)</div>
        <button
          onClick={() =>
            setFilters({ q: '', type: '', payment: '', sort: '-createdAt' })
          }
          className="px-3 py-1.5 bg-gray-200 rounded-md hover:bg-gray-300"
        >
          Réinitialiser
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   FORMULAIRE
============================================================ */
function TransactionForm({ form, setForm, handleSubmit, loading }) {
  return (
    <div className="mb-10">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        ➕ Nouvelle transaction
      </h2>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-5 rounded-xl border border-gray-200"
      >
        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type
          </label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
          >
            {Object.entries(TRANSACTION_TYPES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Montant */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Montant
          </label>
          <input
            type="number"
            step="0.01"
            placeholder="Ex : 25000"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
          />
        </div>

        {/* Devise */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Devise
          </label>
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
          >
            {Object.entries(CURRENCY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Méthode de paiement (optionnel)
          </label>
          <input
            placeholder="Ex : MoMo, Virement..."
            value={form.paymentMethod}
            onChange={(e) =>
              setForm({ ...form, paymentMethod: e.target.value })
            }
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
          />
        </div>

        {/* Description */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            rows={3}
            placeholder="Description (optionnelle)"
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
          />
        </div>

        {/* File */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Pièce jointe (optionnel)
          </label>
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx"
            onChange={(e) =>
              setForm({ ...form, proofFile: e.target.files?.[0] || null })
            }
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
          />
        </div>

        {/* Submit */}
        <div className="sm:col-span-2 text-right">
          <button
            type="submit"
            disabled={loading}
            className={`px-5 py-2.5 text-sm font-semibold rounded-lg shadow-sm ${
              loading
                ? 'bg-blue-300 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
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
   LISTE DES TRANSACTIONS
============================================================ */
function TransactionList({ transactions, loading }) {
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
        Aucune transaction trouvée.
      </p>
    );
  }

  return (
    <div className="grid gap-6">
      {transactions.map((t) => {
        const userDisplay = t.user ? getUserDisplay(t.user) : 'Système';
        const currencyLabel = t.currencyLabel || t.currency || 'XOF';

        return (
          <div
            key={t.id}
            className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 hover:shadow-md transition"
          >
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
              
              {/* Left block */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {t.typeLabel || t.type}
                  </span>

                  {t.statusLabel && (
                    <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {t.statusLabel}
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mt-2">
                  {Number(t.amount || 0).toLocaleString()} {currencyLabel}
                </h3>

                <p className="text-sm text-gray-600 mt-1">
                  {t.description || 'Aucune description fournie.'}
                </p>

                {t.paymentMethod && (
                  <p className="text-xs text-gray-500 mt-1">
                    Méthode :{' '}
                    <span className="font-medium">{t.paymentMethod}</span>
                  </p>
                )}
              </div>

              {/* Right block */}
              <div className="text-xs text-gray-500 text-right mt-1 sm:mt-0">
                <div>
                  Créée le{' '}
                  <strong>{new Date(t.createdAt).toLocaleDateString()}</strong>
                </div>
                <div>
                  à{' '}
                  <strong>{new Date(t.createdAt).toLocaleTimeString()}</strong>
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-col sm:flex-row justify-between text-sm">
              <div className="text-xs text-gray-500">
                Saisie par <strong>{userDisplay}</strong>
              </div>

              {t.proofFile?.path && (
                <a
                  href={toAbsUrl(t.proofFile.path)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center text-xs font-medium text-blue-600 hover:underline"
                >
                  📎 Voir la pièce jointe
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
