'use strict';

const { Op } = require('sequelize');
const { Category, Product } = require('../../models');
const { isGlobalAdmin } = require('../utils/geoScope');
const { CATEGORY_STATUSES, getLabel } = require('../utils/labels');
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

function slugify(input) {
  if (!input) return null;
  return String(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Ajoute les labels à une catégorie
 */
function withLabels(cat) {
  if (!cat) return null;
  const c = cat.toJSON ? cat.toJSON() : cat;
  const statusKey = c.isActive ? 'active' : 'inactive';

  return {
    ...c,
    status: statusKey,
    statusLabel: getLabel(statusKey, CATEGORY_STATUSES),
    categoryStatus: statusKey,
  };
}

/**
 * Récupère le rôle utilisateur de manière sûre
 */
function getUserRole(req) {
  return req?.user?.role || null;
}

/* ============================================================
   🔐 ACL
============================================================ */
function canReadCategory(req) {
  const role = getUserRole(req);
  return ['admin', 'agent', 'client'].includes(role);
}

function canWriteCategory(req) {
  const role = getUserRole(req);
  return role === 'admin' && isGlobalAdmin(req.user);
}

/* ============================================================
   1️⃣ CREATE — idempotent + slug auto + scope
============================================================ */
exports.create = async (req, res) => {
  try {
    if (!canWriteCategory(req)) {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const { name, slug, description, status, isActive } = req.body || {};
    const cleanName = toTrimOrNull(name);

    if (!cleanName) {
      return res.status(400).json({ error: 'Le nom de la catégorie est requis' });
    }

    let finalSlug = toTrimOrNull(slug) || slugify(cleanName);
    if (!finalSlug) {
      return res.status(400).json({ error: 'Slug invalide' });
    }

    // 🔐 Idempotence + scope
    const existing = await Category.findOne({
      where: { slug: finalSlug },
    });

    if (existing) {
      return res.status(200).json({
        category: withLabels(existing),
        existed: true,
      });
    }

    const normalizedStatus = toTrimOrNull(status);
    const activeFlag =
      typeof isActive !== 'undefined'
        ? String(isActive) === 'true' || isActive === true
        : normalizedStatus === 'inactive'
          ? false
          : true;

    const cat = await Category.create({
      name: cleanName,
      slug: finalSlug,
      description: toTrimOrNull(description),
      isActive: activeFlag,
    });

    res.status(201).json({ category: withLabels(cat) });
  } catch (e) {
    logger.error('❌ [Category] create:', e);
    res.status(500).json({ error: 'Erreur lors de la création de la catégorie' });
  }
};

/* ============================================================
   2️⃣ LIST — recherche + pagination + scope
============================================================ */
exports.list = async (req, res) => {
  try {
    if (!canReadCategory(req)) {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const q = toTrimOrNull(req.query?.q);
    const status = toTrimOrNull(req.query?.status);
    const { limit, offset, page } = getPagination(req);

    let where = {};

    if (q) {
      where[Op.or] = [
        { name: { [Op.like]: `%${q}%` } },
        { slug: { [Op.like]: `%${q}%` } },
        { description: { [Op.like]: `%${q}%` } },
      ];
    }

    if (status) {
      if (status === 'active') where.isActive = true;
      if (status === 'inactive') where.isActive = false;
    }

    const { rows, count } = await Category.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    res.json({
      categories: rows.map(withLabels),
      pagination: { page, limit, offset, total: count },
    });
  } catch (e) {
    logger.error('❌ [Category] list:', e);
    res.status(500).json({ error: 'Erreur lors de la récupération des catégories' });
  }
};

/* ============================================================
   3️⃣ DETAIL — avec produits liés + scope
============================================================ */
exports.detail = async (req, res) => {
  try {
    if (!canReadCategory(req)) {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const id = toSafeInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'ID invalide' });
    }

    const cat = await Category.findOne({
      where: { id },
      include: [
        {
          model: Product,
          as: 'products',
          limit: 20,
          separate: true,
          order: [['createdAt', 'DESC']],
        },
      ],
    });

    if (!cat) {
      return res.status(404).json({ error: 'Catégorie introuvable' });
    }

    res.json({ category: withLabels(cat) });
  } catch (e) {
    logger.error('❌ [Category] detail:', e);
    res.status(500).json({ error: 'Erreur lors de la récupération de la catégorie' });
  }
};

/* ============================================================
   4️⃣ UPDATE — slug auto + scope
============================================================ */
exports.update = async (req, res) => {
  try {
    if (!canWriteCategory(req)) {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const id = toSafeInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'ID invalide' });
    }

    const cat = await Category.findOne({
      where: { id },
    });

    if (!cat) {
      return res.status(404).json({ error: 'Catégorie introuvable' });
    }

    const { name, slug, description, status, isActive } = req.body || {};

    if (name !== undefined) {
      const cleanName = toTrimOrNull(name);
      if (!cleanName) {
        return res.status(400).json({ error: 'Le nom de la catégorie ne peut pas être vide' });
      }
      cat.name = cleanName;
    }

    if (slug !== undefined || name !== undefined) {
      const baseForSlug =
        toTrimOrNull(slug) ||
        (name ? toTrimOrNull(name) : null) ||
        cat.name;

      const newSlug = slugify(baseForSlug);
      if (!newSlug) {
        return res.status(400).json({ error: 'Slug invalide' });
      }

      const exists = await Category.findOne({
        where: {
          slug: newSlug,
          id: { [Op.ne]: cat.id },
        },
      });

      if (exists) {
        return res.status(400).json({ error: 'Une autre catégorie utilise déjà ce slug' });
      }

      cat.slug = newSlug;
    }

    if (description !== undefined) {
      cat.description = toTrimOrNull(description);
    }

    if (status !== undefined || isActive !== undefined) {
      const cleanStatus = toTrimOrNull(status);
      if (cleanStatus && !['active', 'inactive'].includes(cleanStatus)) {
        return res.status(400).json({ error: 'Statut invalide' });
      }
      if (isActive !== undefined) {
        cat.isActive = String(isActive) === 'true' || isActive === true;
      } else if (cleanStatus) {
        cat.isActive = cleanStatus === 'active';
      }
    }

    await cat.save();
    res.json({ category: withLabels(cat) });
  } catch (e) {
    logger.error('❌ [Category] update:', e);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la catégorie' });
  }
};

/* ============================================================
   5️⃣ DELETE — empêche suppression si produits associés + scope
============================================================ */
exports.remove = async (req, res) => {
  try {
    if (!canWriteCategory(req)) {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const id = toSafeInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'ID invalide' });
    }

    const cat = await Category.findOne({
      where: { id },
      include: [{ model: Product, as: 'products' }],
    });

    if (!cat) {
      return res.status(404).json({ error: 'Catégorie introuvable' });
    }

    if ((cat.products || []).length > 0) {
      return res
        .status(400)
        .json({ error: 'Impossible de supprimer une catégorie avec des produits associés' });
    }

    await cat.destroy();
    res.json({ message: 'Catégorie supprimée' });
  } catch (e) {
    logger.error('❌ [Category] remove:', e);
    res.status(500).json({ error: 'Erreur lors de la suppression de la catégorie' });
  }
};
