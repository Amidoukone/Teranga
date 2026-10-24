import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { updateOperatingOffer } from '../services/operations';
import OperationsQueue from '../features/mission-tracking/OperationsQueue';

function OfferSettings({ entry, onSaved, user }) {
  const { t } = useTranslation();
  const initial = entry.offering || {};
  const rules = initial.providerRules || {};
  const policy = rules.coordination || {};
  const [enabled, setEnabled] = useState(policy.enabled === true);
  const [outcome, setOutcome] = useState(rules.serviceOutcome || entry.definition?.description || '');
  const [sla, setSla] = useState(initial.slaMinutes || '');
  const [attempts, setAttempts] = useState(policy.maxAttempts || 3);
  const [seconds, setSeconds] = useState(policy.acceptanceSeconds || 120);
  const [required, setRequired] = useState(rules.requiredEvidenceTypes || entry.definition?.requiredEvidenceTypes || []);
  const [startMinutes, setStartMinutes] = useState(policy.startMinutes || 15);
  const [escalationMinutes, setEscalationMinutes] = useState(policy.escalationMinutes || 15);
  const [reminderMinutes, setReminderMinutes] = useState(policy.reminderMinutes || 60);
  const [saving, setSaving] = useState(false);
  const sending = useRef(false);
  const [message, setMessage] = useState('');
  const [isActive, setIsActive] = useState(initial.isActive !== false);
  useEffect(() => { setIsActive(initial.isActive !== false); }, [initial.isActive]);
  const canManage = !user?.regionId || String(user.regionId) === String(entry.territory?.regionId);
  async function changeAvailability() {
    if (sending.current) return; sending.current = true;
    const next = !isActive;
    setSaving(true); setMessage('');
    try {
      await updateOperatingOffer(entry.id, { isActive: next });
      setIsActive(next);
      setMessage(t(next ? 'operations.offerReopened' : 'operations.offerSuspended'));
      await onSaved();
    } catch (error) { setMessage(error?.response?.data?.error || t('operations.failed')); }
    finally { sending.current = false; setSaving(false); }
  }
  async function save(event) {
    event.preventDefault(); if (sending.current) return; sending.current = true; setSaving(true); setMessage('');
    try {
      await updateOperatingOffer(entry.id, { slaMinutes: Number(sla), providerRules: { ...rules, serviceOutcome: outcome,
        requiredEvidenceTypes: required, coordination: { ...policy, enabled, maxAttempts: Number(attempts), acceptanceSeconds: Number(seconds), startMinutes: Number(startMinutes), escalationMinutes: Number(escalationMinutes), reminderMinutes: Number(reminderMinutes) } } });
      setMessage(t('operations.saved')); onSaved();
    } catch (error) { setMessage(error?.response?.data?.error || t('operations.failed')); }
    finally { sending.current = false; setSaving(false); }
  }
  const prefix = `offer-${entry.id}`;
  return <form onSubmit={save} className="space-y-3 rounded-2xl border border-border bg-surface-card p-4">
    <h3 className="font-semibold">{entry.definition?.name} · {entry.territory?.name}</h3>
    <p className="text-sm text-text-secondary">{entry.operatingOrganization?.displayName || entry.operatingOrganization?.legalName}</p>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm font-medium">{t(isActive ? 'operations.offerOpen' : 'operations.offerClosed')}</p>
      <button type="button" disabled={saving || !canManage} onClick={changeAvailability} className="btn-secondary rounded-lg px-3 py-2 text-sm disabled:opacity-50">{t(isActive ? 'operations.suspendOffer' : 'operations.reopenOffer')}</button>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="text-sm" htmlFor={`${prefix}-start`}>{t('operations.startMinutes')}<input id={`${prefix}-start`} type="number" min="1" max="1440" required value={startMinutes} disabled={!canManage} onChange={(event) => setStartMinutes(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface-main p-2" /></label>
      <label className="text-sm" htmlFor={`${prefix}-escalation`}>{t('operations.escalationMinutes')}<input id={`${prefix}-escalation`} type="number" min="1" max="1440" required value={escalationMinutes} disabled={!canManage} onChange={(event) => setEscalationMinutes(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface-main p-2" /></label>
      <label className="text-sm" htmlFor={`${prefix}-reminder`}>{t('operations.reminderMinutes')}<input id={`${prefix}-reminder`} type="number" min="5" max="1440" required value={reminderMinutes} disabled={!canManage} onChange={(event) => setReminderMinutes(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface-main p-2" /></label>
    </div>
    <p className="text-xs text-text-secondary">{t('operations.availabilityHint')}</p>
    <label className="block text-sm" htmlFor={`${prefix}-outcome`}>{t('operations.outcome')}</label>
    <textarea id={`${prefix}-outcome`} value={outcome} onChange={(event) => setOutcome(event.target.value)} minLength={10} maxLength={2000} required disabled={!canManage} className="w-full rounded-lg border border-border bg-surface-main p-2" />
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="text-sm" htmlFor={`${prefix}-sla`}>{t('operations.sla')}
        <input id={`${prefix}-sla`} type="number" min="1" max="10080" required value={sla} disabled={!canManage} onChange={(event) => setSla(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface-main p-2" /></label>
      <label className="text-sm" htmlFor={`${prefix}-attempts`}>{t('operations.maxAttempts')}
        <input id={`${prefix}-attempts`} type="number" min="1" max="10" required value={attempts} disabled={!canManage} onChange={(event) => setAttempts(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface-main p-2" /></label>
      <label className="text-sm" htmlFor={`${prefix}-seconds`}>{t('operations.acceptanceSeconds')}
        <input id={`${prefix}-seconds`} type="number" min="30" max="3600" required value={seconds} disabled={!canManage} onChange={(event) => setSeconds(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface-main p-2" /></label>
    </div>
    <fieldset disabled={!canManage} className="flex flex-wrap gap-3"><legend className="mb-2 text-sm">{t('operations.proofs')}</legend>
      {['photo', 'document', 'receipt', 'other'].map((kind) => <label key={kind} className="text-sm"><input type="checkbox" checked={required.includes(kind)} onChange={(event) => setRequired(event.target.checked ? [...required, kind] : required.filter((value) => value !== kind))} /> {t(`operations.evidence.${kind}`)}</label>)}
    </fieldset>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} disabled={!canManage || (!entry.definition?.legacyTradeCategoryId && entry.definition?.executionProfile !== 'agent')} onChange={(event) => setEnabled(event.target.checked)} />{t('operations.enableAutomatic')}</label>
    <p className="text-xs text-text-secondary">{t('operations.activationHint')}</p>
    <button type="submit" disabled={saving || !canManage} className="btn-primary rounded-lg px-4 py-2 disabled:opacity-50">{saving ? t('operations.saving') : t('operations.save')}</button>
    {message && <p role="status" className="text-sm">{message}</p>}
  </form>;
}

export default function OperationsPage(props) {
  return <OperationsQueue {...props} renderOffer={(entry, onSaved, user) => <OfferSettings key={entry.id} entry={entry} onSaved={onSaved} user={user} />} />;
}
