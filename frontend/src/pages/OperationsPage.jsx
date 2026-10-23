import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGeo } from '../contexts/GeoContext';
import { getLocalUser } from '../services/auth';
import { getAssignableAgents, getFieldReadiness, getOperatingCatalog, getOperations, updateCoordination, updateOperatingOffer } from '../services/operations';

function WorkSettings({ item, agents, onSaved }) {
  const { t } = useTranslation();
  const [agentId, setAgentId] = useState(item.coordination?.executorUserId || item.agentId || '');
  const [minutes, setMinutes] = useState(item.coordination?.policy?.stageMinutes || (item.entityType === 'project' ? 1440 : 60));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!dirty) { setAgentId(item.coordination?.executorUserId || item.agentId || ''); setMinutes(item.coordination?.policy?.stageMinutes || (item.entityType === 'project' ? 1440 : 60)); }
  }, [dirty, item]);
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const assignmentChanged = String(agentId || '') !== String(item.coordination?.executorUserId || item.agentId || '');
      await updateCoordination(item.id, { ...(item.status === 'created' && assignmentChanged ? { executorUserId: agentId ? Number(agentId) : null, mode: 'manual' } : {}), policy: { stageMinutes: Number(minutes) } }, item.entityType);
      setDirty(false); await onSaved();
    } catch (failure) { setError(failure?.response?.data?.error || t('operations.failed')); }
    finally { setBusy(false); }
  }
  const choices = agents.filter((agent) => (!agent.countryId || String(agent.countryId) === String(item.countryId)) && (!agent.regionId || String(agent.regionId) === String(item.regionId)));
  return <form onSubmit={save} className="space-y-2 border-t border-border pt-3">
    {item.status === 'created' && <label className="block text-sm" htmlFor={`executor-${item.entityType}-${item.id}`}>{t('operations.executor')}
      <select id={`executor-${item.entityType}-${item.id}`} value={agentId} onChange={(event) => { setAgentId(event.target.value); setDirty(true); }} className="ml-2 rounded-lg border border-border bg-surface-main p-2">
        <option value="">{t('operations.toDefine')}</option>{choices.map((agent) => <option key={agent.id} value={agent.id}>{[agent.firstName, agent.lastName].filter(Boolean).join(' ') || agent.email || `#${agent.id}`}</option>)}
      </select></label>}
    <label className="block text-sm" htmlFor={`deadline-${item.entityType}-${item.id}`}>{t('operations.sla')}
      <input id={`deadline-${item.entityType}-${item.id}`} type="number" min="1" max="10080" required value={minutes} onChange={(event) => { setMinutes(event.target.value); setDirty(true); }} className="ml-2 w-24 rounded-lg border border-border bg-surface-main p-2" /></label>
    <button type="submit" disabled={busy} className="btn-secondary rounded-lg px-3 py-2 text-sm">{t('operations.save')}</button>
    {error && <p role="alert">{error}</p>}
  </form>;
}

function OfferSettings({ entry, onSaved, user }) {
  const { t } = useTranslation();
  const initial = entry.offering || {};
  const rules = initial.providerRules || {};
  const policy = rules.coordination || {};
  const [enabled, setEnabled] = useState(policy.enabled === true);
  const [outcome, setOutcome] = useState(rules.serviceOutcome || entry.definition?.description || '');
  const [sla, setSla] = useState(initial.slaMinutes || '');
  const [attempts, setAttempts] = useState(policy.maxAttempts || 3);
  const [seconds, setSeconds] = useState(policy.acceptanceSeconds || 120);
  const [required, setRequired] = useState(rules.requiredEvidenceTypes || entry.definition?.requiredEvidenceTypes || []);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const canManage = !user?.regionId || String(user.regionId) === String(entry.territory?.regionId);
  async function save(event) {
    event.preventDefault(); setSaving(true); setMessage('');
    try {
      await updateOperatingOffer(entry.id, { slaMinutes: Number(sla), providerRules: { ...rules, serviceOutcome: outcome,
        requiredEvidenceTypes: required, coordination: { ...policy, enabled, maxAttempts: Number(attempts), acceptanceSeconds: Number(seconds) } } });
      setMessage(t('operations.saved')); onSaved();
    } catch (error) { setMessage(error?.response?.data?.error || t('operations.failed')); }
    finally { setSaving(false); }
  }
  const prefix = `offer-${entry.id}`;
  return <form onSubmit={save} className="space-y-3 rounded-2xl border border-border bg-surface-card p-4">
    <h3 className="font-semibold">{entry.definition?.name} · {entry.territory?.name}</h3>
    <p className="text-sm text-text-secondary">{entry.operatingOrganization?.displayName || entry.operatingOrganization?.legalName}</p>
    <label className="block text-sm" htmlFor={`${prefix}-outcome`}>{t('operations.outcome')}</label>
    <textarea id={`${prefix}-outcome`} value={outcome} onChange={(event) => setOutcome(event.target.value)} minLength={10} maxLength={2000} required disabled={!canManage} className="w-full rounded-lg border border-border bg-surface-main p-2" />
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="text-sm" htmlFor={`${prefix}-sla`}>{t('operations.sla')}
        <input id={`${prefix}-sla`} type="number" min="1" max="10080" required value={sla} disabled={!canManage} onChange={(event) => setSla(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface-main p-2" /></label>
      <label className="text-sm" htmlFor={`${prefix}-attempts`}>{t('operations.maxAttempts')}
        <input id={`${prefix}-attempts`} type="number" min="1" max="10" required value={attempts} disabled={!canManage} onChange={(event) => setAttempts(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface-main p-2" /></label>
      <label className="text-sm" htmlFor={`${prefix}-seconds`}>{t('operations.acceptanceSeconds')}
        <input id={`${prefix}-seconds`} type="number" min="30" max="3600" required value={seconds} disabled={!canManage} onChange={(event) => setSeconds(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface-main p-2" /></label>
    </div>
    <fieldset disabled={!canManage} className="flex flex-wrap gap-3"><legend className="mb-2 text-sm">{t('operations.proofs')}</legend>
      {['photo', 'document', 'receipt', 'other'].map((kind) => <label key={kind} className="text-sm"><input type="checkbox" checked={required.includes(kind)} onChange={(event) => setRequired(event.target.checked ? [...required, kind] : required.filter((value) => value !== kind))} /> {t(`operations.evidence.${kind}`)}</label>)}
    </fieldset>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} disabled={!canManage || (!entry.definition?.legacyTradeCategoryId && entry.definition?.executionProfile !== 'agent')} onChange={(event) => setEnabled(event.target.checked)} />{t('operations.enableAutomatic')}</label>
    <p className="text-xs text-text-secondary">{t('operations.activationHint')}</p>
    <button type="submit" disabled={saving || !canManage} className="btn-primary rounded-lg px-4 py-2 disabled:opacity-50">{saving ? t('operations.saving') : t('operations.save')}</button>
    {message && <p role="status" className="text-sm">{message}</p>}
  </form>;
}

export default function OperationsPage() {
  const { t, i18n } = useTranslation();
  const { countryId, regionId } = useGeo();
  const [items, setItems] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [agents, setAgents] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [error, setError] = useState('');
  const [setupError, setSetupError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [entityType, setEntityType] = useState('service');
  const [attention, setAttention] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [user] = useState(getLocalUser);
  const generation = useRef(0);
  const boardRequest = useRef(0);
  const setupRequest = useRef(0);
  const loadBoard = useCallback(async () => {
    const epoch = generation.current;
    const request = ++boardRequest.current;
    try {
      const result = await getOperations({ countryId, regionId, entityType, attention: attention ? true : undefined, limit: 25, offset });
      if (generation.current !== epoch || boardRequest.current !== request) return;
      setItems(result.items || []); setTotal(result.pagination?.total || 0); setError('');
    } catch (failure) {
      if (generation.current === epoch && boardRequest.current === request) { setItems([]); setTotal(0); setError(failure?.response?.data?.error || t('operations.failed')); }
    } finally { if (generation.current === epoch && boardRequest.current === request) setLoading(false); }
  }, [countryId, regionId, entityType, attention, offset, t]);
  const loadSetup = useCallback(async () => {
    const epoch = generation.current;
    const request = ++setupRequest.current;
    try {
      const [offers, check, executors] = await Promise.all([getOperatingCatalog({ countryId, regionId }), countryId ? getFieldReadiness({ countryId, regionId }) : Promise.resolve(null), entityType === 'service' ? Promise.resolve([]) : getAssignableAgents({ countryId, regionId })]);
      if (generation.current !== epoch || setupRequest.current !== request) return;
      setCatalog(offers); setReadiness(check); setAgents(executors); setSetupError('');
    } catch (failure) { if (generation.current === epoch && setupRequest.current === request) { setReadiness(null); setCatalog([]); setSetupError(failure?.response?.data?.error || t('operations.failed')); } }
  }, [countryId, regionId, entityType, t]);
  useEffect(() => {
    setOffset(0);
  }, [countryId, regionId]);
  useEffect(() => {
    generation.current += 1; setItems([]); setReadiness(null); setCatalog([]); setLoading(true);
    loadBoard(); loadSetup();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') loadBoard(); }, 15000);
    return () => { generation.current += 1; clearInterval(timer); };
  }, [loadBoard, loadSetup]);
  async function configure(item, mode) {
    const epoch = generation.current;
    setBusy(item.id);
    try {
      const payload = { mode, ...(user?.id ? { ownerUserId: user.id } : {}) };
      if (entityType === 'service') await updateCoordination(item.id, payload);
      else await updateCoordination(item.id, payload, entityType);
      if (generation.current === epoch) await loadBoard();
    } catch (failure) { if (generation.current === epoch) setError(failure?.response?.data?.error || t('operations.failed')); }
    finally { setBusy(null); }
  }
  const date = (value) => value ? new Date(value).toLocaleString(i18n.language) : t('operations.toDefine');
  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 text-text-primary">
    <header><h1 className="text-2xl font-bold">{t('operations.title')}</h1><p className="mt-2 text-text-secondary">{t('operations.subtitle')}</p></header>
    <section aria-label={t('operations.readiness')} className="rounded-2xl border border-border bg-surface-card p-4">
      <h2 className="text-lg font-semibold">{t('operations.readiness')}</h2>
      {setupError && <p role="alert">{setupError}</p>}
      {!countryId && <p>{t('operations.selectCountry')}</p>}
      {readiness && <><p className="my-2 font-semibold">{t(readiness.ready ? 'operations.configurationReady' : 'operations.configurationIncomplete')}</p>
        <ul className="list-disc space-y-1 pl-5">{readiness.issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.message}</li>)}</ul>
        <p className="mt-3 text-sm text-text-secondary">{t('operations.fieldChecksRemain')}</p></>}
    </section>
    <section aria-label={t('operations.queue')} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{t('operations.queue')}</h2>
        <label className="text-sm"><input type="checkbox" checked={attention} onChange={(event) => { setAttention(event.target.checked); setOffset(0); }} /> {t('operations.attentionOnly')}</label>
        <button type="button" onClick={() => { loadBoard(); loadSetup(); }} className="btn-secondary rounded-lg px-4 py-2">{t('operations.refresh')}</button>
      </div>
      <label htmlFor="operation-type" className="block text-sm">{t('operations.entityType')} <select id="operation-type" value={entityType} onChange={(event) => { setEntityType(event.target.value); setOffset(0); }} className="rounded-lg border border-border bg-surface-main p-2">{['service', 'project', 'order'].map((type) => <option key={type} value={type}>{t(`operations.entities.${type}`)}</option>)}</select></label>
      {error && <p role="alert">{error}</p>}
      {loading && <p role="status">{t('operations.loading')}</p>}
      {!loading && !error && !items.length && <p>{t('operations.empty')}</p>}
      <div className="grid gap-4 lg:grid-cols-2">{items.map((item) => <article key={`${entityType}-${item.id}`} className="space-y-3 rounded-2xl border border-border bg-surface-card p-4">
        <h3 className="font-semibold"><Link to={`/${entityType === 'service' ? 'services' : entityType === 'project' ? 'projects' : 'orders'}/${item.id}`} className="underline">#{item.id} · {item.title}</Link></h3>
        <p className="text-sm">{item.country?.name} {item.region?.name ? `· ${item.region.name}` : ''} · {item.tradeCategory?.name || item.type}</p>
        <p>{t('operations.state')}: {t(`operations.states.${item.coordination?.state || 'waiting'}`)}</p>
        <p className="text-sm">{t('operations.owner')}: {item.coordination?.owner?.email || t('operations.toDefine')}</p>
        <p className="text-sm">{t('operations.nextAction')}: {date(item.coordination?.nextActionAt)}</p>
        <p className="text-sm">{t('operations.attempts')}: {item.coordination?.attempts?.length || 0}</p>
        {item.coordination?.reason && <p className="text-sm text-amber-700 dark:text-amber-300">{t(`operations.reasons.${item.coordination.reason}`, { defaultValue: item.coordination.reason })}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy === item.id} onClick={() => configure(item, 'manual')} className="btn-secondary rounded-lg px-3 py-2 text-sm">{t('operations.takeOwnership')}</button>
          {((entityType === 'service' && (['CREATED', 'SEARCHING_EXECUTOR'].includes(item.missionStatus) || (!item.missionStatus && item.status === 'created' && !item.agentId))) || (entityType !== 'service' && item.status === 'created' && !item.agentId && !item.coordination?.executorUserId)) && <button type="button" disabled={busy === item.id} onClick={() => configure(item, 'automatic')} className="btn-primary rounded-lg px-3 py-2 text-sm">{t('operations.startAutomatic')}</button>}
          <Link to={entityType === 'service' ? '/admin/services' : entityType === 'project' ? '/admin/projects' : '/orders'} className="btn-secondary rounded-lg px-3 py-2 text-sm">{t('operations.assignManually')}</Link>
        </div>
        {entityType !== 'service' && <WorkSettings item={{ ...item, entityType }} agents={agents} onSaved={loadBoard} />}
      </article>)}</div>
      <div className="flex items-center justify-between gap-3"><button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))} className="btn-secondary rounded-lg px-3 py-2 disabled:opacity-50">{t('operations.previous')}</button>
        <p className="text-sm">{items.length ? offset + 1 : 0}–{offset + items.length} / {total}</p>
        <button type="button" disabled={offset + 25 >= total} onClick={() => setOffset(offset + 25)} className="btn-secondary rounded-lg px-3 py-2 disabled:opacity-50">{t('operations.next')}</button></div>
    </section>
    <section aria-label={t('operations.catalog')} className="space-y-4"><h2 className="text-lg font-semibold">{t('operations.catalog')}</h2>
      <div className="grid gap-4 lg:grid-cols-2">{catalog.map((entry) => <OfferSettings key={entry.id} entry={entry} user={user} onSaved={loadSetup} />)}</div>
    </section>
  </main>;
}
