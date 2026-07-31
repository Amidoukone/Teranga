'use strict';

const { Op } = require('sequelize');
const {
  TradeCategory,
  Provider,
  Service,
  MissionPricingRule,
  CategoryManagerTradeCategory,
  Country,
  Region,
} = require('../../models');
const { getUserGeoScope, isGlobalAdmin, canAccessGeoResource } = require('../utils/geoScope');
const logger = require('../utils/logger');

function toTrimOrNull(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function toSafeInt(v, fallback = null) {
  if (v === undefined || v === null || v === '') return fallback;
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

const GEO_INCLUDE = [
  { model: Country, as: 'country', attributes: ['id', 'name', 'isoCode'] },
  { model: Region, as: 'region', attributes: ['id', 'name'] },
];

/**
 * Filière globale (countryId NULL) OU couvrant le pays/région passé — même hiérarchie à 3
 * niveaux que MissionPricingRule (région précise > pays entier > global), voir
 * priceEstimate.service.js findBestRule(). countryId/regionId ici décrivent le PÉRIMÈTRE DU
 * VISIONNEUR (compte du client, ou scope du master pour la page de gestion), pas la
 * destination de la mission (inconnue à ce stade du wizard, filière choisie avant l'adresse).
 */
function buildScopeOr({ countryId, regionId }) {
  const scopeOr = [{ countryId: null }];
  if (regionId) {
    scopeOr.push({ regionId });
    if (countryId) scopeOr.push({ countryId, regionId: null });
  } else if (countryId) {
    scopeOr.push({ countryId });
  }
  return scopeOr;
}

/* ============================================================
   LIST — filières actives (docs/DEV_SPEC_TERANGA_v3.md section 3.3, public)
   Utilisé par le sélecteur de filière du wizard mission / du formulaire
   invité : pas d'auth requise. countryId/regionId optionnels (scope du compte
   client s'il est connecté, sinon omis => uniquement les filières globales,
   comportement historique inchangé pour un visiteur anonyme).
============================================================ */
exports.list = async (req, res) => {
  try {
    const countryId = toSafeInt(req.query?.countryId);
    const regionId = toSafeInt(req.query?.regionId);

    const tradeCategories = await TradeCategory.findAll({
      where: { isActive: true, [Op.or]: buildScopeOr({ countryId, regionId }) },
      order: [['name', 'ASC']],
    });

    return res.json({ tradeCategories });
  } catch (e) {
    logger.error({ err: e }, 'tradeCategory.list.failed');
    return res.status(500).json({ error: 'Erreur lors de la récupération des filières' });
  }
};

/* ============================================================
   LIST (admin) — filières actives ET inactives, pour la page de gestion.
   Admin global : tout. Master (admin scopé) : les filières globales (lecture
   seule côté écriture) + celles de son propre périmètre pays/région.
============================================================ */
exports.listForAdmin = async (req, res) => {
  try {
    let where = {};
    if (!isGlobalAdmin(req.user)) {
      where = { [Op.or]: buildScopeOr(getUserGeoScope(req.user)) };
    }

    const tradeCategories = await TradeCategory.findAll({
      where,
      include: GEO_INCLUDE,
      order: [['name', 'ASC']],
    });

    return res.json({ tradeCategories });
  } catch (e) {
    logger.error({ err: e }, 'tradeCategory.list_for_admin.failed');
    return res.status(500).json({ error: 'Erreur lors de la récupération des filières' });
  }
};

/* ============================================================
   CREATE — super admin OU master. Un master (admin scopé) hérite TOUJOURS de
   son propre périmètre (countryId/regionId du payload ignorés, même pattern
   que user.controller.js createAgent / missionPricingRule.controller.js
   resolveWriteScope) : il ne peut pas créer une filière hors de son
   territoire. Seul l'admin global peut choisir un périmètre arbitraire ou
   laisser vide pour une filière globale.
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

    let countryId = null;
    let regionId = null;

    if (isGlobalAdmin(req.user)) {
      const requestedCountryId = toSafeInt(req.body?.countryId ?? req.body?.country_id);
      const requestedRegionId = toSafeInt(req.body?.regionId ?? req.body?.region_id);

      if (requestedRegionId) {
        const region = await Region.findByPk(requestedRegionId);
        if (!region) return res.status(400).json({ error: 'Région introuvable' });
        if (requestedCountryId && String(region.countryId) !== String(requestedCountryId)) {
          return res.status(400).json({ error: 'La région ne correspond pas au pays fourni' });
        }
        regionId = region.id;
        countryId = region.countryId;
      } else if (requestedCountryId) {
        const country = await Country.findByPk(requestedCountryId);
        if (!country) return res.status(400).json({ error: 'Pays introuvable' });
        countryId = country.id;
      }
    } else {
      const scope = getUserGeoScope(req.user);
      countryId = scope.countryId;
      regionId = scope.regionId;
    }

    const warrantyDays = toSafeInt(defaultWarrantyDays, 0);

    const tradeCategory = await TradeCategory.create({
      name: cleanName,
      slug: finalSlug,
      requiresCompany: Boolean(requiresCompany),
      defaultWarrantyDays: warrantyDays != null && warrantyDays >= 0 ? warrantyDays : 0,
      isActive: isActive === undefined ? true : Boolean(isActive),
      countryId,
      regionId,
    });

    const withGeo = await TradeCategory.findByPk(tradeCategory.id, { include: GEO_INCLUDE });

    return res.status(201).json({ tradeCategory: withGeo || tradeCategory });
  } catch (e) {
    logger.error({ err: e }, 'tradeCategory.create.failed');
    return res.status(500).json({ error: 'Erreur lors de la création de la filière' });
  }
};

/* ============================================================
   UPDATE — super admin (tout) OU master (uniquement les filières de son
   propre périmètre, jamais les globales ni celles d'un autre périmètre ;
   ne peut jamais déplacer une filière vers un autre pays/région).
============================================================ */
exports.update = async (req, res) => {
  try {
    const id = toSafeInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalide' });

    const tradeCategory = await TradeCategory.findByPk(id);
    if (!tradeCategory) return res.status(404).json({ error: 'Filière introuvable' });

    const globalAdmin = isGlobalAdmin(req.user);
    if (!globalAdmin) {
      if (!canAccessGeoResource(tradeCategory, req.user)) {
        return res.status(403).json({ error: 'Filière hors de votre périmètre géographique' });
      }
      if (req.body?.countryId !== undefined || req.body?.regionId !== undefined) {
        return res.status(400).json({
          error: 'Le périmètre géographique ne peut être modifié que par un administrateur global',
        });
      }
    } else if (req.body?.countryId !== undefined || req.body?.regionId !== undefined) {
      const requestedCountryId = toSafeInt(req.body?.countryId);
      const requestedRegionId = toSafeInt(req.body?.regionId);

      if (requestedRegionId) {
        const region = await Region.findByPk(requestedRegionId);
        if (!region) return res.status(400).json({ error: 'Région introuvable' });
        tradeCategory.regionId = region.id;
        tradeCategory.countryId = region.countryId;
      } else if (requestedCountryId) {
        const country = await Country.findByPk(requestedCountryId);
        if (!country) return res.status(400).json({ error: 'Pays introuvable' });
        tradeCategory.countryId = country.id;
        tradeCategory.regionId = null;
      } else {
        tradeCategory.countryId = null;
        tradeCategory.regionId = null;
      }
    }

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

    const withGeo = await TradeCategory.findByPk(tradeCategory.id, { include: GEO_INCLUDE });

    return res.json({ tradeCategory: withGeo || tradeCategory });
  } catch (e) {
    logger.error({ err: e }, 'tradeCategory.update.failed');
    return res.status(500).json({ error: 'Erreur lors de la mise à jour de la filière' });
  }
};

/* ============================================================
   DELETE — super admin (tout) OU master (uniquement son propre périmètre).
   Refusée si la filière est déjà utilisée (prestataires, missions, règles de
   tarification, category managers) : désactiver (isActive=false) via PUT
   plutôt que de casser des données existantes.
============================================================ */
exports.remove = async (req, res) => {
  try {
    const id = toSafeInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalide' });

    const tradeCategory = await TradeCategory.findByPk(id);
    if (!tradeCategory) return res.status(404).json({ error: 'Filière introuvable' });

    if (!isGlobalAdmin(req.user) && !canAccessGeoResource(tradeCategory, req.user)) {
      return res.status(403).json({ error: 'Filière hors de votre périmètre géographique' });
    }

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
