import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGeo } from '../contexts/GeoContext';
import { getDashboardSummary } from '../services/dashboard';
import { getFinancialSummary } from '../services/transactions';
import { useLocale } from '../i18n/useLocale';

const LINKS = [
  ['/admin/services', 'nav.adminServices'], ['/admin/agents', 'nav.agents'],
  ['/admin/providers', 'nav.providers'], ['/admin/projects', 'nav.adminProjects'],
  ['/admin/properties', 'nav.clientProperties'], ['/orders', 'nav.orders'],
  ['/admin/disputes', 'nav.disputes'], ['/finance', 'nav.finance'],
];

export default function ManagementHome() {
  const { t } = useTranslation();
  const { formatNumber } = useLocale();
  const { countryId, regionId } = useGeo();
  const [summary, setSummary] = useState(null);
  const [finance, setFinance] = useState(null);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setSummary(null); setFinance(null); setErrors([]); setLoading(true);
    Promise.allSettled([getDashboardSummary(), getFinancialSummary()]).then(([overview, financial]) => {
      if (!active) return;
      if (overview.status === 'fulfilled') setSummary(overview.value);
      if (financial.status === 'fulfilled') setFinance(financial.value);
      setErrors([overview.status === 'rejected' || overview.value?.meta?.partial ? 'workspace.overviewError' : null, financial.status === 'rejected' ? 'workspace.financeError' : null].filter(Boolean));
      setLoading(false);
    });
    return () => { active = false; };
  }, [countryId, regionId, attempt]);
  return <div className="app-page-wrap"><div className="app-page-shell space-y-6">
    <header className="rounded-3xl border border-border bg-surface-card p-5 sm:p-7"><h1 className="app-page-headline">{t('workspace.management')}</h1><p className="mt-2 text-text-secondary">{t('workspace.managementHint')}</p>
      <Link to="/admin/operations" className="btn-primary mt-5 inline-flex min-h-14 items-center justify-center rounded-2xl px-6 font-semibold">{t('workspace.openOperations')}</Link>
    </header>
    {errors.length > 0 && <div role="alert" className="app-alert app-alert-error">{errors.map((key) => <p key={key}>{t(key)}</p>)}<button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-2 underline">{t('serviceOrders.retry')}</button></div>}
    {loading && <p role="status">{t('dashboard.loading')}</p>}
    {summary && <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={t('workspace.overview')}>
      {[[summary.stats?.activeServices, 'dashboard.stats.activeServices'], [summary.detailStats?.projects?.total, 'nav.projects'], [summary.detailStats?.orders?.open, 'workspace.openOrders'], [summary.detailStats?.tasks?.inProgress, 'workspace.activeTasks']].map(([value, key]) => <div key={key} className="rounded-2xl border border-border bg-surface-card p-4"><p className="text-2xl font-bold">{value ?? '—'}</p><p className="text-sm text-text-secondary">{t(key)}</p></div>)}
    </section>}
    <nav aria-label={t('workspace.managementLinks')} className="grid grid-cols-2 gap-3 sm:grid-cols-4">{LINKS.map(([path, key]) => <Link key={path} to={path} className="btn-secondary flex min-h-12 items-center justify-center rounded-xl px-3 py-3 text-center text-sm">{t(key)}</Link>)}</nav>
    {finance && <details className="rounded-2xl border border-border bg-surface-card p-5"><summary className="cursor-pointer font-semibold">{t('workspace.finance')}</summary>
      <p className="mt-3 text-sm text-text-secondary">{t('workspace.currencyHint')}</p>
      {finance.byCurrency?.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{finance.byCurrency.map((totals) => <article key={totals.currency} className="rounded-xl border border-border p-4"><h2 className="font-bold">{totals.currency}</h2><dl className="mt-2 space-y-2 text-sm">{['revenues', 'expenses', 'commissions', 'adjustments', 'balance'].map((key) => <div key={key} className="flex flex-wrap justify-between gap-2"><dt>{t(`workspace.financeFields.${key}`)}</dt><dd>{formatNumber(totals[key] ?? 0)} {totals.currency}</dd></div>)}</dl></article>)}</div> : <p className="mt-3 text-sm">{t('workspace.noTransactions')}</p>}
      <Link to="/finance" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-blue-700 dark:text-blue-300">{t('nav.finance')}</Link>
    </details>}
  </div></div>;
}
