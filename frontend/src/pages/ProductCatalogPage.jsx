// frontend/src/pages/ProductCatalogPage.jsx
import { useEffect, useMemo, useState } from 'react';
import { getProducts } from '../services/products';
import { createOrder } from '../services/orders';
import { me } from '../services/auth';
import { formatCurrency } from '../utils/labels';

/**
 * ============================================================
 * 🛍️ Page Catalogue Produits (Shop) — Clean Shop Premium
 * ============================================================
 * - Accessible à tous les rôles connectés (client, agent, admin)
 * - Affiche les produits avec coverImage + gallery (allImageUrls)
 * - Lightbox moderne pour défiler les images du produit
 * - Permet aux clients/agents de passer une commande
 * - Système de recherche + filtres (nom, catégorie, prix, tri)
 * - Cohérent avec le design Teranga et l’admin produits
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

  // 🖼️ Lightbox images
  const [previewProduct, setPreviewProduct] = useState(null);
  const [previewIndex, setPreviewIndex] = useState(0);

  // 🔍 Filtres & tri
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(''); // id de catégorie ou ''
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [sort, setSort] = useState('default'); // default | price_asc | price_desc | name_asc | name_desc | stock_desc

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
        setError('');
      } catch (e) {
        console.error('❌ Erreur chargement catalogue:', e);
        const msg =
          e?.response?.data?.error ||
          "Impossible de charger les produits.";
        setError(msg);
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
      alert('Erreur lors de la création de la commande.');
    }
  }

  /* ============================================================
     🖼️ Helpers Lightbox
  ============================================================ */
  function getImagesForProduct(p) {
    const gallery = Array.isArray(p.allImageUrls) ? p.allImageUrls : [];
    if (gallery.length) return gallery;
    if (p.imageUrl && typeof p.imageUrl === 'string') return [p.imageUrl];
    return [];
  }

  function openPreview(product, startIndex = 0) {
    const imgs = getImagesForProduct(product);
    if (!imgs.length) return;
    const clampedIndex = Math.min(Math.max(startIndex, 0), imgs.length - 1);
    setPreviewProduct(product);
    setPreviewIndex(clampedIndex);
  }

  function closePreview() {
    setPreviewProduct(null);
    setPreviewIndex(0);
  }

  function goPrev(e) {
    if (e) e.stopPropagation();
    if (!previewProduct) return;
    const imgs = getImagesForProduct(previewProduct);
    if (!imgs.length) return;
    setPreviewIndex((prev) => (prev === 0 ? imgs.length - 1 : prev - 1));
  }

  function goNext(e) {
    if (e) e.stopPropagation();
    if (!previewProduct) return;
    const imgs = getImagesForProduct(previewProduct);
    if (!imgs.length) return;
    setPreviewIndex((prev) => (prev === imgs.length - 1 ? 0 : prev + 1));
  }

  /* ============================================================
     🧮 Dérivés : catégories + produits filtrés
  ============================================================ */

  // Liste des catégories distinctes présentes dans les produits (pour le filtre)
  const availableCategories = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      const cat = p.category;
      if (cat && cat.id && !map.has(cat.id)) {
        map.set(cat.id, { id: cat.id, name: cat.name || `Catégorie #${cat.id}` });
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    );
  }, [products]);

  // Produits filtrés + triés (client-side, optimisé par useMemo)
  const filteredProducts = useMemo(() => {
    let arr = [...products];

    // 🔎 Recherche plein-text (nom, description, catégorie, id)
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

    // 🎯 Filtre catégorie
    if (categoryFilter) {
      const catIdNum = Number(categoryFilter);
      arr = arr.filter((p) => Number(p.category?.id || p.categoryId) === catIdNum);
    }

    // 💰 Filtre prix min/max
    const min = priceMin !== '' ? Number(priceMin) : null;
    const max = priceMax !== '' ? Number(priceMax) : null;
    if (min !== null && !Number.isNaN(min)) {
      arr = arr.filter((p) => Number(p.price || 0) >= min);
    }
    if (max !== null && !Number.isNaN(max)) {
      arr = arr.filter((p) => Number(p.price || 0) <= max);
    }

    // 🔃 Tri
    if (sort === 'price_asc') {
      arr.sort(
        (a, b) => Number(a.price || 0) - Number(b.price || 0)
      );
    } else if (sort === 'price_desc') {
      arr.sort(
        (a, b) => Number(b.price || 0) - Number(a.price || 0)
      );
    } else if (sort === 'name_asc') {
      arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sort === 'name_desc') {
      arr.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
    } else if (sort === 'stock_desc') {
      arr.sort((a, b) => Number(b.stock || 0) - Number(a.stock || 0));
    }
    // sort === 'default' => on garde l'ordre du backend

    return arr;
  }, [products, search, categoryFilter, priceMin, priceMax, sort]);

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
     🧱 Affichage du catalogue (Clean Shop Premium + filtres)
  ============================================================ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 sm:px-6 py-10">
      <div className="max-w-6xl mx-auto">
        {/* En-tête */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4 sm:mb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-2">
              🛍️
              <span>Catalogue des produits</span>
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

        {/* Barre de filtres */}
        <div className="mb-8 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-sm px-4 py-4 sm:px-5 sm:py-4">
          <div className="grid gap-3 md:grid-cols-4 items-end">
            {/* Recherche plein texte */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Rechercher
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  🔍
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nom, description, catégorie, #id…"
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                />
              </div>
            </div>

            {/* Catégorie */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Catégorie
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="">Toutes les catégories</option>
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Prix min / max (en petite ligne sur mobile) */}
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-[1.2fr_1fr]">
            {/* Prix + reset */}
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
                  className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
                  className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Max"
                />
              </div>
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
                  className="w-full text-xs font-semibold rounded-xl border border-slate-200 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 transition"
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
                className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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

        {/* Grille produits */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white/80 border border-slate-200 rounded-2xl shadow-sm py-10 flex items-center justify-center">
            <p className="text-slate-500 text-sm">
              Aucun produit ne correspond à ces critères de recherche.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((p) => {
              const images = getImagesForProduct(p);
              const thumb = images[0] || null;

              return (
                <div
                  key={p.id}
                  className="bg-white border border-slate-200/80 rounded-2xl shadow-sm hover:shadow-lg hover:border-blue-200 transition-all duration-200 overflow-hidden flex flex-col"
                >
                  {/* Image + overlay */}
                  {thumb ? (
                    <button
                      type="button"
                      onClick={() => openPreview(p, 0)}
                      className="relative w-full group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-50"
                      aria-label={`Agrandir les images de ${p.name}`}
                    >
                      <img
                        src={thumb}
                        alt={p.name}
                        className="w-full h-44 object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

                      <div className="absolute left-3 bottom-3 flex flex-col gap-1 text-left">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-black/60 text-[11px] text-white shadow-sm">
                          Cliquer pour agrandir
                        </span>
                      </div>

                      {images.length > 1 && (
                        <span className="absolute right-3 bottom-3 inline-flex items-center px-2 py-0.5 rounded-full bg-black/70 text-[11px] text-white shadow-sm">
                          {images.length} photo{images.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </button>
                  ) : (
                    <div className="w-full h-44 flex items-center justify-center bg-slate-100 text-slate-400 text-sm">
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
                        <span className="shrink-0 ml-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-[11px] font-medium text-blue-700">
                          {p.category.name}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 mb-2">
                      Réf. <span className="font-mono">#{p.id}</span>
                    </p>

                    <p className="text-sm text-slate-600 flex-1 line-clamp-3">
                      {p.description
                        ? p.description
                        : 'Pas de description pour ce produit.'}
                    </p>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">
                          Prix
                        </p>
                        <p className="text-lg font-bold text-blue-600">
                          {formatCurrency(p.currency || 'XOF')}{' '}
                          {Number(p.price || 0).toLocaleString()}
                        </p>
                      </div>
                      {typeof p.stock === 'number' && (
                        <div className="text-right">
                          <p className="text-[11px] uppercase tracking-wide text-slate-400">
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

                    {/* Bouton Commander (clients/agents seulement) */}
                    {user && user.role !== 'admin' && (
                      <button
                        onClick={() => handleOrder(p)}
                        className="mt-4 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl shadow-sm bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                      >
                        <span>🛒 Commander</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ✅ Popup de commande rapide */}
        {creating && selectedProduct && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 px-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-slate-200 relative">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 text-sm"
                aria-label="Fermer"
              >
                ✕
              </button>
              <h2 className="text-xl font-bold text-slate-900 mb-1">
                Commander {selectedProduct.name}
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                {formatCurrency(selectedProduct.currency || 'XOF')}{' '}
                {Number(selectedProduct.price || 0).toLocaleString()} par unité
              </p>
              <form onSubmit={handleConfirmOrder}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantité
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
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

        {/* 💡 Lightbox plein écran pour les images produit */}
        {previewProduct && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4"
            onClick={closePreview}
          >
            {/* Close */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                closePreview();
              }}
              className="absolute top-4 right-4 text-white text-xl font-bold px-3 py-1 rounded-full bg-black/60 hover:bg-black/80"
              aria-label="Fermer"
            >
              ✕
            </button>

            {/* Navigation si plusieurs images */}
            {getImagesForProduct(previewProduct).length > 1 && (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  className="absolute left-4 text-white text-2xl px-3 py-2 rounded-full bg-black/50 hover:bg-black/70"
                  aria-label="Image précédente"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="absolute right-4 text-white text-2xl px-3 py-2 rounded-full bg-black/50 hover:bg-black/70"
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
              {/* Header lightbox */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 text-slate-100 text-sm">
                <div className="truncate">
                  <span className="font-semibold">
                    {previewProduct.name}
                  </span>
                  {previewProduct.id && (
                    <span className="text-xs text-slate-400 ml-2">
                      #{previewProduct.id}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400">
                  {getImagesForProduct(previewProduct).length > 0 && (
                    <>
                      {previewIndex + 1} /{' '}
                      {getImagesForProduct(previewProduct).length}
                    </>
                  )}
                </div>
              </div>

              {/* Image principale */}
              <div className="flex-1 flex items-center justify-center bg-black">
                <img
                  src={getImagesForProduct(previewProduct)[previewIndex]}
                  alt={previewProduct.name}
                  className="max-h-[70vh] max-w-full object-contain"
                />
              </div>

              {/* Thumbnails si plusieurs images */}
              {getImagesForProduct(previewProduct).length > 1 && (
                <div className="px-4 py-3 bg-slate-950/80 border-t border-slate-800 flex gap-2 overflow-x-auto">
                  {getImagesForProduct(previewProduct).map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPreviewIndex(idx)}
                      className={`relative w-16 h-16 rounded-lg overflow-hidden border ${
                        idx === previewIndex
                          ? 'border-blue-400 ring-2 ring-blue-400/70'
                          : 'border-slate-600 hover:border-slate-400'
                      } flex-shrink-0`}
                    >
                      <img
                        src={img}
                        alt={`Preview ${idx + 1}`}
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
