import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CarFront, PackageCheck, Plus } from 'lucide-react';
import { getMyServices } from '../services/services';
import { useGeo } from '../contexts/GeoContext';
import RequestSummaryCard from '../components/RequestSummaryCard';
import WorkspaceHeader from '../components/WorkspaceHeader';

export default function ClientHome({ user }) {
  const { t } = useTranslation();
  const { countryId, regionId } = useGeo();
  const scope = JSON.stringify([user.id, countryId, regionId]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const visible = data?.scope === scope ? data : null;
  const load = useCallback(async () => {
    const version = ++generation.current;
    const results = await Promise.allSettled([
      getMyServices({ view: 'review', limit: 3, sort: 'createdAt' }, { withPagination: true }),
      getMyServices({ view: 'ongoing', limit: 4, sort: '-createdAt' }, { withPagination: true }),
    ]);
    if (version !== generation.current || scope !== currentScope.current) return;
    setData((previous) => {
      const next = { scope };
      results.forEach((result, index) => {
        const key = index === 0 ? 'review' : 'ongoing';
        next[key] = result.status === 'fulfilled' ? result.value : [401, 403].includes(result.reason?.response?.status) ? null : previous?.scope === scope ? previous[key] : null;
        next[`${key}Error`] = result.status === 'rejected';
      });
      return next;
    });
    setLoading(false);
  }, [scope]);
  useEffect(() => {
    setLoading(true); load();
    const refresh = () => { if (document.visibilityState === 'visible' && navigator.onLine !== false) load(); };
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh);
    return () => { generation.current += 1; clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); };
  }, [load]);
  const review = visible?.review?.items || [];
  const ongoing = visible?.ongoing?.items || [];
  const reviewTotal = visible?.review?.pagination?.total ?? review.length;
  const ongoingTotal = visible?.ongoing?.pagination?.total ?? ongoing.length;
  return <div className="app-page-wrap"><div className="app-page-shell max-w-4xl space-y-6">
    <WorkspaceHeader title={t('clientHome.greeting', { name: user.firstName || '' })} hint={t(review.length ? 'clientHome.reviewHint' : 'clientHome.hint')}>
      <div className="flex flex-wrap gap-3">
        {review.length > 0 && <a href="#client-review" className="btn-primary inline-flex min-h-12 items-center justify-center rounded-xl px-5 font-semibold">{t('clientHome.reviewPriority', { count: reviewTotal })}</a>}
        <Link to="/demandes/nouvelle" className={`${review.length ? 'btn-secondary' : 'btn-primary'} inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 font-semibold`}><Plus size={18} aria-hidden="true" />{t('homePage.simpleHero.otherRequest')}</Link>
      </div>
    </WorkspaceHeader>
    {loading && !visible && <p role="status">{t('serviceOrders.loading')}</p>}
    {visible?.reviewError && <div role="alert" className="app-alert app-alert-error">{t('clientHome.reviewError')} <button type="button" onClick={load} className="underline">{t('serviceOrders.retry')}</button></div>}
    {review.length > 0 && <section id="client-review" aria-labelledby="client-review-title" className="scroll-mt-24 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5"><h2 id="client-review-title" className="text-lg font-bold">{t('clientHome.attention')}</h2><p className="mb-4 mt-1 text-sm text-text-secondary">{t('clientHome.reviewHint')}</p><div className="grid gap-3 sm:grid-cols-2">{review.map((item) => <RequestSummaryCard key={item.id} request={item} />)}</div>
      {reviewTotal > review.length && <Link to="/demandes?vue=a-verifier" className="mt-3 inline-flex min-h-11 items-center font-semibold text-blue-700 dark:text-blue-300">{t('clientHome.allReview', { count: reviewTotal })}</Link>}
    </section>}
    <section aria-labelledby="client-active"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 id="client-active" className="text-lg font-bold">{t('clientHome.active')}{ongoingTotal > 0 ? ` (${ongoingTotal})` : ''}</h2><Link to="/demandes" className="inline-flex min-h-11 items-center text-sm font-semibold text-blue-700 dark:text-blue-300">{t('clientHome.all')}</Link></div>
      {visible?.ongoingError && <div role="alert" className="app-alert app-alert-error">{t('serviceOrders.loadError')} <button type="button" onClick={load} className="underline">{t('serviceOrders.retry')}</button></div>}
      {ongoing.length > 0 ? <div className="grid gap-3 sm:grid-cols-2">{ongoing.map((item) => <RequestSummaryCard key={item.id} request={item} />)}</div> : visible?.ongoing && !visible.ongoingError && <p className="rounded-2xl border border-dashed border-border p-5 text-text-secondary">{t('clientHome.empty')}</p>}
    </section>
    <section aria-label={t('clientHome.quickRequests')} className="rounded-2xl border border-border p-4"><h2 className="text-sm font-semibold">{t('clientHome.quickRequests')}</h2><div className="mt-3 grid gap-3 sm:grid-cols-2"><Link to="/taxi" className="btn-secondary inline-flex min-h-12 items-center gap-3 rounded-xl px-4 py-3"><CarFront size={20} aria-hidden="true" />{t('serviceOrders.newTaxi')}</Link><Link to="/livraison" className="btn-secondary inline-flex min-h-12 items-center gap-3 rounded-xl px-4 py-3"><PackageCheck size={20} aria-hidden="true" />{t('serviceOrders.newDelivery')}</Link></div></section>
    <details className="rounded-2xl border border-border p-4"><summary className="cursor-pointer font-semibold">{t('clientHome.more')}</summary><nav aria-label={t('clientHome.more')} className="mt-3 flex flex-wrap gap-3 text-sm"><Link to="/dossiers" className="btn-secondary min-h-11 rounded-xl px-4 py-3">{t('nav.myCases')}</Link><Link to="/transactions" className="btn-secondary min-h-11 rounded-xl px-4 py-3">{t('clientHome.payments')}</Link></nav></details>
  </div></div>;
}
