import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGeo } from '../contexts/GeoContext';
import { getTaskWorkspace } from '../services/tasks';
import { StepCard } from '../features/service-workspace/ServiceStepsPanel';

export default function TaskWorkspacePage() {
  const { id } = useParams();
  const { user, countryId, regionId } = useGeo();
  return <TaskCase key={JSON.stringify([id,user?.id,user?.role,countryId,regionId])} id={id} />;
}
function TaskCase({ id }) {
  const { t } = useTranslation();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const alive = useRef(true), request = useRef(0), sending = useRef(false);
  const load = useCallback(async () => {
    if (!alive.current) return;
    const version = ++request.current; setLoading(true);
    try { const result = await getTaskWorkspace(id); if (alive.current && version === request.current) { setData(result); setError(''); } }
    catch (failure) { if (alive.current && version === request.current) { if ([401,403,404].includes(failure?.response?.status)) setData(null); setError(failure?.response?.data?.error || t('workspaceQueue.taskFailed')); } }
    finally { if (alive.current && version === request.current) setLoading(false); }
  }, [id,t]);
  useEffect(() => {
    alive.current = true; load();
    const refresh = () => { if (document.visibilityState === 'visible' && !sending.current) load(); };
    const timer = setInterval(refresh,30000); window.addEventListener('online',refresh);
    return () => { alive.current = false; request.current += 1; clearInterval(timer); window.removeEventListener('online',refresh); };
  }, [load]);
  async function write(action) {
    if (sending.current) throw new Error(t('operations.saving'));
    sending.current = true; request.current += 1; setBusy(true); setMessage('');
    try { const result = await action(); await load(); if (alive.current) setMessage(t('workspaceQueue.taskSaved')); return result; }
    catch (failure) { await load(); if (alive.current) setError(failure?.response?.data?.error || t('serviceSteps.actionFailed')); throw failure; }
    finally { sending.current = false; if (alive.current) setBusy(false); }
  }
  const from = location.state?.from;
  const back = typeof from === 'string' && /^\/operations(?:\?[^#\\\r\n]*)?$/.test(from) ? from : '/operations';
  return <div className="app-page-wrap"><div className="app-page-shell max-w-3xl space-y-5">
    <Link to={back} className="inline-flex min-h-11 items-center text-sm underline">{t('workspaceQueue.back')}</Link>
    <header><h1 className="app-page-headline">{t('workspaceQueue.taskTitle',{id})}</h1><p className="mt-2 text-sm text-text-secondary">{t('workspaceQueue.taskHint')}</p></header>
    {loading && <p role="status">{t('workspaceQueue.loading')}</p>}
    {error && <p role="alert" className="app-alert app-alert-error">{error} <button type="button" onClick={load} disabled={busy || loading} className="min-h-11 underline">{t('serviceOrders.retry')}</button></p>}
    {data && <><fieldset disabled={busy}><StepCard task={data.task} serviceId={data.parentServiceId} viewer={data.viewer} onWrite={write} initialProofs={new URLSearchParams(location.search).get('pieces') === '1'} /></fieldset>
      {data.parentServiceId && <Link to={`/services/${data.parentServiceId}/tasks?etape=${id}#steps`} className="inline-flex min-h-11 items-center text-sm underline">{t('serviceSteps.back')}</Link>}</>}
    {message && <p role="status">{message}</p>}
  </div></div>;
}
