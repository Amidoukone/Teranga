import { getFileUrl } from '../../services/api';

export function getProductImages(product = {}) {
  const urls = [product.imageUrl, product.coverImage,
    ...(Array.isArray(product.allImageUrls) ? product.allImageUrls : []),
    ...(Array.isArray(product.gallery) ? product.gallery : [])];
  return [...new Set(urls.map((entry) => typeof entry === 'string' ? entry : entry?.url)
    .filter(Boolean).map((url) => getFileUrl(url.replace(/\\/g, '/'))))];
}

export function catalogueReturn(from) {
  return typeof from === 'string' && /^\/shop(?:\?[^#\\\r\n]*)?$/.test(from) ? from : '/shop';
}
