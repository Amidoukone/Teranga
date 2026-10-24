import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import WorkAssignmentCard from './WorkAssignmentCard';
import { getAgentAssignments, getAgentCapacity, updateAgentCapacity } from '../../services/operations';

export default function AgentCoordinationPanel() {
  const { t } = useTranslation();
  const editing = useRef(false);
  const sending = useRef(false);
  const readVersion = useRef(0);
  const [capacity, setCapacity] = useState(null);
  const [activeCount, setActiveCount] = useState(0);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [availableMinutes, setAvailableMinutes] = useState(60);
  const load = useCallback(async () => {
    const version = ++readVersion.current;
    const [profile, assignments] = await Promise.all([getAgentCapacity(), getAgentAssignments()]);
    if (readVersion.current !== version) return;
    if (!editing.current) setCapacity(profile.capacity);
    setActiveCount(profile.activeAssignments); setItems(assignments);
  }, []);
  useEffect(() => {
    let active = true;
    async function refresh() {
      if (sending.current) return;
      const version = ++readVersion.current;
      try {
        const [profile, assignments] = await Promise.all([getAgentCapacity(), getAgentAssignments()]);
        if (active && version === readVersion.current && !sending.current) { if (!editing.current) setCapacity(profile.capacity); setActiveCount(profile.activeAssignments); setItems(assignments); setError(''); }
      } catch (failure) { if (active && version === readVersion.current) setError(failure?.response?.data?.error || t('operations.failed')); }
    }
    refresh();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 15000);
    return () => { active = false; readVersion.current += 1; clearInterval(timer); };
  }, [t]);
  async function save(changes) {
    if (sending.current) return;
    readVersion.current += 1;
    sending.current = true; setBusy(true); setError('');
    try {
      const result = await updateAgentCapacity(changes);
      editing.current = false;
      if (result.capacity) setCapacity(result.capacity);
      await load();
    } catch (failure) { setError(failure?.response?.data?.error || t('operations.failed')); }
    finally { sending.current = false; setBusy(false); }
  }
  return <section aria-label={t('agentCoordination.title')} className="space-y-4 rounded-2xl border border-border bg-surface-card p-4">
    <h2 className="font-semibold">{t('agentCoordination.title')}</h2>
    {capacity && <>
      <p role="status" className="text-sm font-semibold">{t(capacity.available ? 'fieldWorkspace.available' : 'fieldWorkspace.offline')}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label htmlFor="agent-available-minutes" className="text-sm">{t('fieldWorkspace.duration')}
          <select id="agent-available-minutes" value={availableMinutes} onChange={(event) => setAvailableMinutes(Number(event.target.value))} disabled={busy} className="ml-2 rounded-xl border border-border bg-surface-main p-3">
            {[30, 60, 120, 240, 480].map((minutes) => <option key={minutes} value={minutes}>{t('fieldWorkspace.minutes', { count: minutes })}</option>)}
          </select>
        </label>
        <button type="button" disabled={busy} onClick={() => save({ available: !capacity.available, ...(capacity.available ? {} : { availableMinutes }) })} className={`${capacity.available ? 'btn-secondary' : 'btn-primary'} min-h-12 rounded-xl px-5 py-3 font-semibold`}>
          {t(busy ? 'operations.saving' : capacity.available ? 'fieldWorkspace.goOffline' : 'fieldWorkspace.goAvailable')}
        </button>
      </div>
      {capacity.available && capacity.availableUntil && <p className="text-sm">{t('agentCoordination.availableUntil')} : {new Date(capacity.availableUntil).toLocaleString()}</p>}
      {capacity.availabilityExpired && <p role="status" className="text-sm">{t('agentCoordination.expired')}</p>}
      <p className="text-sm text-text-secondary">{t('agentCoordination.load', { count: activeCount })}</p>
      <details><summary className="cursor-pointer text-sm font-medium">{t('fieldWorkspace.settings')}</summary>
        <form onSubmit={(event) => { event.preventDefault(); save({ maxConcurrent: Number(capacity.maxConcurrent) }); }} className="mt-3 flex flex-wrap items-center gap-3">
          <label htmlFor="agent-capacity" className="text-sm">{t('agentCoordination.capacity')} <input id="agent-capacity" type="number" min="1" max="10" required value={capacity.maxConcurrent} disabled={busy} onChange={(event) => { editing.current = true; setCapacity({ ...capacity, maxConcurrent: event.target.value }); }} className="w-20 rounded-xl border border-border bg-surface-main p-3" /></label>
          <button type="submit" disabled={busy} className="btn-secondary min-h-11 rounded-xl px-4 py-2">{t('operations.save')}</button>
        </form>
        <p className="mt-2 text-sm text-text-secondary">{t('agentCoordination.hint')}</p>
      </details>
    </>}
    <p className="text-sm text-text-secondary">{t('agentCoordination.startHint')}</p>
    {error && <p role="alert">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-2">{items.map((item) => <WorkAssignmentCard key={`${item.entityType}-${item.id}`} item={item} onSaved={load} />)}</div>
  </section>;
}
