// frontend/src/pages/OrderTransactionsPage.jsx
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getOrderTransactions,
  createOrderTransaction,
} from '../services/transactions';
import { me } from '../services/auth';
import { applyLabels, TRANSACTION_TYPES, CURRENCY_LABELS } from '../utils/labels';

/**
 * ============================================================
 * 💰 OrderTransactionsPage — Transactions liées à une commande
 * ============================================================
 * - Liste + création de transactions liées à une commande
 * - Compatible avec la structure commerce actuelle
 * - Rôles :
 *   • Admin : voir toutes, créer et modifier
 *   • Agent : voir et créer si autorisé
 *   • Client : voir uniquement ses transactions liées
 * ============================================================
 */

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
     🔹 Charge la liste des transactions (mémoïsé)
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
      alert('Erreur lors du chargement des transactions de la commande.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  /* ============================================================
     🔹 Initialisation utilisateur + transactions
  ============================================================ */
  useEffect(() => {
    (async () => {
      try {
        const userData = await me();
        setUser(userData.user);
        await loadTransactions();
      } catch (err) {
        console.error('❌ Erreur init OrderTransactionsPage:', err);
        const status = err?.response?.status;
        if (status === 401) {
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
     🔹 Création d'une transaction liée à la commande
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
      alert('✅ Transaction ajoutée à la commande avec succès');
      resetForm();
      await loadTransactions();
    } catch (err) {
      console.error('❌ Erreur ajout transaction commande:', err);
      alert("Erreur lors de l'ajout de la transaction.");
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
     🔍 Filtres dynamiques + tri
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
          t.user?.email,
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

    const by = filters.sort || '-createdAt';
    arr.sort((a, b) => {
      const sign = by.startsWith('-') ? -1 : 1;
      const key = by.replace(/^-/, '');
      let va, vb;
      if (key === 'createdAt') {
        va = new Date(a.createdAt).getTime();
        vb = new Date(b.createdAt).getTime();
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
     🔹 UI
  ============================================================ */
  if (!user)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-600 text-lg animate-pulse">Chargement…</p>
      </div>
    );

  const canCreate = user.role === 'admin' || user.role === 'agent'; // client ne peut pas créer

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 py-10">
      <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
        {/* 🧭 En-tête */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              💰 Transactions de la commande #{id}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Connecté en tant que <strong>{user.email}</strong> ({user.role})
            </p>
          </div>

          <div className="flex gap-2">
            {canCreate && (
              <button
                onClick={() => setShowForm((v) => !v)}
                className="px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-slate-800 text-white hover:bg-slate-900 transition"
              >
                {showForm ? '➖ Masquer le formulaire' : '➕ Nouvelle transaction'}
              </button>
            )}

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

            <button
              onClick={() => navigate(`/orders/${id}`)}
              className="px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-gray-200 hover:bg-gray-300 transition"
            >
              ← Retour à la commande
            </button>
          </div>
        </div>

        {/* 🔍 Barre de filtres */}
        <TransactionFilters
          filters={filters}
          setFilters={setFilters}
          count={filteredTransactions.length}
        />

        {/* ➕ Formulaire de création */}
        {canCreate && showForm && (
          <TransactionForm
            form={form}
            setForm={setForm}
            handleSubmit={handleSubmit}
            loading={loading}
          />
        )}

        {/* 📜 Liste des transactions */}
        <TransactionList transactions={filteredTransactions} loading={loading} />
      </div>
    </div>
  );
}

/* ============================================================
   🔹 Sous-composants : Filtres / Formulaire / Liste
============================================================ */

function TransactionFilters({ filters, setFilters, count }) {
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
        <div className="text-xs text-gray-500">{count} transaction(s)</div>
        <button
          onClick={() =>
            setFilters({ q: '', type: '', payment: '', sort: '-createdAt' })
          }
          className="text-xs px-3 py-1.5 bg-gray-200 rounded-md hover:bg-gray-300 font-medium transition"
        >
          Réinitialiser
        </button>
      </div>
    </div>
  );
}

function TransactionForm({ form, setForm, handleSubmit, loading }) {
  return (
    <div className="mb-10">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        ➕ Nouvelle transaction (commande)
      </h2>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-5 rounded-xl border border-gray-200"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type
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
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Devise
          </label>
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

        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
          className="sm:col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        />

        <input
          type="file"
          // Aligné avec le backend (uploadEvidence.middleware)
          accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx"
          onChange={(e) =>
            setForm({ ...form, proofFile: e.target.files?.[0] || null })
          }
          className="sm:col-span-2 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 bg-white"
        />

        <div className="col-span-2 text-right">
          <button
            type="submit"
            disabled={loading}
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

function TransactionList({ transactions, loading }) {
  if (loading)
    return (
      <p className="text-gray-500 italic text-center py-6">
        Chargement des transactions…
      </p>
    );

  if (transactions.length === 0)
    return (
      <p className="text-gray-500 italic text-center py-6">
        Aucune transaction trouvée pour cette commande.
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
                {t.typeLabel || t.type} — {t.amount}{' '}
                {t.currencyLabel || t.currency}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {t.statusLabel ? `Statut : ${t.statusLabel}` : ''}
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
              <strong>{t.user?.email || 'Système'}</strong>
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
