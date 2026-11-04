import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getMyDispatchPresence, getMyProvider, updateMyAvailability, updateMyLiveLocation } from '../../services/providers';

export default function ProviderAvailabilityPanel({ active = true }) {
  const { t } = useTranslation();
  const [provider, setProvider] = useState(null);
  const [presence, setPresence] = useState(null);
  const [vehicleId, setVehicleId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const alive = useRef(true), version = useRef(0), sending = useRef(false);
  const activeView = useRef(active); activeView.current = active;
  const load = useCallback(async ({ force = false } = {}) => {
    if (!alive.current || (!activeView.current && !force) || (sending.current && !force)) return;
    const request = ++version.current;
    try {
      const profile = await getMyProvider({ strict: true });
      if (!alive.current || request !== version.current) return;
      if (!profile) { setProvider(null); setPresence(null); setError(''); return; }
      setProvider(profile);
      const current = await getMyDispatchPresence();
      if (!alive.current || request !== version.current) return;
      setPresence(current);
      setProvider({ ...profile, availabilityStatus: current.availabilityStatus || profile.availabilityStatus });
      setVehicleId((previous) => {
        const vehicles = current.eligibleVehicles || [];
        if (vehicles.some((vehicle) => String(vehicle.id) === String(previous))) return previous;
        return vehicles.find((vehicle) => String(vehicle.id) === String(current.liveLocation?.vehicleId))?.id || vehicles[0]?.id || '';
      });
      setError('');
    } catch (failure) {
      if (!alive.current || request !== version.current) return;
      setPresence(null);
      if ([401, 403, 404].includes(failure?.response?.status)) setProvider(null);
      setError(t('workspace.providerUnavailable'));
    } finally { if (alive.current && request === version.current) setLoading(false); }
  }, [t]);
  useEffect(() => {
    alive.current = true; load();
    const refresh = () => { if (document.visibilityState === 'visible') load(); };
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh);
    return () => { alive.current = false; version.current += 1; clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); };
  }, [load]);
  async function change(status) {
    if (sending.current || !alive.current || !activeView.current) return;
    sending.current = true; version.current += 1; setBusy(true); setSaveError('');
    try {
      if (status === 'available' && presence?.eligibleVehicles?.length) {
        if (!vehicleId) throw new Error(t('myMissionsPage.errors.vehicleRequired'));
        if (navigator.geolocation) {
          try {
            const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }));
            if (!alive.current || !activeView.current) return;
            await updateMyLiveLocation({ vehicleId: Number(vehicleId), latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyMeters: position.coords.accuracy ?? null, headingDegrees: position.coords.heading ?? null });
          } catch { /* La disponibilité reste possible si la position ne peut pas être actualisée. */ }
        }
      }
      if (!alive.current || !activeView.current) return;
      const updated = await updateMyAvailability(status, status === 'available' ? vehicleId : null);
      if (!alive.current) return;
      setProvider(updated); await load({ force: true });
    } catch (failure) {
      if (alive.current) { setSaveError(failure?.response?.data?.error || failure?.message || t('myMissionsPage.errors.availability')); await load({ force: true }); }
    } finally { sending.current = false; if (alive.current) setBusy(false); }
  }
  const available = provider?.availabilityStatus === 'available';
  return <section id="workspace-availability" aria-label={t('connectedHome.availability')} className="scroll-mt-24 space-y-3 rounded-2xl border border-border bg-surface-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold">{t('connectedHome.availability')}</h2>{provider && <p role="status" className="text-sm font-semibold">{t(available ? 'roleViews.availability.available' : provider.availabilityStatus === 'busy' ? 'roleViews.availability.busy' : 'roleViews.availability.offline')}</p>}</div>
    {loading && <p role="status" className="text-sm">{t('operations.loading')}</p>}
    {error && <p role="alert" className="text-sm">{error} <button type="button" disabled={busy} onClick={() => load()} className="min-h-11 underline">{t('serviceOrders.retry')}</button></p>}
    {!loading && !error && !provider && <p className="text-sm text-text-secondary">{t('connectedHome.noProvider')}</p>}
    {provider && <><div className="flex flex-wrap items-center justify-between gap-3">
      <button type="button" disabled={busy || provider.availabilityStatus === 'busy' || (!available && !presence)} onClick={() => change(available ? 'offline' : 'available')} className={`${available ? 'btn-secondary' : 'btn-primary'} min-h-11 rounded-xl px-4 font-semibold`}>
        {t(busy ? 'operations.saving' : available ? 'fieldWorkspace.goOffline' : provider.availabilityStatus === 'busy' ? 'fieldWorkspace.busy' : 'fieldWorkspace.goAvailable')}
      </button>
    </div>
    {presence?.eligibleVehicles?.length === 1 && <p className="text-sm text-text-secondary">{t('myMissionsPage.availability.activeVehicle')} : {[presence.eligibleVehicles[0].brand, presence.eligibleVehicles[0].model, presence.eligibleVehicles[0].plateNumber].filter(Boolean).join(' · ')}</p>}
    {(presence?.eligibleVehicles?.length || 0) > 1 && <label className="block text-sm">{t('myMissionsPage.availability.activeVehicle')}
      <select aria-label={t('myMissionsPage.availability.activeVehicle')} value={vehicleId} disabled={busy || provider.availabilityStatus === 'busy'} onChange={(event) => setVehicleId(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface-main p-2">
        {presence.eligibleVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.brand} {vehicle.model} · {vehicle.plateNumber}</option>)}
      </select>
    </label>}
    <details className="text-sm"><summary className="min-h-11 cursor-pointer py-3 font-medium">{t('roleViews.availabilityHelp')}</summary><p className="text-xs text-text-secondary">{t('fieldWorkspace.providerHint')}</p></details></>}
    {saveError && <p role="alert" className="text-sm">{saveError}</p>}
  </section>;
}
