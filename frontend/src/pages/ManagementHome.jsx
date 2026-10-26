import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CarFront, PackageCheck } from 'lucide-react';
import { useGeo } from '../contexts/GeoContext';
import { getDashboardSummary } from '../services/dashboard';
import { getFinancialSummary } from '../services/transactions';
import { useLocale } from '../i18n/useLocale';
import WorkspaceHeader from '../components/WorkspaceHeader';
import { managementNavigation } from '../utils/managementNavigation';

export default function ManagementHome() {
  const { user, countryId, regionId } = useGeo();
  return <Management key={JSON.stringify([user?.id, user?.role, countryId, regionId])} />;
}

function Management() {
  const { t } = useTranslation();
  const { formatNumber } = useLocale();
  const { user, countryId, regionId } = useGeo();
  const groups = managementNavigation(user);
  const scope = JSON.stringify([countryId, regionId]);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(false);
  const [overview, setOverview] = useState(null);
  const [financial, setFinancial] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!overviewOpen) return undefined;
    let active = true;
    setOverview({ scope, loading: true });
    getDashboardSummary().then((value) => { if (active) setOverview({ scope, value, error: value?.meta?.partial }); })
      .catch(() => { if (active) setOverview({ scope, error: true }); });
    return () => { active = false; };
  }, [overviewOpen, scope, attempt]);
  useEffect(() => {
    if (!financeOpen) return undefined;
    let active = true;
    setFinancial({ scope, loading: true });
    getFinancialSummary().then((value) => { if (active) setFinancial({ scope, value }); })
      .catch(() => { if (active) setFinancial({ scope, error: true }); });
    return () => { active = false; };
  }, [financeOpen, scope, attempt]);
  const summary = overview?.scope === scope ? overview : null;
  const finance = financial?.scope === scope ? financial : null;
  const failure = (key) => <div role="alert" className="app-alert app-alert-error">{t(key)} <button type="button" onClick={() => setAttempt((value) => value + 1)} className="underline">{t('serviceOrders.retry')}</button></div>;
  return <div className="app-page-wrap"><div className="app-page-shell max-w-5xl space-y-6">
    <WorkspaceHeader title={t('workspace.management')} hint={t('workspace.managementHint')} operations={false}>
      <Link to="/operations" className="btn-primary inline-flex min-h-12 items-center justify-center gap-3 rounded-xl px-5 font-semibold">{t('workspace.openOperations')}<ArrowRight size={18} aria-hidden="true" /></Link>
    </WorkspaceHeader>
    <section aria-labelledby="management-mobility"><h2 id="management-mobility" className="mb-3 text-lg font-bold">{t('workspace.mobility')}</h2><div className="grid gap-3 sm:grid-cols-2">{[['/admin/taxi-dispatch', 'nav.taxiOperations', 'workspace.taxiHint', CarFront], ['/admin/livraisons', 'nav.deliveryOperations', 'workspace.deliveryHint', PackageCheck]].map(([path, label, hint, Icon]) => <Link key={path} to={path} className="flex items-center gap-3 rounded-2xl border border-border p-4 transition hover:border-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"><Icon className="shrink-0 text-blue-600" size={24} aria-hidden="true" /><div className="min-w-0"><span className="font-semibold">{t(label)}</span><p className="mt-1 text-sm text-text-secondary">{t(hint)}</p></div><ArrowRight size={17} className="ml-auto shrink-0" aria-hidden="true" /></Link>)}</div></section>
    <details className="rounded-2xl border border-border p-4 sm:p-5"><summary className="cursor-pointer font-semibold">{t('workspace.tools')}</summary><div className="mt-4 grid gap-5 sm:grid-cols-2">{groups.map(([title, links]) => <nav key={title} aria-label={t(title)}><h2 className="mb-2 text-sm font-bold text-text-secondary">{t(title)}</h2><div className="flex flex-col">{links.map(([path, key]) => <Link key={path} to={path} className="inline-flex min-h-11 items-center justify-between gap-3 border-b border-border py-2 text-sm font-medium">{t(key)}<ArrowRight size={14} aria-hidden="true" /></Link>)}</div></nav>)}</div></details>
    <details onToggle={(event) => setOverviewOpen(event.currentTarget.open)} className="rounded-2xl border border-border p-4 sm:p-5"><summary className="cursor-pointer font-semibold">{t('workspace.insights')}</summary>
      {summary?.loading && <p role="status" className="mt-3 text-sm">{t('dashboard.loading')}</p>}
      {summary?.error && failure('workspace.overviewError')}
      {summary?.value && <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={t('workspace.overview')}>{[[summary.value.stats?.activeServices, 'dashboard.stats.activeServices'], [summary.value.detailStats?.projects?.total, 'nav.projects'], [summary.value.detailStats?.orders?.open, 'workspace.openOrders'], [summary.value.detailStats?.tasks?.inProgress, 'workspace.activeTasks']].map(([value, key]) => <div key={key} className="rounded-xl bg-surface-main p-4"><p className="text-2xl font-bold">{value ?? '—'}</p><p className="text-sm text-text-secondary">{t(key)}</p></div>)}</section>}
    </details>
    <details onToggle={(event) => setFinanceOpen(event.currentTarget.open)} className="rounded-2xl border border-border p-4 sm:p-5"><summary className="cursor-pointer font-semibold">{t('workspace.finance')}</summary>
      <p className="mt-3 text-sm text-text-secondary">{t('workspace.currencyHint')}</p>
      {finance?.loading && <p role="status" className="mt-3 text-sm">{t('dashboard.loading')}</p>}
      {finance?.error && failure('workspace.financeError')}
      {finance?.value && (finance.value.byCurrency?.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{finance.value.byCurrency.map((totals) => <article key={totals.currency} className="rounded-xl border border-border p-4"><h2 className="font-bold">{totals.currency}</h2><dl className="mt-2 space-y-2 text-sm">{['revenues', 'expenses', 'commissions', 'adjustments', 'balance'].map((key) => <div key={key} className="flex flex-wrap justify-between gap-2"><dt>{t(`workspace.financeFields.${key}`)}</dt><dd>{formatNumber(totals[key] ?? 0)} {totals.currency}</dd></div>)}</dl></article>)}</div> : <p className="mt-3 text-sm">{t('workspace.noTransactions')}</p>)}
      <Link to="/transactions?vue=bilan" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-blue-700 dark:text-blue-300">{t('financialWorkspace.statement')}</Link>
    </details>
  </div></div>;
}
