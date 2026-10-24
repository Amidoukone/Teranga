import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { assignClassicAgent, updateCoordination } from '../../services/operations';

export default function AssignmentSettings({ item, agents, agentsError, agentsLoading, onRetryAgents, onSaved }) {
  const { t } = useTranslation();
  const classic = item.entityType === 'service';
  const currentId = item.coordination?.executorUserId || item.agentId || '';
  const [agentId, setAgentId] = useState(currentId);
  const [baselineId, setBaselineId] = useState(currentId);
  const [minutes, setMinutes] = useState(item.coordination?.policy?.stageMinutes || (item.entityType === 'project' ? 1440 : 60));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sending = useRef(false);
  useEffect(() => {
    if (!dirty) { setAgentId(currentId); setBaselineId(currentId); setMinutes(item.coordination?.policy?.stageMinutes || (item.entityType === 'project' ? 1440 : 60)); }
  }, [dirty, currentId, item.coordination?.policy?.stageMinutes, item.entityType]);
  const choices = agents.filter((agent) => (!agent.countryId || String(agent.countryId) === String(item.countryId)) && (!agent.regionId || String(agent.regionId) === String(item.regionId)));
  const changed = dirty && String(agentId || '') !== String(currentId || '');
  const stale = dirty && String(baselineId || '') !== String(currentId || '');
  async function save(event) {
    event.preventDefault(); if (sending.current || stale) return;
    sending.current = true; setBusy(true); setError('');
    try {
      if (classic) await assignClassicAgent(item.id, Number(agentId));
      else await updateCoordination(item.id, { ...(item.status === 'created' && changed ? { executorUserId: agentId ? Number(agentId) : null, mode: 'manual' } : {}), policy: { stageMinutes: Number(minutes) } }, item.entityType);
      setDirty(false); await onSaved();
    } catch (failure) { setError(failure?.response?.data?.error || t('operations.failed')); }
    finally { sending.current = false; setBusy(false); }
  }
  return <form onSubmit={save} className="mt-3 space-y-3 rounded-xl border border-border p-3">
    <p className="text-sm text-text-secondary">{t(classic ? 'coordinationWorkspace.classicAssignmentHint' : 'coordinationWorkspace.assignmentHint')}</p>
    {stale && <p role="alert" className="text-sm">{t('coordinationWorkspace.assignmentChanged')} <button type="button" onClick={() => { setAgentId(currentId); setBaselineId(currentId); }} className="min-h-11 underline">{t('coordinationWorkspace.reviewAssignment')}</button></p>}
    {agentsError && <p role="alert" className="text-sm">{t('coordinationWorkspace.agentsError')} <button type="button" onClick={onRetryAgents} className="underline">{t('serviceOrders.retry')}</button></p>}
    {item.status === 'created' && <label className="block text-sm" htmlFor={`executor-${item.entityType}-${item.id}`}>{t('operations.executor')}<select id={`executor-${item.entityType}-${item.id}`} required={classic} disabled={busy || agentsLoading} value={agentId} onChange={(event) => { setAgentId(event.target.value); setDirty(true); }} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-surface-main px-3">
      <option value="" disabled={classic}>{t('operations.toDefine')}</option>
      {currentId && !choices.some((agent) => String(agent.id) === String(currentId)) && <option value={currentId}>{t('coordinationWorkspace.currentAgent', { id: currentId })}</option>}
      {choices.map((agent) => <option key={agent.id} value={agent.id}>{[agent.firstName, agent.lastName].filter(Boolean).join(' ') || agent.email || `#${agent.id}`}</option>)}
    </select></label>}
    {!classic && <label className="block text-sm" htmlFor={`deadline-${item.entityType}-${item.id}`}>{t('operations.sla')}<input id={`deadline-${item.entityType}-${item.id}`} type="number" min="1" max="10080" required disabled={busy} value={minutes} onChange={(event) => { setMinutes(event.target.value); setDirty(true); }} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-surface-main px-3" /></label>}
    <button type="submit" disabled={busy || stale || (classic && (!changed || !agentId || agentsLoading || agentsError))} className="btn-primary min-h-11 rounded-xl px-4 text-sm font-semibold disabled:opacity-50">{t(busy ? 'operations.saving' : 'operations.save')}</button>
    {error && <p role="alert" className="text-sm">{error}</p>}
  </form>;
}
