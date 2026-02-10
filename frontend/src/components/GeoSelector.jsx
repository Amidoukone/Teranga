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
    canSelect,
    scopedCountryId,
    scopedRegionId,
  } = useGeo();

  const countryOptions = useMemo(() => countries || [], [countries]);
  const regionOptions = useMemo(() => regions || [], [regions]);

  if (loading) {
    return (
      <div className="text-xs text-gray-400">Chargement zones…</div>
    );
  }

  const displayCountryId = canSelect
    ? countryId
    : scopedCountryId ?? countryId;
  const displayRegionId = canSelect
    ? regionId
    : scopedRegionId ?? regionId;

  const selectedCountry = countryOptions.find(
    (c) => String(c.id) === String(displayCountryId)
  );
  const selectedRegion = regionOptions.find(
    (r) => String(r.id) === String(displayRegionId)
  );

  if (!canSelect) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-cyan-300">
          Scope
        </span>
        <span className="text-gray-400">
          {selectedCountry?.name || (displayCountryId ? `Pays #${displayCountryId}` : 'Pays non défini')}
        </span>
        {displayRegionId && (
          <span className="text-gray-400">
            • {selectedRegion?.name || `Région #${displayRegionId}`}
          </span>
        )}
      </div>
    );
  }

  const selectBase =
    "bg-surface-card/90 text-text-primary rounded-lg px-2.5 py-1.5 border border-border/60 " +
    "shadow-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40";

  const selectDisabled =
    "bg-surface-main/40 text-text-muted border-border/40 cursor-not-allowed";

  return (
    <div className="flex items-center gap-2 text-xs">
      <label className="sr-only" htmlFor="geo-country">Pays</label>
      <select
        id="geo-country"
        className={selectBase}
        value={countryId || ''}
        onChange={(e) => setCountry(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">Tous les pays</option>
        {countryOptions.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="geo-region">Région</label>
      <select
        id="geo-region"
        className={[selectBase, !countryId ? selectDisabled : ""].join(" ").trim()}
        value={regionId || ''}
        onChange={(e) => setRegion(e.target.value ? Number(e.target.value) : null)}
        disabled={!countryId}
      >
        <option value="">Toutes les régions</option>
        {regionOptions.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
    </div>
  );
}
