import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGeo } from '../contexts/GeoContext';
import { acceptMission, declineMission, getMyMissions } from '../services/missions';
import { getRequestDetailPath, getRequestKind, isRequestHistory } from '../utils/requestLifecycle';
import { useLocale } from '../i18n/useLocale';
import PaginationBar from '../components/PaginationBar';
import CollectionFilters from '../components/CollectionFilters';

const VIEWS = { 'en-cours': 'active', offres: 'offers', historique: 'history' };
const LIMIT = 20;

// Bookmarks keep their category, and their future returns use the common list.
export function ProviderWorkspaceAlias({ kind }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  if (kind && !params.has('type')) params.set('type', kind);
  return <Navigate to={`/prestataire/interventions${params.size ? `?${params}` : ''}`} replace state={location.state} />;
}

export default function ProviderWorkspacePage() {
  const { user } = useGeo();
  return <Interventions key={JSON.stringify([user?.id, user?.role])} />;
}

function Interventions() {
  const { t } = useTranslation();
  const { formatDateTime } = useLocale();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const view = Object.prototype.hasOwnProperty.call(VIEWS, params.get('vue')) ? params.get('vue') : 'en-cours';
  const kind = ['service', 'taxi', 'delivery'].includes(params.get('type')) ? params.get('type') : 'all';
  const q = (params.get('q') || '').trim().slice(0, 200);
  const rawPage = Number(params.get('page') || 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 100000 ? rawPage : 1;
  const scope = JSON.stringify([view, kind, q, page]);
  const from = location.pathname + location.search;
  const current = useRef(scope); current.current = scope;
  const latestLoad = useRef(null);
  const alive = useRef(true), generation = useRef(0), abort = useRef(null), sending = useRef(false);
  const [query, setQuery] = useState(q);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(null);
  const visible = data?.scope === scope ? data : null;
  useEffect(() => setQuery(q), [q]);
  function change(values) {
    const next = new URLSearchParams(params); next.delete('page');
    Object.entries(values).forEach(([key, value]) => value ? next.set(key, String(value)) : next.delete(key));
    setParams(next);
  }
  const load = useCallback(async () => {
    if (!alive.current || sending.current) return;
    const version = ++generation.current;
    abort.current?.abort();
    const controller = new AbortController(); abort.current = controller;
    setLoading(true);
    try {
      const result = await getMyMissions({ view: VIEWS[view], kind, ...(q ? { q } : {}), page, limit: LIMIT }, { signal: controller.signal });
      if (!alive.current || generation.current !== version || current.current !== scope) return;
      const total = result.pagination?.total ?? result.missions?.length ?? 0;
      if (page > 1 && (page - 1) * LIMIT >= total) {
        setParams(previous => { const next = new URLSearchParams(previous); next.set('page', String(Math.max(1, Math.ceil(total / LIMIT)))); return next; }, { replace: true });
        return;
      }
      setData({ scope, items: result.missions || [], total }); setError('');
    } catch (failure) {
      if (!alive.current || generation.current !== version || current.current !== scope || controller.signal.aborted) return;
      if ([401, 403].includes(failure?.response?.status)) setData(null);
      setError(t('providerWorkspace.loadFailed'));
    } finally { if (alive.current && generation.current === version && current.current === scope) setLoading(false); }
  }, [view, kind, q, page, scope, setParams, t]);
  latestLoad.current = load;
  useEffect(() => {
    alive.current = true; load();
    const refresh = () => { if (document.visibilityState === 'visible' && navigator.onLine !== false) load(); };
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh);
    return () => { alive.current = false; generation.current += 1; abort.current?.abort(); clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); };
  }, [load]);
  async function respond(mission, action) {
    if (sending.current || !alive.current) return;
    const context = scope;
    sending.current = true; generation.current += 1; abort.current?.abort();
    setBusy({ id: mission.id, action }); setActionError(null);
    try {
      await (action === 'accept' ? acceptMission(mission.id) : declineMission(mission.id));
      if (!alive.current || current.current !== context) return;
      window.dispatchEvent(new Event('notifications:refresh'));
      if (action === 'accept') navigate(getRequestDetailPath(mission, undefined, 'provider'), { state: { from } });
    } catch (failure) {
      if (!alive.current || current.current !== context) return;
      setActionError({ scope: context, message: failure?.response?.data?.error || t('providerWorkspace.actionFailed') });
      if ([401, 403].includes(failure?.response?.status)) setData(null);
    } finally {
      sending.current = false;
      if (alive.current) { setBusy(null); latestLoad.current(); }
    }
  }
  const filtered = kind !== 'all' || Boolean(q);
  return <div className="app-page-wrap role-workspace"><div className="app-page-shell max-w-5xl space-y-4">
    <header><h1 className="app-page-headline">{t('providerWorkspace.title')}</h1><p className="mt-2 max-w-2xl text-sm text-text-secondary">{t('roleViews.providerHint')}</p></header>
    <nav aria-label={t('providerWorkspace.views')} className="role-view-tabs grid grid-cols-3 gap-2">{Object.keys(VIEWS).map(value => <button key={value} type="button" disabled={Boolean(busy)} aria-current={view === value ? 'page' : undefined} onClick={() => change({ vue: value })} className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold ${view === value ? 'border-blue-600 bg-blue-600 text-white' : 'border-border bg-surface-card'}`}>{t(`providerWorkspace.view.${value}`)}</button>)}</nav>
    <CollectionFilters id="interventions" query={query} onQueryChange={setQuery} onSubmit={() => change({ q: query.trim() })} kind={kind} onKindChange={value => change({ type: value === 'all' ? null : value })} searchLabel={t('providerWorkspace.search')} findLabel={t('requestWorkspace.find')} placeholder={t('roleViews.search')} kindLabel={t('operationsCenter.type')} disabled={Boolean(busy)} options={['all', 'service', 'taxi', 'delivery'].map(value => ({ value, label: t(`serviceOrders.filters.${value}`) }))} />
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><p aria-live="polite">{visible ? t('providerWorkspace.results', { count: visible.total }) : ''}</p><div className="flex flex-wrap gap-3">{filtered && <button type="button" disabled={Boolean(busy)} onClick={() => change({ type: null, q: null })} className="min-h-11 underline">{t('operationsCenter.clearFilters')}</button>}<button type="button" disabled={loading || Boolean(busy)} onClick={load} className="btn-secondary min-h-11 rounded-xl px-3">{t('operations.refresh')}</button></div></div>
    {error && <p role="alert" className="app-alert app-alert-error">{error} <button type="button" disabled={loading || Boolean(busy)} onClick={load} className="min-h-11 underline">{t('serviceOrders.retry')}</button></p>}
    {actionError?.scope === scope && <p role="alert" className="app-alert app-alert-error">{actionError.message}</p>}
    {loading && <p role="status" className="text-sm text-text-secondary">{t('operations.loading')}</p>}
    {!loading && !error && visible && !visible.items.length && <div className="rounded-2xl border border-dashed border-border p-6"><h2 className="font-semibold">{t(filtered ? 'operationsCenter.noMatches' : `providerWorkspace.empty.${view}`)}</h2><p className="mt-2 text-sm text-text-secondary">{t(filtered ? 'operationsCenter.filterHint' : 'providerWorkspace.emptyHint')}</p></div>}
    <div className="grid gap-3 sm:grid-cols-2">{visible?.items.map(mission => <InterventionCard key={mission.id} mission={mission} from={from} busy={busy} respond={respond} formatDateTime={formatDateTime} />)}</div>
    {visible?.total > LIMIT && <PaginationBar page={page} pageSize={LIMIT} totalItems={visible.total} onPageChange={next => { if (!busy) change({ page: next }); }} showPageSize={false} />}
    <Link to="/operations#workspace-availability" className="inline-flex min-h-11 items-center text-sm font-semibold underline">{t('providerWorkspace.availability')}</Link>
  </div></div>;
}

function InterventionCard({ mission, from, busy, respond, formatDateTime }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(Date.now());
  const offer = mission.missionStatus === 'ASSIGNED' && Boolean(mission.acceptanceDeadlineAt);
  const deadline = new Date(mission.acceptanceDeadlineAt).getTime();
  const expired = offer && (!Number.isFinite(deadline) || deadline <= now);
  useEffect(() => {
    if (!offer || expired) return undefined;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(2147483647, Math.max(1, deadline - Date.now() + 50)));
    return () => clearTimeout(timer);
  }, [offer, expired, deadline]);
  const history = isRequestHistory(mission);
  const completed = mission.missionStatus === 'COMPLETED';
  const reason = offer ? expired ? 'expired' : 'offer' : history ? 'history' : completed ? 'waitingClient' : mission.missionStatus === 'DISPUTED' ? 'disputed' : mission.missionStatus === 'IN_PROGRESS' ? 'report' : 'work';
  return <article aria-labelledby={`intervention-${mission.id}`} className={`space-y-3 rounded-2xl border bg-surface-card p-4 ${offer && !expired ? 'border-blue-500/50' : 'border-border'}`}>
    <p className="text-xs text-text-secondary">{t(`serviceOrders.filters.${getRequestKind(mission)}`)} · #{mission.id}</p>
    <h2 id={`intervention-${mission.id}`} className="break-words font-semibold">{mission.title || t('myMissionsPage.missionFallback', { id: mission.id })}</h2>
    <p className="text-sm font-medium">{t(`providerWorkspace.status.${mission.missionStatus}`, { defaultValue: mission.missionStatus })}</p>
    {(mission.pickupAddress || mission.address) && <p className="break-words text-sm text-text-secondary">{[mission.pickupAddress, mission.address].filter(Boolean).join(' → ')}</p>}
    <p className="text-sm text-text-secondary">{t(`providerWorkspace.next.${reason}`)}</p>
    {offer && !expired && <p className="text-sm">{t('providerWorkspace.deadline', { date: formatDateTime(mission.acceptanceDeadlineAt) })}</p>}
    {offer && <div className="flex flex-wrap gap-2"><button type="button" disabled={Boolean(busy) || expired} onClick={() => respond(mission, 'accept')} className="btn-primary min-h-12 rounded-xl px-4 font-semibold">{t(busy?.id === mission.id && busy.action === 'accept' ? 'operations.saving' : 'providerWorkspace.accept')}</button><button type="button" disabled={Boolean(busy) || expired} onClick={() => respond(mission, 'decline')} className="btn-secondary min-h-12 rounded-xl px-4">{t('providerWorkspace.decline')}</button></div>}
    <Link to={getRequestDetailPath(mission, undefined, 'provider')} state={{ from }} className={`${offer ? 'underline' : 'btn-primary rounded-xl px-4'} inline-flex min-h-11 items-center text-sm font-semibold`}>{t(offer ? 'serviceAgent.details' : history || completed ? 'providerWorkspace.report' : 'workspace.continueWork')}</Link>
  </article>;
}
