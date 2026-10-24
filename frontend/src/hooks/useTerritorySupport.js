import { useGeo } from '../contexts/GeoContext';
import { territoryContact } from '../utils/territoryContact';

export default function useTerritorySupport() {
  const geo = useGeo();
  const countryId = geo.countryId || geo.user?.countryId;
  const regionId = geo.regionId || (String(countryId) === String(geo.user?.countryId) ? geo.user?.regionId : null);
  return territoryContact({
    country: geo.countries?.find((country) => String(country.id) === String(countryId)),
    region: geo.regions?.find((region) => String(region.id) === String(regionId)),
  });
}
