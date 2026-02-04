import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getCountries } from '../services/countries';
import { getRegions } from '../services/regions';
import { getGeoSelection, setGeoSelection } from '../services/geo';
import { getLocalUser, getToken } from '../services/auth';
import { normalizeRole } from '../utils/role';

const GeoContext = createContext(null);

export function GeoProvider({ children }) {
  const initial = getGeoSelection();
  const [countryId, setCountryId] = useState(initial.countryId);
  const [regionId, setRegionId] = useState(initial.regionId);
  const [countries, setCountries] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(getLocalUser());
  const [token, setToken] = useState(getToken());
  const role = normalizeRole(user?.role);
  const isAuthenticated = Boolean(token || user);
  const isAdmin = role === 'admin';
  const scopedCountryId = user?.countryId ?? null;
  const scopedRegionId = user?.regionId ?? null;
  const isScopedAdmin = isAdmin && (scopedCountryId != null || scopedRegionId != null);
  const canSelect = isAdmin && !isScopedAdmin;

  const clearSelection = useCallback(() => {
    setCountryId(null);
    setRegionId(null);
    setGeoSelection({ countryId: null, regionId: null });
  }, []);

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
    function syncAuthState() {
      setUser(getLocalUser());
      setToken(getToken());
    }

    if (typeof window === 'undefined') return () => {};

    window.addEventListener('storage', syncAuthState);
    window.addEventListener('teranga_auth_changed', syncAuthState);

    return () => {
      window.removeEventListener('storage', syncAuthState);
      window.removeEventListener('teranga_auth_changed', syncAuthState);
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!isAuthenticated) {
        if (active) {
          setCountries([]);
          setRegions([]);
          clearSelection();
          setLoading(false);
        }
        return;
      }
      if (active) setLoading(true);
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
  }, [clearSelection, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    if (isScopedAdmin) {
      setCountryId(scopedCountryId);
      setRegionId(scopedRegionId);
      setGeoSelection({ countryId: scopedCountryId, regionId: scopedRegionId });
      return;
    }

    if (!isAdmin) {
      clearSelection();
    }
  }, [
    clearSelection,
    isAdmin,
    isAuthenticated,
    isScopedAdmin,
    scopedCountryId,
    scopedRegionId,
  ]);

  useEffect(() => {
    refreshRegions(countryId);
  }, [countryId, refreshRegions]);

  useEffect(() => {
    setGeoSelection({ countryId, regionId });
  }, [countryId, regionId]);

  const setCountry = useCallback((next) => {
    if (!canSelect) return;
    setCountryId(next || null);
    setRegionId(null);
  }, [canSelect]);

  const setRegion = useCallback((next) => {
    if (!canSelect) return;
    setRegionId(next || null);
  }, [canSelect]);

  const value = useMemo(
    () => ({
      countryId,
      regionId,
      countries,
      regions,
      setCountry,
      setRegion,
      loading,
      canSelect,
      isScopedAdmin,
    }),
    [
      countryId,
      regionId,
      countries,
      regions,
      setCountry,
      setRegion,
      loading,
      canSelect,
      isScopedAdmin,
    ]
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
