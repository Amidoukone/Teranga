// ============================================================
// OrdersPage.jsx — Teranga PRODUCTION READY (Option B Premium)
// Clean Shop, filtres, tri, formulaires, responsivité mobile
// Design B : Style marketplace / SaaS Pro 2025
// ============================================================

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getOrders, createOrder } from '../services/orders';
import { getProducts } from '../services/products';
import { me } from '../services/auth';
import {
  formatCurrency,
  formatStatus,
  canonicalizeOrderStatus,
  canonicalizePaymentStatus,
} from '../utils/labels';

/* ============================================================
   🎨 Helpers de style pour les statuts (Badges / Timeline)
============================================================ */
function getOrderStatusStyle(status) {
  const canon = canonicalizeOrderStatus(status);

  switch (canon) {
    case 'created':
      return 'bg-slate-100 text-slate-700 border border-slate-200';
    case 'processing':
      return 'bg-blue-50 text-blue-700 border border-blue-100';
    case 'shipped':
      return 'bg-indigo-50 text-indigo-700 border border-indigo-100';
    case 'delivered':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
    case 'cancelled':
      return 'bg-rose-50 text-rose-700 border border-rose-100';
    case 'refunded':
      return 'bg-amber-50 text-amber-700 border border-amber-100';
    default:
      return 'bg-slate-50 text-slate-600 border border-slate-100';
  }
}

function getPaymentStatusStyle(status) {
  const canon = canonicalizePaymentStatus(status);

  switch (canon) {
    case 'paid':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
    case 'partial':
      return 'bg-amber-50 text-amber-700 border border-amber-100';
    case 'unpaid':
      return 'bg-slate-100 text-slate-700 border border-slate-200';
    case 'refunded':
      return 'bg-rose-50 text-rose-700 border border-rose-100';
    default:
      return 'bg-slate-50 text-slate-600 border border-slate-100';
  }
}

/* ============================================================
   ✅ Helpers API (compat array OU { orders/products })
============================================================ */
function normalizeListResponse(data, key) {
  if (Array.isArray(data)) return data;
  const arr = data?.[key];
  return Array.isArray(arr) ? arr : [];
}

/* ============================================================
   ⭐ Page Commandes — Clean Shop Premium (Style B)
============================================================ */
export default function OrdersPage() {
  const [user, setUser] = useState(null);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Produits pour création rapide de commande
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [filters, setFilters] = useState({
    q: '',
    status: '',
    payment: '',
    sort: '-createdAt',
  });

  const [showForm, setShowForm] = useState(() => {
    const saved = localStorage.getItem('teranga_orders_showForm');
    return saved === null ? true : saved === '1';
  });

  const [form, setForm] = useState({
    customerNote: '',
    withItem: false,
    productId: '',
    quantity: 1,
    unitPrice: '',
  });

  const navigate = useNavigate();

  /* ============================================================
     🔄 Loaders (useCallback pour éviter les recréations)
  ============================================================ */
  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOrders();
      setOrders(normalizeListResponse(data, 'orders'));
    } catch (e) {
      console.error('❌ Erreur chargement commandes:', e);
      alert('Erreur lors du chargement des commandes.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const data = await getProducts({ limit: 200 });
      setProducts(normalizeListResponse(data, 'products'));
    } catch (e) {
      console.error('❌ Erreur chargement produits:', e);
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  /* ============================================================
     🔄 Initialisation
  ============================================================ */
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const ud = await me();
        if (!mounted) return;
        setUser(ud.user);
        await Promise.all([loadOrders(), loadProducts()]);
      } catch (e) {
        console.error('❌ Erreur init OrdersPage:', e);
        if (e?.response?.status === 401) {
          localStorage.removeItem('teranga_token');
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
      }
    }

    init();
    return () => {
      mounted = false;
    };
  }, [loadOrders, loadProducts]);

  // Persistance de l’affichage du formulaire
  useEffect(() => {
    localStorage.setItem('teranga_orders_showForm', showForm ? '1' : '0');
  }, [showForm]);

  /* ============================================================
     ➕ Création commande (avec protection anti double-submit)
  ============================================================ */
  async function handleCreate(e) {
    e.preventDefault();
    if (creating) return;

    try {
      setCreating(true);

      const payload = {
        customerNote: form.customerNote || '',
      };

      if (form.withItem && form.productId) {
        const prod = products.find((p) => String(p.id) === String(form.productId));

        const unit =
          form.unitPrice !== '' && form.unitPrice !== null
            ? Number(form.unitPrice)
            : Number(prod?.price || 0);

        payload.items = [
          {
            productId: Number(form.productId),
            quantity: Number(form.quantity) > 0 ? Number(form.quantity) : 1,
            unitPrice: Number.isFinite(unit) ? unit : 0,
          },
        ];
      }

      const newOrder = await createOrder(payload);

      // Reset propre
      setForm({
        customerNote: '',
        withItem: false,
        productId: '',
        quantity: 1,
        unitPrice: '',
      });

      alert('✅ Commande créée avec succès.');

      // Redirection automatique vers la commande
      const id = newOrder?.id || newOrder?.order?.id;
      if (id) {
        navigate(`/orders/${id}`);
      } else {
        await loadOrders();
      }
    } catch (err) {
      console.error('❌ Erreur création commande:', err);
      alert('Erreur lors de la création de la commande.');
    } finally {
      setCreating(false);
    }
  }

  /* ============================================================
     🎛️ Filtres + tri (mémoïsés) — canon robustes
  ============================================================ */
  const filtered = useMemo(() => {
    return (orders || [])
      .filter((o) => {
        const term = (filters.q || '').trim().toLowerCase();
        if (!term) return true;

        const blob = [
          o.code,
          o.customer?.email,
          o.customerNote,
          o.orderStatus,
          o.paymentStatus,
          o.currency,
          String(o.totalAmount ?? ''),
          String(o.id ?? ''),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return blob.includes(term);
      })
      .filter((o) => {
        if (!filters.status) return true;
        const want = canonicalizeOrderStatus(filters.status);
        const got = canonicalizeOrderStatus(o.orderStatus);
        return got === want;
      })
      .filter((o) => {
        if (!filters.payment) return true;
        const want = canonicalizePaymentStatus(filters.payment);
        const got = canonicalizePaymentStatus(o.paymentStatus);
        return got === want;
      })
      .sort((a, b) => {
        const by = filters.sort || '-createdAt';
        const sign = by.startsWith('-') ? -1 : 1;
        const key = by.replace(/^-/, '');

        let va = a?.[key];
        let vb = b?.[key];

        if (key === 'createdAt') {
          va = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          vb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        } else if (key === 'totalAmount') {
          va = Number(a.totalAmount ?? 0);
          vb = Number(b.totalAmount ?? 0);
        }

        if (va < vb) return -1 * sign;
        if (va > vb) return 1 * sign;
        return 0;
      });
  }, [orders, filters]);

  /* ============================================================
     🧱 UI principale — wrapper + skeleton
  ============================================================ */
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-600 text-lg animate-pulse">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-3 py-8 sm:px-4 sm:py-10">
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 p-4 sm:p-8">

        {/* ===================================================== */}
        {/* 🧭 Header Premium Responsive (Style B) */}
        {/* ===================================================== */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-8">
          <div className="max-w-full break-words">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-2">
              🧾 <span>Gestion des commandes</span>
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Suivi complet, filtres avancés et création rapide de commandes.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Link
              to="/shop"
              className="w-full sm:w-auto px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg shadow-sm hover:bg-blue-700 text-center"
            >
              🛍️ Voir catalogue
            </Link>

            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="w-full sm:w-auto px-4 py-2 text-sm bg-slate-900 text-white font-semibold rounded-lg shadow-sm hover:bg-black text-center"
            >
              {showForm ? '➖ Masquer' : '➕ Nouvelle commande'}
            </button>

            <button
              type="button"
              onClick={loadOrders}
              disabled={loading}
              className={`w-full sm:w-auto px-4 py-2 text-sm font-semibold rounded-lg shadow-sm text-center ${
                loading
                  ? 'bg-blue-300 cursor-not-allowed text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {loading ? 'Chargement…' : '🔄 Rafraîchir'}
            </button>
          </div>
        </div>

        {/* ===================================================== */}
        {/* 🎛️ Filtres Premium Responsive (Style SaaS) */}
        {/* ===================================================== */}
        <div className="mb-6 bg-gray-50 border border-gray-200 rounded-2xl p-4 sm:p-5">
          {/* Recherche */}
          <div className="flex flex-col lg:flex-row gap-3 mb-4">
            <div className="w-full lg:w-2/3">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Rechercher
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  🔍
                </span>
                <input
                  value={filters.q}
                  onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                  placeholder="Email client, code commande, montant, statut..."
                  className="w-full border border-gray-300 rounded-xl pl-8 pr-3 py-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-blue-500 break-words"
                />
              </div>
            </div>

            <div className="w-full lg:w-1/3 flex items-end justify-end">
              <div className="text-xs text-slate-500 flex flex-col items-start lg:items-end gap-1 w-full">
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-white border border-slate-200 shadow-sm">
                  {filtered.length} commande{filtered.length > 1 ? 's' : ''} affichée
                  {filtered.length > 1 ? 's' : ''} / {orders.length}
                </span>
              </div>
            </div>
          </div>

          {/* Sélecteurs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Statut commande */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Statut commande
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white w-full"
              >
                <option value="">Tous</option>
                <option value="created">Créée</option>
                <option value="processing">En traitement</option>
                <option value="shipped">Expédiée</option>
                <option value="delivered">Livrée</option>
                <option value="cancelled">Annulée</option>
                <option value="refunded">Remboursée</option>
              </select>
            </div>

            {/* Paiement */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Statut paiement
              </label>
              <select
                value={filters.payment}
                onChange={(e) => setFilters({ ...filters, payment: e.target.value })}
                className="border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white w-full"
              >
                <option value="">Tous</option>
                <option value="unpaid">Non payée</option>
                <option value="partial">Partielle</option>
                <option value="paid">Payée</option>
                <option value="refunded">Remboursée</option>
              </select>
            </div>

            {/* Tri */}
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Trier par
              </label>
              <select
                value={filters.sort}
                onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
                className="border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white w-full"
              >
                <option value="-createdAt">Plus récentes</option>
                <option value="createdAt">Plus anciennes</option>
                <option value="-totalAmount">Montant décroissant</option>
                <option value="totalAmount">Montant croissant</option>
              </select>
            </div>
          </div>

          {/* Reset + compteur en bas */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <span>Filtre(s) actif(s) :</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white border border-slate-200">
                {[
                  filters.q && 'Recherche',
                  filters.status && 'Statut',
                  filters.payment && 'Paiement',
                ].filter(Boolean).length || 'Aucun'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setFilters({ q: '', status: '', payment: '', sort: '-createdAt' })}
              className="px-3 py-1.5 bg-gray-200 rounded-md hover:bg-gray-300 font-medium w-full sm:w-auto text-center"
            >
              Réinitialiser tous les filtres
            </button>
          </div>
        </div>
        {/* ===================================================== */}
        {/* ➕ Formulaire création commande (Premium Responsive) */}
        {/* ===================================================== */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="bg-gray-50 border border-gray-200 rounded-2xl p-4 sm:p-6 mb-8"
          >
            <h2 className="text-lg font-semibold text-slate-900 mb-3">
              ➕ Nouvelle commande
            </h2>

            {/* Note client */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note client (optionnel)
              </label>
              <textarea
                rows={3}
                value={form.customerNote}
                onChange={(e) =>
                  setForm((f) => ({ ...f, customerNote: e.target.value }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 break-words"
                placeholder="Informations particulières, adresse, consignes..."
              />
            </div>

            {/* Ajouter un article */}
            <div className="mt-2 flex items-center gap-2">
              <input
                id="withItem"
                type="checkbox"
                checked={form.withItem}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    withItem: e.target.checked,
                    productId: e.target.checked ? f.productId : '',
                    quantity: e.target.checked ? f.quantity : 1,
                    unitPrice: e.target.checked ? f.unitPrice : '',
                  }))
                }
                className="rounded border-gray-300"
              />
              <label
                htmlFor="withItem"
                className="text-sm text-gray-700 cursor-pointer"
              >
                Ajouter un article dès la création
              </label>
            </div>

            {form.withItem && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
                {/* Produit */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Produit
                  </label>
                  <select
                    disabled={loadingProducts}
                    value={form.productId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, productId: e.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">— Sélectionner —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} —{' '}
                        {Number(p.price || 0).toLocaleString('fr-FR')}{' '}
                        {formatCurrency(p.currency || 'XOF')}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quantité */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantité
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.quantity}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, quantity: e.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                  />
                </div>

                {/* PU */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    PU (optionnel)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.unitPrice}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, unitPrice: e.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                    placeholder="PU du produit par défaut"
                  />
                </div>
              </div>
            )}

            {/* Bouton soumission */}
            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                disabled={creating}
                className={`w-full sm:w-auto px-5 py-2.5 text-sm font-semibold rounded-lg shadow-sm ${
                  creating
                    ? 'bg-blue-300 cursor-not-allowed text-white'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {creating ? 'Création…' : '➕ Créer la commande'}
              </button>
            </div>
          </form>
        )}

        {/* ===================================================== */}
        {/* 📄 LISTE Commandes — Cards marketplace style B */}
        {/* ===================================================== */}
        {loading ? (
          <p className="text-gray-500 italic text-center py-6">
            Chargement…
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500 italic text-center py-6">
            Aucune commande trouvée.
          </p>
        ) : (
          <div className="grid gap-5">
            {filtered.map((o) => {
              const currency = o.currency || 'XOF';
              const total = Number(o.totalAmount || 0);

              const orderStatusChip = formatStatus(o.orderStatus, 'order');
              const paymentStatusChip = formatStatus(o.paymentStatus, 'payment');

              const orderStatusClass = getOrderStatusStyle(o.orderStatus);
              const paymentStatusClass = getPaymentStatusStyle(o.paymentStatus);

              return (
                <div
                  key={o.id}
                  className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition w-full break-words overflow-hidden"
                >
                  {/* Bandeau supérieur */}
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 px-4 sm:px-5 pt-4 pb-3 border-b border-gray-100 bg-slate-50/60">
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 break-words">
                        {o.code || `Commande #${o.id}`}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5 break-words">
                        ID interne : {o.id}
                      </p>
                    </div>

                    <div className="flex flex-col items-start sm:items-end text-xs text-gray-500">
                      <span>
                        {o.createdAt
                          ? new Date(o.createdAt).toLocaleString('fr-FR')
                          : '—'}
                      </span>
                      {o.updatedAt && (
                        <span className="mt-0.5">
                          MAJ :{' '}
                          {new Date(o.updatedAt).toLocaleString('fr-FR')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Corps */}
                  <div className="px-4 sm:px-5 py-4 flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                      <div className="text-sm text-gray-700 space-y-1">
                        <p>
                          <span className="font-medium text-gray-800">
                            Client :
                          </span>{' '}
                          {o.customer?.email || '—'}
                        </p>
                        {o.customerNote && (
                          <p className="text-xs text-gray-500">
                            <span className="font-medium">Note :</span>{' '}
                            {o.customerNote}
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        <p className="text-[11px] uppercase text-slate-400">
                          Montant
                        </p>
                        <p className="text-lg font-bold text-blue-600">
                          {total.toLocaleString('fr-FR')}{' '}
                          {formatCurrency(currency)}
                        </p>
                      </div>
                    </div>

                    {/* Statuts */}
                    <div className="flex flex-wrap gap-2 items-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${orderStatusClass}`}
                      >
                        Commande : {orderStatusChip}
                      </span>

                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${paymentStatusClass}`}
                      >
                        Paiement : {paymentStatusChip}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-4 sm:px-5 pb-4 pt-2 border-t border-gray-100 bg-slate-50/60">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Link
                        to={`/orders/${o.id}`}
                        className="w-full sm:w-auto px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-center"
                      >
                        📄 Ouvrir la commande
                      </Link>

                      <Link
                        to={`/orders/${o.id}/transactions`}
                        className="w-full sm:w-auto px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900 text-center"
                      >
                        💰 Transactions
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
