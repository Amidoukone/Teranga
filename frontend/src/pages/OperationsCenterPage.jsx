import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCheck, Inbox, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { useGeo } from '../contexts/GeoContext';
import { getLocalUser } from '../services/auth';
import { normalizeRole } from '../utils/roles';
import { getNotificationSummary, markAllNotificationsRead, markNotificationRead } from '../services/notifications';
import { cleanupOperationUpdates, getOperationUpdates, removeOperationUpdate } from '../services/operationUpdates';
import { resolveNotificationLink } from '../utils/notificationLink';
import { confirmAction } from '../utils/confirm';
import { notify } from '../utils/notify';
import { useLocale } from '../i18n/useLocale';
import { formatStatus } from '../utils/labels';
import PaginationBar from '../components/PaginationBar';
import OperationsPage from './OperationsPage';
import WorkspaceQueue from '../features/mission-tracking/WorkspaceQueue';

const refreshUpdates = () => window.dispatchEvent(new Event('notifications:refresh'));
const unauthorized = (error) => [401, 403].includes(error?.response?.status);

function Updates({ view, userId, role, onUnread }) {
  const { t } = useTranslation();
  const { formatDate } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const [filters, setFilters] = useState({ entityType: '', progress: '', action: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  const abort = useRef(null);
  const mutation = useRef(false);
  const owner = useRef(userId);
  owner.current = userId;
  const invalidDates = filters.from && filters.to && filters.from > filters.to;
  const scope = JSON.stringify([userId, view, filters, page]);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const visible = data?.scope === scope ? data : null;

  const load = useCallback(async () => {
    const epoch = ++request.current;
    abort.current?.abort();
    if (invalidDates) { setLoading(false); return; }
    const controller = new AbortController();
    abort.current = controller;
    setLoading(true);
    try {
      const params = { page, limit: 15, status: view === 'unread' ? 'unread' : 'all' };
      if (filters.entityType) params.entityType = filters.entityType;
      if (filters.action) params.action = filters.action;
      if (filters.progress) params.progress = filters.progress;
      if (filters.from) params.from = new Date(`${filters.from}T00:00:00`).toISOString();
      if (filters.to) params.to = new Date(`${filters.to}T23:59:59.999`).toISOString();
      const result = await getOperationUpdates(params, controller.signal);
      if (request.current !== epoch || scopeRef.current !== scope) return;
      if (page > 1 && !result.items?.length && result.pagination?.total < (page - 1) * 15 + 1) { setPage(Math.max(1, Math.ceil(result.pagination.total / 15))); return; }
      setData({ ...result, scope }); setError(''); onUnread(result.summary?.unread || 0);
    } catch (failure) {
      if (request.current !== epoch || controller.signal.aborted || scopeRef.current !== scope) return;
      if (unauthorized(failure)) setData(null);
      setError(t(unauthorized(failure) ? 'operationsCenter.accessChanged' : 'operationsCenter.loadFailed'));
    } finally { if (request.current === epoch && scopeRef.current === scope) setLoading(false); }
  }, [filters, invalidDates, onUnread, page, scope, t, view]);

  useEffect(() => {
    load();
    const refresh = () => load();
    const poll = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 60000);
    window.addEventListener('online', refresh);
    window.addEventListener('notifications:refresh', refresh);
    return () => { request.current += 1; abort.current?.abort(); clearInterval(poll); window.removeEventListener('online', refresh); window.removeEventListener('notifications:refresh', refresh); };
  }, [load]);

  function changeFilter(field, value) { setPage(1); setFilters((previous) => ({ ...previous, [field]: value })); }
  async function act(action) {
    if (mutation.current) return;
    mutation.current = true; setBusy(true);
    const account = userId;
    try {
      await action();
      if (owner.current === account) { setError(''); refreshUpdates(); }
    } catch (failure) {
      if (owner.current === account) {
        setError(failure?.response?.data?.error || t('operationsCenter.actionFailed'));
        if (failure?.response?.status === 409) load();
      }
    } finally { mutation.current = false; if (owner.current === account) setBusy(false); }
  }
  function open(item) {
    if (item.notificationId && item.status === 'unread') {
      markNotificationRead(item.notificationId, item.version).then(refreshUpdates).catch(() => {
        notify(t('operationsCenter.readFailed'), { type: 'info' });
      });
    }
    navigate(resolveNotificationLink(item, role), { state: { from: location.pathname + location.search, ...(item.metadata?.serviceId ? { serviceId: item.metadata.serviceId } : {}) } });
  }
  async function remove(item) {
    if (!await confirmAction({ message: t('operationsCenter.removeConfirm'), danger: true })) return;
    return act(() => removeOperationUpdate(item));
  }
  async function cleanup() {
    if (!await confirmAction({ message: t('operationsCenter.cleanupConfirm'), danger: true })) return;
    return act(cleanupOperationUpdates);
  }
  const items = visible?.items || [];
  const unread = visible?.summary?.unread || 0;
  const filtered = Object.values(filters).some(Boolean);

  return <section aria-label={t('operationsCenter.personalUpdates')} className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-semibold">{t(view === 'unread' ? 'operationsCenter.unread' : 'operationsCenter.history')}</h2><p className="mt-1 text-sm text-text-secondary">{t('operationsCenter.feedHint')}</p></div>
      <button type="button" onClick={load} disabled={loading} className="btn-secondary inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2"><RefreshCw size={17} aria-hidden="true" />{t('operations.refresh')}</button>
    </div>
    <details className="rounded-2xl border border-border bg-surface-card p-4">
      <summary className="cursor-pointer text-sm font-semibold"><SlidersHorizontal size={16} className="mr-2 inline" aria-hidden="true" />{t('operationsCenter.filters')}{filtered ? ` · ${t('operationsCenter.filtersActive')}` : ''}</summary>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">{t('operationsCenter.type')}<select value={filters.entityType} onChange={(event) => changeFilter('entityType', event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-surface-main p-2"><option value="">{t('operationsOverview.all')}</option>{['service', 'project', 'order', 'task', 'evidence', 'user'].map((type) => <option key={type} value={type}>{t(`operationsCenter.entities.${type}`)}</option>)}</select></label>
        <label className="text-sm">{t('operationsCenter.event')}<select value={filters.action} onChange={(event) => changeFilter('action', event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-surface-main p-2"><option value="">{t('operationsOverview.all')}</option>{['created', 'assigned', 'status_updated'].map((action) => <option key={action} value={action}>{t(`activities.actions.${action}`)}</option>)}</select></label>
        <label className="text-sm">{t('operationsCenter.progress')}<select value={filters.progress} onChange={(event) => changeFilter('progress', event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-surface-main p-2"><option value="">{t('operationsOverview.all')}</option>{['new', 'in_progress', 'done'].map((progress) => <option key={progress} value={progress}>{t(`activities.tabs.${progress === 'in_progress' ? 'inProgress' : progress}`)}</option>)}</select></label>
        <label className="text-sm">{t('operationsCenter.from')}<input type="date" value={filters.from} onChange={(event) => changeFilter('from', event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-surface-main p-2" /></label>
        <label className="text-sm">{t('operationsCenter.to')}<input type="date" value={filters.to} onChange={(event) => changeFilter('to', event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-surface-main p-2" /></label>
      </div>
      <button type="button" onClick={() => { setFilters({ entityType: '', progress: '', action: '', from: '', to: '' }); setPage(1); }} className="mt-3 min-h-11 text-sm underline">{t('operationsCenter.clearFilters')}</button>
    </details>
    {invalidDates && <p role="alert" className="app-alert app-alert-error">{t('activities.validation.invalidDateRange')}</p>}
    {error && <p role="alert" className="app-alert app-alert-error">{error}</p>}
    {loading && <p role="status" className="text-sm text-text-secondary">{t('operations.loading')}</p>}
    {!loading && !error && !invalidDates && !items.length && <div className="rounded-2xl border border-dashed border-border p-8 text-center"><Inbox size={28} className="mx-auto mb-3 text-text-muted" aria-hidden="true" /><h3 className="font-semibold">{t(filtered ? 'operationsCenter.noMatches' : view === 'unread' ? 'operationsCenter.upToDate' : 'operationsCenter.noHistory')}</h3><p className="mt-2 text-sm text-text-secondary">{t(filtered ? 'operationsCenter.filterHint' : 'operationsCenter.emptyHint')}</p></div>}
    <div className="space-y-3">{items.map((item) => <article key={item.key} aria-labelledby={`update-${item.key}`} className={`app-list-card rounded-2xl border p-4 sm:p-5 ${item.status === 'unread' ? 'border-blue-500/40 bg-blue-500/5' : 'border-border bg-surface-card'}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary"><span>{t(`operationsCenter.entities.${item.entityType}`, { defaultValue: t('operationsCenter.information') })}{item.entityId ? ` #${item.entityId}` : ''}</span><span aria-hidden="true">·</span><time dateTime={item.occurredAt}>{formatDate(item.occurredAt)}</time>{item.status === 'unread' && <span className="rounded-full bg-blue-600 px-2.5 py-1 font-semibold text-white">{t('operationsCenter.toRead')}</span>}</div>
      <h3 id={`update-${item.key}`} className="mt-3 break-words text-base font-semibold">{item.title || item.metadata?.title || t('operationsCenter.information')}</h3>
      {item.message && item.message !== item.title && <p className="mt-2 whitespace-pre-line break-words text-sm text-text-secondary">{item.message}</p>}
      {item.entityStatus && <p className="mt-2 text-sm text-text-secondary">{item.metadata?.missionStatus ? t(`missionTracking.status.${item.metadata.missionStatus}`, { defaultValue: formatStatus(item.entityStatus, item.entityType) }) : formatStatus(item.entityStatus, item.entityType)}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => open(item)} className="app-btn-primary min-h-11">{t(item.metadata?.coordinationState && role === 'admin' ? 'operationsCenter.examine' : `operationsCenter.open.${item.entityType}`, { defaultValue: t('operationsCenter.open.default') })}</button>
        {item.notificationId && item.status === 'unread' && <button type="button" disabled={busy} onClick={() => act(() => markNotificationRead(item.notificationId, item.version))} className="app-btn-soft min-h-11">{t('operationsCenter.markRead')}</button>}
        <details className="ml-auto text-sm"><summary className="min-h-11 cursor-pointer py-3">{t('operationsCenter.more')}</summary><button type="button" disabled={busy} onClick={() => remove(item)} className="min-h-11 text-red-700 underline dark:text-red-300">{t('operationsCenter.remove')}</button></details>
      </div>
    </article>)}</div>
    {visible && <PaginationBar page={page} pageSize={15} totalItems={visible.pagination?.total || 0} onPageChange={setPage} showPageSize={false} />}
    <details className="rounded-2xl border border-border bg-surface-card p-4"><summary className="cursor-pointer text-sm font-semibold">{t('operationsCenter.manageReading')}</summary><p className="mt-3 text-sm text-text-secondary">{t('operationsCenter.readingHint')}</p><div className="mt-3 flex flex-wrap gap-3">
      <button type="button" disabled={busy || !unread} onClick={() => act(markAllNotificationsRead)} className="btn-secondary inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2"><CheckCheck size={17} aria-hidden="true" />{t('operationsCenter.markAllRead')}</button>
      <button type="button" disabled={busy} onClick={cleanup} className="btn-secondary min-h-11 rounded-xl px-4 py-2">{t('operationsCenter.cleanup')}</button>
    </div></details>
  </section>;
}

export default function OperationsCenterPage() {
  const geo = useGeo();
  const user = geo.user || getLocalUser();
  return <Center key={JSON.stringify([user?.id,user?.role,geo.countryId,geo.regionId])} user={user} />;
}

function Center({ user }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const role = normalizeRole(user?.role);
  const admin = role === 'admin';
  const [params,setParams] = useSearchParams();
  const requested = params.get('vue');
  const information = ['informations','a-lire','historique'].includes(requested);
  const coordination = admin && requested === 'coordonner';
  const view = information ? 'information' : requested === 'a-suivre' ? 'following' : 'action';
  const reading = requested === 'historique' ? 'history' : requested === 'a-lire' ? 'unread' : params.get('lecture') === 'tout' ? 'history' : 'unread';
  const [summary,setSummary] = useState(null);
  const [coordinationVisited,setCoordinationVisited] = useState(coordination);
  const [workVisited,setWorkVisited] = useState(!information && !coordination);
  const [lastWorkView,setLastWorkView] = useState(view === 'following' ? 'following' : 'action');
  const type = ['service','project','order'].includes(params.get('type')) ? params.get('type') : 'all';
  const focusedId = /^[1-9][0-9]*$/.test(params.get('demande') || '') ? params.get('demande') : null;
  const [boardTarget,setBoardTarget] = useState({type,focusedId});
  useEffect(() => { if (coordination) { setCoordinationVisited(true); setBoardTarget({type,focusedId}); } },[coordination,type,focusedId]);
  useEffect(() => { if (!information && !coordination) { setWorkVisited(true); setLastWorkView(view); } },[information,coordination,view]);
  useEffect(() => {
    if (!coordination) return undefined;
    const frame = window.requestAnimationFrame(()=>{const section=document.getElementById('workspace-coordination');section?.focus({preventScroll:true});section?.scrollIntoView?.({block:'start'});});
    return ()=>window.cancelAnimationFrame(frame);
  },[coordination,type,focusedId]);
  const onSummary = useCallback((value)=>setSummary(value),[]);
  const onUnread = useCallback((unread)=>setSummary((current)=>({...current,unread})),[]);
  useEffect(() => {
    if (!coordination) return undefined;
    let current = true;
    const load = () => getNotificationSummary({force:true}).then((value)=>{if(current)onUnread(value.unread || 0);}).catch(()=>{});
    load(); const timer = setInterval(()=>{if(document.visibilityState === 'visible')load();},60000);
    window.addEventListener('notifications:refresh',load);
    return ()=>{current=false;clearInterval(timer);window.removeEventListener('notifications:refresh',load);};
  },[coordination,onUnread]);
  function select(next) {
    const value = new URLSearchParams(params);
    value.set('vue',next === 'information' ? 'informations' : next === 'following' ? 'a-suivre' : 'a-faire');
    value.delete('page'); value.delete('type'); value.delete('demande'); setParams(value);
  }
  function openTools() {
    const value = new URLSearchParams(params); value.set('vue','coordonner');
    if(boardTarget.type !== 'all')value.set('type',boardTarget.type);
    if(boardTarget.focusedId)value.set('demande',boardTarget.focusedId);
    setParams(value);
  }
  function back() {
    let target = '/operations?vue=a-faire';
    try {
      const value = new URL(location.state?.from,window.location.origin);
      if(value.origin === window.location.origin && value.pathname === '/operations' && value.searchParams.get('vue') !== 'coordonner') target=value.pathname+value.search;
    } catch (_error) { /* Retour vers la file par défaut. */ }
    navigate(target);
  }
  const target = coordination ? {type,focusedId} : boardTarget;
  return <div className="app-page-wrap"><div className="app-page-shell max-w-6xl space-y-6">
    <header><p className="page-kicker">{t('operationsCenter.kicker')}</p><h1 className="app-page-headline">{t('operations.title')}</h1><p className="mt-2 max-w-2xl text-text-secondary">{t('workspaceQueue.hint')}</p></header>
    <nav aria-label={t('operationsCenter.views')} className="flex flex-wrap gap-2">{['action','following','information'].map((key)=>{
      const count = key === 'information' ? summary?.unread : summary?.[key];
      return <button key={key} type="button" aria-current={view === key ? 'page' : undefined} onClick={()=>select(key)} className={`min-h-12 rounded-xl border px-4 py-2 text-sm font-semibold ${view === key ? 'border-blue-600 bg-blue-600 text-white' : 'border-border bg-surface-card text-text-primary'}`}>{t(`workspaceQueue.${key}`)}{Number.isFinite(count) ? ` (${count})` : ''}</button>;
    })}</nav>
    {(workVisited || (!information && !coordination)) && <div hidden={information || coordination}><WorkspaceQueue view={!information && !coordination ? view : lastWorkView} active={!information && !coordination} onSummary={onSummary} /></div>}
    {information && <section className="space-y-4"><nav aria-label={t('workspaceQueue.reading')} className="flex flex-wrap gap-3">{['unread','history'].map((key)=><button key={key} type="button" aria-pressed={reading === key} onClick={()=>{const value=new URLSearchParams(params);value.set('vue','informations');if(key==='history')value.set('lecture','tout');else value.delete('lecture');setParams(value);}} className="btn-secondary min-h-11 rounded-xl px-4 text-sm">{t(`operationsCenter.${key}`)}</button>)}</nav><Updates key={user?.id} userId={user?.id} role={role} view={reading} onUnread={onUnread} /></section>}
    {admin && !coordination && <button type="button" onClick={openTools} className="min-h-11 text-sm underline">{t('workspaceQueue.coordinationTools')}</button>}
    {admin && (coordination || coordinationVisited) && <section id="workspace-coordination" tabIndex={-1} hidden={!coordination} aria-label={t('operationsCenter.coordination')} className="scroll-mt-24 space-y-4">
      <button type="button" onClick={back} className="min-h-11 text-sm underline">{t('workspaceQueue.back')}</button>
      {target.focusedId && <p className="rounded-xl border border-blue-500/30 p-3 text-sm">{t('operationsCenter.focused',{id:target.focusedId})}</p>}
      <OperationsPage key={`${user?.id}:${target.type}:${target.focusedId}`} embedded active={coordination} initialEntityType={target.type} focusedId={target.focusedId} />
    </section>}
  </div></div>;
}
