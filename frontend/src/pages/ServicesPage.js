import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Inbox, RefreshCw } from 'lucide-react';
import { useGeo } from '../contexts/GeoContext';
import { getClientRequests } from '../services/clientRequests';
import ClientRequestCard from '../components/ClientRequestCard';
import PaginationBar from '../components/PaginationBar';
import CollectionFilters from '../components/CollectionFilters';

const VIEWS = { 'en-cours': 'active', 'a-verifier': 'review', historique: 'history', toutes: 'all' };
const LIMIT = 20;

export default function ServicesPage() {
  const { user, countryId, regionId } = useGeo();
  return <RequestsList key={JSON.stringify([user?.id, user?.role, countryId, regionId])} />;
}

function RequestsList() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const view = Object.prototype.hasOwnProperty.call(VIEWS, params.get('vue')) ? params.get('vue') : 'en-cours';
  const kind = ['service', 'taxi', 'delivery', 'project', 'order'].includes(params.get('type')) ? params.get('type') : 'all';
  const q = (params.get('q') || '').trim().slice(0, 200);
  const rawPage = Number(params.get('page') || 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 100000 ? rawPage : 1;
  const scope = JSON.stringify([view, kind, q, page]);
  const [query, setQuery] = useState(q);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const abort = useRef(null);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const visible = data?.scope === scope ? data : null;
  function change(values) {
    const next = new URLSearchParams(params);
    next.delete('page');
    Object.entries(values).forEach(([key, value]) => value ? next.set(key, String(value)) : next.delete(key));
    setParams(next);
  }
  useEffect(() => setQuery(q), [q]);
  const load = useCallback(async () => {
    const version = ++generation.current;
    abort.current?.abort();
    const controller = new AbortController(); abort.current = controller;
    setLoading(true);
    try {
      const result = await getClientRequests({ view: VIEWS[view], kind, ...(q ? { q } : {}), limit: LIMIT, page }, { signal: controller.signal });
      if (version !== generation.current || currentScope.current !== scope) return;
      const total = result.pagination?.total ?? result.items?.length ?? 0;
      if (page > 1 && (page - 1) * LIMIT >= total) {
        setParams((previous) => { const next = new URLSearchParams(previous); next.set('page', String(Math.max(1, Math.ceil(total / LIMIT)))); return next; }, { replace: true });
        return;
      }
      setData({ scope, items: result.items || [], total }); setError('');
    } catch (failure) {
      if (version !== generation.current || controller.signal.aborted || currentScope.current !== scope) return;
      if ([401, 403].includes(failure?.response?.status)) setData(null);
      setError(t('serviceOrders.loadError'));
    } finally { if (version === generation.current && currentScope.current === scope) setLoading(false); }
  }, [view, kind, q, page, scope, setParams, t]);
  useEffect(() => {
    load();
    const refresh = () => { if (document.visibilityState === 'visible' && navigator.onLine !== false) load(); };
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh);
    return () => { generation.current += 1; abort.current?.abort(); clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); };
  }, [load]);
  const filtered = kind !== 'all' || Boolean(q);
  return <div className="app-page-wrap role-workspace"><div className="app-page-shell max-w-5xl space-y-4">
    <header><h1 className="app-page-headline">{t('serviceOrders.title')}</h1><p className="mt-2 max-w-2xl text-sm text-text-secondary">{t('roleViews.clientHint')}</p></header>
    <nav aria-label={t('unifiedRequests.create')} className="flex flex-wrap gap-3"><Link to="/demandes/nouvelle" className="btn-primary inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold">{t('unifiedRequests.service')}</Link><Link to="/projects?nouveau=1" state={{ from: location.pathname + location.search }} className="btn-secondary inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold">{t('projectSimple.new')}</Link><Link to="/orders?nouveau=1" state={{ from: location.pathname + location.search }} className="btn-secondary inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold">{t('orders.buttons.newOrder')}</Link></nav>
    <nav aria-label={t('requestWorkspace.views')} className="role-view-tabs grid grid-cols-4 gap-2">{['en-cours', 'a-verifier', 'historique', 'toutes'].map((value) => <button key={value} type="button" aria-current={view === value ? 'page' : undefined} onClick={() => change({ vue: value })} className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold ${view === value ? 'border-blue-600 bg-blue-600 text-white' : 'border-border bg-surface-card'}`}>{t(`requestWorkspace.viewsLabel.${value}`)}</button>)}</nav>
    <CollectionFilters id="requests" query={query} onQueryChange={setQuery} onSubmit={() => change({ q: query.trim().slice(0, 200) })} kind={kind} onKindChange={value => change({ type: value === 'all' ? null : value })} searchLabel={t('requestWorkspace.search')} findLabel={t('requestWorkspace.find')} placeholder={t('roleViews.search')} hint={t('requestWorkspace.searchHint')} kindLabel={t('operationsCenter.type')} options={['all', 'service', 'taxi', 'delivery', 'project', 'order'].map(value => ({ value, label: t(['project', 'order'].includes(value) ? `unifiedRequests.kind.${value}` : `serviceOrders.filters.${value}`) }))} />
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><p aria-live="polite">{visible ? t('requestWorkspace.results', { count: visible.total }) : loading ? t('serviceOrders.loading') : ''}</p><div className="flex flex-wrap gap-3">{filtered && <button type="button" onClick={() => { setQuery(''); change({ type: null, q: null }); }} className="min-h-11 underline">{t('operationsCenter.clearFilters')}</button>}<button type="button" onClick={load} disabled={loading} className="btn-secondary inline-flex min-h-11 items-center gap-2 rounded-xl px-3"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />{t('serviceOrders.refresh')}</button></div></div>
    {error && <div role="alert" className="app-alert app-alert-error">{error} <button type="button" onClick={load} className="underline">{t('serviceOrders.retry')}</button></div>}
    {loading && <p role="status" className="text-sm text-text-secondary">{t('serviceOrders.loading')}</p>}
    {view === 'a-verifier' && <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">{t('clientHome.reviewHint')}</p>}
    {!loading && !error && visible && !visible.items.length && <div className="rounded-2xl border border-dashed border-border p-8 text-center"><Inbox size={28} className="mx-auto mb-3 text-text-muted" aria-hidden="true" /><h2 className="font-semibold">{t(filtered ? 'operationsCenter.noMatches' : `requestWorkspace.empty.${view}`)}</h2><p className="mt-2 text-sm text-text-secondary">{t(filtered ? 'operationsCenter.filterHint' : 'requestWorkspace.emptyHint')}</p></div>}
    {visible && <><div className="grid gap-3 sm:grid-cols-2">{visible.items.map((item) => <ClientRequestCard key={`${item.kind}:${item.id}`} request={item} from={location.pathname + location.search} />)}</div>{visible.total > LIMIT && <PaginationBar page={page} pageSize={LIMIT} totalItems={visible.total} onPageChange={(next) => change({ page: next })} showPageSize={false} />}</>}
    <nav aria-label={t('workspace.shortcuts')} className="flex flex-wrap gap-5 border-t border-border pt-3 text-sm"><Link to="/operations" className="inline-flex min-h-11 items-center font-semibold text-blue-700 dark:text-blue-300">{t('nav.home')}</Link><Link to="/help-support" className="inline-flex min-h-11 items-center text-text-secondary">{t('nav.helpSupport')}</Link></nav>
  </div></div>;
}
