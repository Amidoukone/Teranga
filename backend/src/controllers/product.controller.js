'use strict';

const { Op, col } = require('sequelize');
const { Product, Category } = require('../../models');
const { formatCurrency } = require('../utils/labels');
const imageKit = require('../helpers/teranga-imagekit');
const {
  applyGeoScopeForModel,
  filterGeoAssignmentsForModel,
  getUserGeoScope,
  isGlobalAdmin,
} = require('../utils/geoScope');
const { getPagination } = require('../utils/pagination');
const logger = require('../utils/logger');

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

function buildProductOrder(sort) {
  switch (String(sort || '').toLowerCase()) {
    case 'price_asc':
      return [['price', 'ASC']];
    case 'price_desc':
      return [['price', 'DESC']];
    case 'name_asc':
      return [['name', 'ASC']];
    case 'name_desc':
      return [['name', 'DESC']];
    case 'stock_desc':
      return [['stock', 'DESC']];
    case 'stock_asc':
      return [['stock', 'ASC']];
    case 'created_asc':
      return [[col('Product.created_at'), 'ASC']];
    case 'created_desc':
    default:
      return [[col('Product.created_at'), 'DESC']];
  }
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
  if (!isImageKitEnabled()) return null;

  try {
    const uploaded = await imageKit.upload({
      file: file.buffer,
      fileName: file.originalname,
      folder: '/teranga/products',
    });

    return { url: uploaded.url, fileId: uploaded.fileId };
  } catch (err) {
    logger.error(`Erreur upload ImageKit (${file?.originalname || 'file'}):`, err);
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
   🏷️ withLabels — version FIABLE (compat frontend)
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

  const rawUrls = [];
  if (coverUrl) rawUrls.push(coverUrl);
  rawUrls.push(...gallery.map((g) => g?.url).filter(Boolean));

  const seen = new Set();
  const allImageUrls = rawUrls.filter((u) => {
    if (!u || seen.has(u)) return false;
    seen.add(u);
    return true;
  });

  return {
    ...p,
    imageUrl: coverUrl,
    image: coverUrl,
    imagePath: coverUrl,
    coverImage: cover,
    gallery,
    images: gallery,
    allImageUrls,
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
   🌍 Geo helpers
============================================================ */
function readBodyCountryId(req) {
  return toSafeInt(req.body?.countryId ?? req.body?.country_id);
}

function readBodyRegionId(req) {
  return toSafeInt(req.body?.regionId ?? req.body?.region_id);
}

function buildProductScopeAssignments(req) {
  const scope = getUserGeoScope(req.user);
  const desiredCountryId = readBodyCountryId(req);
  const desiredRegionId = readBodyRegionId(req);

  const finalCountryId = isGlobalAdmin(req.user) ? desiredCountryId : scope.countryId;
  const finalRegionId = isGlobalAdmin(req.user) ? desiredRegionId : scope.regionId;

  const assignments = {
    country_id: finalCountryId ?? null,
    region_id: finalRegionId ?? null,
    countryId: finalCountryId ?? null,
    regionId: finalRegionId ?? null,
  };

  return filterGeoAssignmentsForModel(Product, assignments);
}

function canWriteGeoField(fieldName) {
  return Boolean(Product.rawAttributes?.[fieldName]);
}

function buildScopedSlug(baseSlug, scopeAssignments) {
  const cleanBase = baseSlug || `p-${Date.now()}`;
  const countryId = scopeAssignments?.countryId ?? scopeAssignments?.country_id ?? null;
  const regionId = scopeAssignments?.regionId ?? scopeAssignments?.region_id ?? null;

  if (!countryId && !regionId) return cleanBase;

  const parts = [];
  if (countryId) parts.push(`c${countryId}`);
  if (regionId) parts.push(`r${regionId}`);

  return `${cleanBase}-${parts.join("-")}`;
}

async function ensureUniqueSlug(slug, excludeId = null) {
  let finalSlug = slug;
  let i = 1;

  while (
    await Product.findOne({
      where: excludeId
        ? { slug: finalSlug, id: { [Op.ne]: excludeId } }
        : { slug: finalSlug },
    })
  ) {
    finalSlug = `${slug}-${i++}`;
  }

  return finalSlug;
}

/* ============================================================
   1️⃣ CREATE
============================================================ */
exports.create = async (req, res) => {
  try {
    if (!canWriteProduct(req.user)) {
      return res.status(403).json({ error: 'Accès interdit' });
    }

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

    if (!name) {
      return res.status(400).json({ error: 'Nom du produit requis' });
    }

    const cid = toSafeInt(categoryId);
    const category = cid ? await Category.findByPk(cid) : null;

    const priceNum = toNullableNumber(price);
    if (price !== undefined && priceNum === null) {
      return res.status(400).json({ error: 'Le prix doit être un nombre.' });
    }

    const stockNum = toSafeInt(stock);
    if (stock !== undefined && stockNum === null && stock !== '') {
      return res.status(400).json({ error: 'Stock invalide' });
    }

    const { coverImage, gallery } = await extractImagesFromRequestImageKit(req);

    const scopeAssignments = buildProductScopeAssignments(req);
    const baseSlug = slugify(name);
    const scopedSlug = buildScopedSlug(baseSlug, scopeAssignments);
    const finalSlug = await ensureUniqueSlug(scopedSlug);

    const prod = await Product.create({
      categoryId: category?.id ?? null,
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
      ...scopeAssignments,
    });

    const created = await Product.findOne({
      where: applyGeoScopeForModel({ id: prod.id }, req.user, Product),
      include: [{ model: Category, as: 'category' }],
    });

    return res.status(201).json({
      message: 'Produit créé avec succès',
      product: withLabels(created),
    });
  } catch (e) {
    logger.error('create product:', e);
    return res.status(500).json({ error: e.message || 'Erreur serveur' });
  }
};

/* ============================================================
   2️⃣ LIST
============================================================ */
exports.list = async (req, res) => {
  try {
    if (!canReadProduct(req.user)) {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const q = toTrimOrNull(req.query?.q);
    const categoryId = toSafeInt(req.query?.categoryId);
    const countryId = toSafeInt(req.query?.countryId ?? req.query?.country_id);
    const regionId = toSafeInt(req.query?.regionId ?? req.query?.region_id);
    const active = req.query?.isActive;
    const priceMin = toNullableNumber(req.query?.priceMin);
    const priceMax = toNullableNumber(req.query?.priceMax);
    const sort = toTrimOrNull(req.query?.sort);
    const { limit, offset, page } = getPagination(req);

    let where = {};

    if (q) {
      where[Op.or] = [
        { name: { [Op.like]: `%${q}%` } },
        { sku: { [Op.like]: `%${q}%` } },
        { description: { [Op.like]: `%${q}%` } },
      ];
    }

    if (categoryId) where.categoryId = categoryId;
    if (typeof active !== 'undefined') where.isActive = String(active) === 'true';
    if (priceMin !== null || priceMax !== null) {
      where.price = {};
      if (priceMin !== null) where.price[Op.gte] = priceMin;
      if (priceMax !== null) where.price[Op.lte] = priceMax;
    }

    // 🌍 scope (safe selon modèle)
    where = applyGeoScopeForModel(where, req.user, Product, {
      includeClients: true,
    });

    // Optional geo filters from query (useful for global admin management UI).
    // These constraints are additive and do not bypass existing ACL scope.
    if (countryId) where.countryId = countryId;
    if (regionId) where.regionId = regionId;

    const { rows, count } = await Product.findAndCountAll({
      where,
      include: [{ model: Category, as: 'category' }],

      // ✅ FIX DÉFINITIF : la colonne MySQL réelle (underscored)
      order: buildProductOrder(sort),

      limit,
      offset,
      distinct: true,
    });

    return res.json({
      products: rows.map(withLabels),
      pagination: { page, limit, offset, total: count, count },
    });
  } catch (e) {
    logger.error('list products:', e);
    return res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
};

/* ============================================================
   3️⃣ DETAIL
============================================================ */
exports.detail = async (req, res) => {
  try {
    if (!canReadProduct(req.user)) {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const id = toSafeInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalide' });

    const prod = await Product.findOne({
      where: applyGeoScopeForModel({ id }, req.user, Product, {
        includeClients: true,
      }),
      include: [{ model: Category, as: 'category' }],
    });

    if (!prod) return res.status(404).json({ error: 'Produit introuvable' });

    return res.json({ product: withLabels(prod) });
  } catch (e) {
    logger.error('detail product:', e);
    return res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
};

/* ============================================================
   4️⃣ UPDATE
============================================================ */
exports.update = async (req, res) => {
  try {
    if (!canWriteProduct(req.user)) {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const id = toSafeInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalide' });

    const prod = await Product.findOne({
      where: applyGeoScopeForModel({ id }, req.user, Product),
    });

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
      prod.categoryId = toSafeInt(categoryId) || null;
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
      if (priceNum === null) return res.status(400).json({ error: 'Prix invalide' });
      prod.price = priceNum;
    }

    if (currency !== undefined) {
      prod.currency = String(currency).toUpperCase().trim();
    }

    if (stock !== undefined) {
      const stockNum = toSafeInt(stock);
      if (stockNum === null && stock !== '') {
        return res.status(400).json({ error: 'Stock invalide' });
      }
      prod.stock = stockNum ?? prod.stock;
    }

    if (description !== undefined) prod.description = toTrimOrNull(description);
    if (shortDescription !== undefined) prod.shortDescription = toTrimOrNull(shortDescription);

    if (typeof isActive !== 'undefined') {
      prod.isActive = String(isActive) === 'true' || isActive === true;
    }

    /* ---------------------------
       🌍 scope update
    --------------------------- */
    const scopeAssignments = buildProductScopeAssignments(req);

    if (isGlobalAdmin(req.user)) {
      const wantsCountry =
        req.body?.countryId !== undefined || req.body?.country_id !== undefined;
      const wantsRegion =
        req.body?.regionId !== undefined || req.body?.region_id !== undefined;

      if (wantsCountry) {
        if (canWriteGeoField('country_id')) prod.country_id = scopeAssignments.country_id;
        if (canWriteGeoField('countryId')) prod.countryId = scopeAssignments.countryId;
      }
      if (wantsRegion) {
        if (canWriteGeoField('region_id')) prod.region_id = scopeAssignments.region_id;
        if (canWriteGeoField('regionId')) prod.regionId = scopeAssignments.regionId;
      }
    } else {
      // admin scoped => impose
      if (canWriteGeoField('country_id')) prod.country_id = scopeAssignments.country_id;
      if (canWriteGeoField('countryId')) prod.countryId = scopeAssignments.countryId;
      if (canWriteGeoField('region_id')) prod.region_id = scopeAssignments.region_id;
      if (canWriteGeoField('regionId')) prod.regionId = scopeAssignments.regionId;
    }

    /* ---------------------------
       🖼 Images update (ImageKit)
       - si de nouvelles images arrivent : suppression anciennes + remplacement
    --------------------------- */
    const { coverImage, gallery, hasNewImages } =
      await extractImagesFromRequestImageKit(req);

    if (hasNewImages) {
      // delete previous files (best effort)
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

    /* ---------------------------
       🔁 Slug regeneration
    --------------------------- */
    if (regenerateSlug && prod.name) {
      const baseSlug = slugify(prod.name);
      const scopedSlug = buildScopedSlug(baseSlug, {
        countryId: prod.countryId ?? prod.country_id,
        regionId: prod.regionId ?? prod.region_id,
      });
      prod.slug = await ensureUniqueSlug(scopedSlug, prod.id);
    }

    await prod.save();

    const updated = await Product.findOne({
      where: applyGeoScopeForModel({ id: prod.id }, req.user, Product),
      include: [{ model: Category, as: 'category' }],
    });

    return res.json({
      message: 'Produit mis à jour avec succès',
      product: withLabels(updated),
    });
  } catch (e) {
    logger.error('update product:', e);
    return res.status(500).json({ error: e.message || 'Erreur serveur' });
  }
};

/* ============================================================
   5️⃣ DELETE
============================================================ */
exports.remove = async (req, res) => {
  try {
    if (!canWriteProduct(req.user)) {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const id = toSafeInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalide' });

    const force = String(req.query?.force || '').toLowerCase() === 'true';

    const prod = await Product.findOne({
      where: applyGeoScopeForModel({ id }, req.user, Product),
    });

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
    logger.error('remove product:', e);
    return res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
};
