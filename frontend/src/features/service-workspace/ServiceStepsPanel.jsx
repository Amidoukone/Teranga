import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGeo } from '../../contexts/GeoContext';
import { getServiceSteps, updateTaskStatus } from '../../services/tasks';
import { useLocale } from '../../i18n/useLocale';
import PaginationBar from '../../components/PaginationBar';
import StepEvidencePanel from './StepEvidencePanel';
import StepCreationForm from './StepCreationForm';
import StepAssignmentForm from './StepAssignmentForm';

export default function ServiceStepsPanel(props) {
  const { user, countryId, regionId } = useGeo();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const rawTaskId = Number(params.get('etape'));
  const focusedId = Number.isSafeInteger(rawTaskId) && rawTaskId > 0 ? rawTaskId : null;
  const showProofs = Boolean(focusedId && params.get('pieces') === '1');
  params.delete('etape'); params.delete('pieces');
  const rest = params.toString();
  const allStepsTo = `${location.pathname}${rest ? `?${rest}` : ''}#steps`;
  return <Steps key={JSON.stringify([props.serviceId, user?.id, countryId, regionId, focusedId, showProofs])} {...props} focusedId={focusedId} showProofs={showProofs} allStepsTo={allStepsTo} returnState={location.state} />;
}

function Steps({ serviceId, standalone = false, focusedId, showProofs, allStepsTo, returnState, onContext }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(standalone || Boolean(focusedId) || window.location.hash === '#steps');
  const [creating, setCreating] = useState(false);
  const [writing, setWriting] = useState(false);
  const alive = useRef(true);
  const generation = useRef(0);
  const mutation = useRef(false);
  const currentPage = useRef(page); currentPage.current = page;
  const expanded = useRef(open); expanded.current = open;
  const contextCallback = useRef(onContext); contextCallback.current = onContext;
  const focusedOnce = useRef(false);
  const visible = data?.page === page ? data.value : null;
  const load = useCallback(async () => {
    if (!alive.current) return;
    const version = ++generation.current; setLoading(true);
    try {
      const result = await getServiceSteps(serviceId, { page, limit: 20, ...(focusedId ? { taskId: focusedId } : {}) });
      if (!alive.current || version !== generation.current || currentPage.current !== page) return;
      if (page > 1 && (page - 1) * 20 >= result.pagination.total) { setPage(Math.max(1, Math.ceil(result.pagination.total / 20))); return; }
      setData({ page, value: result }); setError('');
      contextCallback.current?.(result.serviceContext, result.viewer);
    } catch (failure) {
      if (alive.current && version === generation.current && currentPage.current === page) {
        if ([401, 403, 404].includes(failure?.response?.status)) { setData(null); setCreating(false); }
        setError(failure?.response?.data?.error || t('serviceSteps.failed'));
      }
    } finally { if (alive.current && version === generation.current) setLoading(false); }
  }, [serviceId, page, focusedId, t]);
  useEffect(() => {
    alive.current = true; load();
    const refresh = () => { if (expanded.current && document.visibilityState === 'visible' && !mutation.current) load(); };
    const timer = setInterval(refresh, 30000); window.addEventListener('online', refresh);
    return () => { alive.current = false; generation.current += 1; clearInterval(timer); window.removeEventListener('online', refresh); };
  }, [load]);
  async function write(action) {
    if (mutation.current) throw new Error(t('operations.saving'));
    mutation.current = true; generation.current += 1; setWriting(true); setMessage(''); setError('');
    try {
      const result = await action();
      if (alive.current) { await load(); if (alive.current) setMessage(t('serviceSteps.saved')); }
      return result;
    } catch (failure) {
      if (alive.current) { await load(); if (alive.current) setError(failure?.response?.data?.error || t('serviceSteps.actionFailed')); }
      throw failure;
    } finally { mutation.current = false; if (alive.current) setWriting(false); }
  }
  useEffect(() => {
    const anchor = () => { if (window.location.hash === '#steps') setOpen(true); };
    window.addEventListener('hashchange', anchor); return () => window.removeEventListener('hashchange', anchor);
  }, []);
  useEffect(() => {
    if (!focusedId || !visible || loading || focusedOnce.current) return;
    focusedOnce.current = true;
    const section = document.getElementById('steps');
    section?.focus({ preventScroll: true }); section?.scrollIntoView?.({ block: 'start' });
  }, [focusedId, visible, loading]);
  if (!standalone && !focusedId && !loading && !error && visible?.pagination.total === 0 && !visible.canCreate) return null;
  const hasSteps = (visible?.pagination.total || 0) > 0;
  return <section id="steps" tabIndex={-1} className="scroll-mt-24 space-y-3" aria-label={t('serviceSteps.title')}>
    {standalone && visible?.serviceContext && <Link to={`/services/${serviceId}`} className="inline-flex min-h-11 items-center text-sm underline">{t('serviceSteps.back')}</Link>}
    <details open={open || creating} onToggle={(event) => setOpen(event.currentTarget.open)} className="rounded-2xl border border-border bg-surface-card p-4">
      <summary className="min-h-11 cursor-pointer font-semibold">{hasSteps ? t('serviceSteps.title') : t('serviceSteps.organize')}{hasSteps && <span className="ml-2 text-sm font-normal text-text-secondary">({visible.pagination.total})</span>}</summary>
      <div className="space-y-4 pt-3">
        {focusedId && <p className="rounded-xl border border-blue-500/30 p-3 text-sm">{t('serviceSteps.focused', { id: focusedId })} <Link to={allStepsTo} state={returnState} className="inline-flex min-h-11 items-center underline">{t('serviceSteps.allSteps')}</Link></p>}
        <p className="text-sm text-text-secondary">{t('serviceSteps.intro')}</p>
        <p className="text-xs text-text-secondary">{t('serviceSteps.separate')}</p>
        <button type="button" onClick={load} disabled={loading || writing} className="min-h-11 text-sm underline">{t('serviceSteps.refresh')}</button>
        {loading && <p role="status" className="text-sm">{t('serviceSteps.loading')}</p>}
        {error && <p role="alert" className="app-alert app-alert-error text-sm">{error} <button type="button" onClick={load} disabled={loading || writing} className="min-h-11 underline">{t('serviceOrders.retry')}</button></p>}
        <fieldset disabled={writing} className="space-y-4 disabled:opacity-70">
          {(standalone || focusedId) && visible?.pagination.total === 0 && <p className="text-sm text-text-secondary">{t(focusedId ? 'serviceSteps.focusMissing' : 'serviceSteps.empty')}</p>}
          {!focusedId && visible?.canCreate && !creating && <button type="button" onClick={() => setCreating(true)} className="btn-secondary min-h-11 rounded-xl px-4 text-sm">{t('serviceSteps.add')}</button>}
          {creating && visible?.canCreate && <StepCreationForm service={visible.serviceContext} onWrite={write} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); if (page !== 1) setPage(1); }} />}
          {visible?.tasks.map((task) => <StepCard key={task.id} task={task} service={visible.serviceContext} serviceId={serviceId} viewer={visible.viewer} onWrite={write} initialProofs={showProofs} />)}
          {visible && visible.pagination.total > 20 && <PaginationBar page={page} pageSize={20} totalItems={visible.pagination.total} onPageChange={setPage} showPageSize={false} />}
        </fieldset>
        {message && <p role="status" className="text-sm">{message}</p>}
      </div>
    </details>
    {error && !open && <p role="alert" className="text-sm">{error} <button type="button" onClick={() => { setOpen(true); load(); }} className="min-h-11 underline">{t('serviceOrders.retry')}</button></p>}
  </section>;
}

export function StepCard({ task, service, serviceId, viewer, onWrite, initialProofs }) {
  const { t } = useTranslation();
  const { formatDate, formatNumber } = useLocale();
  const [proofs, setProofs] = useState(Boolean(initialProofs));
  const [proofsVisited, setProofsVisited] = useState(Boolean(initialProofs));
  const [assigning, setAssigning] = useState(false);
  const rights = task.capabilities || {};
  const assignee = [task.assignee?.firstName, task.assignee?.lastName].filter(Boolean).join(' ');
  const action = rights.canStart ? ['in_progress', 'start'] : rights.canComplete ? ['completed', 'complete'] : rights.canValidate ? ['validated', 'validate'] : null;
  return <article aria-labelledby={`step-title-${task.id}`} className="rounded-xl border border-border p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-text-secondary">#{task.id}</span><span className="rounded-lg bg-surface-main px-2 py-1 text-xs font-semibold">{t(`labels.task.statuses.${task.status}`)}</span></div>
    <h3 id={`step-title-${task.id}`} className="mt-2 break-words font-semibold">{task.title}</h3>
    <p className="mt-1 text-sm text-text-secondary">{assignee || (task.assignedTo ? t('serviceSteps.currentAgent', { id: task.assignedTo }) : t('serviceSteps.unassigned'))}</p>
    {task.description && <p className="mt-2 whitespace-pre-wrap text-sm">{task.description}</p>}
    <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
      {task.type && <div><dt className="sr-only">{t('serviceSteps.type')}</dt><dd>{t(`labels.task.types.${task.type}`)}</dd></div>}
      {task.dueDate && <div><dt className="inline">{t('serviceSteps.due')}: </dt><dd className="inline">{formatDate(task.dueDate)}</dd></div>}
      {task.priority !== 'normal' && <div><dt className="inline">{t('serviceSteps.priority')}: </dt><dd className="inline">{t(`labels.task.priorities.${task.priority}`)}</dd></div>}
      {task.estimatedCost != null && <div><dt className="inline">{t('serviceSteps.cost')}: </dt><dd className="inline">{formatNumber(Number(task.estimatedCost))} {task.currency}</dd></div>}
    </dl>
    {['completed', 'validated'].includes(task.status) && <p className="mt-3 text-xs text-text-secondary">{t(task.status === 'completed' ? 'serviceSteps.completedHint' : 'serviceSteps.validatedHint')}</p>}
    {viewer?.role === 'agent' && task.assignedTo && String(task.assignedTo) !== String(viewer.id) && <p className="mt-2 text-xs text-text-secondary">{t('serviceSteps.assignedElsewhere')}</p>}
    <div className="mt-3 flex flex-wrap gap-3">
      {action && <button type="button" onClick={() => onWrite(() => updateTaskStatus(task.id, action[0])).catch(() => {})} className="btn-secondary min-h-11 rounded-xl px-4 text-sm font-semibold">{t(`serviceSteps.${action[1]}`)}</button>}
      {rights.canAssign && <button type="button" aria-expanded={assigning} onClick={() => setAssigning((value) => !value)} className="min-h-11 text-sm underline">{t('serviceSteps.assign')}</button>}
      {rights.canAccessEvidence && <button type="button" aria-expanded={proofs} onClick={() => { setProofs((value) => !value); setProofsVisited(true); }} className="min-h-11 text-sm underline">{t('serviceSteps.proofs')}</button>}
      <Link to={`/transactions?taskId=${task.id}`} className="inline-flex min-h-11 items-center text-sm underline">{t('serviceSteps.transactions')}</Link>
    </div>
    {assigning && rights.canAssign && <StepAssignmentForm task={task} service={service} onWrite={onWrite} />}
    {proofsVisited && rights.canAccessEvidence && <div hidden={!proofs}><StepEvidencePanel task={task} viewer={viewer} serviceId={serviceId} /></div>}
  </article>;
}
