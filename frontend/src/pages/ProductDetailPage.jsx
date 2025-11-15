// frontend/src/pages/ProductDetailPage.jsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProductById } from '../services/products';
import { formatCurrency } from '../utils/labels';

/**
 * 🛍️ Détail d’un produit
 * ---------------------------------------------------------
 * - Charge les données via /api/products/:id
 * - Affiche galerie d’images, description, prix, stock, catégorie
 * - Lightbox plein écran au clic sur l’image principale
 * - Cohérent avec normalizeProduct() (imageUrl + allImageUrls)
 * ---------------------------------------------------------
 */
export default function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 🖼️ Gestion de la galerie
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    async function loadProduct() {
      try {
        setLoading(true);
        const prod = await getProductById(id);
        setProduct(prod);
        setError('');
        setSelectedIndex(0);
        setLightboxOpen(false);
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
            to="/shop"
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
            to="/shop"
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
    stock,
    category,
    imageUrl,
    allImageUrls,
  } = product;

  // 🔹 Construction de la liste d’images (cover + galerie)
  const images =
    Array.isArray(allImageUrls) && allImageUrls.length
      ? allImageUrls
      : imageUrl
      ? [imageUrl]
      : [];

  const hasImages = images.length > 0;
  const currentImage = hasImages ? images[selectedIndex] : null;

  // 🔹 Navigation lightbox
  function goPrev(event) {
    if (event) event.stopPropagation();
    if (!hasImages) return;
    setSelectedIndex((prev) =>
      prev === 0 ? images.length - 1 : prev - 1
    );
  }

  function goNext(event) {
    if (event) event.stopPropagation();
    if (!hasImages) return;
    setSelectedIndex((prev) =>
      prev === images.length - 1 ? 0 : prev + 1
    );
  }

  function openLightbox() {
    if (!hasImages) return;
    setLightboxOpen(true);
  }

  function closeLightbox() {
    setLightboxOpen(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-6 py-10">
      <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
        <div className="flex flex-col md:flex-row gap-6">
          {/* =========================
              🖼 Bloc images
          ========================== */}
          <div className="w-full md:w-1/2">
            {hasImages ? (
              <>
                {/* Image principale */}
                <div
                  className="relative cursor-zoom-in group"
                  onClick={openLightbox}
                  aria-label="Voir l'image en grand"
                >
                  <img
                    src={currentImage}
                    alt={name}
                    className="w-full h-80 object-cover rounded-xl border border-gray-200"
                  />
                  <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/10 transition" />
                  {images.length > 1 && (
                    <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded-full">
                      {selectedIndex + 1} / {images.length}
                    </span>
                  )}
                </div>

                {/* Vignettes */}
                {images.length > 1 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {images.map((img, idx) => (
                      <button
                        key={img + idx}
                        type="button"
                        onClick={() => setSelectedIndex(idx)}
                        className={`border rounded-lg overflow-hidden w-16 h-16 flex-shrink-0 ${
                          idx === selectedIndex
                            ? 'ring-2 ring-blue-500 border-blue-500'
                            : 'border-gray-200 hover:border-blue-300'
                        }`}
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
              <div className="w-full h-80 flex items-center justify-center rounded-xl border border-dashed border-gray-300 text-gray-400 text-sm bg-gray-50">
                Aucun visuel disponible
              </div>
            )}
          </div>

          {/* =========================
              📄 Bloc infos
          ========================== */}
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {name}
            </h1>

            {category?.name && (
              <p className="text-xs inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100 mb-3">
                {category.name}
              </p>
            )}

            <p className="text-gray-600 mb-4 whitespace-pre-line">
              {description || 'Aucune description disponible.'}
            </p>

            <p className="text-2xl font-semibold text-blue-600 mb-4">
              {formatCurrency(currency || 'XOF')}{' '}
              {Number(price || 0).toLocaleString()}
            </p>

            {typeof stock === 'number' && (
              <p className="text-sm text-gray-500 mb-4">
                <span className="font-medium">Stock :</span>{' '}
                {stock}
              </p>
            )}

            <Link
              to="/shop"
              className="inline-block mt-2 px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition"
            >
              ← Retour au catalogue
            </Link>
          </div>
        </div>
      </div>

      {/* =========================
          💡 Lightbox plein écran
      ========================== */}
      {lightboxOpen && hasImages && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          onClick={closeLightbox}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              closeLightbox();
            }}
            className="absolute top-4 right-4 text-white text-xl font-bold px-3 py-1 rounded-full bg-black/60 hover:bg-black/80"
            aria-label="Fermer"
          >
            ✕
          </button>

          {images.length > 1 && (
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

          <img
            src={currentImage}
            alt={name}
            className="max-w-[90vw] max-h-[80vh] object-contain rounded-xl shadow-2xl border border-white/20"
          />

          {images.length > 1 && (
            <div className="absolute bottom-4 text-white text-xs bg-black/40 px-3 py-1 rounded-full">
              {selectedIndex + 1} / {images.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
