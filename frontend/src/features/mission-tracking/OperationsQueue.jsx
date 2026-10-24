import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGeo } from '../../contexts/GeoContext';
import { getLocalUser } from '../../services/auth';
import { getAssignableAgents, getFieldReadiness, getOperatingCatalog, getOperations, updateCoordination } from '../../services/operations';
import { getRequestDetailPath } from '../../utils/requestLifecycle';
import PaginationBar from '../../components/PaginationBar';
import AssignmentSettings from './AssignmentSettings';

const TYPES = ['service', 'project', 'order'];
const orderRows = (a, b) => Number(b.coordination?.state === 'escalated') - Number(a.coordination?.state === 'escalated') ||
  (a.coordination?.nextActionAt ? new Date(a.coordination.nextActionAt).getTime() : Infinity) - (b.coordination?.nextActionAt ? new Date(b.coordination.nextActionAt).getTime() : Infinity);

export default function OperationsQueue(props) {
  const geo = useGeo();
  const user = geo.user || getLocalUser();
  return <Queue key={JSON.stringify([user?.id, geo.countryId, geo.regionId])} {...props} user={user} countryId={geo.countryId} regionId={geo.regionId} />;
}

function Queue({ initialEntityType = 'all', embedded, focusedId, active = true, renderOffer, user, countryId, regionId }) {
  const { t, i18n } = useTranslation();
  const [entityType, setEntityType] = useState(initialEntityType);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [assignment, setAssignment] = useState(null);
  const [agents, setAgents] = useState([]);
  const [agentsError, setAgentsError] = useState(false);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentsLoaded, setAgentsLoaded] = useState(false);
  const [readinessOpen, setReadinessOpen] = useState(!embedded);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [readiness, setReadiness] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [readinessError, setReadinessError] = useState('');
  const [catalogError, setCatalogError] = useState('');
  const [setupAttempt, setSetupAttempt] = useState(0);
  const [setupLoading, setSetupLoading] = useState(false);
  const request = useRef(0);
  const alive = useRef(true);
  const mutation = useRef(false);
  const activeView = useRef(active); activeView.current = active;
  const scope = JSON.stringify([entityType, filter, q, offset, focusedId]);
  const currentScope = useRef(scope); currentScope.current = scope;
  const visible = data?.scope === scope ? data : null;
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current += 1; }; }, []);
  const loadBoard = useCallback(async () => {
    if (!alive.current) return;
    const version = ++request.current; setLoading(true);
    const types = entityType === 'all' ? TYPES : [entityType];
    const results = await Promise.allSettled(types.map((type) => getOperations({ countryId, regionId, entityType: type,
      ...(filter === 'attention' ? { attention: true } : {}), ...(filter === 'mine' ? { owner: 'me' } : {}), ...(q ? { q } : {}),
      ...(focusedId ? { id: focusedId, open: false } : {}), limit: 25, offset: entityType === 'all' ? 0 : offset })));
    if (!alive.current || version !== request.current || scope !== currentScope.current) return;
    const failed = types.filter((type, index) => results[index].status === 'rejected');
    const one = results[0];
    if (entityType !== 'all' && one.status === 'fulfilled' && offset > 0 && offset >= (one.value.pagination?.total || 0)) { setOffset(Math.max(0, Math.ceil((one.value.pagination?.total || 0) / 25) - 1) * 25); return; }
    setData((previous) => {
      const byType = {};
      results.forEach((result, index) => {
        const type = types[index];
        if (result.status === 'fulfilled') byType[type] = result.value;
        else if (![401, 403].includes(result.reason?.response?.status) && previous?.scope === scope) byType[type] = previous.byType[type];
      });
      return { scope, byType };
    });
    setError(failed.length ? t('operationsOverview.partial', { types: failed.map((type) => t(`operations.entities.${type}`)).join(', ') }) : ''); setLoading(false);
  }, [countryId, regionId, entityType, filter, q, offset, focusedId, scope, t]);
  useEffect(() => {
    loadBoard();
    const refresh = () => { if (activeView.current && document.visibilityState === 'visible' && !mutation.current) loadBoard(); };
    const timer = setInterval(refresh, 30000); window.addEventListener('online', refresh);
    return () => { request.current += 1; clearInterval(timer); window.removeEventListener('online', refresh); };
  }, [loadBoard]);
  useEffect(() => {
    if (!readinessOpen || !countryId) return undefined;
    let current = true; setReadinessError(''); setSetupLoading(true);
    getFieldReadiness({ countryId, regionId }).then((value) => { if (current) setReadiness(value); })
      .catch((failure) => { if (current) { setReadiness(null); setReadinessError(failure?.response?.data?.error || t('operations.failed')); } })
      .finally(() => { if (current) setSetupLoading(false); });
    return () => { current = false; };
  }, [readinessOpen, countryId, regionId, setupAttempt, t]);
  useEffect(() => {
    if (!catalogOpen) return undefined;
    let current = true; setCatalogError(''); setCatalogLoading(true);
    getOperatingCatalog({ countryId, regionId }).then((value) => { if (current) setCatalog(value); })
      .catch((failure) => { if (current) { if ([401, 403].includes(failure?.response?.status)) setCatalog([]); setCatalogError(failure?.response?.data?.error || t('operations.failed')); } })
      .finally(() => { if (current) setCatalogLoading(false); });
    return () => { current = false; };
  }, [catalogOpen, countryId, regionId, setupAttempt, t]);
  async function loadAgents() {
    if (agentsLoading) return; setAgentsLoading(true); setAgentsError(false);
    try { const result = await getAssignableAgents({ countryId, regionId }); if (alive.current) { setAgents(result); setAgentsLoaded(true); } }
    catch (_failure) { if (alive.current) setAgentsError(true); }
    finally { if (alive.current) setAgentsLoading(false); }
  }
  async function configure(item, mode) {
    if (mutation.current) return; mutation.current = true; request.current += 1; setBusy(true); setMessage('');
    const targetScope = scope;
    try {
      const payload = { ...(mode ? { mode } : {}), ownerUserId: user.id };
      if (item.entityType === 'service') await updateCoordination(item.id, payload);
      else await updateCoordination(item.id, payload, item.entityType);
      if (alive.current && currentScope.current === targetScope) { setMessage(t(mode ? 'coordinationWorkspace.searchSaved' : 'coordinationWorkspace.ownershipSaved')); await loadBoard(); }
    } catch (failure) { if (alive.current && currentScope.current === targetScope) setError(failure?.response?.data?.error || t('operations.failed')); }
    finally { mutation.current = false; if (alive.current) setBusy(false); }
  }
  const entries = Object.entries(visible?.byType || {}).filter(([, value]) => value);
  const items = entries.flatMap(([type, value]) => (value.items || []).map((item) => ({ ...item, entityType: type }))).sort(orderRows);
  const total = entries.reduce((sum, [, value]) => sum + (value.pagination?.total || 0), 0);
  const date = (value) => value ? new Date(value).toLocaleString(i18n.language) : t('operations.toDefine');
  const Container = embedded ? 'section' : 'main';
  function selectType(value) { setEntityType(value); setOffset(0); setAssignment(null); }
  return <Container className={embedded ? 'space-y-5' : 'mx-auto max-w-6xl space-y-5 px-4 py-6'}>
    {!embedded && <header><h1 className="app-page-headline">{t('operations.title')}</h1><p className="mt-2 text-sm text-text-secondary">{t('operations.subtitle')}</p></header>}
    <section aria-label={t('operations.queue')} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{t('operations.queue')}</h2><button type="button" onClick={loadBoard} disabled={busy || loading} className="btn-secondary min-h-11 rounded-xl px-4 text-sm">{t('operations.refresh')}</button></div>
      {!focusedId && <nav aria-label={t('coordinationWorkspace.views')} className="flex flex-wrap gap-2">{['all', 'attention', 'mine'].map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => { setFilter(value); setOffset(0); }} className={`min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold ${value === filter ? 'border-blue-600 bg-blue-600 text-white' : 'border-border bg-surface-card'}`}>{t(`coordinationWorkspace.viewsLabel.${value}`)}</button>)}</nav>}
      {!focusedId && <form onSubmit={(event) => { event.preventDefault(); setQ(query.trim()); setOffset(0); }} className="grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-2"><div><label htmlFor="operation-search" className="text-sm">{t('coordinationWorkspace.search')}</label><div className="mt-1 flex gap-2"><input id="operation-search" value={query} maxLength={100} onChange={(event) => setQuery(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface-main px-3" /><button type="submit" className="btn-secondary min-h-11 rounded-xl px-3 text-sm">{t('requestWorkspace.find')}</button></div></div><label htmlFor="operation-type" className="text-sm">{t('operations.entityType')}<select id="operation-type" value={entityType} onChange={(event) => selectType(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-surface-main px-3"><option value="all">{t('operationsOverview.all')}</option>{TYPES.map((type) => <option key={type} value={type}>{t(`operations.entities.${type}`)}</option>)}</select></label></form>}
      {entityType === 'all' && <div className="flex flex-wrap gap-2">{entries.map(([type, value]) => <button key={type} type="button" onClick={() => selectType(type)} className="btn-secondary min-h-11 rounded-xl px-4 text-sm">{t(`operations.entities.${type}`)} ({value.pagination?.total || 0})</button>)}<p className="w-full text-xs text-text-secondary">{t('operationsOverview.limit')}</p></div>}
      {message && <p role="status" className="app-alert app-alert-success">{message}</p>}{error && <p role="alert" className="app-alert app-alert-error">{error}</p>}{loading && <p role="status">{t('operations.loading')}</p>}
      {!loading && !error && !items.length && <p className="rounded-2xl border border-dashed border-border p-6 text-sm">{t(q || filter !== 'all' ? 'coordinationWorkspace.emptyFiltered' : 'operations.empty')}</p>}
      <div className="grid gap-4 lg:grid-cols-2">{items.map((item) => {
        const type = item.entityType; const key = `${type}:${item.id}`;
        const terminal = type === 'service' ? ['VALIDATED', 'CLOSED', 'CANCELLED_BY_CLIENT', 'NO_EXECUTOR_FOUND', 'RESOLVED_REFUND', 'RESOLVED_REDO', 'RESOLVED_CLOSED'].includes(item.missionStatus) || (!item.missionStatus && item.status === 'validated') : ['validated', 'cancelled', 'delivered', 'fulfilled', 'refunded'].includes(item.status);
        const classic = type === 'service' && !item.missionStatus && item.executionType !== 'provider';
        const canAssign = !terminal && (type !== 'service' || (classic && item.status === 'created'));
        const canStart = !terminal && (type === 'service' ? ['CREATED', 'SEARCHING_EXECUTOR'].includes(item.missionStatus) || (!item.missionStatus && item.status === 'created' && !item.agentId) : item.status === 'created' && !item.agentId && !item.coordination?.executorUserId);
        const path = type === 'service' ? getRequestDetailPath(item, undefined, 'admin') : `/${type === 'project' ? 'projects' : 'orders'}/${item.id}`;
        const agent = item.agent || item.coordination?.executor;
        const executorId = item.coordination?.executorUserId || item.agentId;
        const executor = type === 'service' && item.executionType === 'provider'
          ? item.provider?.displayFirstName || (item.providerId ? t('coordinationWorkspace.currentProvider', { id: item.providerId }) : t('operations.toDefine'))
          : [agent?.firstName, agent?.lastName].filter(Boolean).join(' ') || (executorId ? t('coordinationWorkspace.currentAgent', { id: executorId }) : t('operations.toDefine'));
        return <article key={key} aria-labelledby={`operation-${type}-${item.id}`} className={`space-y-3 rounded-2xl border bg-surface-card p-4 ${item.coordination?.state === 'escalated' ? 'border-amber-500/40' : 'border-border'}`}>
          <p className="text-xs font-semibold text-text-secondary">{t(`operations.entities.${type}`)} · #{item.id}</p><h3 id={`operation-${type}-${item.id}`} className="break-words font-semibold"><Link to={path} className="underline">{item.title || `#${item.id}`}</Link></h3>
          <p className="text-sm text-text-secondary">{[item.country?.name, item.region?.name, item.tradeCategory?.name].filter(Boolean).join(' · ')}</p>
          <p className="text-sm font-semibold">{t(`operations.states.${item.coordination?.state || 'waiting'}`)}</p>
          {item.coordination?.reason && <p className="text-sm text-amber-800 dark:text-amber-200">{t(`operations.reasons.${item.coordination.reason}`, { defaultValue: item.coordination.reason })}</p>}
          <p className="text-sm">{t('operations.owner')}: {[item.coordination?.owner?.firstName, item.coordination?.owner?.lastName].filter(Boolean).join(' ') || item.coordination?.owner?.email || t('operations.toDefine')}</p>
          <p className="text-sm">{t('operations.executor')}: {executor}</p>
          <p className="text-sm">{t('operations.nextAction')}: {date(item.coordination?.nextActionAt)}</p>
          <div className="flex flex-wrap gap-2"><Link to={path} className="btn-primary inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold">{t('coordinationWorkspace.openCase')}</Link>{!terminal && String(item.coordination?.ownerUserId || item.coordination?.owner?.id) !== String(user?.id) && <button type="button" disabled={busy} onClick={() => configure(item)} className="btn-secondary min-h-11 rounded-xl px-4 text-sm">{t('operations.takeOwnership')}</button>}</div>
          {!terminal && <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">{t('coordinationWorkspace.assignmentOptions')}</summary><p className="mb-3 text-xs text-text-secondary">{t('coordinationWorkspace.modeHint')} {t(item.coordination?.mode === 'automatic' ? 'coordinationWorkspace.automatic' : 'coordinationWorkspace.manual')}</p><div className="flex flex-wrap gap-2">{canStart && <button type="button" disabled={busy} onClick={() => configure(item, 'automatic')} className="btn-secondary min-h-11 rounded-xl px-4 text-sm">{t('operations.startAutomatic')}</button>}{canAssign ? <button type="button" onClick={() => { setAssignment(assignment === key ? null : key); if (!agentsLoaded) loadAgents(); }} className="btn-secondary min-h-11 rounded-xl px-4 text-sm">{t(type === 'service' ? 'operations.assignManually' : 'operationsCenter.adjustAssignment')}</button> : <Link to={path} className="btn-secondary inline-flex min-h-11 items-center rounded-xl px-4 text-sm">{t('operations.assignManually')}</Link>}</div>{assignment === key && canAssign && <AssignmentSettings item={item} agents={agents} agentsError={agentsError} agentsLoading={agentsLoading} onRetryAgents={loadAgents} onSaved={loadBoard} />}</details>}
        </article>;
      })}</div>
      {entityType !== 'all' && total > 25 && <PaginationBar page={offset / 25 + 1} pageSize={25} totalItems={total} onPageChange={(page) => setOffset((page - 1) * 25)} showPageSize={false} />}
    </section>
    <details open={readinessOpen} onToggle={(event) => setReadinessOpen(event.currentTarget.open)} className="rounded-2xl border border-border p-4"><summary className="cursor-pointer font-semibold">{t('operations.readiness')}</summary>{!countryId && <p className="mt-3 text-sm">{t('operations.selectCountry')}</p>}{setupLoading && <p role="status" className="mt-3 text-sm">{t('operations.loading')}</p>}{readinessError && <p role="alert">{readinessError} <button type="button" onClick={() => setSetupAttempt((value) => value + 1)} className="underline">{t('serviceOrders.retry')}</button></p>}{readiness && <div className="mt-3 space-y-3 text-sm"><p className="font-semibold">{t(readiness.ready ? 'operations.configurationReady' : 'operations.configurationIncomplete')}</p>{readiness.automation && <p>{t('operations.automationCoverage', { enabled: readiness.automation.enabledOffers, total: readiness.activeOffers, agents: readiness.automation.availableAgents })}</p>}<ul className="list-disc pl-5">{(readiness.issues || []).map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.message}</li>)}</ul><p className="text-text-secondary">{t('operations.fieldChecksRemain')}</p></div>}</details>
    <details open={catalogOpen} onToggle={(event) => setCatalogOpen(event.currentTarget.open)} className="rounded-2xl border border-border p-4"><summary className="cursor-pointer font-semibold">{t('operations.catalog')}</summary>{catalogOpen && catalogLoading && <p role="status" className="mt-3 text-sm">{t('operations.loading')}</p>}{catalogError && <p role="alert">{catalogError} <button type="button" onClick={() => setSetupAttempt((value) => value + 1)} className="underline">{t('serviceOrders.retry')}</button></p>}{catalog.length > 0 && <section hidden={!catalogOpen} aria-label={t('operations.catalog')} className="mt-4 grid gap-4 lg:grid-cols-2">{catalog.map((entry) => renderOffer(entry, () => setSetupAttempt((value) => value + 1), user))}</section>}</details>
  </Container>;
}
