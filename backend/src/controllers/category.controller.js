// backend/src/controllers/category.controller.js
'use strict';

const { Op } = require('sequelize');
const { Category, Product } = require('../../models');
const {
  CATEGORY_STATUSES,
  getLabel,
} = require('../utils/labels');

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

function getPagination(req, defLimit = 50, maxLimit = 200) {
  const rawLimit = parseInt(req.query?.limit, 10);
  const rawPage = parseInt(req.query?.page, 10);

  const limit = Math.min(Math.max(rawLimit || defLimit, 1), maxLimit);
  const page = Math.max(rawPage || 1, 1);
  const offset = (page - 1) * limit;

  return { limit, offset, page };
}

function slugify(input) {
  if (!input) return null;
  return String(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')      // non alphanum -> -
    .replace(/^-+|-+$/g, '');         // trim -
}

/**
 * Ajoute les labels à une catégorie
 */
function withLabels(cat) {
  if (!cat) return null;
  const c = cat.toJSON ? cat.toJSON() : cat;

  return {
    ...c,
    statusLabel: getLabel(c.status, CATEGORY_STATUSES),
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
  // Ici tu peux décider d'ouvrir la lecture publique si tu veux :
  // return !role || ['admin', 'agent', 'client'].includes(role);
  return ['admin', 'agent', 'client'].includes(role);
}

function canWriteCategory(req) {
  const role = getUserRole(req);
  return role === 'admin';
}

/* ============================================================
   1️⃣ CREATE — tolérante (slug auto si absent)
============================================================ */
exports.create = async (req, res) => {
  try {
    if (!canWriteCategory(req)) {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const { name, slug, description, status = 'active' } = req.body || {};

    // name requis (clé UX/DB)
    const cleanName = toTrimOrNull(name);
    if (!cleanName) {
      return res.status(400).json({ error: 'Le nom de la catégorie est requis' });
    }

    // slug : autoriser vide -> slugify(name)
    let finalSlug = toTrimOrNull(slug) || slugify(cleanName);
    if (!finalSlug) {
      return res.status(400).json({ error: 'Slug invalide' });
    }

    // Vérifier collision slug
    const existing = await Category.findOne({ where: { slug: finalSlug } });
    if (existing) {
      return res.status(400).json({ error: 'Une catégorie avec ce slug existe déjà' });
    }

    const cat = await Category.create({
      name: cleanName,
      slug: finalSlug,
      description: toTrimOrNull(description),
      status: toTrimOrNull(status) || 'active',
    });

    res.status(201).json({ category: withLabels(cat) });
  } catch (e) {
    console.error('❌ [Category] create:', e);
    res.status(500).json({ error: 'Erreur lors de la création de la catégorie' });
  }
};

/* ============================================================
   2️⃣ LIST — recherche + pagination
============================================================ */
exports.list = async (req, res) => {
  try {
    if (!canReadCategory(req)) {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const q = toTrimOrNull(req.query?.q);
    const status = toTrimOrNull(req.query?.status);
    const { limit, offset, page } = getPagination(req);

    const where = {};

    if (q) {
      where[Op.or] = [
        { name: { [Op.like]: `%${q}%` } },
        { slug: { [Op.like]: `%${q}%` } },
        { description: { [Op.like]: `%${q}%` } },
      ];
    }

    if (status) {
      where.status = status;
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
      pagination: { page, limit, total: count },
    });
  } catch (e) {
    console.error('❌ [Category] list:', e);
    res.status(500).json({ error: 'Erreur lors de la récupération des catégories' });
  }
};

/* ============================================================
   3️⃣ DETAIL — avec premiers produits liés (aperçu)
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

    const cat = await Category.findByPk(id, {
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
    console.error('❌ [Category] detail:', e);
    res.status(500).json({ error: 'Erreur lors de la récupération de la catégorie' });
  }
};

/* ============================================================
   4️⃣ UPDATE — slug auto si fourni vide
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

    const cat = await Category.findByPk(id);
    if (!cat) {
      return res.status(404).json({ error: 'Catégorie introuvable' });
    }

    const { name, slug, description, status } = req.body || {};

    // name
    if (name !== undefined) {
      const cleanName = toTrimOrNull(name);
      if (!cleanName) {
        return res.status(400).json({ error: 'Le nom de la catégorie ne peut pas être vide' });
      }
      cat.name = cleanName;
    }

    // slug
    if (slug !== undefined || name !== undefined) {
      const fromBodySlug = toTrimOrNull(slug);
      const baseForSlug = fromBodySlug || (name ? toTrimOrNull(name) : null) || cat.name;
      const newSlug = slugify(baseForSlug);

      if (!newSlug) {
        return res.status(400).json({ error: 'Slug invalide' });
      }

      // Vérifier collision slug (autre enregistrement)
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

    // description
    if (description !== undefined) {
      cat.description = toTrimOrNull(description);
    }

    // status
    if (status !== undefined) {
      const cleanStatus = toTrimOrNull(status);
      if (!cleanStatus) {
        return res.status(400).json({ error: 'Statut invalide' });
      }
      cat.status = cleanStatus;
    }

    await cat.save();
    res.json({ category: withLabels(cat) });
  } catch (e) {
    console.error('❌ [Category] update:', e);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la catégorie' });
  }
};

/* ============================================================
   5️⃣ DELETE — empêche suppression si produits associés
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

    const cat = await Category.findByPk(id, {
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
    console.error('❌ [Category] remove:', e);
    res.status(500).json({ error: 'Erreur lors de la suppression de la catégorie' });
  }
};
