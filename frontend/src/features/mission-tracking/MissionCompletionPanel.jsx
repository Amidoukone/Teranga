import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { submitMissionCompletion } from '../../services/missions';

function fileUrl(value) {
  try {
    const base = window.__TERANGA_FILE_BASE_URL || window.__TERANGA_API_BASE_URL || process.env.REACT_APP_API_URL || window.location.origin;
    const url = new URL(value, new URL(base, window.location.origin));
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch (_error) { return null; }
}
const newKey = () => window.crypto?.randomUUID?.() || `report-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function MissionCompletionPanel({ missionId, completion, canSubmit, onSaved }) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState(completion?.report?.summary || '');
  const [files, setFiles] = useState([]);
  const [kind, setKind] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const requestKey = useRef(newKey());
  const [inputVersion, setInputVersion] = useState(0);
  const inFlight = useRef(false);
  const dirty = useRef(false);
  useEffect(() => {
    if (!dirty.current) setSummary(completion?.report?.summary || '');
  }, [completion?.report?.summary]);
  async function submit(event) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true); setError(''); setSaved(false);
    try {
      await submitMissionCompletion(missionId, { summary, files, kind, requestKey: requestKey.current });
      requestKey.current = newKey(); dirty.current = false; setFiles([]); setInputVersion((value) => value + 1); setSaved(true);
      await onSaved?.();
    } catch (failure) { setError(failure?.response?.data?.error || t('completion.failed')); }
    finally { inFlight.current = false; setSaving(false); }
  }
  if (!completion) return null;
  return <section id="completion-report" tabIndex={-1} className="my-5 scroll-mt-24 space-y-3 rounded-2xl border border-border bg-surface-card p-4" aria-label={t('completion.title')}>
    <h2 className="font-semibold">{t('completion.title')}</h2>
    {completion.expectedOutcome && <p className="text-sm">{completion.expectedOutcome}</p>}
    {completion.requiredEvidenceTypes?.length > 0 && <p className="text-sm">{t('completion.requiredFiles')}: {completion.requiredEvidenceTypes.map((value) => t(`operations.evidence.${value}`)).join(', ')}</p>}
    {completion.report && <><p className="whitespace-pre-wrap text-sm">{completion.report.summary}</p>
      <ul className="space-y-1">{completion.report.attachments?.map((file) => <li key={file.id}>{fileUrl(file.filePath) && <a href={fileUrl(file.filePath)} target="_blank" rel="noreferrer" className="text-sm underline">{file.originalName || t(`operations.evidence.${file.kind}`)}</a>}</li>)}</ul></>}
    {canSubmit && <form onSubmit={submit} className="space-y-3">
      <fieldset disabled={saving} className="space-y-3 disabled:opacity-60">
      <label htmlFor="completion-summary" className="block text-sm">{t('completion.summary')}</label>
      <textarea id="completion-summary" value={summary} minLength={20} maxLength={4000} required onChange={(event) => { dirty.current = true; setSaved(false); setSummary(event.target.value); requestKey.current = newKey(); }} className="min-h-28 w-full rounded-lg border border-border bg-surface-main p-3" />
      <label htmlFor="completion-kind" className="block text-sm">{t('completion.fileKind')}</label>
      <select id="completion-kind" value={kind} onChange={(event) => { setKind(event.target.value); requestKey.current = newKey(); }} className="w-full rounded-lg border border-border bg-surface-main p-2">
        <option value="">{t('completion.detectKind')}</option>{['photo', 'document', 'receipt', 'other'].map((value) => <option key={value} value={value}>{t(`operations.evidence.${value}`)}</option>)}
      </select>
      <label htmlFor="completion-files" className="block text-sm">{t('completion.files')}</label>
      <input key={inputVersion} id="completion-files" type="file" multiple accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx" onChange={(event) => { setFiles(Array.from(event.target.files || [])); requestKey.current = newKey(); }} className="block w-full text-sm" />
      <p className="text-xs text-text-secondary">{t('completion.filesHint')}</p>
      <button type="submit" disabled={saving || files.length > 3} className="btn-primary rounded-lg px-4 py-2 disabled:opacity-50">{saving ? t('operations.saving') : t('completion.save')}</button>
      </fieldset>
      {error && <p role="alert">{error}</p>}{saved && <p role="status">{t('completion.saved')}</p>}
    </form>}
  </section>;
}
