import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createTask } from '../../services/tasks';
import { CURRENCY_LABELS, TASK_PRIORITIES, TASK_TYPES } from '../../utils/labels';

export default function StepCreationForm({ service, onWrite, onSaved, onClose }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ title: '', description: '', type: 'other', priority: 'normal', dueDate: '', estimatedCost: '', currency: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sending = useRef(false);
  function change(name, value) { setForm((current) => ({ ...current, [name]: value })); }
  async function submit(event) {
    event.preventDefault(); if (sending.current) return;
    sending.current = true; setBusy(true); setError('');
    try { await onWrite(() => createTask({ ...form, serviceId: service.id })); onSaved(); }
    catch (failure) { setError(failure?.response?.data?.error || t('serviceSteps.actionFailed')); }
    finally { sending.current = false; setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-surface-main p-4">
    <fieldset disabled={busy} className="space-y-3 disabled:opacity-60">
      <label htmlFor="new-step-title" className="block text-sm">{t('serviceSteps.name')}<input id="new-step-title" value={form.title} maxLength={255} required onChange={(event) => change('title', event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-surface-card px-3" /></label>
      <label htmlFor="new-step-description" className="block text-sm">{t('serviceSteps.description')}<textarea id="new-step-description" value={form.description} onChange={(event) => change('description', event.target.value)} className="mt-1 w-full rounded-xl border border-border bg-surface-card p-3" /></label>
      <details className="rounded-xl border border-border p-3"><summary className="min-h-11 cursor-pointer text-sm">{t('serviceSteps.advanced')}</summary><div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor="new-step-type" className="text-sm">{t('serviceSteps.type')}<select id="new-step-type" value={form.type} onChange={(event) => change('type', event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-surface-card p-2">{Object.keys(TASK_TYPES).map((value) => <option key={value} value={value}>{t(`labels.task.types.${value}`)}</option>)}</select></label>
        <label htmlFor="new-step-priority" className="text-sm">{t('serviceSteps.priority')}<select id="new-step-priority" value={form.priority} onChange={(event) => change('priority', event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-surface-card p-2">{Object.keys(TASK_PRIORITIES).map((value) => <option key={value} value={value}>{t(`labels.task.priorities.${value}`)}</option>)}</select></label>
        <label htmlFor="new-step-due" className="text-sm">{t('serviceSteps.due')}<input id="new-step-due" type="datetime-local" value={form.dueDate} onChange={(event) => change('dueDate', event.target.value)} className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-border bg-surface-card p-2" /></label>
        <label htmlFor="new-step-cost" className="text-sm">{t('serviceSteps.cost')}<input id="new-step-cost" type="number" min="0" step="0.01" value={form.estimatedCost} onChange={(event) => change('estimatedCost', event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-surface-card p-2" /></label>
        <label htmlFor="new-step-currency" className="text-sm">{t('serviceSteps.currency')}<select id="new-step-currency" value={form.currency} onChange={(event) => change('currency', event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-surface-card p-2"><option value="">{t('common.currencyFromService')} ({service.currency})</option>{Array.from(new Set([service.currency, ...Object.keys(CURRENCY_LABELS)])).filter(Boolean).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      </div></details>
      <p className="text-xs text-text-secondary">{t('serviceSteps.unassigned')}</p>
      <div className="flex flex-wrap gap-3"><button type="submit" className="btn-primary min-h-11 rounded-xl px-4 text-sm">{t(busy ? 'operations.saving' : 'serviceSteps.create')}</button><button type="button" onClick={onClose} className="min-h-11 text-sm underline">{t('serviceSteps.cancel')}</button></div>
    </fieldset>
    {error && <p role="alert" className="text-sm">{error}</p>}
  </form>;
}
