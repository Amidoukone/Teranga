/* eslint-disable jsx-a11y/img-redundant-alt */
// ============================================================
// ProductCatalogPage.jsx — Teranga PRODUCTION READY (Option B)
// Clean Shop Premium + FILE_BASE + Lightbox + Optimisations
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { getProducts } from '../services/products';
import { createOrder } from '../services/orders';
import { me } from '../services/auth';
import { formatCurrency } from '../utils/labels';

/* ============================================================
   🌍 PRODUCTION CONFIG — FILE_BASE / toAbsUrl()
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
   ⭐ PAGE CATALOGUE PRODUITS (CLEAN SHOP PREMIUM)
============================================================ */
export default function ProductCatalogPage() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Commander popup
  const [creating, setCreating] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);

  // Lightbox premium
  const [previewProduct, setPreviewProduct] = useState(null);
  const [previewIndex, setPreviewIndex] = useState(0);

  // Filtres + tri
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [sort, setSort] = useState('default');

  /* ============================================================
     🔹 1) Init user + produits
  ============================================================ */
  useEffect(() => {
    async function init() {
      try {
        const { user } = await me();
        setUser(user);

        const prods = await getProducts({ limit: 200 });
        setProducts(prods || []);

        setError('');
      } catch (e) {
        console.error('❌ Erreur chargement catalogue:', e);
        setError(
          e?.response?.data?.error ||
            "Impossible de charger les produits."
        );
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  /* ============================================================
     🧰 Helpers — Images du produit
  ============================================================ */
  function getImagesForProduct(p) {
    if (!p) return [];

    let gallery = Array.isArray(p.allImageUrls) ? p.allImageUrls : [];
    gallery = gallery.map((u) => toAbsUrl(u)).filter(Boolean);

    const cover = p.imageUrl ? toAbsUrl(p.imageUrl) : null;

    if (gallery.length) return gallery;
    if (cover) return [cover];

    return [];
  }

  /* ============================================================
     🖼️ Lightbox controls
  ============================================================ */
  function openPreview(product, startIndex = 0) {
    const imgs = getImagesForProduct(product);
    if (!imgs.length) return;

    const index = Math.min(Math.max(startIndex, 0), imgs.length - 1);
    setPreviewProduct(product);
    setPreviewIndex(index);
  }

  function closePreview() {
    setPreviewProduct(null);
    setPreviewIndex(0);
  }

  function goPrev(e) {
    if (e) e.stopPropagation();
    const imgs = getImagesForProduct(previewProduct);
    if (!imgs.length) return;

    setPreviewIndex((prev) =>
      prev === 0 ? imgs.length - 1 : prev - 1
    );
  }

  function goNext(e) {
    if (e) e.stopPropagation();
    const imgs = getImagesForProduct(previewProduct);
    if (!imgs.length) return;

    setPreviewIndex((prev) =>
      prev === imgs.length - 1 ? 0 : prev + 1
    );
  }

  /* ============================================================
     🛒 Création d'une commande rapide
  ============================================================ */
  async function handleOrder(product) {
    if (!user)
      return alert('Vous devez être connecté pour commander.');

    if (user.role === 'admin') {
      return alert("ℹ️ Les administrateurs ne passent pas de commandes ici.");
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
     🧮 Dérivés — catégories disponibles
  ============================================================ */
  const availableCategories = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      const cat = p.category;
      if (cat?.id && !map.has(cat.id)) {
        map.set(cat.id, {
          id: cat.id,
          name: cat.name || `Catégorie #${cat.id}`,
        });
      }
    });

    return [...map.values()].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    );
  }, [products]);

  /* ============================================================
     🧮 Produits filtrés + triés
  ============================================================ */
  const filteredProducts = useMemo(() => {
    let arr = [...products];

    const q = search.trim().toLowerCase();
    if (q) {
      arr = arr.filter((p) => {
        const name = (p.name || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();
        const cat = (p.category?.name || '').toLowerCase();
        const idStr = String(p.id || '').toLowerCase();
        return (
          name.includes(q) ||
          desc.includes(q) ||
          cat.includes(q) ||
          idStr.includes(q)
        );
      });
    }

    if (categoryFilter) {
      const catId = Number(categoryFilter);
      arr = arr.filter(
        (p) => Number(p.category?.id || p.categoryId || 0) === catId
      );
    }

    const min = priceMin !== '' ? Number(priceMin) : null;
    const max = priceMax !== '' ? Number(priceMax) : null;

    if (min !== null && !Number.isNaN(min)) {
      arr = arr.filter((p) => Number(p.price || 0) >= min);
    }
    if (max !== null && !Number.isNaN(max)) {
      arr = arr.filter((p) => Number(p.price || 0) <= max);
    }

    if (sort === 'price_asc') {
      arr.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else if (sort === 'price_desc') {
      arr.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    } else if (sort === 'name_asc') {
      arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sort === 'name_desc') {
      arr.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
    } else if (sort === 'stock_desc') {
      arr.sort((a, b) => Number(b.stock || 0) - Number(a.stock || 0));
    }

    return arr;
  }, [products, search, categoryFilter, priceMin, priceMax, sort]);

  /* ============================================================
     🌀 États de chargement
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
        <div className="text-center max-w-md mx-auto bg-white rounded-2xl shadow-md p-6 border border-red-100">
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
     🧱 UI PRINCIPALE — Filtres + Tri + Grille Produits
  ============================================================ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 sm:px-6 py-10">
      <div className="max-w-6xl mx-auto">

        {/* ==== HEADER ==== */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4 sm:mb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-2">
              🛍️ <span>Catalogue des produits</span>
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Découvrez les produits disponibles dans votre espace Teranga.
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/70 border border-slate-200 shadow-sm">
              {filteredProducts.length} résultat
              {filteredProducts.length > 1 ? 's' : ''} sur {products.length}
            </span>
          </div>
        </div>

        {/* ==== BARRE DE FILTRES ==== */}
        <div className="mb-8 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-sm px-4 py-4 sm:px-5 sm:py-4">
          <div className="grid gap-3 md:grid-cols-4 items-end">

            {/* --- Recherche --- */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Rechercher
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nom, description, catégorie, #id…"
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* --- Catégorie --- */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Catégorie
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 bg-white"
              >
                <option value="">Toutes les catégories</option>
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ==== Filtres prix + reset + tri ==== */}
          <div className="mt-3 grid gap-3 md:grid-cols-[1.2fr_1fr]">

            {/* Prix */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                  Prix min
                </label>
                <input
                  type="number"
                  min="0"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 bg-white"
                  placeholder="Min"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                  Prix max
                </label>
                <input
                  type="number"
                  min="0"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 bg-white"
                  placeholder="Max"
                />
              </div>

              {/* Reset */}
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setCategoryFilter('');
                    setPriceMin('');
                    setPriceMax('');
                    setSort('default');
                  }}
                  className="w-full text-xs font-semibold rounded-xl border border-slate-200 px-3 py-2 bg-slate-50 hover:bg-slate-100"
                >
                  Réinitialiser
                </button>
              </div>
            </div>

            {/* Tri */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Trier par
              </label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 bg-white"
              >
                <option value="default">Recommandé</option>
                <option value="price_asc">Prix croissant</option>
                <option value="price_desc">Prix décroissant</option>
                <option value="name_asc">Nom A → Z</option>
                <option value="name_desc">Nom Z → A</option>
                <option value="stock_desc">Stock le plus élevé</option>
              </select>
            </div>
          </div>
        </div>

        {/* ==== GRILLE PRODUITS ==== */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white/80 border rounded-2xl shadow-sm py-10 flex items-center justify-center">
            <p className="text-slate-500 text-sm">
              Aucun produit ne correspond à ces critères.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((p) => {
              const imgs = getImagesForProduct(p);
              const thumb = imgs[0] || null;

              return (
                <div
                  key={p.id}
                  className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-lg hover:border-blue-200 transition overflow-hidden flex flex-col"
                >
                  {/* Image */}
                  {thumb ? (
                    <button
                      type="button"
                      onClick={() => openPreview(p, 0)}
                      className="relative group"
                      aria-label={`Voir images de ${p.name}`}
                    >
                      <img
                        src={thumb}
                        alt={p.name}
                        className="w-full h-44 object-cover transition group-hover:scale-[1.03]"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent opacity-0 group-hover:opacity-100 transition" />

                      <div className="absolute left-3 bottom-3 text-white text-[11px] bg-black/50 px-2 py-1 rounded">
                        Cliquer pour agrandir
                      </div>

                      {imgs.length > 1 && (
                        <span className="absolute right-3 bottom-3 text-[11px] bg-black/60 text-white px-2 py-0.5 rounded">
                          {imgs.length} photos
                        </span>
                      )}
                    </button>
                  ) : (
                    <div className="w-full h-44 flex items-center justify-center bg-slate-100 text-slate-400">
                      Aucun visuel
                    </div>
                  )}

                  {/* Contenu carte */}
                  <div className="flex-1 flex flex-col px-4 py-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h2 className="text-base font-semibold text-slate-900 line-clamp-2">
                        {p.name}
                      </h2>

                      {p.category?.name && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] bg-blue-50 text-blue-700 border border-blue-100">
                          {p.category.name}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 mb-2">
                      Réf. <span className="font-mono">#{p.id}</span>
                    </p>

                    <p className="text-sm text-slate-600 flex-1 line-clamp-3">
                      {p.description || 'Aucune description.'}
                    </p>

                    {/* Prix + Stock */}
                    <div className="mt-3 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] uppercase text-slate-400">
                          Prix
                        </p>
                        <p className="text-lg font-bold text-blue-600">
                          {formatCurrency(p.currency || 'XOF')}{' '}
                          {Number(p.price || 0).toLocaleString()}
                        </p>
                      </div>

                      {typeof p.stock === 'number' && (
                        <div className="text-right">
                          <p className="text-[11px] uppercase text-slate-400">
                            Stock
                          </p>
                          <p
                            className={`text-xs font-semibold ${
                              p.stock > 0
                                ? 'text-emerald-600'
                                : 'text-rose-600'
                            }`}
                          >
                            {p.stock > 0 ? `${p.stock} dispo` : 'Rupture'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Bouton Commander */}
                    {user && user.role !== 'admin' && (
                      <button
                        onClick={() => handleOrder(p)}
                        className="mt-4 w-full inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-xl shadow-sm bg-blue-600 text-white hover:bg-blue-700"
                      >
                        🛒 Commander
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ==== POPUP COMMANDE ==== */}
        {creating && selectedProduct && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 px-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-slate-200 relative">
              <button
                onClick={() => setCreating(false)}
                aria-label="Fermer"
                className="absolute top-3 right-3 text-slate-500 hover:text-slate-800"
              >
                ✕
              </button>

              <h2 className="text-xl font-bold text-slate-900 mb-1">
                Commander {selectedProduct.name}
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                {formatCurrency(selectedProduct.currency || 'XOF')}{' '}
                {Number(selectedProduct.price || 0).toLocaleString()} / unité
              </p>

              <form onSubmit={handleConfirmOrder}>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Quantité
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4"
                />

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setCreating(false)}
                    className="px-4 py-2 text-sm bg-gray-200 rounded-lg hover:bg-gray-300"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Confirmer
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================
            💡 LIGHTBOX PLEIN ÉCRAN
        ============================================================ */}
        {previewProduct && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4"
            onClick={closePreview}
            role="dialog"
            aria-modal="true"
            aria-label={`Images du produit ${previewProduct.name}`}
          >
            {/* Bouton fermeture */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                closePreview();
              }}
              className="absolute top-4 right-4 text-white text-xl font-bold px-3 py-1 rounded-full bg-black/60 hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white"
              aria-label="Fermer la lightbox"
            >
              ✕
            </button>

            {/* Navigation */}
            {getImagesForProduct(previewProduct).length > 1 && (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  className="absolute left-4 text-white text-3xl px-3 py-2 rounded-full bg-black/50 hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
                  aria-label="Image précédente"
                >
                  ‹
                </button>

                <button
                  type="button"
                  onClick={goNext}
                  className="absolute right-4 text-white text-3xl px-3 py-2 rounded-full bg-black/50 hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
                  aria-label="Image suivante"
                >
                  ›
                </button>
              </>
            )}

            {/* Contenu lightbox */}
            <div
              className="bg-slate-900/95 border border-slate-700 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 text-slate-100 text-sm">
                <div className="truncate">
                  <span className="font-semibold">{previewProduct.name}</span>
                  {previewProduct.id && (
                    <span className="text-xs text-slate-400 ml-2">
                      #{previewProduct.id}
                    </span>
                  )}
                </div>

                {getImagesForProduct(previewProduct).length > 1 && (
                  <div className="text-xs text-slate-400">
                    {previewIndex + 1} / {getImagesForProduct(previewProduct).length}
                  </div>
                )}
              </div>

              {/* Image principale */}
              <div className="flex-1 flex items-center justify-center bg-black">
                <img
                  src={getImagesForProduct(previewProduct)[previewIndex]}
                  alt={`Photo ${previewIndex + 1} de ${previewProduct.name}`}
                  className="max-h-[70vh] max-w-full object-contain rounded-lg"
                />
              </div>

              {/* Miniatures */}
              {getImagesForProduct(previewProduct).length > 1 && (
                <div className="px-4 py-3 bg-slate-950/80 border-t border-slate-800 flex gap-2 overflow-x-auto">
                  {getImagesForProduct(previewProduct).map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPreviewIndex(idx)}
                      className={`relative w-16 h-16 rounded-lg overflow-hidden border flex-shrink-0 transition ${
                        idx === previewIndex
                          ? 'border-blue-400 ring-2 ring-blue-400/70'
                          : 'border-slate-600 hover:border-slate-400'
                      }`}
                      aria-label={`Miniature ${idx + 1}`}
                    >
                      <img
                        src={img}
                        alt={`Miniature ${idx + 1} pour ${previewProduct.name}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
