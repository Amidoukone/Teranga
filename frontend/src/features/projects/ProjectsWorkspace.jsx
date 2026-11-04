import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGeo } from '../../contexts/GeoContext';
import { me } from '../../services/auth';
import { getProjects } from '../../services/projects';
import { useLocale } from '../../i18n/useLocale';
import { getProjectStatusTone } from '../../utils/labels';
import { Badge } from '../../components/ui';
import PaginationBar from '../../components/PaginationBar';
import ProjectEditor, { projectFieldClass, projectStates } from './ProjectEditor';

export default function ProjectsWorkspace() {
  const { user, countryId, regionId } = useGeo();
  return <Projects key={JSON.stringify([user?.id, user?.role, countryId, regionId])} countryId={countryId} regionId={regionId} />;
}
function Projects({ countryId, regionId }) {
  const { t } = useTranslation();
  const { formatNumber, formatDateTime } = useLocale();
  const navigate = useNavigate(), location = useLocation();
  const [params, setParams] = useSearchParams();
  const [user, setUser] = useState(null), [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [bootError, setBootError] = useState(''), [attempt, setAttempt] = useState(0);
  const [revoked, setRevoked] = useState(false), [visited, setVisited] = useState(params.get('nouveau') === '1'), [showForm, setShowForm] = useState(params.get('nouveau') === '1');
  const q = params.get('q') || '', status = projectStates.includes(params.get('status')) ? params.get('status') : '';
  const sort = ['-createdAt', 'createdAt', 'title'].includes(params.get('sort')) ? params.get('sort') : '-createdAt';
  const rawPage = Number(params.get('page')), page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const [search, setSearch] = useState(q);
  const alive = useRef(true), version = useRef(0);
  useEffect(() => { setSearch(q); }, [q]);
  useEffect(() => {
    let current = true; alive.current = true;
    me().then((result) => { if (current) { if (result?.user) { setUser(result.user); setBootError(''); } else navigate('/login'); } })
      .catch(() => { if (current) { setBootError(t('projects.alerts.userLoadError')); setLoading(false); } });
    return () => { current = false; alive.current = false; version.current += 1; };
  }, [navigate, attempt, t]);
  const load = useCallback(async () => {
    if (!user || !alive.current) return;
    const current = ++version.current; setLoading(true);
    try {
      const result = await getProjects(user.role === 'admin' ? { countryId, regionId } : { countryId: null, regionId: null });
      if (!alive.current || current !== version.current) return;
      setProjects(Array.isArray(result) ? result : []); setError(''); setRevoked(false);
    } catch (failure) {
      if (!alive.current || current !== version.current) return;
      if ([401, 403, 404].includes(failure?.response?.status)) { setProjects([]); setVisited(false); setShowForm(false); setRevoked(true); }
      setError(failure?.response?.data?.error || t('projects.alerts.loadError'));
    } finally { if (alive.current && current === version.current) setLoading(false); }
  }, [user, countryId, regionId, t]);
  useEffect(() => { load(); const refresh = () => load(); window.addEventListener('online', refresh); return () => { version.current += 1; window.removeEventListener('online', refresh); }; }, [load]);
  const filtered = useMemo(() => projects.filter((project) => (!status || project.status === status) && (!q || `${project.title || ''} ${project.description || ''} ${user?.role === 'admin' ? [project.client?.firstName, project.client?.lastName, project.client?.email].filter(Boolean).join(' ') : ''}`.toLocaleLowerCase().includes(q.toLocaleLowerCase()))).sort((a, b) => {
    if (sort === 'title') return String(a.title).localeCompare(String(b.title)) || a.id - b.id;
    return ((Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0) || a.id - b.id) * (sort === 'createdAt' ? 1 : -1);
  }), [projects, q, status, sort, user?.role]);
  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 20)));
  function update(values) { setParams((previous) => { const next = new URLSearchParams(previous); next.delete('page'); Object.entries(values).forEach(([key, value]) => value ? next.set(key, String(value)) : next.delete(key)); return next; }, { preventScrollReset: true }); }
  if (!user) return <div className="app-page-wrap"><div className="app-page-shell">{bootError ? <p role="alert">{bootError} <button type="button" onClick={() => setAttempt((value) => value + 1)} className="min-h-11 underline">{t('financialWorkspace.retry')}</button></p> : <p role="status">{t('projects.loading')}</p>}</div></div>;
  const from = /^\/(?:demandes|services)(?:\?[^#\\\r\n]*)?$/.test(location.state?.from || '') ? location.state.from : location.pathname + location.search;
  return <div className="app-page-wrap"><div className="app-page-shell max-w-5xl space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="app-page-headline">{t(user.role === 'client' ? 'projectSimple.mine' : 'projectSimple.title')}</h1><p className="mt-2 text-sm text-text-secondary">{t('projectSimple.hint')}</p></div>{!revoked && ['client', 'admin'].includes(user.role) && <button type="button" aria-expanded={showForm} onClick={() => { setShowForm((value) => !value); setVisited(true); }} className="btn-primary min-h-11 rounded-xl px-4 text-sm font-semibold">{t(showForm ? 'projectSimple.hide' : 'projectSimple.new')}</button>}</header>
    {visited && !revoked && <div hidden={!showForm}><ProjectEditor active={showForm} user={user} onCancel={() => setShowForm(false)} onSaved={(project) => navigate(`/projects/${project.id}`, { state: { from } })} /></div>}
    <form onSubmit={(event) => { event.preventDefault(); update({ q: search.trim() }); }} className="flex items-end gap-3"><label className="min-w-0 flex-1 text-sm">{t(user.role === 'admin' ? 'projectSimple.searchAdmin' : 'projectSimple.search')}<input value={search} onChange={(event) => setSearch(event.target.value)} className={projectFieldClass} /></label><button type="submit" className="btn-secondary min-h-11 rounded-xl px-4 text-sm">{t('financialWorkspace.find')}</button></form>
    <details className="rounded-xl border border-border p-3"><summary className="min-h-11 cursor-pointer py-3 text-sm">{t('projectSimple.filters')}</summary><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">{t('projectSimple.status')}<select value={status} onChange={(event) => update({ status: event.target.value })} className={projectFieldClass}><option value="">{t('orders.filters.all')}</option>{projectStates.map((value) => <option key={value} value={value}>{t(`projects.status.${value}`)}</option>)}</select></label><label className="text-sm">{t('orders.filters.sortLabel')}<select value={sort} onChange={(event) => update({ sort: event.target.value })} className={projectFieldClass}>{[['-createdAt', 'sortNewest'], ['createdAt', 'sortOldest'], ['title', 'sortTitle']].map(([value, label]) => <option key={value} value={value}>{t(`projectSimple.${label}`)}</option>)}</select></label></div></details>
    <button type="button" onClick={load} disabled={loading} className="min-h-11 text-sm underline">{t('financialWorkspace.refresh')}</button>
    {loading && <p role="status">{t('projects.loading')}</p>}
    {error && <p role="alert" className="app-alert app-alert-error">{error} <button type="button" onClick={load} disabled={loading} className="min-h-11 underline">{t('financialWorkspace.retry')}</button></p>}
    {!loading && !error && filtered.length === 0 && <p>{t('projectSimple.empty')}</p>}
    <div className="space-y-4">{filtered.slice((safePage - 1) * 20, safePage * 20).map((project) => <article key={project.id} aria-label={project.title} className="space-y-3 rounded-2xl border border-border bg-surface-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="break-words text-lg font-bold">{project.title}</h2><Badge tone={getProjectStatusTone(project.status)}>{t(`projects.status.${project.status}`, { defaultValue: project.status })}</Badge></div>
      {project.description && <p className="line-clamp-2 break-words text-sm text-text-secondary">{project.description}</p>}
      {user.role === 'admin' && project.client && <p className="break-words text-sm">{t('projects.card.client')} {[project.client.firstName, project.client.lastName, project.client.email].filter(Boolean).join(' · ')}</p>}
      <p className="text-sm text-text-secondary">{[project.address || project.city, project.agent && [project.agent.firstName, project.agent.lastName].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}</p>
      {project.budget != null && <p className="text-sm">{t('projectSimple.budget')}: {formatNumber(project.budget)} {project.currency || 'XOF'}</p>}
      {project.createdAt && <p className="text-xs text-text-secondary">{formatDateTime(project.createdAt)}</p>}
      <Link to={`/projects/${project.id}`} state={{ from }} className="btn-primary inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold">{t('projectSimple.open')}</Link>
    </article>)}</div>
    <PaginationBar showPageSize={false} page={safePage} pageSize={20} totalItems={filtered.length} onPageChange={(value) => update({ page: value })} />
  </div></div>;
}
