import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGeo } from '../../contexts/GeoContext';
import { me } from '../../services/auth';
import { getProperties } from '../../services/properties';
import { PROPERTY_TYPES } from '../../utils/labels';
import PaginationBar from '../../components/PaginationBar';
import PropertyEditor, { propertyTypes } from './PropertyEditor';
import { dossierFieldClass as projectFieldClass } from '../../components/formStyles';

export default function PropertiesWorkspace() {
  const { user, countryId, regionId } = useGeo();
  return <Properties key={JSON.stringify([user?.id, user?.role, countryId, regionId])} countryId={countryId} regionId={regionId} />;
}
function Properties({ countryId, regionId }) {
  const { t } = useTranslation();
  const location = useLocation(), navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [user, setUser] = useState(null), [result, setResult] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [bootAttempt, setBootAttempt] = useState(0), [visited, setVisited] = useState(false), [creating, setCreating] = useState(false), [revoked, setRevoked] = useState(false);
  const q = params.get('q') || '', type = propertyTypes.includes(params.get('type')) ? params.get('type') : '';
  const rawPage = Number(params.get('page')), page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const [search, setSearch] = useState(q);
  const alive = useRef(true), version = useRef(0);
  useEffect(() => { setSearch(q); }, [q]);
  useEffect(() => {
    let current = true; alive.current = true;
    me().then((value) => { if (current) { if (value?.user) setUser(value.user); else navigate('/login'); } }).catch(() => { if (current) { setError(t('propertySimple.failed')); setLoading(false); } });
    return () => { current = false; alive.current = false; version.current += 1; };
  }, [navigate, bootAttempt, t]);
  const load = useCallback(async () => {
    if (!user || !alive.current) return;
    const current = ++version.current; setLoading(true);
    try {
      const data = await getProperties({ page, limit: 20, q, type, ...(user.role === 'admin' ? { countryId, regionId } : { countryId: null, regionId: null }) }, { withPagination: true, strict: true });
      if (!alive.current || current !== version.current) return;
      setResult(data); setError(''); setRevoked(false);
    } catch (failure) {
      if (!alive.current || current !== version.current) return;
      if ([401, 403, 404].includes(failure?.response?.status)) { setResult(null); setVisited(false); setCreating(false); setRevoked(true); }
      setError(failure?.response?.data?.error || t('propertySimple.failed'));
    } finally { if (alive.current && current === version.current) setLoading(false); }
  }, [user, q, type, page, countryId, regionId, t]);
  useEffect(() => { load(); const refresh = () => load(); window.addEventListener('online', refresh); return () => { version.current += 1; window.removeEventListener('online', refresh); }; }, [load]);
  function update(values) { setParams((previous) => { const next = new URLSearchParams(previous); next.delete('page'); Object.entries(values).forEach(([key, value]) => value ? next.set(key, String(value)) : next.delete(key)); return next; }, { preventScrollReset: true }); }
  if (!user) return <div className="app-page-wrap"><div className="app-page-shell">{error ? <p role="alert">{error} <button type="button" onClick={() => setBootAttempt((value) => value + 1)} className="min-h-11 underline">{t('financialWorkspace.retry')}</button></p> : <p role="status">{t('common.loading')}</p>}</div></div>;
  const from = location.pathname + location.search;
  return <div className="app-page-wrap"><div className="app-page-shell max-w-5xl space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="app-page-headline">{t(user.role === 'client' ? 'propertySimple.mine' : 'propertySimple.title')}</h1><p className="mt-2 text-sm text-text-secondary">{t('propertySimple.hint')}</p></div>{!revoked && ['client', 'admin'].includes(user.role) && <button type="button" aria-expanded={creating} onClick={() => { setVisited(true); setCreating((value) => !value); }} className="btn-primary min-h-11 rounded-xl px-4 text-sm">{t(creating ? 'projectSimple.hide' : 'propertySimple.new')}</button>}</header>
    {visited && !revoked && <div hidden={!creating}><PropertyEditor user={user} onCancel={() => setCreating(false)} onSaved={(property) => navigate(`/properties/${property.id}`, { state: { from } })} /></div>}
    <form onSubmit={(event) => { event.preventDefault(); update({ q: search.trim() }); }} className="flex items-end gap-3"><label className="min-w-0 flex-1 text-sm">{t('propertySimple.search')}<input value={search} onChange={(event) => setSearch(event.target.value)} className={projectFieldClass} /></label><button type="submit" className="btn-secondary min-h-11 rounded-xl px-4 text-sm">{t('financialWorkspace.find')}</button></form>
    <div className="flex flex-wrap items-end gap-4"><label className="min-w-0 flex-1 text-sm">{t('propertiesPage.form.labels.type')}<select value={type} onChange={(event) => update({ type: event.target.value })} className={projectFieldClass}><option value="">{t('orders.filters.all')}</option>{propertyTypes.map((value) => <option key={value} value={value}>{PROPERTY_TYPES[value]}</option>)}</select></label><button type="button" disabled={loading} onClick={load} className="min-h-11 text-sm underline">{t('financialWorkspace.refresh')}</button></div>
    {loading && <p role="status">{t('common.loading')}</p>}{error && <p role="alert" className="app-alert app-alert-error">{error} <button type="button" onClick={load} className="min-h-11 underline">{t('financialWorkspace.retry')}</button></p>}
    {!loading && !error && result?.items.length === 0 && <p>{t('propertySimple.empty')}</p>}
    <div className="space-y-4">{result?.items.map((property) => <article key={property.id} aria-label={property.title} className="space-y-3 rounded-2xl border border-border bg-surface-card p-4 sm:p-5"><h2 className="break-words text-lg font-bold">{property.title}</h2><p className="text-sm text-text-secondary">{PROPERTY_TYPES[property.type] || property.type} · {[property.address, property.city].filter(Boolean).join(', ')}</p>{property.description && <p className="line-clamp-2 break-words text-sm text-text-secondary">{property.description}</p>}<Link to={`/properties/${property.id}`} state={{ from }} className="btn-primary inline-flex min-h-11 items-center rounded-xl px-4 text-sm">{t('propertySimple.open')}</Link></article>)}</div>
    {result && <PaginationBar showPageSize={false} page={page} pageSize={20} totalItems={result.pagination?.total ?? result.items.length} onPageChange={(value) => update({ page: value })} />}
  </div></div>;
}
