import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGeo } from '../contexts/GeoContext';
import { me } from '../services/auth';
import { deleteProperty, getPropertyById } from '../services/properties';
import { getFileUrl } from '../services/api';
import { PROPERTY_TYPES, PROPERTY_STATUSES } from '../utils/labels';
import { useDeleteConfirm } from '../hooks/useDeleteConfirm';
import PropertyEditor, { canModifyProperty } from '../features/properties/PropertyEditor';
import PropertyHistory from '../features/properties/PropertyHistory';

export default function PropertyDetailPage() {
  const { id } = useParams();
  const { user, countryId, regionId } = useGeo();
  return <Property key={JSON.stringify([id, user?.id, user?.role, countryId, regionId])} id={id} />;
}
function Property({ id }) {
  const { t } = useTranslation();
  const location = useLocation(), navigate = useNavigate();
  const from = useRef(location.state?.from);
  const back = typeof from.current === 'string' && /^\/(?:properties|admin\/properties)(?:\?[^#\\\r\n]*)?$/.test(from.current) ? from.current : '/properties';
  const { confirmDelete } = useDeleteConfirm();
  const [user, setUser] = useState(null), [property, setProperty] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0), [editing, setEditing] = useState(false), [visited, setVisited] = useState(false), [busy, setBusy] = useState(false), [writeError, setWriteError] = useState(''), [now, setNow] = useState(Date.now());
  const alive = useRef(true), version = useRef(0), sending = useRef(false);
  const load = useCallback(async () => {
    const current = ++version.current;
    try {
      const [session, result] = await Promise.all([me(), getPropertyById(id, { strict: true })]);
      if (!alive.current || current !== version.current) return;
      if (!result || !session?.user) { setProperty(null); setUser(null); setError(t('propertySimple.inaccessible')); return; }
      setProperty(result); setUser(session.user); setError('');
    } catch (failure) {
      if (!alive.current || current !== version.current) return;
      if ([401, 403, 404].includes(failure?.response?.status)) { setProperty(null); setUser(null); setEditing(false); setVisited(false); }
      setError(failure?.response?.data?.error || t('propertySimple.failed'));
    } finally { if (alive.current && current === version.current) setLoading(false); }
  }, [id, t]);
  useEffect(() => {
    alive.current = true; load(); const timer = setInterval(() => setNow(Date.now()), 30000);
    const refresh = () => load(); window.addEventListener('online', refresh);
    return () => { alive.current = false; version.current += 1; clearInterval(timer); window.removeEventListener('online', refresh); };
  }, [load, attempt]);
  async function remove() {
    if (sending.current || !canModifyProperty(property, user)) return;
    sending.current = true;
    try {
      if (!await confirmDelete('property') || !alive.current) return;
      setBusy(true); await deleteProperty(property.id); if (alive.current) navigate(back);
    } catch (failure) { if (alive.current) setWriteError(failure?.response?.data?.error || t('propertiesPage.alerts.deleteError')); }
    finally { sending.current = false; if (alive.current) setBusy(false); }
  }
  return <div className="app-page-wrap"><div className="app-page-shell max-w-5xl space-y-5">
    <Link to={back} className="inline-flex min-h-11 items-center text-sm underline">{t('propertySimple.back')}</Link>
    {loading && <p role="status">{t('common.loading')}</p>}
    {error && <p role="alert" className="app-alert app-alert-error">{error} <button type="button" onClick={() => setAttempt((value) => value + 1)} className="min-h-11 underline">{t('financialWorkspace.retry')}</button></p>}
    {property && user && <>
      <header className="space-y-3"><h1 className="app-page-headline break-words">{property.title}</h1><p className="text-sm text-text-secondary">{PROPERTY_TYPES[property.type] || property.type} · {PROPERTY_STATUSES[property.status] || property.status}</p><p className="break-words text-sm">{[property.address, property.city, property.postalCode].filter(Boolean).join(', ')}</p>
        {user.role === 'client' && String(property.ownerId ?? property.owner?.id) === String(user.id) && <Link to={`/demandes/nouvelle?bien=${property.id}`} state={{ propertyListFrom: back }} className="btn-primary inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold">{t('propertySimple.request')}</Link>}
      </header>
      {property.description && <p className="whitespace-pre-line break-words text-sm text-text-secondary">{property.description}</p>}
      {property.photos?.length > 0 && <section aria-label={t('propertySimple.files')} className="rounded-2xl border border-border p-4"><h2 className="mb-3 text-lg font-bold">{t('propertySimple.files')}</h2><div className="grid gap-3 sm:grid-cols-3">{property.photos.map((url, index) => <a key={url} href={getFileUrl(url)} target="_blank" rel="noreferrer" className="min-w-0 rounded-xl border border-border p-3 text-sm underline">{!/[.]pdf(?:[?#]|$)/i.test(url) && <img src={getFileUrl(url)} alt="" loading="lazy" className="mb-2 h-36 w-full rounded-lg object-cover" />}{t('propertySimple.fileNumber', { count: index + 1 })}</a>)}</div></section>}
      <PropertyHistory property={property} user={user} kind="services" />
      <PropertyHistory property={property} user={user} kind="tasks" />
      <details className="rounded-2xl border border-border p-4"><summary className="min-h-11 cursor-pointer py-3 text-lg font-bold">{t('propertySimple.details')}</summary><dl className="mt-3 space-y-2 text-sm">{property.surfaceArea != null && <div><dt>{t('propertySimple.surfaceArea')}</dt><dd>{property.surfaceArea}</dd></div>}{property.roomCount != null && <div><dt>{t('propertySimple.roomCount')}</dt><dd>{property.roomCount}</dd></div>}</dl>
        {user.role === 'admin' && property.owner && <p className="mt-3 break-words text-sm">{t('projects.form.clientLabel')}: {[property.owner.firstName, property.owner.lastName, property.owner.email].filter(Boolean).join(' · ')}</p>}
        {canModifyProperty(property, user, now) && <div className="mt-4 space-y-4"><div className="flex flex-wrap gap-4"><button type="button" disabled={busy} aria-expanded={editing} onClick={() => { setVisited(true); setEditing((value) => !value); }} className="btn-secondary min-h-11 rounded-xl px-4 text-sm">{t('propertySimple.edit')}</button><details><summary className="min-h-11 cursor-pointer py-3 text-sm">{t('operationsCenter.more')}</summary><button type="button" onClick={remove} disabled={busy} className="min-h-11 text-sm text-red-700 underline">{t('propertiesPage.list.delete')}</button></details></div>{visited && <div hidden={!editing}><PropertyEditor property={property} user={user} onCancel={() => setEditing(false)} onSaved={async () => { setEditing(false); setVisited(false); await load(); }} /></div>}</div>}
        {writeError && <p role="alert">{writeError}</p>}
      </details>
    </>}
  </div></div>;
}
