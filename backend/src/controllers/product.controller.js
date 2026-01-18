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
   🔒 ImageKit activation check
============================================================ */
function isImageKitEnabled() {
  return Boolean(
    process.env.IMAGEKIT_PUBLIC_KEY &&
      process.env.IMAGEKIT_PRIVATE_KEY &&
      process.env.IMAGEKIT_URL_ENDPOINT
  );
}

/* ============================================================
   🖼 Upload ImageKit (safe)
============================================================ */
async function uploadToImageKit(file) {
  if (!isImageKitEnabled()) {
    console.warn('⚠️ ImageKit désactivé : upload ignoré');
    return null;
  }

  try {
    const uploaded = await imageKit.upload({
      file: file.buffer,
      fileName: file.originalname,
      folder: '/teranga/products',
    });

    return {
      url: uploaded.url,
      fileId: uploaded.fileId,
    };
  } catch (err) {
    console.error(`❌ Erreur upload ImageKit (${file.originalname}):`, err);
    return null;
  }
}

/* ============================================================
   🖼 Collecte des fichiers (multer.any)
============================================================ */
async function extractImagesFromRequestImageKit(req) {
  const collected = [];

  if (req.file) collected.push(req.file);
  if (Array.isArray(req.files)) collected.push(...req.files);

  if (req.files && typeof req.files === 'object' && !Array.isArray(req.files)) {
    Object.values(req.files).forEach((arr) => {
      if (Array.isArray(arr)) collected.push(...arr);
    });
  }

  if (!collected.length) {
    return { coverImage: null, gallery: [], hasNewImages: false };
  }

  const uploads = [];
  for (const f of collected.slice(0, 3)) {
    const up = await uploadToImageKit(f);
    if (up) uploads.push(up);
  }

  return {
    coverImage: uploads[0] || null,
    gallery: uploads,
    hasNewImages: uploads.length > 0,
  };
}

/* ============================================================
   🏷️ withLabels — version complète et FIABLE
============================================================ */
function withLabels(prod) {
  if (!prod) return null;

  const p = prod.toJSON ? prod.toJSON() : prod;
  const gallery = Array.isArray(p.gallery) ? p.gallery : [];

  let cover = null;
  if (typeof p.coverImage === 'string') cover = { url: p.coverImage };
  else if (p.coverImage && typeof p.coverImage === 'object') cover = p.coverImage;
  else if (gallery[0]) cover = gallery[0];

  const coverUrl = cover?.url || null;

  const galleryUrls = gallery
    .map((g) => g?.url)
    .filter((u) => typeof u === 'string' && u.length > 0);

  const rawUrls = [];
  if (coverUrl) rawUrls.push(coverUrl);
  rawUrls.push(...galleryUrls);

  const seen = new Set();
  const allImageUrls = rawUrls.filter((u) => {
    if (!u || seen.has(u)) return false;
    seen.add(u);
    return true;
  });

  return {
    ...p,
    imageUrl: coverUrl,
    allImageUrls,
    image: coverUrl,
    imagePath: coverUrl,
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
   1️⃣ CREATE
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
      countryId,
      regionId,
    } = req.body || {};

    if (!name)
      return res.status(400).json({ error: 'Nom du produit requis' });

    const cid = toSafeInt(categoryId);
    const cat = cid ? await Category.findByPk(cid) : null;

    const priceNum = toNullableNumber(price);
    if (price !== undefined && priceNum === null)
      return res.status(400).json({ error: 'Le prix doit être un nombre.' });

    const stockNum = toSafeInt(stock);
    const { coverImage, gallery } = await extractImagesFromRequestImageKit(req);

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
      coverImage: coverImage?.url || null,
      gallery: gallery.map((g) => ({ url: g.url, fileId: g.fileId })),
      isActive:
        typeof isActive === 'undefined'
          ? true
          : String(isActive) === 'true' || isActive === true,
      countryId: toSafeInt(countryId),
      regionId: toSafeInt(regionId),
    });

    const created = await Product.findByPk(prod.id, {
      include: [{ model: Category, as: 'category' }],
    });

    return res.status(201).json({
      message: 'Produit créé avec succès',
      product: withLabels(created),
    });
  } catch (e) {
    console.error('❌ create product:', e);
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
    console.error('❌ list products:', e);
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
    if (!id) return res.status(400).json({ error: 'ID invalide' });

    const prod = await Product.findByPk(id, {
      include: [{ model: Category, as: 'category' }],
    });

    if (!prod) return res.status(404).json({ error: 'Produit introuvable' });

    return res.json({ product: withLabels(prod) });
  } catch (e) {
    console.error('❌ detail product:', e);
    return res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
};

/* ============================================================
   4️⃣ UPDATE
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
      countryId,
      regionId,
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
      if (stockNum === null && stock !== '')
        return res.status(400).json({ error: 'Stock invalide' });
      prod.stock = stockNum ?? prod.stock;
    }

    if (description !== undefined) prod.description = toTrimOrNull(description);
    if (shortDescription !== undefined)
      prod.shortDescription = toTrimOrNull(shortDescription);

    if (typeof isActive !== 'undefined')
      prod.isActive = String(isActive) === 'true' || isActive === true;

    if (countryId !== undefined || req.body?.country_id !== undefined)
      prod.countryId = toSafeInt(countryId ?? req.body?.country_id);

    if (regionId !== undefined || req.body?.region_id !== undefined)
      prod.regionId = toSafeInt(regionId ?? req.body?.region_id);

    const { coverImage, gallery, hasNewImages } =
      await extractImagesFromRequestImageKit(req);

    if (hasNewImages) {
      if (Array.isArray(prod.gallery)) {
        for (const img of prod.gallery) {
          if (img?.fileId) {
            try {
              await imageKit.deleteFile(img.fileId);
            } catch (_) {}
          }
        }
      }

      if (coverImage?.url) prod.coverImage = coverImage.url;
      prod.gallery = gallery.map((g) => ({ url: g.url, fileId: g.fileId }));
    }

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
    console.error('❌ update product:', e);
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
          'Produit actif. Pour supprimer, utilisez : DELETE /products/:id?force=true',
      });
    }

    if (Array.isArray(prod.gallery)) {
      for (const img of prod.gallery) {
        if (img?.fileId) {
          try {
            await imageKit.deleteFile(img.fileId);
          } catch (_) {}
        }
      }
    }

    await prod.destroy();

    return res.json({ message: 'Produit supprimé avec succès' });
  } catch (e) {
    console.error('❌ remove product:', e);
    return res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
};
