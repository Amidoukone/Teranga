'use strict';

// Tarification configurable (docs/DEV_SPEC_TERANGA_v3.md section 4.1). Autorisation :
// réutilisation intégrale de backend/src/utils/geoScope.js (même mécanisme que
// providerScope.js au Lot 3) — aucun nouveau système de permission (section 8 du spec).
// "super_admin" n'est pas un rôle DB distinct : c'est un admin sans scope pays/région
// (isGlobalAdmin). Un "master"/country_admin est un admin avec countryId (+ éventuellement
// regionId) renseigné.

const { MissionPricingRule, Country, Region, TradeCategory } = require('../../models');
const {
  isGlobalAdmin,
  getUserGeoScope,
  applyGeoScopeForModel,
  canAccessGeoResource,
} = require('../utils/geoScope');
const logger = require('../utils/logger');

const INCLUDE = [
  { model: Country, as: 'country', attributes: ['id', 'name', 'isoCode', 'currency'] },
  { model: Region, as: 'region', attributes: ['id', 'name'] },
  { model: TradeCategory, as: 'tradeCategory', attributes: ['id', 'name', 'slug'] },
];

function resolveWriteScope(user, payload) {
  if (isGlobalAdmin(user)) {
    return { countryId: payload.countryId, regionId: payload.regionId ?? null };
  }

  const { countryId, regionId } = getUserGeoScope(user);
  if (!countryId) {
    const err = new Error('Aucun scope pays défini pour cet administrateur');
    err.status = 403;
    throw err;
  }

  // Admin scopé région : ne peut agir que sur sa région exacte (cohérent avec
  // canAccessGeoResource utilisé côté lecture/modification).
  if (regionId) return { countryId, regionId };

  // Admin scopé pays : peut créer une règle pays par défaut ou une surcharge région,
  // tant que c'est dans son propre pays.
  return { countryId, regionId: payload.regionId ?? null };
}

exports.list = async (req, res) => {
  try {
    const where = applyGeoScopeForModel({}, req.user, MissionPricingRule);
    if (where.id === 0) {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const rules = await MissionPricingRule.findAll({
      where,
      include: INCLUDE,
      order: [['countryId', 'ASC'], ['regionId', 'ASC'], ['createdAt', 'DESC']],
    });

    return res.status(200).json({ pricingRules: rules });
  } catch (e) {
    logger.error({ err: e }, 'missionPricingRule.list.failed');
    return res.status(500).json({ error: 'Erreur lors de la récupération des tarifs' });
  }
};

exports.create = async (req, res) => {
  try {
    const scope = resolveWriteScope(req.user, req.body);

    const rule = await MissionPricingRule.create({
      ...req.body,
      countryId: scope.countryId,
      regionId: scope.regionId,
      updatedByUserId: req.user.id,
    });

    const full = await MissionPricingRule.findByPk(rule.id, { include: INCLUDE });
    return res.status(201).json({ message: 'Règle de tarification créée', pricingRule: full });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    if (e.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Une règle existe déjà pour ce périmètre exact' });
    }
    logger.error({ err: e }, 'missionPricingRule.create.failed');
    return res.status(500).json({ error: 'Erreur lors de la création de la règle de tarification' });
  }
};

exports.update = async (req, res) => {
  try {
    const rule = await MissionPricingRule.findByPk(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Règle introuvable' });

    if (!canAccessGeoResource(rule, req.user)) {
      return res.status(403).json({ error: 'Accès interdit pour cette règle' });
    }

    Object.assign(rule, req.body, { updatedByUserId: req.user.id });
    await rule.save();

    const full = await MissionPricingRule.findByPk(rule.id, { include: INCLUDE });
    return res.status(200).json({ pricingRule: full });
  } catch (e) {
    logger.error({ err: e }, 'missionPricingRule.update.failed');
    return res.status(500).json({ error: 'Erreur lors de la mise à jour de la règle' });
  }
};

exports.remove = async (req, res) => {
  try {
    const rule = await MissionPricingRule.findByPk(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Règle introuvable' });

    if (!canAccessGeoResource(rule, req.user)) {
      return res.status(403).json({ error: 'Accès interdit pour cette règle' });
    }

    // Désactivation plutôt que suppression physique — garde l'historique/audit.
    rule.isActive = false;
    rule.updatedByUserId = req.user.id;
    await rule.save();

    return res.status(200).json({ message: 'Règle désactivée' });
  } catch (e) {
    logger.error({ err: e }, 'missionPricingRule.remove.failed');
    return res.status(500).json({ error: 'Erreur lors de la désactivation de la règle' });
  }
};
