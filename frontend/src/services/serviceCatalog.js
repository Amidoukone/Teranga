import api from "./api";

export async function getLocalServiceCatalog({ countryId, regionId } = {}) {
  const params = { countryId };
  if (regionId) params.regionId = regionId;
  const { data } = await api.get("/v1/service-catalog", { params, skipAuthHeader: true });
  return data;
}

export function filterLocalServiceChoices(tradeCategories, catalogResponse) {
  if (!catalogResponse?.configured) {
    return { tradeCategories, classicTypes: undefined };
  }
  const catalog = catalogResponse.catalog || [];
  const tradeIds = new Set(catalog.map((item) => String(item.definition?.legacyTradeCategoryId || "")));
  const classicTypes = new Set(catalog.map((item) => item.definition?.legacyServiceType).filter(Boolean));
  return {
    tradeCategories: tradeCategories.filter((item) => tradeIds.has(String(item.id))),
    classicTypes: [...classicTypes],
  };
}
