'use strict';

const { Op } = require('sequelize');
const { Product, Category } = require('../../models');
const { formatCurrency } = require('../utils/labels');
const imageKit = require('../helpers/teranga-imagekit');

/* ============================================================
   🔧 Helpers génériques
============================================================ */
function toSafeInt(v) {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}
function toTrimOrNull(v) {
  const s = (v ?? '').toString().trim();
  return s.length ? s : null;
}
function toNullableNumber(v) {
  if (v === '' || v === null || typeof v === 'undefined') return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}
function getPagination(req, defLimit = 50, maxLimit = 200) {
  const limit = Math.min(
    Math.max(parseInt(req.query?.limit, 10) || defLimit, 1),
    maxLimit
  );
  const page = Math.max(parseInt(req.query?.page, 10) || 1, 1);
  const offset = (page - 1) * limit;
  return { limit, offset, page };
}
function slugify(str = '') {
  return str
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 200);
}

/* ============================================================
   🖼 Helpers images → version ImageKit
============================================================ */
async function uploadToImageKit(file) {
  const uploaded = await imagekit.upload({
    file: file.buffer,
    fileName: file.originalname,
    folder: '/products',
  });

  return {
    url: uploaded.url,
    fileId: uploaded.fileId,
  };
}

/**
 * Upload multi-images (max 3)
 * - Supporte req.file, req.files, req.files.images etc.
 * - Transforme TOUT en liste uniforme de { url, fileId }
 */
async function extractImagesFromRequestImageKit(req) {
  const collected = [];

  if (req.file) collected.push(req.file);
  if (Array.isArray(req.files)) collected.push(...req.files);
  if (req.files && typeof req.files === 'object') {
    Object.values(req.files).forEach((arr) => {
      if (Array.isArray(arr)) collected.push(...arr);
    });
  }

  if (!collected.length) {
    return { coverImage: null, gallery: null, hasNewImages: false };
  }

  const uploads = [];
  for (const f of collected.slice(0, 3)) {
    const result = await uploadToImageKit(f);
    uploads.push(result);
  }

  return {
    coverImage: uploads[0],
    gallery: uploads,
    hasNewImages: true,
  };
}

/* ============================================================
   🏷️ Format helpers
============================================================ */
function withLabels(prod) {
  if (!prod) return null;
  const p = prod.toJSON ? prod.toJSON() : prod;

  const gallery = Array.isArray(p.gallery) ? p.gallery : [];

  const cover = p.coverImage || gallery[0] || null;

  return {
    ...p,
    image: cover?.url || null,
    imagePath: cover?.url || null,
    coverImage: cover,
    gallery,
    images: gallery,
    currencyLabel: formatCurrency(p.currency || 'XOF'),
  };
}

/* ============================================================
   🔐 ACL
============================================================ */
function canReadProduct(user) {
  return ['admin', 'agent', 'client'].includes(user?.role);
}
function canWriteProduct(user) {
  return user?.role === 'admin';
}

/* ============================================================
   1️⃣ CREATE (ImageKit)
============================================================ */
exports.create = async (req, res) => {
  try {
    if (!canWriteProduct(req.user))
      return res.status(403).json({ error: 'Accès interdit' });

    const {
      categoryId,
      name,
      sku,
      price,
      currency = 'XOF',
      stock = 0,
      description,
      shortDescription,
      isActive,
    } = req.body || {};

    if (!name) return res.status(400).json({ error: 'Nom du produit requis' });

    const cid = toSafeInt(categoryId);
    const cat = cid ? await Category.findByPk(cid) : null;

    const priceNum = toNullableNumber(price);
    if (price !== undefined && priceNum === null) {
      return res.status(400).json({ error: 'Le prix doit être un nombre valide.' });
    }

    const stockNum = toSafeInt(stock);

    // ⬆️ UPLOAD IMAGEKIT
    const { coverImage, gallery } = await extractImagesFromRequestImageKit(req);

    // Slug unique
    const baseSlug = slugify(name);
    let finalSlug = baseSlug || `p-${Date.now()}`;
    let i = 1;
    while (await Product.findOne({ where: { slug: finalSlug } })) {
      finalSlug = `${baseSlug}-${i++}`;
    }

    const prod = await Product.create({
      categoryId: cat ? cat.id : null,
      name: String(name).trim(),
      slug: finalSlug,
      sku: toTrimOrNull(sku),
      price: priceNum ?? 0,
      currency: String(currency).toUpperCase().trim(),
      stock: stockNum ?? 0,
      description: toTrimOrNull(description),
      shortDescription: toTrimOrNull(shortDescription),

      coverImage: coverImage || null,
      gallery: gallery || [],

      isActive:
        typeof isActive === 'undefined'
          ? true
          : String(isActive) === 'true' || isActive === true,
    });

    const created = await Product.findByPk(prod.id, {
      include: [{ model: Category, as: 'category' }],
    });

    return res.status(201).json({
      message: 'Produit créé avec succès',
      product: withLabels(created),
    });
  } catch (e) {
    console.error('❌ Erreur create product:', e);
    return res.status(500).json({ error: e.message || 'Erreur serveur' });
  }
};

/* ============================================================
   2️⃣ LIST
============================================================ */
exports.list = async (req, res) => {
  try {
    if (!canReadProduct(req.user))
      return res.status(403).json({ error: 'Accès interdit' });

    const q = toTrimOrNull(req.query?.q);
    const categoryId = toSafeInt(req.query?.categoryId);
    const active = req.query?.isActive;
    const { limit, offset, page } = getPagination(req);

    const where = {};
    if (q) {
      where[Op.or] = [
        { name: { [Op.like]: `%${q}%` } },
        { sku: { [Op.like]: `%${q}%` } },
        { description: { [Op.like]: `%${q}%` } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (typeof active !== 'undefined')
      where.isActive = String(active) === 'true';

    const { rows, count } = await Product.findAndCountAll({
      where,
      include: [{ model: Category, as: 'category' }],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return res.json({
      products: rows.map(withLabels),
      pagination: { page, limit, total: count },
    });
  } catch (e) {
    console.error('❌ Erreur list products:', e);
    return res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
};

/* ============================================================
   3️⃣ DETAIL
============================================================ */
exports.detail = async (req, res) => {
  try {
    if (!canReadProduct(req.user))
      return res.status(403).json({ error: 'Accès interdit' });

    const id = toSafeInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID produit invalide' });

    const prod = await Product.findByPk(id, {
      include: [{ model: Category, as: 'category' }],
    });
    if (!prod) return res.status(404).json({ error: 'Produit introuvable' });

    return res.json({ product: withLabels(prod) });
  } catch (e) {
    console.error('❌ Erreur detail product:', e);
    return res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
};

/* ============================================================
   4️⃣ UPDATE (ImageKit)
============================================================ */
exports.update = async (req, res) => {
  try {
    if (!canWriteProduct(req.user))
      return res.status(403).json({ error: 'Accès interdit' });

    const id = toSafeInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalide' });

    const prod = await Product.findByPk(id);
    if (!prod) return res.status(404).json({ error: 'Produit introuvable' });

    const {
      categoryId,
      name,
      sku,
      price,
      currency,
      stock,
      description,
      shortDescription,
      isActive,
    } = req.body || {};

    if (categoryId !== undefined) {
      const cid = toSafeInt(categoryId);
      prod.categoryId = cid || null;
    }

    let regenerateSlug = false;
    if (name !== undefined) {
      const newName = String(name).trim();
      if (newName && newName !== prod.name) {
        prod.name = newName;
        regenerateSlug = true;
      }
    }

    if (sku !== undefined) prod.sku = toTrimOrNull(sku);

    if (price !== undefined) {
      const priceNum = toNullableNumber(price);
      if (priceNum === null)
        return res.status(400).json({ error: 'Prix invalide' });
      prod.price = priceNum;
    }

    if (currency !== undefined)
      prod.currency = String(currency).toUpperCase().trim();

    if (stock !== undefined) {
      const stockNum = toSafeInt(stock);
      if (stock !== '' && stockNum === null)
        return res.status(400).json({ error: 'Stock invalide' });
      prod.stock = stockNum ?? prod.stock;
    }

    if (description !== undefined) prod.description = toTrimOrNull(description);
    if (shortDescription !== undefined)
      prod.shortDescription = toTrimOrNull(shortDescription);

    if (typeof isActive !== 'undefined')
      prod.isActive = String(isActive) === 'true' || isActive === true;

    // ⬆️ Upload ImageKit
    const { coverImage, gallery, hasNewImages } =
      await extractImagesFromRequestImageKit(req);

    if (hasNewImages) {
      // Optionnel : supprimer anciennes images ImageKit
      if (Array.isArray(prod.gallery)) {
        for (const img of prod.gallery) {
          if (img?.fileId) {
            try {
              await imagekit.deleteFile(img.fileId);
            } catch (err) {
              console.warn('⚠️ Impossible de supprimer image:', img.fileId);
            }
          }
        }
      }

      prod.coverImage = coverImage || null;
      prod.gallery = gallery || [];
    }

    // Regeneration du slug
    if (regenerateSlug && prod.name) {
      const baseSlug = slugify(prod.name);
      let finalSlug = baseSlug || `p-${Date.now()}`;
      let i = 1;
      while (
        await Product.findOne({
          where: { slug: finalSlug, id: { [Op.ne]: prod.id } },
        })
      ) {
        finalSlug = `${baseSlug}-${i++}`;
      }
      prod.slug = finalSlug;
    }

    await prod.save();

    const updated = await Product.findByPk(prod.id, {
      include: [{ model: Category, as: 'category' }],
    });

    return res.json({
      message: 'Produit mis à jour avec succès',
      product: withLabels(updated),
    });
  } catch (e) {
    console.error('❌ Erreur update product:', e);
    return res.status(500).json({ error: e.message || 'Erreur serveur' });
  }
};

/* ============================================================
   5️⃣ DELETE
============================================================ */
exports.remove = async (req, res) => {
  try {
    if (!canWriteProduct(req.user))
      return res.status(403).json({ error: 'Accès interdit' });

    const id = toSafeInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalide' });

    const force = String(req.query?.force || '').toLowerCase() === 'true';
    const prod = await Product.findByPk(id);
    if (!prod) return res.status(404).json({ error: 'Produit introuvable' });

    if (prod.isActive && !force) {
      return res.status(400).json({
        error:
          'Ce produit est actif. Pour supprimer : DELETE /products/:id?force=true',
      });
    }

    // Supprimer les images ImageKit
    if (Array.isArray(prod.gallery)) {
      for (const img of prod.gallery) {
        if (img?.fileId) {
          try {
            await imagekit.deleteFile(img.fileId);
          } catch (_) {}
        }
      }
    }

    await prod.destroy();
    return res.json({ message: 'Produit supprimé avec succès' });
  } catch (e) {
    console.error('❌ Erreur remove product:', e);
    return res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
};
