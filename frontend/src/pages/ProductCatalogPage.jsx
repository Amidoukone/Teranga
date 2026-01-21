/* eslint-disable jsx-a11y/img-redundant-alt */
// ============================================================
// ProductCatalogPage.jsx — Teranga PRODUCTION READY (Style A 2025)
// Clean Shop Premium + FILE_BASE + Lightbox + Optimisations
// + compat multi-pays / master (backend-driven)
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProducts } from '../services/products';
import { createOrder } from '../services/orders';
import { me } from '../services/auth';
import { formatCurrency } from '../utils/labels';

/* ============================================================
   🌍 PRODUCTION CONFIG — FILE_BASE / toAbsUrl()
   Compatible Render + Netlify, aucun localhost forcé
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
  if (!norm) return '';
  if (/^https?:\/\//i.test(norm)) return norm;

  return FILE_BASE.replace(/\/$/, '') + '/' + norm.replace(/^\//, '');
}

/* ============================================================
   🖼 Helper : récupérer toutes les images d’un produit
   (allImageUrls, gallery, coverImage, imageUrl)
============================================================ */
function getImagesForProduct(p) {
  if (!p) return [];

  const urls = [];

  // 1) allImageUrls (backend withLabels)
  if (Array.isArray(p.allImageUrls)) {
    urls.push(...p.allImageUrls);
  }

  // 2) gallery : [{ url }, "string", ...]
  if (Array.isArray(p.gallery)) {
    p.gallery.forEach((g) => {
      if (g && typeof g === 'object' && g.url) urls.push(g.url);
      else if (typeof g === 'string') urls.push(g);
    });
  }

  // 3) coverImage : string ou { url }
  if (p.coverImage) {
    if (typeof p.coverImage === 'string') urls.unshift(p.coverImage);
    else if (p.coverImage.url) urls.unshift(p.coverImage.url);
  }

  // 4) imageUrl (compat)
  if (p.imageUrl) {
    urls.unshift(p.imageUrl);
  }

  // Déduplication + normalisation en URL absolues
  const seen = new Set();
  return urls
    .map((u) => toAbsUrl(u))
    .filter((u) => u && !seen.has(u) && (seen.add(u), true));
}

/* ============================================================
   💰 Helper : affichage PRO du prix (montant + devise)
   Exemple : "12 500 Franc CFA (XOF)"
============================================================ */
function formatProductPrice(amount, currency = 'XOF') {
  const numeric = Number(amount || 0);

  const formattedNumber = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numeric);

  const label = formatCurrency(currency || 'XOF');

  // Nombre AVANT la devise (style e-commerce)
  return `${formattedNumber} ${label}`;
}

/* ============================================================
   ⭐ PAGE CATALOGUE PRODUITS (CLEAN SHOP PREMIUM — STYLE A)
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

  const navigate = useNavigate();

  /* ============================================================
     🔹 1) Init user + produits
     ✅ compat: getProducts() retourne soit Array, soit { products, pagination }
     ✅ master/multi-pays: backend scoper via token + geoScope
  ============================================================ */
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const ud = await me();
        if (!mounted) return;
        setUser(ud?.user || null);

        const res = await getProducts({ limit: 200 });

        // compat: array direct OU {products}
        const prods = Array.isArray(res) ? res : res?.products;
        setProducts(Array.isArray(prods) ? prods : []);
        setError('');
      } catch (e) {
        console.error('❌ Erreur chargement catalogue:', e);
        setError(
          e?.response?.data?.error || "Impossible de charger les produits."
        );
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();
    return () => {
      mounted = false;
    };
  }, []);

  /* ============================================================
     🖼️ Lightbox controls (utilisés => pas de warnings)
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
     🛒 Création d'une commande rapide (logique existante conservée)
  ============================================================ */
  function handleOrder(product) {
    if (!user) {
      alert('Vous devez être connecté pour commander.');
      return;
    }

    if (user.role === 'admin') {
      alert("ℹ️ Les administrateurs ne passent pas de commandes ici.");
      return;
    }

    setSelectedProduct(product);
    setQuantity(1);
    setCreating(true);
  }

  async function handleConfirmOrder(e) {
    e.preventDefault();
    if (!selectedProduct) return;

    const requestedQty = Number(quantity);

    if (!Number.isFinite(requestedQty) || requestedQty <= 0) {
      alert('Veuillez saisir une quantité valide (au moins 1).');
      return;
    }

    // Si stock connu et la demande dépasse le stock → message personnalisé
    if (typeof selectedProduct.stock === 'number') {
      if (selectedProduct.stock <= 0) {
        alert(
          "Ce produit est actuellement en rupture de stock. Merci de contacter le service client pour plus d'informations."
        );
        return;
      }

      if (requestedQty > selectedProduct.stock) {
        alert(
          `La quantité demandée (${requestedQty}) dépasse le stock disponible (${selectedProduct.stock}).\n\n` +
            'Merci de contacter le service client pour ajuster votre commande ou organiser une commande spéciale.'
        );
        return;
      }
    }

    try {
      setCreating(false);

      const payload = {
        customerNote: `Commande de ${requestedQty} x ${selectedProduct.name}`,
        items: [
          {
            productId: selectedProduct.id,
            quantity: requestedQty,
            unitPrice: Number(selectedProduct.price || 0),
          },
        ],
      };

      const newOrder = await createOrder(payload);

      alert(`✅ Commande créée pour ${requestedQty} × ${selectedProduct.name}`);

      setSelectedProduct(null);
      setQuantity(1);

      // compat: API peut renvoyer order ou id direct
      const id = newOrder?.id || newOrder?.order?.id;
      if (id) navigate(`/orders/${id}`);
      else navigate('/orders');
    } catch (err) {
      console.error('❌ Erreur création commande:', err);
      alert("Erreur lors de la création de la commande.");
    }
  }

  /* ============================================================
     🧮 Catégories disponibles (dérivées)
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
     🌀 États de chargement / erreur / vide
  ============================================================ */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100">
        <div className="bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl px-6 py-5 shadow-xl">
          <p className="text-gray-600 text-sm sm:text-lg animate-pulse text-center">
            Chargement du catalogue…
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-red-50 to-red-100 px-4">
        <div className="max-w-md w-full bg-white border border-red-100 shadow-xl rounded-3xl px-6 py-6">
          <h1 className="text-lg font-bold text-red-700 mb-2">
            Une erreur est survenue
          </h1>
          <p className="text-sm text-red-600 mb-4 break-words">{error}</p>
          <p className="text-xs text-gray-500">
            Veuillez réessayer plus tard ou contacter le support si le problème
            persiste.
          </p>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4">
        <div className="max-w-md w-full bg-white border border-slate-100 shadow-xl rounded-3xl px-6 py-6 text-center">
          <p className="text-gray-500 text-sm sm:text-base italic">
            Aucun produit disponible pour le moment.
          </p>
        </div>
      </div>
    );
  }

  /* ============================================================
     🧱 UI PRINCIPALE — Filtres + Tri + Grille Produits (Style A)
  ============================================================ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-3 sm:px-4 lg:px-6 py-8 sm:py-10">
      <div className="max-w-6xl mx-auto bg-white shadow-2xl rounded-3xl border border-slate-100 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">

        {/* ==== HEADER ==== */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] font-semibold text-blue-600 mb-1">
              Boutique Teranga
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-2">
              🛍️ <span>Catalogue des produits</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-xl">
              Explorez et commandez rapidement des produits disponibles depuis
              votre espace Teranga.
            </p>
          </div>

          <div className="flex items-end sm:items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            <div className="flex flex-col items-end text-right">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-[11px] text-slate-600 shadow-sm">
                {filteredProducts.length} résultat
                {filteredProducts.length > 1 ? 's' : ''} sur {products.length}
              </span>
              <span className="mt-1 text-[11px] text-slate-400">
                Filtrez par catégorie, prix ou nom de produit.
              </span>
            </div>
          </div>
        </div>

        {/* ==== BARRE DE FILTRES ==== */}
        <div className="bg-slate-50/80 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-sm px-4 py-4 sm:px-5 sm:py-4 space-y-3">
          {/* Ligne 1 : recherche + catégorie */}
          <div className="grid gap-3 md:grid-cols-4 items-end">
            {/* Recherche */}
            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
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
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                />
              </div>
            </div>

            {/* Catégorie */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Catégorie
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

          {/* Ligne 2 : prix, reset, tri */}
          <div className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
            {/* Prix + reset */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                  Prix min
                </label>
                <input
                  type="number"
                  min="0"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Min"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                  Prix max
                </label>
                <input
                  type="number"
                  min="0"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  className="w-full text-xs font-semibold rounded-xl border border-slate-200 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700"
                >
                  Réinitialiser
                </button>
              </div>
            </div>

            {/* Tri */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Trier par
              </label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
        {filteredProducts.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl shadow-sm py-10 flex items-center justify-center">
            <p className="text-slate-500 text-sm">
              Aucun produit ne correspond à ces critères.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((p) => {
              const images = getImagesForProduct(p);
              const mainImg = images[0] || null;

              return (
                <div
                  key={p.id}
                  className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-lg hover:border-blue-200 transition overflow-hidden flex flex-col"
                >
                  {/* Image */}
                  {mainImg ? (
                    <button
                      type="button"
                      onClick={() => openPreview(p, 0)}
                      className="relative group"
                      aria-label={`Voir images de ${p.name}`}
                    >
                      <img
                        src={mainImg}
                        alt={p.name}
                        className="w-full h-44 object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition" />

                      <div className="absolute left-3 bottom-3 text-white text-[11px] bg-black/50 px-2 py-1 rounded">
                        Cliquer pour agrandir
                      </div>

                      {images.length > 1 && (
                        <span className="absolute right-3 bottom-3 text-[11px] bg-black/60 text-white px-2 py-0.5 rounded">
                          {images.length} photo
                          {images.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </button>
                  ) : (
                    <div className="w-full h-44 flex items-center justify-center bg-slate-100 text-slate-400 text-xs">
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
                        <span className="px-2 py-0.5 rounded-full text-[11px] bg-blue-50 text-blue-700 border border-blue-100 whitespace-nowrap">
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
                          {formatProductPrice(p.price, p.currency)}
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
                            {p.stock > 0
                              ? `${p.stock} dispo`
                              : 'Rupture'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Bouton Commander */}
                    {user && user.role !== 'admin' && (
                      <button
                        onClick={() => handleOrder(p)}
                        className="mt-4 w-full inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-xl shadow-sm bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition"
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

        {/* ============================================================
            POPUP COMMANDE — UX PREMIUM
        ============================================================ */}
        {creating && selectedProduct && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 px-4">
            <div className="relative w-full max-w-sm rounded-2xl border border-slate-300 bg-white shadow-2xl">
              <button
                onClick={() => setCreating(false)}
                className="absolute top-3 right-3 text-slate-500 hover:text-slate-800"
                aria-label="Fermer"
              >
                ✕
              </button>

              <div className="p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-1">
                  Commander {selectedProduct.name}
                </h2>
                <p className="text-xs text-slate-600 mb-4">
                  {formatProductPrice(
                    selectedProduct.price,
                    selectedProduct.currency || 'XOF'
                  )}{' '}
                  / unité
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
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setCreating(false)}
                      className="px-4 py-2 text-sm bg-gray-100 text-slate-700 rounded-lg hover:bg-gray-200"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800"
                    >
                      Confirmer
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            LIGHTBOX PLEIN ÉCRAN — IMAGES UNIQUEMENT
        ============================================================ */}
        {previewProduct && (() => {
          const images = getImagesForProduct(previewProduct);
          if (!images.length) return null;

          return (
            <div
              className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4"
              onClick={closePreview}
              role="dialog"
              aria-modal="true"
            >
              {/* Fermer */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closePreview();
                }}
                className="absolute top-4 right-4 text-white text-xl font-bold px-3 py-1 rounded-full bg-black/60 hover:bg-black/80"
              >
                ✕
              </button>

              {/* Navigation */}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goPrev}
                    className="absolute left-4 text-white text-3xl px-3 py-2 rounded-full bg-black/50 hover:bg-black/70"
                  >
                    ‹
                  </button>

                  <button
                    type="button"
                    onClick={goNext}
                    className="absolute right-4 text-white text-3xl px-3 py-2 rounded-full bg-black/50 hover:bg-black/70"
                  >
                    ›
                  </button>
                </>
              )}

              <div
                className="bg-black/95 border border-slate-700 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex-1 flex items-center justify-center">
                  <img
                    src={images[previewIndex]}
                    alt={`Image ${previewIndex + 1}`}
                    className="max-h-[90vh] max-w-full object-contain"
                  />
                </div>

                {images.length > 1 && (
                  <div className="px-4 py-3 bg-black/80 border-t border-slate-800 flex gap-2 overflow-x-auto">
                    {images.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPreviewIndex(idx)}
                        className={`w-16 h-16 rounded-lg overflow-hidden border ${
                          idx === previewIndex
                            ? 'border-blue-400 ring-2 ring-blue-400/70'
                            : 'border-slate-600 hover:border-slate-400'
                        }`}
                      >
                        <img
                          src={img}
                          alt={`Miniature ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
