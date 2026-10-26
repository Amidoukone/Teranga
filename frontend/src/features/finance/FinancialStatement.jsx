import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAllTransactions } from '../../services/transactions';
import { GEO_SELECTION_CHANGED_EVENT } from '../../services/geo';
import { me } from '../../services/auth';
import { useLocale } from '../../i18n/useLocale';
import { getTransactionCurrency, summarizeTransactionsByCurrency } from '../../utils/currency';
import { statementCSV, TRANSACTION_STATUSES, TRANSACTION_TYPES } from './transactionPresentation';

export default function FinancialStatement({ user: providedUser, embedded = false, filters: providedFilters, onFiltersChange }) {
  const { t } = useTranslation();
  const { formatNumber } = useLocale();
  const [rows, setRows] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [user, setUser] = useState(providedUser);
  const [localFilters, setLocalFilters] = useState({});
  const { currency = '', status = '', type = '', q = '', startDate: from = '', endDate: to = '', role = '', linked = false } = providedFilters || localFilters;
  const change = (field, value) => onFiltersChange ? onFiltersChange({ [field]: value }) : setLocalFilters((previous) => ({ ...previous, [field]: value }));
  const alive = useRef(true), version = useRef(0);
  const load = useCallback(async () => {
    const request = ++version.current; setLoading(true); setError('');
    try {
      const current = providedUser || (await me())?.user;
      if (!['client', 'agent', 'admin'].includes(current?.role)) throw new Error('No financial access');
      const result = await getAllTransactions();
      if (alive.current && request === version.current) { setUser(current); setRows(result); }
    } catch (failure) {
      if (alive.current && request === version.current) { if ([401, 403].includes(failure?.response?.status)) setRows(null); setError(t('financialWorkspace.failed')); }
    } finally { if (alive.current && request === version.current) setLoading(false); }
  }, [providedUser, t]);
  useEffect(() => {
    alive.current = true; load();
    const scopeChanged = () => { setRows(null); load(); };
    window.addEventListener(GEO_SELECTION_CHANGED_EVENT, scopeChanged);
    return () => { alive.current = false; version.current += 1; window.removeEventListener(GEO_SELECTION_CHANGED_EVENT, scopeChanged); };
  }, [load]);
  const invalidDates = Boolean(from && to && from > to) || [from, to].some((value) => value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(new Date(value).getTime())));
  const currencies = useMemo(() => [...new Set((rows || []).map(getTransactionCurrency))].sort(), [rows]);
  const selectedCurrency = currency || currencies[0] || '';
  const currencyOptions = [...new Set([selectedCurrency, ...currencies].filter(Boolean))];
  const filtered = useMemo(() => (rows || []).filter((entry) => {
    if (getTransactionCurrency(entry) !== selectedCurrency || (status && entry.status !== status) || (type && entry.type !== type) || (role && entry.user?.role !== role)) return false;
    if (linked && !['service', 'task', 'order', 'project'].some((kind) => entry[`${kind}Id`] || entry[kind])) return false;
    if (q && ![entry.description, entry.paymentMethod, entry.user?.email, entry.service?.title, entry.project?.title, entry.order?.code].filter(Boolean).join(' ').toLowerCase().includes(q.toLowerCase())) return false;
    const date = new Date(entry.createdAt).getTime();
    return (!from || date >= new Date(`${from}T00:00:00`).getTime()) && (!to || date <= new Date(`${to}T23:59:59.999`).getTime());
  }), [rows, selectedCurrency, status, type, q, from, to, role, linked]);
  const totals = summarizeTransactionsByCurrency(filtered)[0];
  function exportCSV() {
    const url = URL.createObjectURL(new Blob([statementCSV(filtered)], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = `teranga-${selectedCurrency || 'bilan'}-${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(url);
  }
  const input = 'mt-1 min-h-11 w-full rounded-xl border border-border bg-surface-main p-2 text-sm';
  const body = <section aria-label={t('financialWorkspace.statement')} className="space-y-4">
    {!embedded && <h1 className="app-page-headline">{t('financialWorkspace.statement')}</h1>}
    <p className="text-sm text-text-secondary">{t('financialWorkspace.statementHint')}</p>
    <div className="grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-3">
      <label className="text-sm">{t('financialWorkspace.currency')}<select aria-label={t('financialWorkspace.currency')} value={selectedCurrency} onChange={(event) => change('currency', event.target.value)} className={input}>{currencyOptions.map((code) => <option key={code} value={code}>{code}</option>)}</select></label>
      <label className="text-sm">{t('financialWorkspace.status')}<select aria-label={t('financialWorkspace.status')} value={status} onChange={(event) => change('status', event.target.value)} className={input}><option value="">{t('financialWorkspace.allStatuses')}</option>{TRANSACTION_STATUSES.map((value) => <option key={value} value={value}>{t(`transactions.status.${value}`)}</option>)}</select></label>
      <label className="text-sm">{t('financialWorkspace.type')}<select aria-label={t('financialWorkspace.type')} value={type} onChange={(event) => change('type', event.target.value)} className={input}><option value="">{t('financialWorkspace.all')}</option>{TRANSACTION_TYPES.map((value) => <option key={value} value={value}>{t(`transactions.type.${value}`)}</option>)}</select></label>
    </div>
    <details className="rounded-2xl border border-border p-4"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">{t('financialWorkspace.advanced')}</summary><div className="grid gap-3 sm:grid-cols-3">
      <label className="text-sm">{t('financialWorkspace.search')}<input aria-label={t('financialWorkspace.search')} value={q} onChange={(event) => change('q', event.target.value)} className={input} /></label>
      {[['from',from,'startDate'],['to',to,'endDate']].map(([label,value,field]) => <label key={label} className="text-sm">{t(`financialWorkspace.${label}`)}<input aria-label={t(`financialWorkspace.${label}`)} type="date" value={value} onChange={(event) => change(field, event.target.value)} className={input} /></label>)}
      {user?.role === 'admin' && <label className="text-sm">{t('financialWorkspace.role')}<select aria-label={t('financialWorkspace.role')} value={role} onChange={(event) => change('role', event.target.value)} className={input}><option value="">{t('financialWorkspace.all')}</option>{(user.countryId || user.regionId ? ['client','agent'] : ['client','agent','admin']).map((value) => <option key={value} value={value}>{t(`roles.${value}`)}</option>)}</select></label>}
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={linked} onChange={(event) => change('linked', event.target.checked)} />{t('financialWorkspace.linkedOnly')}</label>
    </div></details>
    <button type="button" disabled={loading} onClick={load} className="min-h-11 text-sm underline">{t('financialWorkspace.refresh')}</button>
    {loading && <p role="status">{t('financialWorkspace.loading')}</p>}
    {error && <p role="alert" className="app-alert app-alert-error">{error}</p>}
    {invalidDates && <p role="alert">{t('financialWorkspace.invalidDates')}</p>}
    {!loading && !error && !invalidDates && (totals ? <>
      <p className="text-sm">{t('financialWorkspace.count', { count: filtered.length })} · {t(status ? `transactions.status.${status}` : 'financialWorkspace.allStatuses')} · {selectedCurrency}</p>
      <dl aria-label={selectedCurrency} className="grid gap-3 sm:grid-cols-2">{['revenues','expenses','commissions','adjustments','balance'].map((key) => <div key={key} className="rounded-xl border border-border p-4"><dt className="text-sm text-text-secondary">{t(`financialWorkspace.${key}`)}</dt><dd className="mt-1 text-xl font-semibold">{formatNumber(totals[key])} {selectedCurrency}</dd></div>)}</dl>
      <button type="button" onClick={exportCSV} className="btn-secondary min-h-11 rounded-xl px-4 text-sm">{t('financialWorkspace.export')}</button>
    </> : <p>{t('financialWorkspace.noTotals')}</p>)}
  </section>;
  return embedded ? body : <div className="app-page-wrap"><div className="app-page-shell max-w-5xl">{body}</div></div>;
}
