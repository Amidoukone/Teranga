import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { advanceAssignment } from '../../services/operations';

export default function WorkAssignmentCard({ item, onSaved, canAdvance = true, clientValidation = false, embedded = false, readiness, reviewBlocked = false, from }) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sending = useRef(false);
  const next = clientValidation ? (item.status === 'completed' ? 'validated' : null) : !canAdvance ? null : item.entityType === 'project' ? { created: 'in_progress', in_progress: 'completed' }[item.status]
    : { created: 'processing', paid: 'processing', processing: 'shipped', shipped: 'delivered' }[item.status];
  const finishing = ['completed', 'delivered'].includes(next);
  const incomplete = Boolean(embedded && finishing && readiness && (readiness.openPhases || readiness.openTasks || !readiness.hasProof));
  async function advance(event) {
    event.preventDefault(); if (sending.current || incomplete || (clientValidation && reviewBlocked)) return; sending.current = true; setBusy(true); setError('');
    try { await advanceAssignment(item.entityType, item.id, { status: next, ...(finishing ? { summary } : {}) }); await onSaved(); }
    catch (failure) { setError(failure?.response?.data?.error || t('operations.failed')); }
    finally { sending.current = false; setBusy(false); }
  }
  return <article className="space-y-2 rounded-xl border border-border p-3">
    {!embedded && <Link to={`/${item.entityType === 'project' ? 'projects' : 'orders'}/${item.id}`} state={{ from }} className="font-semibold underline">{t(`operations.entities.${item.entityType}`)} #{item.id} · {item.title || item.code}</Link>}
    <p className="text-sm">{t(`agentCoordination.statuses.${item.status}`, { defaultValue: item.status })}</p>
    {item.status === 'created' && item.coordination?.attempts?.at(-1)?.startDeadlineAt && <p className="text-sm font-medium">{t('agentCoordination.startBefore')} : {new Date(item.coordination.attempts.at(-1).startDeadlineAt).toLocaleString()}</p>}
    {item.coordination?.policy?.completionReport?.summary && <div className="rounded-xl bg-surface-main p-3"><h3 className="text-sm font-bold">{t('dossier.report')}</h3><p className="mt-2 whitespace-pre-wrap text-sm">{item.coordination.policy.completionReport.summary}</p>
      <p className="mt-2 text-xs text-text-secondary">{t('dossier.reportAuthor', { id: item.coordination.policy.completionReport.reporterId })}{item.coordination.policy.completionReport.submittedAt ? ` · ${t('dossier.reportDate', { date: new Date(item.coordination.policy.completionReport.submittedAt).toLocaleString() })}` : ''}</p>
    </div>}
    {embedded && readiness && <div className="space-y-2 rounded-xl border border-border p-3" aria-label={t('dossier.readiness')}>
      <h3 className="text-sm font-bold">{t('dossier.readiness')}</h3>
      {item.entityType === 'project' && <>{readiness.openPhases > 0 && <p className="text-sm">{t('dossier.openPhases', { count: readiness.openPhases })} <a href="#project-phases" className="underline">{t('dossier.realisation')}</a></p>}
        {readiness.openTasks > 0 && <p className="text-sm">{t('dossier.openTasks', { count: readiness.openTasks })} <a href="#project-tasks" className="underline">{t('dossier.projectTasks')}</a></p>}
        {!readiness.openPhases && !readiness.openTasks && <p className="text-sm">{t('dossier.phasesReady')}</p>}</>}
      <p className="text-sm">{t(readiness.hasProof ? 'dossier.proofReady' : item.entityType === 'project' ? 'dossier.projectProof' : 'dossier.orderProof')}{!readiness.hasProof && <> <a href={`#${item.entityType === 'project' ? 'project-documents' : 'order-evidences'}`} className="underline">{t('dossier.addDocument')}</a></>}</p>
      <p className="text-xs text-text-secondary">{t('dossier.advisory')}</p>
    </div>}
    {clientValidation && reviewBlocked && next && <p role="alert" className="text-sm">{t('dossier.reviewUnavailable')}</p>}
    {next && <form onSubmit={advance} className="space-y-2"><fieldset disabled={busy || (clientValidation && reviewBlocked)} className="space-y-2 disabled:opacity-60">
      {finishing && <><label className="block text-sm" htmlFor={`work-report-${item.entityType}-${item.id}`}>{t('completion.summary')}</label>
        <textarea id={`work-report-${item.entityType}-${item.id}`} value={summary} onChange={(event) => setSummary(event.target.value)} minLength={20} maxLength={4000} required className="w-full rounded-lg border border-border bg-surface-main p-2" />
        <p className="text-sm text-text-secondary">{t(embedded ? item.entityType === 'project' ? 'dossier.projectProof' : 'dossier.orderProof' : 'agentCoordination.proofHint')}</p></>}
      <button type="submit" disabled={busy || incomplete} className="btn-primary min-h-11 rounded-lg px-3 py-2">{t(`agentCoordination.actions.${next}`)}</button>
    </fieldset></form>}
    {error && <p role="alert">{error}</p>}
  </article>;
}
