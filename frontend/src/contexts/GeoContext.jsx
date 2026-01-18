import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getCountries } from '../services/countries';
import { getRegions } from '../services/regions';
import { getGeoSelection, setGeoSelection } from '../services/geo';
import { getLocalUser, getToken } from '../services/auth';

const GeoContext = createContext(null);

export function GeoProvider({ children }) {
  const initial = getGeoSelection();
  const [countryId, setCountryId] = useState(initial.countryId);
  const [regionId, setRegionId] = useState(initial.regionId);
  const [countries, setCountries] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const isAuthenticated = Boolean(getToken() || getLocalUser());

  const refreshRegions = useCallback(async (nextCountryId) => {
    if (!nextCountryId || !isAuthenticated) {
      setRegions([]);
      setRegionId(null);
      return;
    }
    try {
      const list = await getRegions({ countryId: nextCountryId });
      setRegions(list || []);
    } catch (e) {
      console.error('❌ Geo regions load:', e);
      setRegions([]);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!isAuthenticated) {
        if (active) setLoading(false);
        return;
      }
      try {
        const list = await getCountries();
        if (active) setCountries(list || []);
      } catch (e) {
        if (active) setCountries([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    refreshRegions(countryId);
  }, [countryId, refreshRegions]);

  useEffect(() => {
    setGeoSelection({ countryId, regionId });
  }, [countryId, regionId]);

  const setCountry = useCallback((next) => {
    setCountryId(next || null);
    setRegionId(null);
  }, []);

  const setRegion = useCallback((next) => {
    setRegionId(next || null);
  }, []);

  const value = useMemo(
    () => ({
      countryId,
      regionId,
      countries,
      regions,
      setCountry,
      setRegion,
      loading,
    }),
    [countryId, regionId, countries, regions, setCountry, setRegion, loading]
  );

  return <GeoContext.Provider value={value}>{children}</GeoContext.Provider>;
}

export function useGeo() {
  const ctx = useContext(GeoContext);
  if (!ctx) {
    throw new Error('useGeo must be used within GeoProvider');
  }
  return ctx;
}
