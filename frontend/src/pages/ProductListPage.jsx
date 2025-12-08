// frontend/src/pages/ProductListPage.jsx
/* eslint-disable jsx-a11y/img-redundant-alt */
/**
 * 🛍️ ProductListPage — Teranga PRODUCTION READY (Style A 2025)
 * ----------------------------------------------------------------
 * - Liste des produits avec design premium & responsive
 * - Compatible multi-images (imageUrl + allImageUrls)
 * - Utilise FILE_BASE + toAbsUrl pour les environnements de prod
 * - Aucune régression de logique, uniquement amélioration UI
 * ----------------------------------------------------------------
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProducts } from '../services/products';
import { formatCurrency } from '../utils/labels';

/* =========================================================
   🌍 FILE_BASE + normalizePath + toAbsUrl
   (même logique que ProductCatalogPage, harmonisation)
========================================================= */
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
  if (!norm) return '';
  if (/^https?:\/\//i.test(norm)) return norm;

  return (
    FILE_BASE.replace(/\/$/, '') +
    '/' +
    norm.replace(/^\//, '')
  );
}

/* =========================================================
   🛍️ Page Liste des produits
========================================================= */
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
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100">
        <p className="text-gray-600 text-lg animate-pulse">
          Chargement des produits…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4">
        <div className="max-w-md w-full bg-white border border-red-100 rounded-2xl shadow-lg p-6 text-center">
          <p className="text-red-600 text-base sm:text-lg mb-4 break-words">
            {error}
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-800"
          >
            ← Retour à l’accueil
          </Link>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4">
        <div className="max-w-md w-full bg-white border border-gray-100 rounded-2xl shadow-lg p-6 text-center">
          <p className="text-gray-500 text-base sm:text-lg italic mb-4">
            Aucun produit disponible pour le moment.
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-800"
          >
            ← Retour à l’accueil
          </Link>
        </div>
      </div>
    );
  }

  /* =========================================================
     🧱 Affichage des produits — Design premium
  ========================================================= */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 sm:px-6 py-10">
      <div className="max-w-6xl mx-auto">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-2">
              🛍️ <span>Catalogue des produits</span>
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Liste simple et rapide de tous les produits disponibles.
            </p>
          </div>

          <div className="text-right text-xs text-slate-500">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/80 border border-slate-200 shadow-sm">
              {products.length} produit{products.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* GRILLE PRODUITS */}
        <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-5">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => {
              // 🔹 Multi-images avec FILE_BASE + toAbsUrl (harmonisé)
              const rawImages =
                Array.isArray(p.allImageUrls) && p.allImageUrls.length
                  ? p.allImageUrls
                  : p.imageUrl
                  ? [p.imageUrl]
                  : [];

              const images = rawImages
                .map((img) => toAbsUrl(img))
                .filter(Boolean);

              const mainImg = images[0] || null;
              const hasMulti = images.length > 1;

              return (
                <Link
                  key={p.id}
                  to={`/products/${p.id}`}
                  className="
                    group bg-white border border-slate-200 rounded-2xl
                    shadow-sm hover:shadow-lg hover:border-blue-200
                    transition overflow-hidden flex flex-col
                  "
                >
                  {/* Image produit */}
                  {mainImg ? (
                    <div className="relative mb-0">
                      <img
                        src={mainImg}
                        alt={p.name}
                        className="
                          w-full h-44 object-cover
                          transition-transform duration-200
                          group-hover:scale-[1.03]
                        "
                      />
                      {/* Overlay bas */}
                      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 via-black/10 to-transparent pointer-events-none" />

                      {hasMulti && (
                        <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded-full">
                          {images.length} image{images.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-44 flex items-center justify-center bg-slate-100 text-slate-400 text-sm mb-0">
                      Aucun visuel
                    </div>
                  )}

                  {/* Contenu carte */}
                  <div className="flex-1 flex flex-col p-4">
                    {/* Titre + réf */}
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-base font-semibold text-slate-900 line-clamp-2">
                        {p.name}
                      </h2>
                      {p.id && (
                        <span className="text-[10px] text-slate-400 font-mono bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">
                          #{p.id}
                        </span>
                      )}
                    </div>

                    {/* Description courte */}
                    <p className="text-slate-600 flex-1 mt-1 text-sm line-clamp-3">
                      {p.description
                        ? p.description
                        : 'Pas de description.'}
                    </p>

                    {/* Prix */}
                    <div className="mt-3 flex items-end justify-between">
                      <div>
                        <p className="text-[11px] uppercase text-slate-400">
                          Prix
                        </p>
                        <p className="text-lg font-bold text-blue-600">
                          {formatCurrency(p.currency || 'XOF')}{' '}
                          {Number(p.price || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Call-to-action subtil */}
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <span>Voir le détail</span>
                        <span aria-hidden="true">↗</span>
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
