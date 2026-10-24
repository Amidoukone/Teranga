import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAssignableAgents } from '../../services/operations';
import { assignTaskAgent } from '../../services/tasks';

export default function StepAssignmentForm({ task, service, onWrite }) {
  const { t } = useTranslation();
  const current = String(task.assignedTo || '');
  const [baseline, setBaseline] = useState(current);
  const [agentId, setAgentId] = useState(current);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [dirty, setDirty] = useState(false);
  const sending = useRef(false);
  const choices = agents.filter((agent) => (!agent.countryId || String(agent.countryId) === String(service?.countryId || task.countryId)) && (!agent.regionId || String(agent.regionId) === String(service?.regionId || task.regionId)));
  const stale = dirty && baseline !== current;
  useEffect(() => { if (!dirty) { setAgentId(current); setBaseline(current); } }, [dirty, current]);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    getAssignableAgents({ countryId: service?.countryId || task.countryId, regionId: service?.regionId || task.regionId })
      .then((result) => { if (active) setAgents(result); })
      .catch(() => { if (active) setError(t('serviceSteps.agentsFailed')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [service?.countryId, service?.regionId, task.countryId, task.regionId, retry, t]);
  async function save(event) {
    event.preventDefault(); if (sending.current || stale || !agentId) return;
    sending.current = true; setError('');
    try { await onWrite(() => assignTaskAgent(task.id, Number(agentId))); setDirty(false); }
    catch (failure) { setError(failure?.response?.data?.error || t('serviceSteps.actionFailed')); }
    finally { sending.current = false; }
  }
  return <form onSubmit={save} className="mt-3 space-y-2 rounded-xl border border-border p-3">
    <label htmlFor={`step-assignee-${task.id}`} className="block text-sm">{t('serviceSteps.assignee')}<select id={`step-assignee-${task.id}`} value={agentId} required disabled={loading} onChange={(event) => { setAgentId(event.target.value); setDirty(true); }} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-surface-main p-2">
      <option value="" disabled>{t('serviceSteps.unassigned')}</option>
      {current && !choices.some((agent) => String(agent.id) === current) && <option value={current}>{t('serviceSteps.currentAgent', { id: current })}</option>}
      {choices.map((agent) => <option key={agent.id} value={agent.id}>{[agent.firstName, agent.lastName].filter(Boolean).join(' ') || agent.email || `#${agent.id}`}</option>)}
    </select></label>
    {stale && <p role="alert" className="text-sm">{t('serviceSteps.assignmentChanged')} <button type="button" onClick={() => { setAgentId(current); setBaseline(current); }} className="min-h-11 underline">{t('coordinationWorkspace.reviewAssignment')}</button></p>}
    {error && <p role="alert" className="text-sm">{error} <button type="button" onClick={() => setRetry((value) => value + 1)} className="min-h-11 underline">{t('serviceOrders.retry')}</button></p>}
    <button type="submit" disabled={loading || stale || !agentId || current === agentId} className="btn-secondary min-h-11 rounded-xl px-4 text-sm">{t('serviceSteps.assign')}</button>
  </form>;
}
