import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProductById } from '../services/products';
import { formatCurrency } from '../utils/labels';

/**
 * 🛍️ Détail d’un produit
 * ---------------------------------------------------------
 * - Charge les données via /api/products/:id
 * - Affiche image, description, prix, et bouton retour
 * - Cohérent avec la normalisation de services/products.js
 * ---------------------------------------------------------
 */
export default function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadProduct() {
      try {
        setLoading(true);
        const prod = await getProductById(id);
        setProduct(prod);
        setError('');
      } catch (e) {
        console.error('❌ Erreur chargement produit:', e);
        const msg =
          e?.response?.data?.error ||
          "Impossible de charger ce produit pour le moment.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    if (id) loadProduct();
  }, [id]);

  /* =========================================================
     🌀 États de chargement / erreur
  ========================================================= */
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <p className="text-gray-600 text-lg animate-pulse">
          Chargement du produit…
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
            to="/products"
            className="inline-block px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition"
          >
            ← Retour au catalogue
          </Link>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 text-lg italic mb-4">
            Produit introuvable.
          </p>
          <Link
            to="/products"
            className="inline-block px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition"
          >
            ← Retour au catalogue
          </Link>
        </div>
      </div>
    );
  }

  /* =========================================================
     🖼️ Données produit prêtes
  ========================================================= */
  const {
    name,
    description,
    price,
    currency,
    imageUrl,
    stock,
    category,
  } = product;

  // Assure compatibilité : imageUrl peut déjà être absolue via normalizeProduct()
  const imgSrc =
    imageUrl && typeof imageUrl === 'string' ? imageUrl : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-6 py-10">
      <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
        <div className="flex flex-col md:flex-row gap-6">
          {imgSrc && (
            <img
              src={imgSrc}
              alt={name}
              className="w-full md:w-1/2 h-80 object-cover rounded-xl border border-gray-200"
            />
          )}
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{name}</h1>
            <p className="text-gray-600 mb-4">
              {description || 'Aucune description disponible.'}
            </p>

            <p className="text-2xl font-semibold text-blue-600 mb-4">
              {formatCurrency(currency || 'XOF')}{' '}
              {Number(price || 0).toLocaleString()}
            </p>

            {typeof stock === 'number' && (
              <p className="text-sm text-gray-500 mb-4">
                <span className="font-medium">Stock :</span> {stock}
                {category?.name && (
                  <>
                    {' '}• Catégorie :{' '}
                    <span className="font-medium">{category.name}</span>
                  </>
                )}
              </p>
            )}

            <Link
              to="/products"
              className="inline-block mt-2 px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition"
            >
              ← Retour au catalogue
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
