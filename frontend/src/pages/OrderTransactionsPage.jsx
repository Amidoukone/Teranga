// ============================================================
// OrderTransactionsPage.jsx — Teranga PRODUCTION READY (Option B2-A)
// Clean Shop Premium + FILE_BASE + toAbsUrl + Optimisations visuelles
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-3 sm:px-4 py-8 sm:py-10">
      <div className="max-w-6xl mx-auto bg-white/95 backdrop-blur-sm shadow-xl rounded-2xl p-4 sm:p-8 border border-gray-100 transition-all duration-150 ease-out">
        
        {/* HEADER — 100% responsive mobile / tablette / desktop */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6 sm:mb-8">
          {/* Bloc titre */}
          <div className="max-w-full break-words">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-2">
              💰 <span>Transactions de la commande #{id}</span>
            </h1>
            <p className="text-sm text-slate-600 mt-1 break-words">
              Suivi des paiements et mouvements financiers associés à cette commande.
            </p>
          </div>

          {/* Boutons actions (stack sur mobile, inline sur desktop) */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full sm:w-auto sm:justify-end">
            {canCreate && (
              <button
                onClick={() => setShowForm((v) => !v)}
                className="w-full sm:w-auto px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-slate-800 text-white hover:bg-slate-900 transition-all duration-150 text-center"
              >
                {showForm ? '➖ Masquer' : '➕ Nouvelle transaction'}
              </button>
            )}

            <button
              onClick={loadTransactions}
              disabled={loading}
              className={`w-full sm:w-auto px-4 py-2 text-sm font-semibold rounded-lg shadow-sm text-center transition-all duration-150 ${
                loading
                  ? 'bg-blue-300 cursor-not-allowed text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {loading ? 'Chargement…' : '🔄 Rafraîchir'}
            </button>

            <button
              onClick={() => navigate(`/orders/${id}`)}
              className="w-full sm:w-auto px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-gray-200 hover:bg-gray-300 text-center transition-all duration-150"
            >
              ← Retour commande
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
        <TransactionList
          transactions={filteredTransactions}
          loading={loading}
        />
      </div>
    </div>
  );
} 

/* ============================================================
   🔹 Sous-composants — Filtres / Formulaire / Liste
============================================================ */

function TransactionFilters({ filters, setFilters, count }) {
  return (
    <div className="mb-8 bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm">
      {/* Ligne recherche seule — pleine largeur, plus respirable */}
      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        <input
          placeholder="🔎 Rechercher (type, statut, description, méthode, utilisateur...)"
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm break-words transition-all duration-150"
        />
      </div>

      {/* Ligne filtres compactes mais fluides */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Type */}
        <select
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-150"
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
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-150"
        />

        {/* Tri — prend plus de place sur les grands écrans */}
        <select
          value={filters.sort}
          onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white w-full sm:col-span-2 lg:col-span-4 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-150"
        >
          <option value="-createdAt">Plus récentes</option>
          <option value="createdAt">Plus anciennes</option>
          <option value="amount">Montant croissant</option>
          <option value="-amount">Montant décroissant</option>
        </select>
      </div>

      {/* Bas de bloc : compteur + reset (stack sur mobile) */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-gray-500">
        <div className="inline-flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400/80" />
          <span>{count} transaction(s) trouvée(s)</span>
        </div>
        <button
          onClick={() =>
            setFilters({ q: '', type: '', payment: '', sort: '-createdAt' })
          }
          className="w-full sm:w-auto px-3 py-1.5 bg-gray-200 rounded-md hover:bg-gray-300 font-medium text-center transition-all duration-150"
        >
          Réinitialiser les filtres
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
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        ➕ <span>Nouvelle transaction</span>
      </h2>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 sm:p-5 rounded-xl border border-gray-200 shadow-sm"
      >
        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type
          </label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-150"
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
            placeholder="Ex : 25 000"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-150"
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
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-150"
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
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-150"
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
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-150"
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
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-150"
          />
        </div>

        {/* Submit */}
        <div className="sm:col-span-2 text-right">
          <button
            type="submit"
            disabled={loading}
            className={`w-full sm:w-auto px-5 py-2.5 text-sm font-semibold rounded-lg shadow-sm transition-all duration-150 ${
              loading
                ? 'bg-blue-300 cursor-not-allowed text-white'
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

        // Accent subtil par type
        let accentClass =
          'border-l-4 border-l-slate-200';
        if (t.type === 'revenue') {
          accentClass = 'border-l-4 border-l-emerald-400/80';
        } else if (t.type === 'expense') {
          accentClass = 'border-l-4 border-l-rose-400/80';
        } else if (t.type === 'commission') {
          accentClass = 'border-l-4 border-l-amber-400/80';
        } else if (t.type === 'adjustment') {
          accentClass = 'border-l-4 border-l-blue-400/80';
        }

        // Couleurs badge type
        let typeBadge =
          'bg-slate-100 text-slate-700 border border-slate-200';
        if (t.type === 'revenue') {
          typeBadge = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
        } else if (t.type === 'expense') {
          typeBadge = 'bg-rose-50 text-rose-700 border border-rose-200';
        } else if (t.type === 'commission') {
          typeBadge = 'bg-amber-50 text-amber-700 border border-amber-200';
        } else if (t.type === 'adjustment') {
          typeBadge = 'bg-blue-50 text-blue-700 border border-blue-200';
        }

        return (
          <div
            key={t.id}
            className={`bg-white border border-gray-200 rounded-xl shadow-sm p-5 hover:shadow-md hover:-translate-y-[1px] transition-all duration-150 ease-out ${accentClass}`}
          >
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
              {/* Left block */}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex px-2 py-0.5 text-xs rounded-full ${typeBadge}`}
                  >
                    {t.typeLabel || t.type}
                  </span>

                  {t.statusLabel && (
                    <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {t.statusLabel}
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mt-2 break-words">
                  {Number(t.amount || 0).toLocaleString('fr-FR')} {currencyLabel}
                </h3>

                <p className="text-sm text-gray-600 mt-1 break-words">
                  {t.description || 'Aucune description fournie.'}
                </p>

                {t.paymentMethod && (
                  <p className="text-xs text-gray-500 mt-1 break-words">
                    Méthode :{' '}
                    <span className="font-medium">{t.paymentMethod}</span>
                  </p>
                )}
              </div>

              {/* Right block */}
              <div className="text-xs text-gray-500 text-right mt-1 sm:mt-0 whitespace-nowrap">
                <div>
                  Créée le{' '}
                  <strong>
                    {new Date(t.createdAt).toLocaleDateString('fr-FR')}
                  </strong>
                </div>
                <div>
                  à{' '}
                  <strong>
                    {new Date(t.createdAt).toLocaleTimeString('fr-FR')}
                  </strong>
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-col sm:flex-row justify-between text-sm gap-1 sm:gap-0">
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
