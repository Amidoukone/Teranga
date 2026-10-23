import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { advanceAssignment } from '../../services/operations';

export default function WorkAssignmentCard({ item, onSaved, canAdvance = true, clientValidation = false }) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const next = clientValidation ? (item.status === 'completed' ? 'validated' : null) : !canAdvance ? null : item.entityType === 'project' ? { created: 'in_progress', in_progress: 'completed' }[item.status]
    : { created: 'processing', paid: 'processing', processing: 'shipped', shipped: 'delivered' }[item.status];
  const finishing = ['completed', 'delivered'].includes(next);
  async function advance(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await advanceAssignment(item.entityType, item.id, { status: next, ...(finishing ? { summary } : {}) }); await onSaved(); }
    catch (failure) { setError(failure?.response?.data?.error || t('operations.failed')); }
    finally { setBusy(false); }
  }
  return <article className="space-y-2 rounded-xl border border-border p-3">
    <Link to={`/${item.entityType === 'project' ? 'projects' : 'orders'}/${item.id}`} className="font-semibold underline">{t(`operations.entities.${item.entityType}`)} #{item.id} · {item.title || item.code}</Link>
    <p className="text-sm">{t(`agentCoordination.statuses.${item.status}`, { defaultValue: item.status })}</p>
    {item.status === 'created' && item.coordination?.attempts?.at(-1)?.startDeadlineAt && <p className="text-sm font-medium">{t('agentCoordination.startBefore')} : {new Date(item.coordination.attempts.at(-1).startDeadlineAt).toLocaleString()}</p>}
    {item.coordination?.policy?.completionReport?.summary && <p className="whitespace-pre-wrap text-sm">{item.coordination.policy.completionReport.summary}</p>}
    {next && <form onSubmit={advance} className="space-y-2">
      {finishing && <><label className="block text-sm" htmlFor={`work-report-${item.entityType}-${item.id}`}>{t('completion.summary')}</label>
        <textarea id={`work-report-${item.entityType}-${item.id}`} value={summary} onChange={(event) => setSummary(event.target.value)} minLength={20} maxLength={4000} required className="w-full rounded-lg border border-border bg-surface-main p-2" />
        <p className="text-sm text-text-secondary">{t('agentCoordination.proofHint')}</p></>}
      <button type="submit" disabled={busy} className="btn-primary rounded-lg px-3 py-2">{t(`agentCoordination.actions.${next}`)}</button>
    </form>}
    {error && <p role="alert">{error}</p>}
  </article>;
}
