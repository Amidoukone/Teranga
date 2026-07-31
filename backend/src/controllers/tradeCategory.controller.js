'use strict';

const { TradeCategory, Provider, Service, MissionPricingRule, CategoryManagerTradeCategory } = require('../../models');
const logger = require('../utils/logger');

function toTrimOrNull(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function toSafeInt(v, fallback = null) {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

function slugify(input) {
  if (!input) return null;
  return String(input)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* ============================================================
   LIST — filières actives (docs/DEV_SPEC_TERANGA_v3.md section 3.3, public)
   Utilisé par le sélecteur de filière du wizard mission / du formulaire
   prestataire : jamais d'auth requise, jamais les filières inactives.
============================================================ */
exports.list = async (_req, res) => {
  try {
    const tradeCategories = await TradeCategory.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']],
    });

    return res.json({ tradeCategories });
  } catch (e) {
    logger.error({ err: e }, 'tradeCategory.list.failed');
    return res.status(500).json({ error: 'Erreur lors de la récupération des filières' });
  }
};

/* ============================================================
   LIST (admin) — toutes les filières, actives ET inactives, pour la page
   de gestion (super admin OU master : la filière est une taxonomie
   métier, pas une ressource scopée par pays/région).
============================================================ */
exports.listForAdmin = async (req, res) => {
  try {
    const tradeCategories = await TradeCategory.findAll({
      order: [['name', 'ASC']],
    });

    return res.json({ tradeCategories });
  } catch (e) {
    logger.error({ err: e }, 'tradeCategory.list_for_admin.failed');
    return res.status(500).json({ error: 'Erreur lors de la récupération des filières' });
  }
};

/* ============================================================
   CREATE (admin ou master) — super admin ET master peuvent créer une
   filière : contrairement aux régions/catégories commerce, la filière
   n'est pas une ressource scopée géographiquement, elle sert avant tout
   au master qui onboarde des prestataires localement.
============================================================ */
exports.create = async (req, res) => {
  try {
    const { name, slug, requiresCompany, defaultWarrantyDays, isActive } = req.body || {};

    const cleanName = toTrimOrNull(name);
    if (!cleanName) {
      return res.status(400).json({ error: 'Le nom de la filière est requis' });
    }

    const finalSlug = toTrimOrNull(slug) || slugify(cleanName);
    if (!finalSlug) {
      return res.status(400).json({ error: 'Slug invalide' });
    }

    const existing = await TradeCategory.findOne({ where: { slug: finalSlug } });
    if (existing) {
      return res.status(409).json({ error: 'Une filière avec ce slug existe déjà' });
    }

    const warrantyDays = toSafeInt(defaultWarrantyDays, 0);

    const tradeCategory = await TradeCategory.create({
      name: cleanName,
      slug: finalSlug,
      requiresCompany: Boolean(requiresCompany),
      defaultWarrantyDays: warrantyDays != null && warrantyDays >= 0 ? warrantyDays : 0,
      isActive: isActive === undefined ? true : Boolean(isActive),
    });

    return res.status(201).json({ tradeCategory });
  } catch (e) {
    logger.error({ err: e }, 'tradeCategory.create.failed');
    return res.status(500).json({ error: 'Erreur lors de la création de la filière' });
  }
};

/* ============================================================
   UPDATE (admin ou master)
============================================================ */
exports.update = async (req, res) => {
  try {
    const id = toSafeInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalide' });

    const tradeCategory = await TradeCategory.findByPk(id);
    if (!tradeCategory) return res.status(404).json({ error: 'Filière introuvable' });

    const { name, slug, requiresCompany, defaultWarrantyDays, isActive } = req.body || {};

    if (name !== undefined) {
      const cleanName = toTrimOrNull(name);
      if (!cleanName) return res.status(400).json({ error: 'Le nom de la filière est requis' });
      tradeCategory.name = cleanName;
    }

    if (slug !== undefined) {
      const cleanSlug = toTrimOrNull(slug) || slugify(tradeCategory.name);
      if (!cleanSlug) return res.status(400).json({ error: 'Slug invalide' });
      if (cleanSlug !== tradeCategory.slug) {
        const existing = await TradeCategory.findOne({ where: { slug: cleanSlug } });
        if (existing && existing.id !== tradeCategory.id) {
          return res.status(409).json({ error: 'Une filière avec ce slug existe déjà' });
        }
      }
      tradeCategory.slug = cleanSlug;
    }

    if (requiresCompany !== undefined) {
      tradeCategory.requiresCompany = Boolean(requiresCompany);
    }

    if (defaultWarrantyDays !== undefined) {
      const warrantyDays = toSafeInt(defaultWarrantyDays, 0);
      tradeCategory.defaultWarrantyDays = warrantyDays != null && warrantyDays >= 0 ? warrantyDays : 0;
    }

    if (isActive !== undefined) {
      tradeCategory.isActive = Boolean(isActive);
    }

    await tradeCategory.save();

    return res.json({ tradeCategory });
  } catch (e) {
    logger.error({ err: e }, 'tradeCategory.update.failed');
    return res.status(500).json({ error: 'Erreur lors de la mise à jour de la filière' });
  }
};

/* ============================================================
   DELETE (admin ou master) — refusée si la filière est déjà utilisée
   (prestataires, missions, règles de tarification, category managers) :
   dans ce cas on désactive (isActive=false) via PUT plutôt que de casser
   des données existantes.
============================================================ */
exports.remove = async (req, res) => {
  try {
    const id = toSafeInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalide' });

    const tradeCategory = await TradeCategory.findByPk(id);
    if (!tradeCategory) return res.status(404).json({ error: 'Filière introuvable' });

    const [providerCount, serviceCount, pricingRuleCount, categoryManagerCount] = await Promise.all([
      Provider.count({ include: [{ model: TradeCategory, as: 'tradeCategories', where: { id }, required: true, attributes: [] }] }),
      Service.count({ where: { tradeCategoryId: id } }),
      MissionPricingRule.count({ where: { tradeCategoryId: id } }),
      CategoryManagerTradeCategory.count({ where: { tradeCategoryId: id } }),
    ]);

    if (providerCount || serviceCount || pricingRuleCount || categoryManagerCount) {
      return res.status(409).json({
        error:
          'Cette filière est déjà utilisée (prestataires, missions, règles de tarification ou category managers) : désactivez-la plutôt que de la supprimer',
      });
    }

    await tradeCategory.destroy();

    return res.json({ success: true });
  } catch (e) {
    logger.error({ err: e }, 'tradeCategory.remove.failed');
    return res.status(500).json({ error: 'Erreur lors de la suppression de la filière' });
  }
};
