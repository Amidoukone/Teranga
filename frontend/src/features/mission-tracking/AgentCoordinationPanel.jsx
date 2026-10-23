import { useCallback, useEffect, useRef, useState } from 'react';
import WorkAssignmentCard from './WorkAssignmentCard';
import { useTranslation } from 'react-i18next';
import { getAgentAssignments, getAgentCapacity, updateAgentCapacity } from '../../services/operations';

export default function AgentCoordinationPanel() {
  const { t } = useTranslation();
  const editing = useRef(false);
  const [capacity, setCapacity] = useState(null);
  const [activeCount, setActiveCount] = useState(0);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const [profile, assignments] = await Promise.all([getAgentCapacity(), getAgentAssignments()]);
    setCapacity(profile.capacity); setActiveCount(profile.activeAssignments); setItems(assignments);
  }, []);
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const [profile, assignments] = await Promise.all([getAgentCapacity(), getAgentAssignments()]);
        if (active) { if (!editing.current) setCapacity(profile.capacity); setActiveCount(profile.activeAssignments); setItems(assignments); setError(''); }
      } catch (failure) { if (active) setError(failure?.response?.data?.error || t('operations.failed')); }
    }
    refresh();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [t]);
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await updateAgentCapacity({ available: capacity.available, maxConcurrent: Number(capacity.maxConcurrent) }); editing.current = false; await load(); }
    catch (failure) { setError(failure?.response?.data?.error || t('operations.failed')); }
    finally { setBusy(false); }
  }
  return <section aria-label={t('agentCoordination.title')} className="space-y-4 rounded-2xl border border-border bg-surface-card p-4">
    <h2 className="font-semibold">{t('agentCoordination.title')}</h2>
    <p className="text-sm text-text-secondary">{t('agentCoordination.hint')}</p>
    {capacity && <form onSubmit={save} className="flex flex-wrap items-center gap-3">
      <label><input type="checkbox" checked={capacity.available} onChange={(event) => { editing.current = true; setCapacity({ ...capacity, available: event.target.checked }); }} /> {t('agentCoordination.available')}</label>
      <label htmlFor="agent-capacity">{t('agentCoordination.capacity')} <input id="agent-capacity" type="number" min="1" max="10" required value={capacity.maxConcurrent} onChange={(event) => { editing.current = true; setCapacity({ ...capacity, maxConcurrent: event.target.value }); }} className="w-16 rounded-lg border border-border bg-surface-main p-2" /></label>
      <button type="submit" disabled={busy} className="btn-primary rounded-lg px-3 py-2">{t('operations.save')}</button>
      <p className="text-sm">{t('agentCoordination.load', { count: activeCount })}</p>
    </form>}
    {error && <p role="alert">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-2">{items.map((item) => <WorkAssignmentCard key={`${item.entityType}-${item.id}`} item={item} onSaved={load} />)}</div>
  </section>;
}
