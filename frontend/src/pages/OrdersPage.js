// ============================================================
// OrdersPage.jsx — Teranga PRODUCTION READY (Option B Premium)
// Clean Shop, filtres, tri, formulaires, responsivité mobile
// ============================================================

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
   ⭐ Page Commandes — Clean Shop Premium
============================================================ */
export default function OrdersPage() {
  const [user, setUser] = useState(null);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

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

  /* ============================================================
     🔄 Loaders (useCallback pour éviter les recréations)
  ============================================================ */
  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOrders();
      setOrders(Array.isArray(data) ? data : []);
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
      const prods = await getProducts({ limit: 200 });
      setProducts(prods || []);
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
    async function init() {
      try {
        const ud = await me();
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
  }, [loadOrders, loadProducts]);

  // Persistance de l’affichage du formulaire
  useEffect(() => {
    localStorage.setItem('teranga_orders_showForm', showForm ? '1' : '0');
  }, [showForm]);

  /* ============================================================
     ➕ Création commande
  ============================================================ */
  async function handleCreate(e) {
    e.preventDefault();
    try {
      const payload = {
        customerNote: form.customerNote || '',
      };

      if (form.withItem && form.productId) {
        const prod = products.find(
          (p) => String(p.id) === String(form.productId)
        );

        const unit =
          form.unitPrice !== '' && form.unitPrice !== null
            ? Number(form.unitPrice)
            : Number(prod?.price || 0);

        payload.items = [
          {
            productId: Number(form.productId),
            quantity: Number(form.quantity) > 0 ? Number(form.quantity) : 1,
            unitPrice: unit,
          },
        ];
      }

      await createOrder(payload);

      // Reset propre
      setForm({
        customerNote: '',
        withItem: false,
        productId: '',
        quantity: 1,
        unitPrice: '',
      });

      await loadOrders();

      alert('✅ Commande créée avec succès.');
    } catch (err) {
      console.error('❌ Erreur création commande:', err);
      alert('Erreur lors de la création de la commande.');
    }
  }

  /* ============================================================
     🎛️ Filtres + tri (mémoïsés)
  ============================================================ */
  const filtered = useMemo(() => {
    return (orders || [])
      .filter((o) => {
        if (!filters.q.trim()) return true;
        const q = filters.q.trim().toLowerCase();
        return (
          [
            o.code,
            o.customer?.email,
            o.customerNote,
            o.orderStatus,
            o.paymentStatus,
            o.currency,
            String(o.totalAmount ?? ''),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q)
        );
      })
      .filter((o) => {
        if (!filters.status) return true;
        const canon = canonicalizeOrderStatus(filters.status);
        return o.orderStatus === canon;
      })
      .filter((o) => {
        if (!filters.payment) return true;
        const canon = canonicalizePaymentStatus(filters.payment);
        return o.paymentStatus === canon;
      })
      .sort((a, b) => {
        const by = filters.sort || '-createdAt';
        const sign = by.startsWith('-') ? -1 : 1;
        const key = by.replace(/^-/, '');

        let va = a[key];
        let vb = b[key];

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
        {/* 🧭 Header Premium Responsive */}
        {/* ===================================================== */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-8">
          <div className="max-w-full break-words">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-2">
              🧾 <span>Gestion des commandes</span>
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Suivi, filtrage et création de vos commandes.
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
              onClick={() => setShowForm((v) => !v)}
              className="w-full sm:w-auto px-4 py-2 text-sm bg-slate-800 text-white font-semibold rounded-lg shadow-sm hover:bg-slate-900 text-center"
            >
              {showForm ? '➖ Masquer' : '➕ Nouvelle commande'}
            </button>

            <button
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
        {/* 🎛️ Filtres Premium Responsive */}
        {/* ===================================================== */}
        <div className="mb-6 bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-5">
          {/* Recherche */}
          <div className="flex flex-col lg:flex-row gap-3 mb-4">
            <input
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              placeholder="🔎 Rechercher (email, code, montant...)"
              className="w-full border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-blue-500 break-words"
            />
          </div>

          {/* Sélecteurs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Statut */}
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Statut commande</option>
              <option value="created">Créée</option>
              <option value="processing">En traitement</option>
              <option value="shipped">Expédiée</option>
              <option value="delivered">Livrée</option>
              <option value="paid">Payée</option>
              <option value="cancelled">Annulée</option>
              <option value="refunded">Remboursée</option>
            </select>

            {/* Paiement */}
            <select
              value={filters.payment}
              onChange={(e) => setFilters({ ...filters, payment: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Paiement</option>
              <option value="unpaid">Non payée</option>
              <option value="partial">Partielle</option>
              <option value="paid">Payée</option>
              <option value="refunded">Remboursée</option>
            </select>

            {/* Tri */}
            <select
              value={filters.sort}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
              className="col-span-1 sm:col-span-2 lg:col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="-createdAt">Plus récentes</option>
              <option value="createdAt">Plus anciennes</option>
            </select>
          </div>

          {/* Reset + compteur */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-gray-500">
            <div>{filtered.length} commande(s)</div>

            <button
              onClick={() =>
                setFilters({ q: '', status: '', payment: '', sort: '-createdAt' })
              }
              className="px-3 py-1.5 bg-gray-200 rounded-md hover:bg-gray-300 font-medium w-full sm:w-auto text-center"
            >
              Réinitialiser
            </button>
          </div>
        </div>

        {/* ===================================================== */}
        {/* ➕ Formulaire création commande (Premium Responsive) */}
        {/* ===================================================== */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-5 mb-8"
          >
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
              />
            </div>

            {/* Ajouter un article */}
            <div className="mt-2">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
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
                />
                <span>Ajouter un article à la création</span>
              </label>
            </div>

            {form.withItem && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
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
                        {p.name} — {Number(p.price || 0).toLocaleString('fr-FR')}{' '}
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
                    placeholder="Laissez vide pour PU du produit"
                  />
                </div>
              </div>
            )}

            <div className="mt-4 text-right">
              <button
                type="submit"
                className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold rounded-lg shadow-sm bg-blue-600 text-white hover:bg-blue-700"
              >
                ➕ Créer la commande
              </button>
            </div>
          </form>
        )}

        {/* ===================================================== */}
        {/* 📄 LISTE Commandes — Cards responsive */}
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

              return (
                <div
                  key={o.id}
                  className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 sm:p-5 hover:shadow-md transition w-full break-words"
                >
                  {/* En-tête commande */}
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 break-words">
                        {o.code || `Commande #${o.id}`}
                      </h3>

                      <p className="text-sm text-gray-600 mt-1 break-words">
                        Client : {o.customer?.email || '—'} • Montant :{' '}
                        <strong>
                          {total.toLocaleString('fr-FR')} {formatCurrency(currency)}
                        </strong>
                      </p>

                      <p className="text-xs text-gray-500 mt-1 break-words">
                        Statut : {formatStatus(o.orderStatus, 'order')} • Paiement :{' '}
                        {formatStatus(o.paymentStatus, 'payment')}
                      </p>
                    </div>

                    <div className="sm:text-right text-xs text-gray-500 whitespace-nowrap">
                      {o.createdAt
                        ? new Date(o.createdAt).toLocaleString('fr-FR')
                        : '—'}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-3 flex flex-col sm:flex-row flex-wrap gap-2">
                    <Link
                      to={`/orders/${o.id}`}
                      className="w-full sm:w-auto px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-center"
                    >
                      📄 Ouvrir
                    </Link>

                    <Link
                      to={`/orders/${o.id}/transactions`}
                      className="w-full sm:w-auto px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900 text-center"
                    >
                      💰 Transactions
                    </Link>
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
