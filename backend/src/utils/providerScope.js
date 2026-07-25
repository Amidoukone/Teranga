'use strict';

/**
 * Autorisation "peut gérer ce prestataire" pour les endpoints Teranga Pro
 * (docs/DEV_SPEC_TERANGA_v3.md section 3.3 : PATCH /providers/:id/status,
 * POST /providers/:id/contracts — rôles category_manager, country_admin).
 *
 * Décision de scope category_manager (section 0.6.c, différée au Lot 3) :
 * - Filière : le category_manager doit couvrir au moins une des filières du
 *   prestataire (table category_manager_trade_categories).
 * - Géo : réutilise users.countryId/regionId (mécanisme admin existant) — un
 *   category_manager sans scope géo est considéré national pour sa/ses
 *   filière(s) (le modèle métier le décrit comme responsable d'une filière
 *   avant d'être responsable d'un territoire ; un scope géo, s'il est
 *   renseigné, restreint en plus par pays).
 *
 * "country_admin" n'est pas un rôle technique séparé : c'est un admin avec
 * scope (countryId/regionId), voir roles.middleware.js.
 */

const db = require('../../models');
const { getCountryIdByIso, isGlobalAdmin, getUserGeoScope } = require('./geoScope');

async function resolveScopedCountryId(user) {
  const { countryId, regionId } = getUserGeoScope(user);
  if (regionId) {
    const region = await db.Region.findByPk(regionId, { attributes: ['countryId'] });
    return region ? region.countryId : null;
  }
  return countryId;
}

async function isProviderInGeoScope(user, provider) {
  const { countryId, regionId } = getUserGeoScope(user);
  if (!countryId && !regionId) return true; // pas de scope géo => pas de restriction pays

  const scopedCountryId = await resolveScopedCountryId(user);
  if (!scopedCountryId) return false;

  const providerCountryId = await getCountryIdByIso(provider.countryCode);
  return providerCountryId != null && Number(scopedCountryId) === Number(providerCountryId);
}

async function canManageProvider(user, provider) {
  if (!user || !provider) return false;

  if (user.role === 'admin') {
    if (isGlobalAdmin(user)) return true;
    return isProviderInGeoScope(user, provider);
  }

  if (user.role === 'category_manager') {
    const managedLinks = await db.CategoryManagerTradeCategory.findAll({
      where: { userId: user.id },
      attributes: ['tradeCategoryId'],
      raw: true,
    });
    if (managedLinks.length === 0) return false;
    const managedCategoryIds = new Set(managedLinks.map((r) => Number(r.tradeCategoryId)));

    const providerLinks = await db.ProviderTradeCategory.findAll({
      where: { providerId: provider.id },
      attributes: ['tradeCategoryId'],
      raw: true,
    });
    const hasOverlap = providerLinks.some((r) => managedCategoryIds.has(Number(r.tradeCategoryId)));
    if (!hasOverlap) return false;

    return isProviderInGeoScope(user, provider);
  }

  return false;
}

/**
 * Filtre de portée pour GET /providers (liste) : traduit le même scope que
 * canManageProvider() en critères Sequelize (countryCodes / tradeCategoryIds)
 * plutôt que de tester ligne par ligne après coup.
 * Retourne { allowAll: true } | { deny: true } | { countryCodes?, tradeCategoryIds? }.
 */
async function getManageableProviderFilter(user) {
  if (!user) return { deny: true };

  if (user.role === 'admin') {
    if (isGlobalAdmin(user)) return { allowAll: true };

    const scopedCountryId = await resolveScopedCountryId(user);
    if (!scopedCountryId) return { deny: true };

    const country = await db.Country.findByPk(scopedCountryId, { attributes: ['isoCode'] });
    if (!country) return { deny: true };

    return { countryCodes: [country.isoCode] };
  }

  if (user.role === 'category_manager') {
    const managedLinks = await db.CategoryManagerTradeCategory.findAll({
      where: { userId: user.id },
      attributes: ['tradeCategoryId'],
      raw: true,
    });
    const tradeCategoryIds = managedLinks.map((r) => r.tradeCategoryId);
    if (tradeCategoryIds.length === 0) return { deny: true };

    const { countryId, regionId } = getUserGeoScope(user);
    if (!countryId && !regionId) return { tradeCategoryIds };

    const scopedCountryId = await resolveScopedCountryId(user);
    if (!scopedCountryId) return { deny: true };

    const country = await db.Country.findByPk(scopedCountryId, { attributes: ['isoCode'] });
    if (!country) return { deny: true };

    return { tradeCategoryIds, countryCodes: [country.isoCode] };
  }

  return { deny: true };
}

module.exports = { canManageProvider, getManageableProviderFilter };
