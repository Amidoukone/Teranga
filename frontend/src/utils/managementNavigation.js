export function managementNavigation(user) {
  if (user?.role !== 'admin') return [];
  const global = user?.role === 'admin' && !user.countryId && !user.regionId;
  return [
    ['nav.sections.operations', [['/admin/services', 'nav.adminServices'], ['/admin/projects', 'nav.adminProjects'], ['/orders', 'nav.orders'], ['/tasks', 'nav.interventions']]],
    ['nav.sections.network', [['/admin/agents', 'nav.agents'], ['/admin/providers', 'nav.providers'], ['/admin/users', 'nav.users'], ['/admin/properties', 'nav.clientProperties']]],
    ['nav.sections.catalog', [['/admin/trade-categories', 'nav.tradeCategories'], ['/admin/property-listings', 'nav.propertyListings'], ['/admin/catalog/categories', 'nav.categories'], ['/admin/catalog/products', 'nav.products'], ['/shop', 'nav.sections.shop']]],
    ['nav.sections.quality', [...(global ? [['/admin/metrics', 'nav.metrics']] : []), ['/admin/disputes', 'nav.disputes']]],
    ['nav.sections.finance', [['/transactions', 'financialWorkspace.title']]],
    ['nav.sections.configuration', [['/admin/mission-pricing', 'nav.missionPricing'], ...(global ? [['/admin/onboarding', 'nav.master']] : [])]],
  ];
}
