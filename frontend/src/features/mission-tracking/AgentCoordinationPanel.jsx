import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WorkAssignmentCard from './WorkAssignmentCard';
import { getAgentAssignments, getAgentCapacity, updateAgentCapacity } from '../../services/operations';

export default function AgentCoordinationPanel({ availabilityOnly = false, active: visible = true }) {
  const { t } = useTranslation();
  const location = useLocation();
  const from = location.pathname + location.search;
  const editing = useRef(false);
  const sending = useRef(false);
  const readVersion = useRef(0);
  const alive = useRef(true);
  const activeView = useRef(visible); activeView.current = visible;
  const [capacity, setCapacity] = useState(null);
  const [activeCount, setActiveCount] = useState(0);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [availableMinutes, setAvailableMinutes] = useState(60);
  const durationControl = <label htmlFor="agent-available-minutes" className="text-sm">{t('fieldWorkspace.duration')}
    <select id="agent-available-minutes" value={availableMinutes} onChange={(event) => setAvailableMinutes(Number(event.target.value))} disabled={busy} className="ml-2 rounded-xl border border-border bg-surface-main p-3">
      {[30, 60, 120, 240, 480].map((minutes) => <option key={minutes} value={minutes}>{t('fieldWorkspace.minutes', { count: minutes })}</option>)}
    </select>
  </label>;
  const load = useCallback(async () => {
    if (!alive.current) return;
    const version = ++readVersion.current;
    const [profile, assignments] = await Promise.all([getAgentCapacity(), availabilityOnly ? Promise.resolve([]) : getAgentAssignments()]);
    if (!alive.current || readVersion.current !== version) return;
    if (!editing.current) setCapacity(profile.capacity);
    setActiveCount(profile.activeAssignments); setItems(assignments);
  }, [availabilityOnly]);
  useEffect(() => {
    let active = true;
    alive.current = true;
    async function refresh() {
      if (sending.current || !activeView.current) return;
      const version = ++readVersion.current;
      try {
        const [profile, assignments] = await Promise.all([getAgentCapacity(), availabilityOnly ? Promise.resolve([]) : getAgentAssignments()]);
        if (active && version === readVersion.current && !sending.current) { if (!editing.current) setCapacity(profile.capacity); setActiveCount(profile.activeAssignments); setItems(assignments); setError(''); }
      } catch (failure) { if (active && version === readVersion.current) { if ([401,403,404].includes(failure?.response?.status)) { setCapacity(null); setItems([]); } setError(failure?.response?.data?.error || t('operations.failed')); } }
    }
    refresh();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 15000);
    window.addEventListener('online', refresh);
    return () => { active = false; alive.current = false; readVersion.current += 1; clearInterval(timer); window.removeEventListener('online', refresh); };
  }, [t, availabilityOnly]);
  async function save(changes) {
    if (sending.current) return;
    readVersion.current += 1;
    sending.current = true; setBusy(true); setError('');
    try {
      const result = await updateAgentCapacity(changes);
      if (!alive.current) return;
      editing.current = false;
      if (result.capacity) setCapacity(result.capacity);
      await load();
    } catch (failure) { if (alive.current) setError(failure?.response?.data?.error || t('operations.failed')); }
    finally { sending.current = false; if (alive.current) setBusy(false); }
  }
  return <section id={availabilityOnly ? 'workspace-availability' : undefined} aria-label={t(availabilityOnly ? 'connectedHome.availability' : 'agentCoordination.title')} className="scroll-mt-24 space-y-3 rounded-2xl border border-border bg-surface-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold">{t(availabilityOnly ? 'connectedHome.availability' : 'agentCoordination.title')}</h2>{availabilityOnly && capacity && <p role="status" className="text-sm font-semibold">{t(capacity.available ? 'roleViews.availability.available' : 'roleViews.availability.offline')}</p>}</div>
    {capacity && <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!availabilityOnly && <p role="status" className="text-sm font-semibold">{t(capacity.available ? 'fieldWorkspace.available' : 'fieldWorkspace.offline')}</p>}
        {!availabilityOnly && durationControl}
        <button type="button" disabled={busy} onClick={() => save({ available: !capacity.available, ...(capacity.available ? {} : { availableMinutes }) })} className={`${capacity.available ? 'btn-secondary' : 'btn-primary'} min-h-12 rounded-xl px-5 py-3 font-semibold`}>
          {t(busy ? 'operations.saving' : capacity.available ? 'fieldWorkspace.goOffline' : 'fieldWorkspace.goAvailable')}
        </button>
      </div>
      {capacity.available && capacity.availableUntil && <p className="text-xs text-text-secondary">{t('agentCoordination.availableUntil')} : {new Date(capacity.availableUntil).toLocaleString()}</p>}
      {capacity.availabilityExpired && <p role="status" className="text-sm">{t('agentCoordination.expired')}</p>}
      <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">{t(availabilityOnly ? 'connectedHome.settings' : 'fieldWorkspace.settings')}</summary>
        <p className="text-xs text-text-secondary">{t('agentCoordination.load', { count: activeCount })}</p>
        {availabilityOnly && <div className="mt-2">{durationControl}</div>}
        <form onSubmit={(event) => { event.preventDefault(); save({ maxConcurrent: Number(capacity.maxConcurrent) }); }} className="mt-3 flex flex-wrap items-center gap-3">
          <label htmlFor="agent-capacity" className="text-sm">{t('agentCoordination.capacity')} <input id="agent-capacity" type="number" min="1" max="10" required value={capacity.maxConcurrent} disabled={busy} onChange={(event) => { editing.current = true; setCapacity({ ...capacity, maxConcurrent: event.target.value }); }} className="w-20 rounded-xl border border-border bg-surface-main p-3" /></label>
          <button type="submit" disabled={busy} className="btn-secondary min-h-11 rounded-xl px-4 py-2">{t('operations.save')}</button>
        </form>
        <p className="mt-2 text-sm text-text-secondary">{t('agentCoordination.hint')}</p>
        {availabilityOnly && <p className="mt-2 text-sm text-text-secondary">{t('agentCoordination.startHint')}</p>}
      </details>
    </>}
    {!availabilityOnly && <p className="text-sm text-text-secondary">{t('agentCoordination.startHint')}</p>}
    {error && <p role="alert">{error} <button type="button" disabled={busy} onClick={async () => {
      try { await load(); if (alive.current) setError(''); }
      catch (failure) { if (alive.current) { if ([401,403,404].includes(failure?.response?.status)) { setCapacity(null); setItems([]); } setError(failure?.response?.data?.error || t('operations.failed')); } }
    }} className="min-h-11 underline">{t('serviceOrders.retry')}</button></p>}
    {!availabilityOnly && <div className="grid gap-3 sm:grid-cols-2">{items.map((item) => <WorkAssignmentCard key={`${item.entityType}-${item.id}`} item={item} onSaved={load} from={from} />)}</div>}
  </section>;
}
