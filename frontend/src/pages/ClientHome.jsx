import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getMyServices } from '../services/services';
import { isRequestHistory, needsClientAction } from '../utils/requestLifecycle';
import RequestSummaryCard from '../components/RequestSummaryCard';

export default function ClientHome({ user }) {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const request = useRef(0);
  const load = useCallback(async () => {
    const version = ++request.current;
    try {
      const result = await getMyServices({ limit: 100, sort: '-createdAt' }, { withPagination: true });
      if (request.current !== version) return;
      setItems(result.items || []); setTotal(result.pagination?.total || result.items?.length || 0); setError(false);
    } catch (_error) { if (request.current === version) setError(true); }
    finally { if (request.current === version) setLoading(false); }
  }, []);
  useEffect(() => {
    load();
    const refresh = () => { if (document.visibilityState === 'visible' && navigator.onLine !== false) load(); };
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh);
    return () => { request.current += 1; clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); };
  }, [load]);
  const review = items.filter(needsClientAction);
  const active = items.filter((item) => !isRequestHistory(item) && !needsClientAction(item));
  return <div className="app-page-wrap"><div className="app-page-shell max-w-4xl space-y-6">
    <header className="rounded-3xl border border-border bg-surface-card p-5 sm:p-7">
      <h1 className="app-page-headline">{t('clientHome.greeting', { name: user.firstName || '' })}</h1>
      <p className="mt-2 text-text-secondary">{t('clientHome.hint')}</p>
      <Link to="/demandes/nouvelle" className="btn-primary mt-5 flex min-h-14 items-center justify-center rounded-2xl px-5 text-base font-semibold">{t('homePage.simpleHero.otherRequest')}</Link>
      <div className="mt-3 flex flex-wrap gap-3 text-sm"><Link to="/taxi" className="btn-secondary min-h-11 rounded-xl px-4 py-3">{t('serviceOrders.newTaxi')}</Link><Link to="/livraison" className="btn-secondary min-h-11 rounded-xl px-4 py-3">{t('serviceOrders.newDelivery')}</Link></div>
    </header>
    {error && <div role="alert" className="app-alert app-alert-error">{t('serviceOrders.loadError')} <button onClick={load} className="underline">{t('serviceOrders.retry')}</button></div>}
    {loading ? <p role="status">{t('serviceOrders.loading')}</p> : <>
      {review.length > 0 && <section aria-labelledby="client-review"><h2 id="client-review" className="mb-3 text-lg font-bold">{t('clientHome.attention')}</h2><div className="grid gap-3 sm:grid-cols-2">{review.map((item) => <RequestSummaryCard key={item.id} request={item} />)}</div></section>}
      <section aria-labelledby="client-active"><h2 id="client-active" className="mb-3 text-lg font-bold">{t('clientHome.active')}</h2>
        {active.length ? <div className="grid gap-3 sm:grid-cols-2">{active.slice(0, 4).map((item) => <RequestSummaryCard key={item.id} request={item} />)}</div> : !error && <p className="rounded-2xl border border-dashed border-border p-5 text-text-secondary">{t('clientHome.empty')}</p>}
        <Link to="/demandes" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-blue-700 dark:text-blue-300">{t('clientHome.all')}</Link>
        {total > items.length && <p className="text-xs text-text-muted">{t('clientHome.partial')}</p>}
      </section>
    </>}
    <nav aria-label={t('clientHome.more')} className="flex flex-wrap gap-3 border-t border-border pt-4 text-sm">
      <Link to="/dossiers" className="btn-secondary rounded-xl px-4 py-3">{t('nav.myCases')}</Link><Link to="/transactions" className="btn-secondary rounded-xl px-4 py-3">{t('clientHome.payments')}</Link><Link to="/help-support" className="btn-secondary rounded-xl px-4 py-3">{t('nav.helpSupport')}</Link>
    </nav>
  </div></div>;
}
