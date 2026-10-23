export function territoryContact({ country, region } = {}) {
  const belongs = region && country && String(region.countryId ?? region.country_id) === String(country.id);
  const phone = (belongs && region.contactPhone) || country?.contactPhone ||
    (country?.isoCode === 'ML' ? '+223 70453345' : null);
  return { phone: phone || null, countryName: country?.name || null };
}
