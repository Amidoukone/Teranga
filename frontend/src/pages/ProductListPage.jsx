// frontend/src/pages/ProductListPage.jsx
/* eslint-disable jsx-a11y/img-redundant-alt */
/**
 * 🛍️ ProductListPage — Teranga PRODUCTION READY (Style A 2025)
 * ----------------------------------------------------------------
 * - Liste des produits avec design premium & responsive
 * - Compatible multi-images (imageUrl + allImageUrls + coverImage + gallery)
 * - Utilise FILE_BASE + toAbsUrl pour les environnements de prod
 * - Compatible réponses API: array direct OU { products, pagination }
 * - Aucune régression de logique, uniquement alignement + robustesse
 * ----------------------------------------------------------------
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getProducts } from "../services/products";
import { formatCurrency } from "../utils/labels";
import { useLocale } from "../i18n/useLocale";
import { useTranslation } from "react-i18next";

/* =========================================================
   🌍 FILE_BASE + normalizePath + toAbsUrl
   (même logique que ProductCatalogPage, harmonisation)
========================================================= */
const FILE_BASE =
  (typeof window !== "undefined" &&
    (window.__TERANGA_FILE_BASE_URL ||
      window.__TERANGA_API_BASE_URL ||
      "")) ||
  "";

function normalizePath(path = "") {
  if (!path) return "";
  const p = String(path).trim().replace(/\\/g, "/");

  if (/^https?:\/\//i.test(p)) return p;

  const start = p.startsWith("/") ? p : "/" + p;
  return start.replace(/\/{2,}/g, "/");
}

function toAbsUrl(path = "") {
  const norm = normalizePath(path);
  if (!norm) return "";
  if (/^https?:\/\//i.test(norm)) return norm;

  return FILE_BASE.replace(/\/$/, "") + "/" + norm.replace(/^\//, "");
}

/* =========================================================
   🖼 Helpers images (robuste, rétro-compatible)
   - backend withLabels => imageUrl, allImageUrls, coverImage, gallery
========================================================= */
function getProductImages(product) {
  if (!product) return [];

  const urls = [];

  // 1) allImageUrls (backend withLabels)
  if (Array.isArray(product.allImageUrls) && product.allImageUrls.length) {
    urls.push(...product.allImageUrls);
  }

  // 2) coverImage (string ou { url })
  if (product.coverImage) {
    if (typeof product.coverImage === "string") {
      urls.unshift(product.coverImage);
    } else if (product.coverImage?.url) {
      urls.unshift(product.coverImage.url);
    }
  }

  // 3) imageUrl legacy/compat
  if (product.imageUrl) {
    urls.unshift(product.imageUrl);
  }

  // 4) gallery : [{ url }, "string", ...]
  if (Array.isArray(product.gallery) && product.gallery.length) {
    product.gallery.forEach((g) => {
      if (g && typeof g === "object" && g.url) urls.push(g.url);
      else if (typeof g === "string") urls.push(g);
    });
  }

  // Déduplication + normalisation en URL absolues
  const seen = new Set();
  return urls
    .map((u) => toAbsUrl(u))
    .filter((u) => u && !seen.has(u) && (seen.add(u), true));
}

/* =========================================================
   🛍️ Page Liste des produits
========================================================= */
export default function ProductListPage() {
  const { formatNumber } = useLocale();
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProducts() {
      try {
        setLoading(true);

        // ✅ compat: getProducts peut renvoyer:
        // - un array directement
        // - ou { products, pagination }
        const res = await getProducts();
        const prods = Array.isArray(res) ? res : res?.products;

        setProducts(Array.isArray(prods) ? prods : []);
        setError("");
      } catch (e) {
        console.error("❌ Erreur chargement produits:", e);
        const msg =
          e?.response?.data?.error ||
          t("productListPage.errors.load");
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, [t]);

  /* =========================================================
     🌀 États de chargement / erreur
  ========================================================= */
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100">
        <p className="text-gray-600 text-lg animate-pulse">
          {t("productListPage.loading")}
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
            {t("productListPage.actions.backHome")}
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
            {t("productListPage.empty")}
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-800"
          >
            {t("productListPage.actions.backHome")}
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
              🛍️ <span>{t("productListPage.header.title")}</span>
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              {t("productListPage.header.subtitle")}
            </p>
          </div>

          <div className="text-right text-xs text-slate-500">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/80 border border-slate-200 shadow-sm">
              {t("productListPage.header.count", { count: products.length })}
            </span>
          </div>
        </div>

        {/* GRILLE PRODUITS */}
        <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-5">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => {
              const images = getProductImages(p);
              const mainImg = images[0] || null;
              const hasMulti = images.length > 1;

              const currencyLabel = formatCurrency(
                (p.currency || "XOF").toUpperCase()
              );

              const priceNumber = Number(p.price || 0);

              const excerpt =
                (p.shortDescription && String(p.shortDescription).trim()) ||
                (p.description && String(p.description).trim()) ||
                "";

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
                          {t("productListPage.card.imageCount", {
                            count: images.length,
                          })}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-44 flex items-center justify-center bg-slate-100 text-slate-400 text-sm mb-0">
                      {t("productListPage.card.noImage")}
                    </div>
                  )}

                  {/* Contenu carte */}
                  <div className="flex-1 flex flex-col p-4">
                    {/* Titre + réf */}
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-base font-semibold text-slate-900 line-clamp-2">
                        {p.name || t("common.dash")}
                      </h2>
                      {p.id != null && (
                        <span className="text-[10px] text-slate-400 font-mono bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">
                          #{p.id}
                        </span>
                      )}
                    </div>

                    {/* Description courte */}
                    <p className="text-slate-600 flex-1 mt-1 text-sm line-clamp-3">
                      {excerpt ? excerpt : t("productListPage.card.noDescription")}
                    </p>

                    {/* Prix */}
                    <div className="mt-3 flex items-end justify-between">
                      <div>
                        <p className="text-[11px] uppercase text-slate-400">
                          {t("productListPage.card.priceLabel")}
                        </p>
                        <p className="text-lg font-bold text-blue-600">
                          {formatNumber(priceNumber)} {currencyLabel}
                        </p>
                      </div>
                    </div>

                    {/* Call-to-action subtil */}
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <span>{t("productListPage.card.viewDetails")}</span>
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

