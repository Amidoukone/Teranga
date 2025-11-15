// frontend/src/services/products.js
import api, { getFileUrl } from './api';
import { applyLabels } from '../utils/labels';

/* -----------------------------------------------------------
 * 🧩 Normalisation produit
 * -----------------------------------------------------------
 * - Gère les URLs d’images (coverImage / gallery / imagePath)
 * - Convertit proprement les nombres et labels
 * - Expose des helpers pratiques :
 *     • imageUrl        → image principale (cover)
 *     • galleryUrls     → autres images (max 3 côté UI si on veut)
 *     • allImageUrls    → [imageUrl, ...galleryUrls]
 * --------------------------------------------------------- */
function normalizeProduct(raw = {}) {
  const p = { ...raw };

  // 🔹 1) Détection des chemins bruts
  // Compat :
  //  - anciens champs: image, imagePath
  //  - nouveaux champs: coverImage, gallery (JSON en DB)
  const coverPath =
    p.imagePath || p.image || p.coverImage || null;

  // gallery brute venant de l’API (optionnelle)
  const rawGallery =
    Array.isArray(p.gallery) ? p.gallery :
    Array.isArray(p.images) ? p.images :
    [];

  // 🔹 2) Construction de l’URL principale (imageUrl)
  let imageUrl = '';
  if (coverPath && typeof coverPath === 'string') {
    if (coverPath.startsWith('/uploads')) {
      imageUrl = getFileUrl(coverPath);
    } else if (coverPath.startsWith('http')) {
      imageUrl = coverPath;
    }
  }

  // 🔹 3) Construction des URLs de galerie
  const galleryUrls = rawGallery
    .filter((g) => typeof g === 'string' && g.length > 0)
    .map((g) => {
      if (g.startsWith('/uploads')) return getFileUrl(g);
      if (g.startsWith('http')) return g;
      return g;
    })
    // on évite de dupliquer la cover dans la galerie
    .filter((url) => url && url !== imageUrl);

  // 🔹 4) Exposition des helpers d’images
  p.imageUrl = imageUrl || '';          // utilisé partout dans ton front actuel
  p.galleryUrls = galleryUrls;          // pour carrousel / lightbox
  p.allImageUrls = imageUrl
    ? [imageUrl, ...galleryUrls]
    : [...galleryUrls];

  // 🔹 Conversion numérique propre (comme avant)
  if (p.price !== undefined && p.price !== null) {
    const n = Number(p.price);
    if (!Number.isNaN(n)) p.price = n;
  }
  if (p.stock !== undefined && p.stock !== null) {
    const n = Number(p.stock);
    if (!Number.isNaN(n)) p.stock = n;
  }

  // 🔹 Application des labels si disponibles
  return applyLabels(p);
}

/* -----------------------------------------------------------
 * 🧾 Helpers FormData
 * -----------------------------------------------------------
 * - Gère fichier image principal + galerie (multi-images)
 * - Compatible avec multer côté backend:
 *     • imageFile / image  → champ "image"
 *     • imageFiles (File[]) → champ "images" (plusieurs fois)
 * --------------------------------------------------------- */
function toFormData(payload = {}) {
  const fd = new FormData();

  Object.entries(payload).forEach(([key, val]) => {
    if (val === undefined || val === null) return;

    // 🔸 Gestion de l’image principale (compat existant)
    // - Avant : imageFile (File) ou image (File) → champ "image"
    if (
      (key === 'imageFile' || key === 'image') &&
      val instanceof File
    ) {
      fd.append('image', val);
      return;
    }

    // 🔸 Gestion de la galerie (multi-images, nouveau)
    // - imageFiles: tableau de File (max 3 idéalement côté UI)
    //   → on envoie sous le champ "images" (multer any())
    if (key === 'imageFiles' && Array.isArray(val)) {
      val
        .filter((f) => f instanceof File)
        .slice(0, 3) // tu peux lever cette limite si besoin
        .forEach((file) => {
          fd.append('images', file);
        });
      return;
    }

    // 🔸 Cast propre pour les champs numériques
    if (['price', 'stock', 'categoryId'].includes(key)) {
      const num = Number(val);
      fd.append(key, Number.isNaN(num) ? val : num);
      return;
    }

    // 🔸 Autres champs textuels
    fd.append(key, val);
  });

  return fd;
}

/* -----------------------------------------------------------
 * GET /products — liste des produits
 * -----------------------------------------------------------
 * Accepte params (q, categoryId, page, limit, etc.)
 * Retourne un tableau de produits normalisés
 * --------------------------------------------------------- */
export async function getProducts(params = {}) {
  const { data } = await api.get('/products', { params });
  const items = data?.items || data?.products || [];
  return items.map(normalizeProduct);
}

/* -----------------------------------------------------------
 * GET /products/:id — détail d’un produit
 * --------------------------------------------------------- */
export async function getProductById(id) {
  const { data } = await api.get(`/products/${id}`);
  const product = data?.product ?? data;
  return normalizeProduct(product);
}

/* -----------------------------------------------------------
 * POST /products — création
 * -----------------------------------------------------------
 * Supporte :
 *  - imageFile (File) → "image" (cover)
 *  - imageFiles (File[]) → "images" (galerie, max 3)
 * --------------------------------------------------------- */
export async function createProduct(payload) {
  const formData = toFormData(payload);
  const { data } = await api.post('/products', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const product = data?.product ?? data;
  return normalizeProduct(product);
}

/* -----------------------------------------------------------
 * PUT /products/:id — mise à jour
 * -----------------------------------------------------------
 * Supporte les mêmes patterns que createProduct
 * --------------------------------------------------------- */
export async function updateProduct(id, payload) {
  const formData = toFormData(payload);
  const { data } = await api.put(`/products/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const product = data?.product ?? data;
  return normalizeProduct(product);
}

/* -----------------------------------------------------------
 * DELETE /products/:id
 * -----------------------------------------------------------
 * Supporte le flag `?force=true` pour suppression définitive
 * --------------------------------------------------------- */
export async function deleteProduct(idOrUrl) {
  const { data } = await api.delete(`/products/${idOrUrl}`);
  return data;
}

/* -----------------------------------------------------------
 * Export groupé
 * --------------------------------------------------------- */
const ProductsService = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};

export default ProductsService;
