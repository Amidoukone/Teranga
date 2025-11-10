import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProducts } from '../services/products';
import { formatCurrency } from '../utils/labels';

/**
 * 🛍️ Page Liste des produits
 * ---------------------------------------------------------
 * - Charge la liste complète via /api/products
 * - Affiche nom, image, prix et description courte
 * - Cohérent avec normalizeProduct() et ProductDetailPage
 * ---------------------------------------------------------
 */
export default function ProductListPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadProducts() {
      try {
        setLoading(true);
        const prods = await getProducts();
        setProducts(prods || []);
        setError('');
      } catch (e) {
        console.error('❌ Erreur chargement produits:', e);
        const msg =
          e?.response?.data?.error ||
          "Impossible de charger les produits pour le moment.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, []);

  /* =========================================================
     🌀 États de chargement / erreur
  ========================================================= */
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <p className="text-gray-600 text-lg animate-pulse">
          Chargement des produits…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 text-lg mb-4">{error}</p>
          <Link
            to="/"
            className="inline-block px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition"
          >
            ← Retour à l’accueil
          </Link>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 text-lg italic mb-4">
            Aucun produit disponible pour le moment.
          </p>
          <Link
            to="/"
            className="inline-block px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition"
          >
            ← Retour à l’accueil
          </Link>
        </div>
      </div>
    );
  }

  /* =========================================================
     🧱 Affichage des produits
  ========================================================= */
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
              <Link
                key={p.id}
                to={`/products/${p.id}`}
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
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
