import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { deleteEvidence, getEvidences, uploadEvidences } from '../../services/evidences';
import { evidenceUrl } from '../../utils/evidenceUrl';
import { confirmAction } from '../../utils/confirm';

export default function StepEvidencePanel({ task, viewer, serviceId }) {
  const { t } = useTranslation();
  const [items, setItems] = useState(null);
  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [denied, setDenied] = useState(false);
  const [inputVersion, setInputVersion] = useState(0);
  const alive = useRef(true);
  const generation = useRef(0);
  const sending = useRef(false);
  const load = useCallback(async () => {
    if (!alive.current) return;
    const version = ++generation.current;
    setLoading(true);
    try {
      const result = await getEvidences(task.id);
      if (alive.current && version === generation.current) { setItems(result); setDenied(false); setError(''); }
    } catch (failure) {
      if (alive.current && version === generation.current) {
        if ([401, 403, 404].includes(failure?.response?.status)) { setItems(null); setDenied(true); }
        setError(failure?.response?.data?.error || t('serviceSteps.failed'));
      }
    } finally { if (alive.current && version === generation.current) setLoading(false); }
  }, [task.id, t]);
  useEffect(() => { alive.current = true; load(); return () => { alive.current = false; generation.current += 1; }; }, [load]);
  async function write(action) {
    if (sending.current) return;
    sending.current = true; generation.current += 1; setBusy(true); setMessage(''); setError('');
    try { await action(); }
    catch (failure) {
      if (alive.current) {
        await load();
        if (alive.current) setError(failure?.response?.data?.error || t('serviceSteps.actionFailed'));
      }
    } finally { sending.current = false; if (alive.current) setBusy(false); }
  }
  function submit(event) {
    event.preventDefault();
    if (!files.length) return;
    return write(async () => {
      const result = await uploadEvidences(task.id, files, notes, { withMetadata: true });
      if (!alive.current) return;
      const failed = result.warnings?.failedFiles || [];
      setFiles((current) => failed.length ? current.filter((file) => failed.some((entry) => entry.name === file.name)) : []);
      setInputVersion((value) => value + 1);
      if (!failed.length) setNotes('');
      await load();
      if (alive.current) setMessage(t(failed.length ? 'serviceSteps.partialUpload' : 'serviceSteps.proofSaved'));
    });
  }
  async function remove(file) {
    if (sending.current || !await confirmAction({ message: t('serviceSteps.remove', { name: file.originalName || `#${file.id}` }), danger: true })) return;
    return write(async () => { await deleteEvidence(file.id); await load(); });
  }
  return <section className="mt-4 space-y-3 rounded-xl border border-border bg-surface-main p-3" aria-label={t('serviceSteps.proofs')}>
    <p className="text-xs text-text-secondary">{t('serviceSteps.proofHint')}</p>
    <button type="button" onClick={load} disabled={busy || loading} className="min-h-11 text-xs underline">{t('serviceSteps.refreshProofs')}</button>
    {loading && <p role="status" className="text-sm">{t('serviceSteps.loadingProofs')}</p>}
    {error && <p role="alert" className="text-sm">{error} <button type="button" onClick={load} disabled={busy || loading} className="min-h-11 underline">{t('serviceOrders.retry')}</button></p>}
    {!denied && <>
      {items?.length === 0 && <p className="text-sm text-text-secondary">{t('serviceSteps.noProof')}</p>}
      <ul className="space-y-2">{items?.map((file) => {
        const url = evidenceUrl(file.filePath);
        const own = String(file.uploaderId) === String(viewer?.id);
        const removable = viewer?.role === 'admin' || (own && Date.now() - new Date(file.createdAt).getTime() <= 3600000);
        const name = file.originalName || `#${file.id}`;
        return <li key={file.id} className="rounded-lg border border-border bg-surface-card p-3 text-sm">
          {url ? <a href={url} target="_blank" rel="noreferrer" aria-label={t('serviceSteps.view', { name })} className="block break-all font-semibold underline">{name}</a> : <p className="break-all">{name}</p>}
          {file.notes && <p className="mt-1 whitespace-pre-wrap text-text-secondary">{file.notes}</p>}
          {removable && <button type="button" disabled={busy} onClick={() => remove(file)} className="min-h-11 text-xs text-red-700 underline dark:text-red-300">{t('serviceSteps.remove', { name })}</button>}
        </li>;
      })}</ul>
      <form onSubmit={submit} className="space-y-3">
        <fieldset disabled={busy} className="space-y-3 disabled:opacity-60">
          <label htmlFor={`step-files-${task.id}`} className="block text-sm">{t('serviceSteps.files')}<input key={inputVersion} id={`step-files-${task.id}`} type="file" multiple accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx" onChange={(event) => setFiles(Array.from(event.target.files || []))} className="mt-2 block w-full min-w-0 text-sm" /></label>
          {files.length > 0 && <p className="break-all text-xs text-text-secondary">{files.map((file) => file.name).join(' · ')}</p>}
          <label htmlFor={`step-notes-${task.id}`} className="block text-sm">{t('serviceSteps.notes')}<textarea id={`step-notes-${task.id}`} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface-card p-2" /></label>
          <button type="submit" disabled={!files.length || loading} className="btn-secondary min-h-11 rounded-xl px-4 text-sm">{t(busy ? 'operations.saving' : 'serviceSteps.upload')}</button>
        </fieldset>
      </form>
      <p className="text-xs text-text-secondary">{t('serviceSteps.deleteHint')}</p>
      <Link to={`/tasks/${task.id}/evidences`} state={{ from: serviceId ? `/services/${serviceId}#steps` : `/tasks/${task.id}`, ...(serviceId ? { serviceId } : {}) }} className="inline-flex min-h-11 items-center text-xs underline">{t('serviceSteps.olderProofs')}</Link>
    </>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
