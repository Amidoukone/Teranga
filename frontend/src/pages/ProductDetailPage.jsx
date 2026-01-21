// ============================================================
// ProductDetailPage.jsx — Teranga PRODUCTION READY (Style A 2025)
// Design premium + responsive, 0 régression fonctionnelle
// - Images robustes (allImageUrls + gallery + coverImage + imageUrl)
// - FILE_BASE + toAbsUrl (Render/Netlify/Prod)
// - Lightbox + navigation + miniatures
// ============================================================

/* eslint-disable jsx-a11y/img-redundant-alt */
import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProductById } from '../services/products';
import { formatCurrency } from '../utils/labels';

/* ============================================================
   🌍 CONFIG PRODUCTION — FILE_BASE / toAbsUrl()
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
   🖼 IMAGES — robuste & rétro-compatible backend
   Sources possibles:
   - allImageUrls: array de strings (déjà prêt côté backend)
   - gallery: [{url}, "string", ...]
   - coverImage: "string" ou {url}
   - imageUrl: "string"
============================================================ */
function getImagesForProduct(p) {
  if (!p) return [];

  const urls = [];

  // 1) allImageUrls (prioritaire)
  if (Array.isArray(p.allImageUrls)) {
    urls.push(...p.allImageUrls);
  }

  // 2) gallery
  if (Array.isArray(p.gallery)) {
    p.gallery.forEach((g) => {
      if (g && typeof g === 'object' && g.url) urls.push(g.url);
      else if (typeof g === 'string') urls.push(g);
    });
  }

  // 3) coverImage (en premier)
  if (p.coverImage) {
    if (typeof p.coverImage === 'string') urls.unshift(p.coverImage);
    else if (p.coverImage.url) urls.unshift(p.coverImage.url);
  }

  // 4) imageUrl (compat historique)
  if (p.imageUrl) {
    urls.unshift(p.imageUrl);
  }

  // Dédup + absolu
  const seen = new Set();
  return urls
    .map((u) => toAbsUrl(u))
    .filter((u) => u && !seen.has(u) && (seen.add(u), true));
}

/* ============================================================
   ⭐ PAGE DÉTAIL PRODUIT — Style A
============================================================ */
export default function ProductDetailPage() {
  const { id } = useParams();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  /* ============================================================
     🔄 Load product (master/multi-pays friendly)
     - Compat si API renvoie `product` ou l'objet direct
  ============================================================ */
  useEffect(() => {
    let mounted = true;

    async function loadProduct() {
      try {
        setLoading(true);

        const res = await getProductById(id);

        // ✅ compat: res peut être l'objet produit ou { product }
        const prod = res?.product ? res.product : res;

        if (!mounted) return;

        setProduct(prod || null);
        setSelectedIndex(0);
        setLightboxOpen(false);
        setError('');
      } catch (e) {
        console.error('❌ Erreur chargement produit:', e);
        const msg =
          e?.response?.data?.error ||
          "Impossible de charger ce produit pour le moment.";
        if (mounted) setError(msg);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (id) loadProduct();

    return () => {
      mounted = false;
    };
  }, [id]);

  /* ============================================================
     🧮 Images dérivées (memo)
  ============================================================ */
  const images = useMemo(() => {
    if (!product) return [];
    return getImagesForProduct(product);
  }, [product]);

  const hasImages = images.length > 0;
  const safeIndex = Math.min(Math.max(selectedIndex, 0), Math.max(images.length - 1, 0));
  const currentImage = hasImages ? images[safeIndex] : null;

  /* ============================================================
     🌀 Load / Error / Not found
  ============================================================ */
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100">
        <p className="text-gray-600 text-lg animate-pulse">
          Chargement du produit…
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
            to="/shop"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-800"
          >
            ← Retour au catalogue
          </Link>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4">
        <div className="max-w-md w-full bg-white border border-gray-100 rounded-2xl shadow-lg p-6 text-center">
          <p className="text-gray-500 text-base sm:text-lg italic mb-4">
            Produit introuvable.
          </p>
          <Link
            to="/shop"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-800"
          >
            ← Retour au catalogue
          </Link>
        </div>
      </div>
    );
  }

  /* ============================================================
     🖼 Lightbox navigation
  ============================================================ */
  function goPrev(e) {
    if (e) e.stopPropagation();
    if (!hasImages) return;

    setSelectedIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  }

  function goNext(e) {
    if (e) e.stopPropagation();
    if (!hasImages) return;

    setSelectedIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  }

  function openLightbox() {
    if (hasImages) setLightboxOpen(true);
  }

  function closeLightbox() {
    setLightboxOpen(false);
  }

  const {
    name,
    description,
    price,
    currency,
    stock,
    category,
    createdAt,
    updatedAt,
  } = product;

  /* ============================================================
     🧱 UI PRINCIPALE — Style A premium
  ============================================================ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 sm:px-6 py-10">
      <div className="max-w-5xl mx-auto">

        {/* HEADER / BREADCRUMB LIGHT */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
              <Link
                to="/shop"
                className="inline-flex items-center gap-1 hover:text-slate-700 flex-shrink-0"
              >
                <span>Catalogue</span>
                <span aria-hidden="true">/</span>
              </Link>
              <span className="font-medium text-slate-700 line-clamp-1">
                {name}
              </span>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">
              Détail du produit
            </h1>
          </div>

          {product.id && (
            <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-full bg-white/80 border border-slate-200 text-[11px] text-slate-500 font-mono">
              ID&nbsp;#{product.id}
            </span>
          )}
        </div>

        {/* CARD PRINCIPALE */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col md:flex-row gap-6 lg:gap-8">

            {/* ===========================
                🖼 Bloc images
               =========================== */}
            <div className="w-full md:w-1/2">
              {hasImages ? (
                <>
                  {/* Image principale */}
                  <div
                    className="relative cursor-zoom-in group"
                    onClick={openLightbox}
                    role="button"
                    tabIndex={0}
                    aria-label={`Voir image ${safeIndex + 1} de ${images.length}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') openLightbox();
                    }}
                  >
                    <img
                      src={currentImage}
                      alt={name}
                      className="
                        w-full h-80 sm:h-96 object-cover rounded-2xl
                        border border-slate-200 shadow-sm
                        transition-transform duration-200
                        group-hover:scale-[1.01]
                      "
                    />

                    {/* Overlay */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/30 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition" />

                    {/* Compteur */}
                    {images.length > 1 && (
                      <span className="absolute bottom-3 right-3 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded-full">
                        {safeIndex + 1} / {images.length}
                      </span>
                    )}

                    {/* Hint zoom */}
                    <span className="absolute bottom-3 left-3 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">
                      Cliquer pour agrandir
                    </span>
                  </div>

                  {/* Vignettes */}
                  {images.length > 1 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {images.map((img, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedIndex(idx)}
                          className={`
                            relative w-16 h-16 rounded-lg overflow-hidden border flex-shrink-0
                            transition
                            ${
                              idx === safeIndex
                                ? 'border-blue-500 ring-2 ring-blue-400/70'
                                : 'border-slate-200 hover:border-blue-300'
                            }
                          `}
                          aria-label={`Voir la vignette ${idx + 1}`}
                        >
                          <img
                            src={img}
                            alt={`${name} vignette ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-80 sm:h-96 flex items-center justify-center rounded-2xl border border-dashed border-slate-300 text-slate-400 text-sm bg-slate-50">
                  Aucun visuel disponible
                </div>
              )}
            </div>
            {/* ===========================
                📄 Bloc infos
               =========================== */}
            <div className="flex-1 flex flex-col">
              {/* Catégorie + titre */}
              <div className="mb-3">
                {category?.name && (
                  <p className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100 text-[11px] font-medium mb-2">
                    {category.name}
                  </p>
                )}

                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 break-words">
                  {name}
                </h2>
              </div>

              {/* Prix + stock */}
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <div>
                  <p className="text-[11px] uppercase text-slate-400">
                    Prix
                  </p>
                  <p className="text-2xl sm:text-3xl font-semibold text-blue-600">
                    {formatCurrency(currency || 'XOF')}{' '}
                    {Number(price || 0).toLocaleString('fr-FR')}
                  </p>
                </div>

                {typeof stock === 'number' && (
                  <div>
                    <p className="text-[11px] uppercase text-slate-400">
                      Stock
                    </p>
                    <p
                      className={`text-sm font-semibold ${
                        stock > 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {stock > 0
                        ? `${stock} article${stock > 1 ? 's' : ''} disponible${
                            stock > 1 ? 's' : ''
                          }`
                        : 'Rupture de stock'}
                    </p>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="mb-4 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {description || 'Aucune description disponible.'}
              </div>

              {/* Métadonnées */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-500 mb-6">
                {createdAt && (
                  <div>
                    <span className="font-semibold">Créé le :</span>{' '}
                    {new Date(createdAt).toLocaleDateString('fr-FR')}
                  </div>
                )}
                {updatedAt && (
                  <div>
                    <span className="font-semibold">Dernière mise à jour :</span>{' '}
                    {new Date(updatedAt).toLocaleDateString('fr-FR')}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-auto flex flex-wrap gap-3">
                <Link
                  to="/shop"
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-800"
                >
                  ← Retour au catalogue
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          💡 LIGHTBOX PLEIN ÉCRAN — images uniquement
      ============================================================ */}
      {lightboxOpen && hasImages && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label={`Images du produit ${name}`}
        >
          {/* Bouton fermer */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              closeLightbox();
            }}
            className="absolute top-4 right-4 text-white text-xl font-bold px-3 py-1 rounded-full bg-black/60 hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white"
            aria-label="Fermer la lightbox"
          >
            ✕
          </button>

          {/* Navigation */}
          {images.length > 1 && (
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

          {/* Image */}
          <img
            src={currentImage}
            alt={`${name} (image ${safeIndex + 1})`}
            className="max-w-[92vw] max-h-[80vh] object-contain rounded-xl shadow-2xl border border-white/20"
          />

          {/* Compteur */}
          {images.length > 1 && (
            <div className="absolute bottom-4 text-white text-xs bg-black/40 px-3 py-1 rounded-full">
              {safeIndex + 1} / {images.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
