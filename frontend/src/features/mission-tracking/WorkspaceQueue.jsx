import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGeo } from '../../contexts/GeoContext';
import { getWorkspace } from '../../services/operations';
import { getLocalUser } from '../../services/auth';
import { getRequestDetailPath } from '../../utils/requestLifecycle';
import { useLocale } from '../../i18n/useLocale';
import PaginationBar from '../../components/PaginationBar';

export function workspaceTarget(item, role, action = item.action) {
  if (action?.kind === 'task') return item.kind === 'service' ? `/services/${item.id}/tasks?etape=${action.id}#steps` : `/tasks/${action.id}`;
  if (item.kind === 'task') return `/tasks/${item.id}`;
  if (action?.code === 'coordinate') return `/operations?vue=coordonner&type=${item.kind}&demande=${item.id}`;
  if (action?.code === 'resolve') return `/admin/disputes?serviceId=${item.id}`;
  if (item.kind === 'project') return `/projects/${item.id}`;
  if (item.kind === 'order') return `/orders/${item.id}`;
  return getRequestDetailPath({ ...item, tradeCategory: item.slug ? { slug:item.slug } : undefined }, undefined, role);
}

export default function WorkspaceQueue({ view, active = true, onSummary }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const formatDeadline = locale.formatDateTime || locale.formatDate;
  const { user: geoUser, countryId, regionId } = useGeo();
  const user = geoUser || getLocalUser();
  const [params,setParams] = useSearchParams();
  const location = useLocation();
  const q = (params.get('q') || '').slice(0,100);
  const kind = ['service','project','order','task'].includes(params.get('famille')) ? params.get('famille') : 'all';
  const rawPage = Number(params.get('page'));
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 100000 ? rawPage : 1;
  const [query,setQuery] = useState(q);
  const [data,setData] = useState(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const generation = useRef(0);
  const alive = useRef(true);
  const scope = JSON.stringify([user?.id,user?.role,countryId,regionId,view,q,kind,page]);
  const currentScope = useRef(scope); currentScope.current = scope;
  const activeRef = useRef(active); activeRef.current = active;
  const visible = data?.scope === scope ? data.value : null;
  useEffect(() => setQuery(q),[q]);
  const update = useCallback((values) => {
    const next = new URLSearchParams(params);
    Object.entries(values).forEach(([key,value]) => { if (value === null || value === '' || value === 'all' || (key === 'page' && value === 1)) next.delete(key); else next.set(key,String(value)); });
    setParams(next);
  },[params,setParams]);
  const load = useCallback(async () => {
    if (!alive.current || !activeRef.current) return;
    const version = ++generation.current; setLoading(true);
    try {
      const territory = user?.role === 'admin' ? { countryId,regionId } : {};
      const result = await getWorkspace({ view,q,kind,page,limit:20,...territory });
      if (!alive.current || version !== generation.current || currentScope.current !== scope) return;
      if (page > 1 && (page-1)*20 >= result.pagination.total) { update({page:Math.max(1,Math.ceil(result.pagination.total/20))}); return; }
      setData({scope,value:result}); setError(''); onSummary(result.summary);
    } catch (failure) {
      if (alive.current && version === generation.current && currentScope.current === scope) {
        if ([401,403].includes(failure?.response?.status)) { setData(null); onSummary(null); }
        setError(failure?.response?.data?.error || t('workspaceQueue.failed'));
      }
    } finally { if (alive.current && version === generation.current) setLoading(false); }
  },[view,q,kind,page,scope,update,onSummary,t,user?.role,countryId,regionId]);
  useEffect(() => {
    alive.current = true;
    if (active) load();
    const refresh = () => { if (activeRef.current && document.visibilityState === 'visible') load(); };
    const timer = setInterval(refresh,30000); window.addEventListener('online',refresh);
    return () => { alive.current = false; generation.current += 1; clearInterval(timer); window.removeEventListener('online',refresh); };
  },[load,active]);
  const from = location.pathname + location.search;
  return <section aria-label={t(`workspaceQueue.${view}`)} className="space-y-4">
    <form onSubmit={(event)=>{event.preventDefault();update({q:query.trim(),page:1});}} className="grid gap-3 rounded-2xl border border-border bg-surface-card p-4 sm:grid-cols-[1fr_auto]">
      <div><label htmlFor="workspace-query" className="text-sm">{t('workspaceQueue.search')}</label><div className="mt-1 flex gap-2"><input id="workspace-query" value={query} maxLength={100} onChange={(event)=>setQuery(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface-main px-3" /><button type="submit" className="btn-secondary min-h-11 rounded-xl px-3 text-sm">{t('workspaceQueue.find')}</button></div></div>
      <label htmlFor="workspace-kind" className="text-sm">{t('workspaceQueue.kind')}<select id="workspace-kind" value={kind} onChange={(event)=>update({famille:event.target.value,page:1})} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-surface-main px-3"><option value="all">{t('workspaceQueue.all')}</option>{['service','project','order','task'].map((value)=><option key={value} value={value}>{t(`workspaceQueue.kinds.${value}`)}</option>)}</select></label>
    </form>
    <button type="button" onClick={load} disabled={loading} className="min-h-11 text-sm underline">{t('operations.refresh')}</button>
    {loading && <p role="status" className="text-sm">{t('workspaceQueue.loading')}</p>}
    {error && <p role="alert" className="app-alert app-alert-error">{error} <button type="button" disabled={loading} onClick={load} className="min-h-11 underline">{t('serviceOrders.retry')}</button></p>}
    {!loading && !error && !visible?.items.length && <div className="rounded-2xl border border-dashed border-border p-6"><h2 className="font-semibold">{t(q || kind !== 'all' ? 'workspaceQueue.emptyFiltered' : view === 'action' ? 'workspaceQueue.emptyAction' : 'workspaceQueue.emptyFollowing')}</h2><p className="mt-2 text-sm text-text-secondary">{t('workspaceQueue.emptyHint')}</p></div>}
    <div className="grid gap-4 lg:grid-cols-2">{visible?.items.map((item)=>{
      const path = workspaceTarget(item,user?.role);
      const waiting = String(item.missionStatus || item.status).toUpperCase() === 'COMPLETED' ? (item.kind === 'task' ? 'waitingReview' : 'waitingClient') : item.openStepCount ? 'waitingSteps' : 'waitingTeam';
      return <article key={item.key} aria-labelledby={`workspace-${item.key}`} className={`space-y-3 rounded-2xl border bg-surface-card p-4 ${item.escalated ? 'border-amber-500/50' : 'border-border'}`}>
        <p className="text-xs text-text-secondary">{t(`workspaceQueue.kinds.${item.kind}`)} · #{item.id}</p>
        <h2 id={`workspace-${item.key}`} className="break-words font-semibold"><Link to={workspaceTarget(item,user?.role,null)} state={{from}} className="underline">{item.title}</Link></h2>
        {(item.executor || item.countryName || item.regionName) && <p className="text-sm text-text-secondary">{[item.countryName,item.regionName,item.executor].filter(Boolean).join(' · ')}</p>}
        <p className="text-sm">{t(item.action ? `workspaceQueue.reasons.${item.action.code}` : `workspaceQueue.${waiting}`)}</p>
        {item.openStepCount > 0 && <p className="text-xs text-text-secondary">{t(item.actionStepCount ? 'workspaceQueue.actionSteps' : 'workspaceQueue.steps',{count:item.actionStepCount || item.openStepCount})}</p>}
        {item.deadline && <p className="text-xs text-text-secondary">{t('workspaceQueue.deadline')}: {formatDeadline(item.deadline)}</p>}
        <Link to={path} state={{from}} className={`${item.action ? 'btn-primary' : 'btn-secondary'} inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold`}>{t(item.action ? `workspaceQueue.actions.${item.action.code}` : 'workspaceQueue.open')}</Link>
      </article>;
    })}</div>
    {visible && visible.pagination.total > 20 && <PaginationBar page={page} pageSize={20} totalItems={visible.pagination.total} onPageChange={(value)=>update({page:value})} showPageSize={false} />}
  </section>;
}
