import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createTransaction, updateTransaction } from '../../services/transactions';
import { CURRENCY_LABELS } from '../../utils/labels';
import { REFERENCE_KINDS, TRANSACTION_STATUSES, TRANSACTION_TYPES, transactionProofHref, validReference } from './transactionPresentation';

const inputClass = 'mt-1 min-h-11 w-full min-w-0 rounded-xl border border-border bg-surface-main p-3 text-sm';

export default function TransactionForm({ user, context, entry, initialTaskId = '', onSaved, onCancel }) {
  const { t } = useTranslation();
  const admin = user?.role === 'admin';
  const [form, setForm] = useState(() => ({ type: entry?.type || (context?.kind === 'order' ? 'revenue' : 'expense'), amount: entry?.amount || '', currency: entry?.currency || '', paymentMethod: entry?.paymentMethod || '', description: entry?.description || '', status: entry?.status || 'pending', serviceId: '', taskId: initialTaskId, orderId: '', projectId: '', proofFile: null }));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const alive = useRef(true), sending = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const changes = (field) => (event) => setForm((previous) => ({ ...previous, [field]: event.target.value }));
  const currencies = [...new Set([...Object.keys(CURRENCY_LABELS), context?.currency, form.currency].filter(Boolean))].sort();
  const proofRequired = entry ? admin && form.status === 'completed' && !transactionProofHref(entry.proofFile) : !form.orderId && !form.projectId && (!context || !['order', 'project'].includes(context.kind));
  async function submit(event) {
    event.preventDefault();
    if (sending.current) return;
    const amount = String(form.amount).trim().replace(',', '.');
    const requiresPositive = !entry && !['order', 'project'].includes(context?.kind) && !form.orderId && !form.projectId && form.type !== 'adjustment';
    if ((!entry || admin) && (!amount || !Number.isFinite(Number(amount)) || (requiresPositive && Number(amount) <= 0))) { setError(t('financialWorkspace.invalidAmount')); return; }
    const links = Object.fromEntries(REFERENCE_KINDS.filter((kind) => form[`${kind}Id`]).map((kind) => [`${kind}Id`, Number(form[`${kind}Id`])]));
    if (Object.values(links).some((value) => !validReference(value))) { setError(t('financialWorkspace.invalidReference')); return; }
    sending.current = true; setBusy(true); setError('');
    try {
      const common = { paymentMethod: form.paymentMethod, description: form.description, proofFile: form.proofFile };
      if (entry) {
        await updateTransaction(entry.id, { ...common, ...(admin ? { type: form.type, amount, currency: form.currency || entry.currency, status: form.status } : {}) });
      } else {
        await createTransaction({ ...common, ...links, ...(context?.kind === 'task' && context.serviceId ? { serviceId: Number(context.serviceId) } : {}), ...(context ? { [`${context.kind}Id`]: Number(context.id) } : {}), type: form.type, amount, currency: form.currency || undefined });
      }
      if (alive.current) onSaved();
    } catch (failure) { if (alive.current) setError(failure?.response?.data?.error || t('financialWorkspace.failed')); }
    finally { sending.current = false; if (alive.current) setBusy(false); }
  }
  return <form aria-label={t(entry ? 'financialWorkspace.edit' : 'financialWorkspace.add')} onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-surface-card p-4">
    <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
      {(!entry || admin) && <>
        <label className="text-sm">{t('financialWorkspace.type')}<select aria-label={t('financialWorkspace.type')} value={form.type} onChange={changes('type')} className={inputClass}>{TRANSACTION_TYPES.map((type) => <option key={type} value={type}>{t(`transactions.type.${type}`)}</option>)}</select></label>
        <label className="text-sm">{t('financialWorkspace.amount')}<input aria-label={t('financialWorkspace.amount')} inputMode="decimal" required value={form.amount} maxLength={32} onChange={changes('amount')} className={inputClass} /></label>
        <label className="text-sm">{t('financialWorkspace.currency')}<select aria-label={t('financialWorkspace.currency')} value={form.currency} onChange={changes('currency')} className={inputClass}>
          {!entry && <option value="">{t(context ? 'financialWorkspace.inheritedCurrency' : 'financialWorkspace.localCurrency')}{context?.currency ? ` (${context.currency})` : ''}</option>}
          {currencies.map((code) => <option key={code} value={code}>{code}</option>)}
        </select></label>
      </>}
      {entry && admin && <label className="text-sm">{t('financialWorkspace.status')}<select aria-label={t('financialWorkspace.status')} value={form.status} onChange={changes('status')} className={inputClass}>{TRANSACTION_STATUSES.map((status) => <option key={status} value={status}>{t(`transactions.status.${status}`)}</option>)}</select></label>}
      <label className="text-sm">{t('financialWorkspace.method')}<input aria-label={t('financialWorkspace.method')} value={form.paymentMethod} onChange={changes('paymentMethod')} maxLength={255} className={inputClass} /></label>
      <label className="text-sm sm:col-span-2">{t('financialWorkspace.description')}<textarea aria-label={t('financialWorkspace.description')} value={form.description} onChange={changes('description')} maxLength={5000} rows={2} className={inputClass} /></label>
      <label className="text-sm sm:col-span-2">{t('financialWorkspace.proof')}<input aria-label={t('financialWorkspace.proof')} type="file" required={proofRequired} accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx" onChange={(event) => setForm((previous) => ({ ...previous, proofFile: event.target.files?.[0] || null }))} className={inputClass} /></label>
      {proofRequired && <p className="text-xs text-text-secondary sm:col-span-2">{t('financialWorkspace.proofRequired')}</p>}
      {form.type === 'adjustment' && <p className="text-xs text-text-secondary sm:col-span-2">{t('financialWorkspace.adjustmentHint')}</p>}
      {!entry && <details className="sm:col-span-2"><summary className="min-h-11 cursor-pointer py-3 text-sm">{t('financialWorkspace.references')}</summary><div className="grid gap-3 sm:grid-cols-2">{REFERENCE_KINDS.filter((kind) => kind !== context?.kind && !(context?.kind === 'task' && context.serviceId && kind === 'service')).map((kind) => <label key={kind} className="text-sm">{t(`financialWorkspace.${kind}`)} #{' '}<input aria-label={`${t(`financialWorkspace.${kind}`)} #`} type="number" min="1" step="1" value={form[`${kind}Id`]} onChange={changes(`${kind}Id`)} className={inputClass} /></label>)}</div></details>}
    </fieldset>
    {context?.kind === 'order' && !entry && <p className="text-sm text-text-secondary">{t('financialWorkspace.orderRule')}</p>}
    {error && <p role="alert" className="app-alert app-alert-error">{error}</p>}
    <div className="flex flex-wrap gap-3"><button type="submit" disabled={busy} className="btn-primary min-h-11 rounded-xl px-4">{t(busy ? 'financialWorkspace.saving' : 'financialWorkspace.save')}</button><button type="button" disabled={busy} onClick={onCancel} className="btn-secondary min-h-11 rounded-xl px-4">{t('financialWorkspace.cancel')}</button></div>
  </form>;
}
