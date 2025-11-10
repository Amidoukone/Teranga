import { useEffect, useState } from 'react';
import { getProducts } from '../services/products';
import { createOrder } from '../services/orders';
import { me } from '../services/auth';
import { formatCurrency } from '../utils/labels';

/**
 * ============================================================
 * 🛍️ Page Catalogue Produits (Shop)
 * ============================================================
 * - Accessible à tous les rôles connectés (client, agent, admin)
 * - Affiche les produits disponibles (avec image, description, prix)
 * - Permet aux clients/agents de passer une commande
 * - S'intègre avec le backend /api/orders
 * ============================================================
 */
export default function ProductCatalogPage() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);

  /* ============================================================
     🔹 Initialisation utilisateur + produits
  ============================================================ */
  useEffect(() => {
    async function init() {
      try {
        const { user } = await me();
        setUser(user);
        const prods = await getProducts({ limit: 200 });
        setProducts(prods || []);
      } catch (e) {
        console.error('❌ Erreur chargement catalogue:', e);
        setError("Impossible de charger les produits.");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  /* ============================================================
     💰 Création d'une commande rapide à partir d’un produit
  ============================================================ */
  async function handleOrder(product) {
    if (!user) return alert('Vous devez être connecté pour commander.');
    if (user.role === 'admin') {
      return alert("ℹ️ Les administrateurs ne passent pas de commande ici.");
    }

    setSelectedProduct(product);
    setCreating(true);
  }

  async function handleConfirmOrder(e) {
    e.preventDefault();
    if (!selectedProduct) return;

    try {
      setCreating(false);
      const payload = {
        customerNote: `Commande de ${quantity} x ${selectedProduct.name}`,
        items: [
          {
            productId: selectedProduct.id,
            quantity: Number(quantity),
            unitPrice: Number(selectedProduct.price || 0),
          },
        ],
      };
      await createOrder(payload);
      alert(`✅ Commande créée pour ${quantity} × ${selectedProduct.name}`);
      setSelectedProduct(null);
      setQuantity(1);
    } catch (err) {
      console.error('❌ Erreur création commande:', err);
      alert("Erreur lors de la création de la commande.");
    }
  }

  /* ============================================================
     🌀 États de chargement / erreur
  ============================================================ */
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <p className="text-gray-600 text-lg animate-pulse">
          Chargement du catalogue…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 text-lg mb-4">{error}</p>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <p className="text-gray-500 text-lg italic">
          Aucun produit disponible pour le moment.
        </p>
      </div>
    );
  }

  /* ============================================================
     🧱 Affichage du catalogue
  ============================================================ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-6 py-10">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          🛍️ Catalogue des produits
        </h1>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const imgSrc =
              p.imageUrl && typeof p.imageUrl === 'string'
                ? p.imageUrl
                : null;

            return (
              <div
                key={p.id}
                className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition p-5 flex flex-col"
              >
                {imgSrc ? (
                  <img
                    src={imgSrc}
                    alt={p.name}
                    className="w-full h-40 object-cover rounded-lg mb-4"
                  />
                ) : (
                  <div className="w-full h-40 flex items-center justify-center bg-gray-100 rounded-lg text-gray-400 text-sm mb-4">
                    Aucun visuel
                  </div>
                )}

                <h2 className="text-lg font-semibold text-gray-900 line-clamp-1">
                  {p.name}
                </h2>

                <p className="text-gray-500 flex-1 mt-1 text-sm line-clamp-2">
                  {p.description
                    ? `${p.description.slice(0, 100)}${
                        p.description.length > 100 ? '…' : ''
                      }`
                    : 'Pas de description.'}
                </p>

                <div className="mt-3 font-bold text-blue-600 text-base">
                  {formatCurrency(p.currency || 'XOF')}{' '}
                  {Number(p.price || 0).toLocaleString()}
                </div>

                {/* Bouton Commander (clients/agents seulement) */}
                {user && user.role !== 'admin' && (
                  <button
                    onClick={() => handleOrder(p)}
                    className="mt-4 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-blue-600 text-white hover:bg-blue-700 transition"
                  >
                    🛒 Commander
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* ✅ Popup de commande rapide */}
        {creating && selectedProduct && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full border border-gray-200">
              <h2 className="text-xl font-bold text-gray-800 mb-3">
                Commander {selectedProduct.name}
              </h2>
              <form onSubmit={handleConfirmOrder}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantité
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 text-sm focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setCreating(false)}
                    className="px-4 py-2 text-sm rounded-lg bg-gray-200 hover:bg-gray-300 transition"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
                  >
                    Confirmer
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
