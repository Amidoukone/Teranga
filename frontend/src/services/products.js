import api, { getFileUrl } from './api';
import { applyLabels } from '../utils/labels';

/* -----------------------------------------------------------
 * 🧩 Normalisation produit
 * -----------------------------------------------------------
 * - Gère les URLs d’image (imagePath → imageUrl absolue)
 * - Convertit proprement les nombres et labels
 * - Rend le produit cohérent pour le frontend
 * --------------------------------------------------------- */
function normalizeProduct(raw = {}) {
  const p = { ...raw };

  // 🔹 Normalisation de l'image
  // - Si le backend renvoie imagePath (ex: /uploads/xxx.jpg), on le convertit en URL complète
  // - Si image existe déjà sous forme absolue, on la garde
  const path = p.imagePath || p.image || null;
  if (path && typeof path === 'string') {
    if (path.startsWith('/uploads')) {
      p.imageUrl = getFileUrl(path);
    } else if (path.startsWith('http')) {
      // image déjà absolue, on garde telle quelle
      p.imageUrl = path;
    }
  }

  // 🔹 Conversion numérique propre
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
 * - Gère fichier image + champs scalaires
 * - Compatible avec multer (champ "image")
 * --------------------------------------------------------- */
function toFormData(payload = {}) {
  const fd = new FormData();

  Object.entries(payload).forEach(([key, val]) => {
    if (val === undefined || val === null) return;

    // 🔸 Gestion de l'image
    if ((key === 'imageFile' || key === 'image') && val instanceof File) {
      fd.append('image', val);
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
 * Supporte imageFile (File) → "image" (upload via multer)
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
 * Supporte imageFile (File) → "image"
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
