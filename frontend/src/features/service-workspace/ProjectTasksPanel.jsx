import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import PaginationBar from '../../components/PaginationBar';

export default function ProjectTasksPanel({ projectId, onRefresh }) {
  const { t } = useTranslation();
  const location = useLocation();
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const currentPage = useRef(page); currentPage.current = page;
  const load = useCallback(async () => {
    const version = ++generation.current;
    try {
      const { data: result } = await api.get('/tasks', { params: { projectId, workspace: true, page, limit: 20 } });
      if (version !== generation.current || currentPage.current !== page) return;
      if (!Array.isArray(result.tasks) || !Number.isInteger(result.pagination?.total) || result.tasks.some((task) => String(task.projectId) !== String(projectId))) throw new Error('Invalid project task context');
      if (page > 1 && (page - 1) * 20 >= result.pagination.total) { setPage(Math.max(1, Math.ceil(result.pagination.total / 20))); return; }
      setData({ page, value: result }); setError('');
    } catch (failure) {
      if (version !== generation.current) return;
      if ([401, 403, 404].includes(failure?.response?.status)) setData(null);
      setError(t('dossier.loadError'));
    }
  }, [projectId, page, t]);
  useEffect(() => {
    load();
    const refresh = () => { if (document.visibilityState === 'visible') load(); };
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh);
    return () => { generation.current += 1; window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); };
  }, [load]);
  const visible = data?.page === page ? data.value : null;
  return <section id="project-tasks" className="scroll-mt-24 space-y-3">
    {error && <p role="alert">{error} <button type="button" onClick={load} className="min-h-11 underline">{t('serviceOrders.retry')}</button></p>}
    {visible?.pagination.total > 0 && <details className="rounded-2xl border border-border p-4"><summary className="min-h-11 cursor-pointer font-semibold">{t('dossier.projectTasks')} ({visible.pagination.total})</summary>
      <p className="mb-3 text-sm text-text-secondary">{t('dossier.projectTasksHint')}</p>
      <button type="button" onClick={() => { load(); onRefresh?.(); }} className="mb-3 min-h-11 text-sm underline">{t('dossier.refresh')}</button>
      <div className="space-y-3">{visible.tasks.map((task) => <article key={task.id} className="rounded-xl border border-border p-3">
        <h3 className="font-semibold">{task.title}</h3><p className="mt-1 text-sm text-text-secondary">{t(`labels.task.statuses.${task.status}`, { defaultValue: task.status })}</p>
        <Link to={`/tasks/${task.id}`} state={{ from: location.pathname + location.search + '#project-tasks' }} className="inline-flex min-h-11 items-center text-sm underline">{t('dossier.openStep')}</Link>
      </article>)}</div>
      <PaginationBar page={page} pageSize={20} totalItems={visible.pagination.total} onPageChange={setPage} showPageSize={false} />
    </details>}
  </section>;
}
