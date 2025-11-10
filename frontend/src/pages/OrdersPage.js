// frontend/src/pages/OrdersPage.js
import { useEffect, useMemo, useState } from 'react';
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

/**
 * ============================================================
 * 🧾 Commandes — Page Liste + Création rapide
 * ============================================================
 * - Charge les commandes (selon rôle)
 * - Filtres : texte, statut, paiement, tri
 * - Création : simple ou avec 1er article
 * ============================================================
 */
export default function OrdersPage() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  // Produits (pour ajout rapide)
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
     🔹 Initialisation (auth + données)
  ============================================================ */
  useEffect(() => {
    async function init() {
      try {
        const ud = await me();
        setUser(ud.user);
        await Promise.all([loadOrders(), loadProducts()]);
      } catch (e) {
        const status = e?.response?.status;
        if (status === 401) {
          localStorage.removeItem('teranga_token');
          localStorage.removeItem('token');
          window.location.href = '/login';
        } else {
          console.error('❌ init OrdersPage:', e);
        }
      }
    }
    init();
  }, []);

  useEffect(() => {
    localStorage.setItem('teranga_orders_showForm', showForm ? '1' : '0');
  }, [showForm]);

  /* ============================================================
     🔹 Chargement des commandes
  ============================================================ */
  async function loadOrders() {
    setLoading(true);
    try {
      const data = await getOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('❌ loadOrders:', e);
      alert('Erreur lors du chargement des commandes.');
    } finally {
      setLoading(false);
    }
  }

  async function loadProducts() {
    setLoadingProducts(true);
    try {
      const prods = await getProducts({ limit: 200 });
      setProducts(Array.isArray(prods) ? prods : []);
    } catch (e) {
      console.error('❌ loadProducts (OrdersPage):', e);
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }

  /* ============================================================
     🔹 Création de commande
  ============================================================ */
  async function handleCreate(e) {
    e.preventDefault();
    try {
      const payload = {
        customerNote: form.customerNote || '',
      };

      // Ajout du premier article si activé
      if (form.withItem && form.productId) {
        const prod = products.find((p) => String(p.id) === String(form.productId));
        const unit = form.unitPrice !== '' && form.unitPrice !== null
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
      setForm({
        customerNote: '',
        withItem: false,
        productId: '',
        quantity: 1,
        unitPrice: '',
      });
      await loadOrders();
      alert('✅ Commande créée avec succès');
    } catch (e) {
      console.error('❌ createOrder:', e);
      alert('Erreur lors de la création de la commande.');
    }
  }

  /* ============================================================
     🔎 Filtres + Tri
  ============================================================ */
  const filtered = useMemo(() => {
    return (orders || [])
      .filter((o) => {
        if (!filters.q.trim()) return true;
        const q = filters.q.toLowerCase();
        return [
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
          .includes(q);
      })
      .filter((o) => {
        if (!filters.status) return true;
        const canon = canonicalizeOrderStatus(filters.status);
        return o.orderStatus === canon;
      })
      .filter((o) => {
        if (!filters.payment) return true;
        const canonPay = canonicalizePaymentStatus(filters.payment);
        return o.paymentStatus === canonPay;
      })
      .sort((a, b) => {
        const by = filters.sort || '-createdAt';
        const sign = by.startsWith('-') ? -1 : 1;
        const key = by.replace(/^-/, '');

        let va = a[key];
        let vb = b[key];

        if (key === 'createdAt') {
          va = new Date(a.createdAt).getTime();
          vb = new Date(b.createdAt).getTime();
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
     🔹 UI
  ============================================================ */
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-600 text-lg animate-pulse">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 py-10">
      <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-2xl p-8 border border-gray-100">

        {/* 🧭 En-tête */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🛒 Commandes</h1>
            <p className="text-sm text-gray-600 mt-1">
              Connecté en tant que <strong>{user.email}</strong> ({user.role})
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              to="/shop"
              className="px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-cyan-600 text-white hover:bg-cyan-700 transition"
            >
              🛍️ Ouvrir le catalogue
            </Link>

            <button
              onClick={() => setShowForm((v) => !v)}
              className="px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-slate-800 text-white hover:bg-slate-900 transition"
            >
              {showForm ? '➖ Masquer le formulaire' : '➕ Nouvelle commande'}
            </button>

            <button
              onClick={loadOrders}
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

        {/* 🎛️ Filtres */}
        <div className="mb-5 bg-gray-50 border border-gray-200 rounded-xl p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <input
              placeholder="🔎 Rechercher"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 col-span-2"
            />

            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Statut commande (tous)</option>
              <option value="created">Créée</option>
              <option value="processing">En traitement</option>
              <option value="shipped">Expédiée</option>
              <option value="delivered">Livrée</option>
              <option value="paid">Payée</option>
              <option value="cancelled">Annulée</option>
              <option value="refunded">Remboursée</option>
            </select>

            <select
              value={filters.payment}
              onChange={(e) => setFilters({ ...filters, payment: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Paiement (tous)</option>
              <option value="unpaid">Non payée</option>
              <option value="partial">Partielle</option>
              <option value="paid">Payée</option>
              <option value="refunded">Remboursée</option>
            </select>

            <select
              value={filters.sort}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 col-span-2"
            >
              <option value="-createdAt">Plus récentes</option>
              <option value="createdAt">Plus anciennes</option>
            </select>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-gray-500">{filtered.length} commande(s)</div>
            <button
              onClick={() => setFilters({ q: '', status: '', payment: '', sort: '-createdAt' })}
              className="text-xs px-3 py-1.5 bg-gray-200 rounded-md hover:bg-gray-300 font-medium transition"
            >
              Réinitialiser
            </button>
          </div>
        </div>

        {/* ➕ Formulaire création (enrichi) */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-8"
          >
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note client (optionnel)
            </label>
            <textarea
              rows={3}
              value={form.customerNote}
              onChange={(e) => setForm((f) => ({ ...f, customerNote: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />

            {/* 🔧 Ajout d'un premier article (optionnel) */}
            <div className="mt-4">
              <label className="inline-flex items-center gap-2 text-sm">
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
                Ajouter un article à la création
              </label>
            </div>

            {form.withItem && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Produit
                  </label>
                  <select
                    disabled={loadingProducts}
                    value={form.productId}
                    onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Sélectionner —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {Number(p.price || 0).toLocaleString()} {formatCurrency(p.currency || 'XOF')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantité
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.quantity}
                    onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    PU (optionnel)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.unitPrice}
                    onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="Laisse vide pour PU produit"
                  />
                </div>
              </div>
            )}

            <div className="mt-4 text-right">
              <button
                type="submit"
                className="px-5 py-2.5 text-sm font-semibold rounded-lg shadow-sm bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition"
              >
                Créer la commande
              </button>
            </div>
          </form>
        )}

        {/* 📜 Liste des commandes */}
        {loading ? (
          <p className="text-gray-500 italic text-center py-6">Chargement…</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500 italic text-center py-6">Aucune commande.</p>
        ) : (
          <div className="grid gap-5">
            {filtered.map((o) => {
              const currency = o.currency || 'XOF';
              const total = Number(o.totalAmount || 0);

              return (
                <div
                  key={o.id}
                  className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 hover:shadow-md transition"
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {o.code || `Commande #${o.id}`}
                      </h3>

                      <p className="text-sm text-gray-600">
                        Client : {o.customer?.email || '—'} • Montant :{' '}
                        <strong>
                          {total.toLocaleString()} {formatCurrency(currency)}
                        </strong>
                      </p>

                      <p className="text-xs text-gray-500 mt-1">
                        Statut commande : {formatStatus(o.orderStatus, 'order')} • Paiement :{' '}
                        {formatStatus(o.paymentStatus, 'payment')}
                      </p>
                    </div>

                    <div className="sm:text-right text-sm text-gray-500">
                      {o.createdAt ? new Date(o.createdAt).toLocaleString() : '—'}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      to={`/orders/${o.id}`}
                      className="inline-block px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      Ouvrir la commande
                    </Link>

                    <Link
                      to={`/orders/${o.id}/transactions`}
                      className="inline-block px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition"
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
