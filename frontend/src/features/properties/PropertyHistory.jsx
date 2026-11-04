import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import PaginationBar from '../../components/PaginationBar';
import { TASK_STATUSES, SERVICE_STATUSES } from '../../utils/labels';
import { getRequestDetailPath } from '../../utils/requestLifecycle';

function HistoryList({ property, user, kind }) {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const key = kind === 'tasks' ? 'interventions_page' : 'demandes_page';
  const raw = Number(params.get(key)), page = Number.isSafeInteger(raw) && raw > 0 ? raw : 1;
  const [data, setData] = useState(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  const version = useRef(0);
  useEffect(() => {
    const current = ++version.current;
    const path = kind === 'tasks' ? '/tasks' : user.role === 'admin' ? '/services' : '/services/me';
    api.get(path, { params: { propertyId: property.id, countryId: null, regionId: null, page, limit: 20 } }).then(({ data: result }) => {
      if (current !== version.current) return;
      setData(result); setError('');
    }).catch((failure) => {
      if (current !== version.current) return;
      if ([401, 403, 404].includes(failure?.response?.status)) setData(null);
      setError(t('propertySimple.historyFailed'));
    });
    return () => { version.current += 1; };
  }, [property.id, user.role, kind, page, attempt, t]);
  const items = data?.[kind === 'tasks' ? 'tasks' : 'services'] || [];
  const section = kind === 'tasks' ? 'property-interventions' : 'property-requests';
  const from = `/properties/${property.id}${params.size ? `?${params.toString()}` : ''}#${section}`;
  return <div className="mt-4 space-y-3">
    {error && <p role="alert">{error} <button type="button" onClick={() => setAttempt((value) => value + 1)} className="min-h-11 underline">{t('financialWorkspace.retry')}</button></p>}
    {!data && !error && <p role="status">{t('common.loading')}</p>}
    {data && items.length === 0 && <p className="text-sm text-text-secondary">{t('propertySimple.noHistory')}</p>}
    {items.map((item) => <article key={item.id} aria-label={item.title} className="space-y-2 rounded-xl border border-border p-3"><h3 className="font-semibold">{item.title}</h3><p className="text-sm text-text-secondary">{item.missionStatusLabel || item.statusLabel || (kind === 'tasks' ? TASK_STATUSES : SERVICE_STATUSES)[item.status] || item.status}</p><Link to={kind === 'tasks' ? `/tasks/${item.id}` : getRequestDetailPath(item, undefined, user.role)} state={{ from }} className="inline-flex min-h-11 items-center text-sm underline">{t(kind === 'tasks' ? 'propertySimple.openIntervention' : 'propertySimple.openRequest')}</Link></article>)}
    {data && <PaginationBar showPageSize={false} page={page} pageSize={20} totalItems={data.pagination?.total ?? items.length} onPageChange={(value) => setParams((previous) => { const next = new URLSearchParams(previous); next.set(key, String(value)); return next; }, { preventScrollReset: true })} />}
  </div>;
}
export default function PropertyHistory({ property, user, kind }) {
  const section = kind === 'tasks' ? 'property-interventions' : 'property-requests';
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [open, setOpen] = useState(() => window.location.hash === `#${section}` || params.has(kind === 'tasks' ? 'interventions_page' : 'demandes_page'));
  const [visited, setVisited] = useState(open);
  return <details id={section} open={open} onToggle={(event) => { setOpen(event.currentTarget.open); if (event.currentTarget.open) setVisited(true); }} className="scroll-mt-24 rounded-2xl border border-border p-4 sm:p-5"><summary className="min-h-11 cursor-pointer py-3 text-lg font-bold">{t(kind === 'tasks' ? 'nav.interventions' : 'propertySimple.requests')}</summary>{visited && <HistoryList property={property} user={user} kind={kind} />}</details>;
}
