import { useMemo } from 'react';
import { useGeo } from '../contexts/GeoContext';

export default function GeoSelector() {
  const {
    countryId,
    regionId,
    countries,
    regions,
    setCountry,
    setRegion,
    loading,
  } = useGeo();

  const countryOptions = useMemo(() => countries || [], [countries]);
  const regionOptions = useMemo(() => regions || [], [regions]);

  if (loading) {
    return (
      <div className="text-xs text-gray-400">Chargement zones…</div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <label className="sr-only" htmlFor="geo-country">Pays</label>
      <select
        id="geo-country"
        className="bg-slate-800 text-gray-200 rounded-md px-2 py-1 border border-slate-700"
        value={countryId || ''}
        onChange={(e) => setCountry(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">Pays</option>
        {countryOptions.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="geo-region">Région</label>
      <select
        id="geo-region"
        className="bg-slate-800 text-gray-200 rounded-md px-2 py-1 border border-slate-700"
        value={regionId || ''}
        onChange={(e) => setRegion(e.target.value ? Number(e.target.value) : null)}
        disabled={!countryId}
      >
        <option value="">Région</option>
        {regionOptions.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
    </div>
  );
}
