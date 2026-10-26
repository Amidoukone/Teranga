import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGeo } from '../../contexts/GeoContext';
import { me } from '../../services/auth';
import { getTransactionsWithMeta } from '../../services/transactions';
import { getServiceById } from '../../services/services';
import { getOrderById } from '../../services/orders';
import { getProjectById } from '../../services/projects';
import api from '../../services/api';
import { getRequestDetailPath } from '../../utils/requestLifecycle';
import PaginationBar from '../../components/PaginationBar';
import TransactionCard from './TransactionCard';
import TransactionForm from './TransactionForm';
import { casePath, REFERENCE_KINDS, TRANSACTION_STATUSES, TRANSACTION_TYPES, validReference } from './transactionPresentation';

const Statement = lazy(() => import('../../pages/FinanceDashboardPage'));
const inputClass = 'mt-1 min-h-11 w-full rounded-xl border border-border bg-surface-main p-2 text-sm';
const allowed = (user) => ['admin', 'agent', 'client'].includes(user?.role);

export default function FinancialWorkspace({ kind: routeKind }) {
  const geo = useGeo();
  const { id } = useParams();
  const [params] = useSearchParams();
  const queryKind = REFERENCE_KINDS.find((kind) => params.has(`${kind}Id`));
  const kind = routeKind || queryKind;
  const reference = routeKind ? id : kind ? params.get(`${kind}Id`) : null;
  return <Workspace key={JSON.stringify([geo.user?.id, geo.user?.role, geo.countryId, geo.regionId, kind, reference, ...REFERENCE_KINDS.map((item) => params.get(`${item}Id`))])} kind={kind} reference={reference} />;
}

function Workspace({ kind, reference }) {
  const { t } = useTranslation();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [user, setUser] = useState(null), [context, setContext] = useState(null), [bootError, setBootError] = useState('');
  const [attempt, setAttempt] = useState(0), [ready, setReady] = useState(false), [showForm, setShowForm] = useState(false), [notice, setNotice] = useState('');
  const [data, setData] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [taskRedirect, setTaskRedirect] = useState(null);
  const legacyTaskId = params.get('taskId');
  const [query, setQuery] = useState(params.get('q') || '');
  const version = useRef(0), alive = useRef(true);
  const statement = !kind && params.get('vue') === 'bilan';
  const q = (params.get('q') || '').slice(0, 100);
  const type = TRANSACTION_TYPES.includes(params.get('type')) ? params.get('type') : '';
  const status = TRANSACTION_STATUSES.includes(params.get('status')) ? params.get('status') : '';
  const currency = /^[A-Z]{3}$/.test(params.get('currency') || '') ? params.get('currency') : '';
  const sort = ['-createdAt', 'createdAt', 'amount', '-amount'].includes(params.get('sort')) ? params.get('sort') : '-createdAt';
  const from = params.get('startDate') || '', to = params.get('endDate') || '';
  const invalidDates = Boolean(from && to && from > to) || [from, to].some((value) => value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(new Date(value).getTime())));
  const rawPage = Number(params.get('page')), page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 100000 ? rawPage : 1;
  const scope = JSON.stringify([kind, reference, q, type, status, currency, sort, from, to, page]);
  const currentScope = useRef(scope); currentScope.current = scope;
  const visible = data?.scope === scope ? data.value : null;
  const update = useCallback((values) => {
    const next = new URLSearchParams(params);
    Object.entries(values).forEach(([field, value]) => value ? next.set(field, String(value)) : next.delete(field));
    setParams(next);
  }, [params, setParams]);
  useEffect(() => { setQuery(q); }, [q]);
  useEffect(() => {
    let active = true;
    alive.current = true; setReady(false); setBootError('');
    async function init() {
      try {
        const { user: current } = await me();
        if (!active) return;
        setUser(current);
        if (!allowed(current)) { setBootError(t('financialWorkspace.noAccess')); return; }
        if (kind) {
          if (!validReference(reference)) { setBootError(t('financialWorkspace.invalidReference')); return; }
          let resource;
          try {
            resource = kind === 'service' ? await getServiceById(reference) : kind === 'order' ? await getOrderById(reference) : kind === 'project' ? await getProjectById(reference) : (await api.get(`/tasks/${reference}/workspace`)).data?.task;
          } catch (failure) {
            if (kind !== 'service' || !validReference(legacyTaskId) || ![403, 404].includes(failure?.response?.status)) throw failure;
            const task = (await api.get(`/tasks/${legacyTaskId}/workspace`)).data?.task;
            if (!task || Number(task.serviceId) !== Number(reference)) throw failure;
            if (active) setTaskRedirect(`/transactions?taskId=${task.id}`);
            return;
          }
          if (!resource) throw new Error('Missing case');
          if (!active) return;
          setContext({ ...resource, id: reference, kind });
        }
        if (active) setReady(true);
      } catch { if (active) setBootError(t(kind ? 'financialWorkspace.contextFailed' : 'financialWorkspace.failed')); }
    }
    init();
    return () => { active = false; alive.current = false; version.current += 1; };
  }, [kind, reference, legacyTaskId, attempt, t]);
  const load = useCallback(async () => {
    if (!ready || !alive.current || invalidDates || statement) return;
    const request = ++version.current; setLoading(true);
    try {
      const result = await getTransactionsWithMeta({ page, limit: 20, includeCount: true, q, type, status, currency, sort,
        ...(from ? { startDate: new Date(`${from}T00:00:00`).toISOString() } : {}), ...(to ? { endDate: new Date(`${to}T23:59:59.999`).toISOString() } : {}),
        ...(kind ? { [`${kind}Id`]: Number(reference), countryId: null, regionId: null } : {}),
        ...Object.fromEntries(REFERENCE_KINDS.filter((item) => item !== kind && validReference(params.get(`${item}Id`))).map((item) => [`${item}Id`, Number(params.get(`${item}Id`))])),
      });
      if (!alive.current || request !== version.current || currentScope.current !== scope) return;
      if (page > 1 && !result.items.length && result.pagination?.total != null) { update({ page: Math.max(1, Math.ceil(result.pagination.total / 20)) }); return; }
      setData({ scope, value: result }); setError('');
    } catch (failure) {
      if (alive.current && request === version.current && currentScope.current === scope) {
        if ([401, 403, 404].includes(failure?.response?.status)) { setData(null); setShowForm(false); setReady(false); setBootError(t('financialWorkspace.contextFailed')); }
        else setError(t('financialWorkspace.failed'));
      }
    } finally { if (alive.current && request === version.current) setLoading(false); }
  }, [ready, invalidDates, statement, page, q, type, status, currency, sort, from, to, kind, reference, params, scope, update, t]);
  useEffect(() => { load(); return () => { version.current += 1; }; }, [load]);
  const canCreate = allowed(user) && (kind === 'service' || kind === 'task' ? user.role !== 'client' : kind === 'project' ? user.role === 'admin' || (user.role === 'agent' && Number(context?.agentId || context?.agent?.id) === Number(user.id)) : true);
  const saved = () => { setNotice(t('financialWorkspace.saved')); setShowForm(false); load(); };
  if (taskRedirect) return <Navigate to={taskRedirect} replace />;
  return <div className="app-page-wrap"><div className="app-page-shell max-w-5xl space-y-5">
    <header className="space-y-3"><h1 className="app-page-headline">{t(user?.role === 'client' && !kind ? 'financialWorkspace.clientTitle' : 'financialWorkspace.title')}</h1>
      <p className="text-sm text-text-secondary">{t('financialWorkspace.hint')}</p>
      {context && <p className="rounded-xl border border-border p-3 text-sm font-semibold">{t(`financialWorkspace.${kind}`)} #{reference} · {context.title || context.code}</p>}
      <div className="flex flex-wrap gap-4 text-sm">{context && <Link to={(kind === 'service' ? getRequestDetailPath(context, undefined, user?.role) : casePath(kind, reference)) + (kind === 'project' || kind === 'order' ? '#dossier-finance' : '')} state={{ from: location.pathname + location.search }} className="inline-flex min-h-11 items-center underline">{t('financialWorkspace.backCase')}</Link>}
        {kind && <Link to="/transactions" className="inline-flex min-h-11 items-center underline">{t('financialWorkspace.allEntries')}</Link>}
        <Link to="/operations" className="inline-flex min-h-11 items-center underline">{t('operations.title')}</Link>
      </div>
    </header>
    <p className="rounded-xl bg-surface-main p-3 text-sm text-text-secondary">{t('financialWorkspace.external')}</p>
    {bootError && <p role="alert" className="app-alert app-alert-error">{bootError} <button type="button" onClick={() => setAttempt((value) => value + 1)} className="min-h-11 underline">{t('financialWorkspace.retry')}</button></p>}
    {!ready && !bootError && <p role="status">{t('financialWorkspace.loading')}</p>}
    {ready && <>
      {!kind && <nav aria-label={t('financialWorkspace.title')} className="flex gap-3">{[['journal', false], ['statement', true]].map(([label, selected]) => <button key={label} type="button" aria-current={statement === selected ? 'page' : undefined} onClick={() => update({ vue: selected ? 'bilan' : null, page: null })} className={`min-h-11 rounded-xl border px-4 text-sm font-semibold ${statement === selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-border'}`}>{t(`financialWorkspace.${label}`)}</button>)}</nav>}
      {statement ? <Suspense fallback={<p role="status">{t('financialWorkspace.loading')}</p>}><Statement embedded user={user}
        filters={{ q, type, status, currency, startDate: from, endDate: to, role: params.get('role') || '', linked: params.get('liees') === '1' }}
        onFiltersChange={(values) => { const next = { ...values, page: null }; if ('linked' in next) { next.liees = next.linked ? '1' : null; delete next.linked; } update(next); }}
      /></Suspense> : <>
        {canCreate && <button type="button" onClick={() => { setShowForm((value) => !value); setNotice(''); }} className="btn-primary min-h-11 rounded-xl px-4 text-sm">{t('financialWorkspace.add')}</button>}
        {!kind && <p className="text-sm text-text-secondary">{t('financialWorkspace.referenceHint')}</p>}
        {showForm && <TransactionForm user={user} context={context} initialTaskId={validReference(params.get('taskId')) ? params.get('taskId') : ''} onSaved={saved} onCancel={() => setShowForm(false)} />}
        {notice && <p role="status" className="text-sm">{notice}</p>}
        <form onSubmit={(event) => { event.preventDefault(); update({ q: query.trim(), page: null }); }} className="rounded-2xl border border-border p-4"><label className="text-sm">{t('financialWorkspace.search')}<div className="mt-1 flex gap-2"><input aria-label={t('financialWorkspace.search')} value={query} onChange={(event) => setQuery(event.target.value)} maxLength={100} className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface-main p-2" /><button type="submit" className="btn-secondary min-h-11 rounded-xl px-3 text-sm">{t('financialWorkspace.find')}</button></div></label></form>
        <details className="rounded-2xl border border-border p-4"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">{t('financialWorkspace.filters')}</summary><div className="grid gap-3 sm:grid-cols-3">
          {['type', 'status'].map((field) => <label key={field} className="text-sm">{t(`financialWorkspace.${field}`)}<select aria-label={t(`financialWorkspace.${field}`)} value={field === 'type' ? type : status} onChange={(event) => update({ [field]: event.target.value, page: null })} className={inputClass}><option value="">{t('financialWorkspace.all')}</option>{(field === 'type' ? TRANSACTION_TYPES : TRANSACTION_STATUSES).map((value) => <option key={value} value={value}>{t(`transactions.${field}.${value}`)}</option>)}</select></label>)}
          <label className="text-sm">{t('financialWorkspace.currency')}<input aria-label={t('financialWorkspace.currency')} value={params.get('currency') || ''} maxLength={3} placeholder="XOF" onChange={(event) => update({ currency: event.target.value.toUpperCase(), page: null })} className={inputClass} /></label>
          {[['startDate', from, 'from'], ['endDate', to, 'to']].map(([field, value, label]) => <label key={field} className="text-sm">{t(`financialWorkspace.${label}`)}<input aria-label={t(`financialWorkspace.${label}`)} type="date" value={value} onChange={(event) => update({ [field]: event.target.value, page: null })} className={inputClass} /></label>)}
          <label className="text-sm">{t('financialWorkspace.sort')}<select aria-label={t('financialWorkspace.sort')} value={sort} onChange={(event) => update({ sort: event.target.value, page: null })} className={inputClass}>{[['-createdAt','newest'],['createdAt','oldest'],['amount','amountAsc'],['-amount','amountDesc']].map(([value, key]) => <option key={value} value={value}>{t(`financialWorkspace.${key}`)}</option>)}</select></label>
        </div><button type="button" onClick={() => update({ q: null, type: null, status: null, currency: null, startDate: null, endDate: null, sort: null, page: null })} className="mt-3 min-h-11 text-sm underline">{t('financialWorkspace.reset')}</button></details>
        <button type="button" disabled={loading} onClick={load} className="min-h-11 text-sm underline">{t('financialWorkspace.refresh')}</button>
        {invalidDates && <p role="alert">{t('financialWorkspace.invalidDates')}</p>}
        {error && <p role="alert" className="app-alert app-alert-error">{error}</p>}
        {loading && <p role="status">{t('financialWorkspace.loading')}</p>}
        {!loading && !error && !invalidDates && visible?.items.length === 0 && <p>{t('financialWorkspace.empty')}</p>}
        {!invalidDates && <div className="space-y-4">{visible?.items.map((entry) => <TransactionCard key={entry.id} entry={entry} user={user} context={context} from={location.pathname + location.search} onSaved={saved} />)}</div>}
        {visible?.pagination?.total > 20 && <PaginationBar page={page} pageSize={20} totalItems={visible.pagination.total} showPageSize={false} onPageChange={(value) => update({ page: value })} />}
      </>}
    </>}
  </div></div>;
}
