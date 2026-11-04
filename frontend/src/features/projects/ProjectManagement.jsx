import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { deleteProject } from '../../services/projects';
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm';
import ProjectEditor, { canModifyProject } from './ProjectEditor';

export default function ProjectManagement({ project, user, onSaved }) {
  const { t } = useTranslation();
  const navigate = useNavigate(), location = useLocation();
  const origin = useRef(location.state?.from);
  const { confirmDelete } = useDeleteConfirm();
  const [editing, setEditing] = useState(false), [visited, setVisited] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const alive = useRef(true), sending = useRef(false);
  useEffect(() => { alive.current = true; const timer = setInterval(() => setNow(Date.now()), 30000); return () => { alive.current = false; clearInterval(timer); }; }, []);
  const allowed = canModifyProject(project, user, now);
  async function remove() {
    if (sending.current || !allowed) return;
    sending.current = true;
    try {
      if (!await confirmDelete('project') || !alive.current) return;
      setBusy(true); setError(''); await deleteProject(project.id);
      if (alive.current) navigate(typeof origin.current === 'string' && /^\/(?:demandes|services|projects|admin\/projects)(?:\?[^#\\\r\n]*)?$/.test(origin.current) ? origin.current : '/projects');
    } catch (failure) { if (alive.current) setError(failure?.response?.data?.error || t('projects.alerts.deleteError')); }
    finally { sending.current = false; if (alive.current) setBusy(false); }
  }
  if (!allowed) return null;
  return <div className="mt-4 space-y-4">
    <div className="flex flex-wrap gap-4"><button type="button" disabled={busy} aria-expanded={editing} onClick={() => { setEditing((value) => !value); setVisited(true); }} className="btn-secondary min-h-11 rounded-xl px-4 text-sm">{t('projectSimple.edit')}</button><details><summary className="min-h-11 cursor-pointer py-3 text-sm">{t('operationsCenter.more')}</summary><button type="button" onClick={remove} disabled={busy} className="min-h-11 text-sm text-red-700 underline">{t('projects.actions.delete')}</button></details></div>
    {visited && <div hidden={!editing}><ProjectEditor user={user} project={project} active={editing} onCancel={() => setEditing(false)} onSaved={async () => { setEditing(false); setVisited(false); await onSaved(); }} /></div>}
    {error && <p role="alert" className="app-alert app-alert-error">{error}</p>}
  </div>;
}
