import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createProperty } from '../../services/properties';
import api, { getFileUrl } from '../../services/api';
import LocationAutocompleteInput from '../mission-creation/LocationAutocompleteInput';
import MissionLocationMap from '../mission-creation/MissionLocationMap';
import { dossierFieldClass as projectFieldClass } from '../../components/formStyles';

export const propertyTypes = ['house', 'apartment', 'land', 'commercial', 'automobile'];
export function canModifyProperty(property, user, now = Date.now()) {
  return user?.role === 'admin' || (user?.role === 'client' && String(property.ownerId ?? property.owner?.id) === String(user.id) && Number.isFinite(Date.parse(property.createdAt)) && now - Date.parse(property.createdAt) <= 3600000);
}
const extensions = /\.(jpe?g|png|webp|heic|heif|pdf)$/i;
export default function PropertyEditor({ property, user, onSaved, onCancel }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => ({ title: property?.title || '', type: property?.type || 'house', address: property?.address || '', city: property?.city || '', postalCode: property?.postalCode || '', description: property?.description || '', surfaceArea: property?.surfaceArea ?? '', roomCount: property?.roomCount ?? '', latitude: property?.latitude ?? null, longitude: property?.longitude ?? null, ownerId: '' }));
  const [files, setFiles] = useState([]), [removed, setRemoved] = useState([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [clients, setClients] = useState([]), [optionsError, setOptionsError] = useState(''), [attempt, setAttempt] = useState(0), [mapOpen, setMapOpen] = useState(false);
  const alive = useRef(true), sending = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (property || user.role !== 'admin') return undefined;
    let current = true;
    api.get('/users', { params: { role: 'client', limit: 200 } }).then(({ data }) => { if (current) { setClients(data.users || []); setOptionsError(''); } }).catch(() => { if (current) setOptionsError(t('projectSimple.peopleFailed')); });
    return () => { current = false; };
  }, [property, user.role, attempt, t]);
  const existing = property?.photos || [];
  const remaining = 10 - existing.filter((url) => !removed.includes(url)).length;
  const change = (name) => (event) => setForm((previous) => ({ ...previous, [name]: event.target.value, ...(name === 'city' ? { latitude: null, longitude: null } : {}) }));
  function selectFiles(event) {
    const selected = Array.from(event.target.files || []);
    if (selected.length > remaining) { setError(t('propertiesPage.alerts.tooManyFiles', { max: remaining })); event.target.value = ''; return; }
    const bad = selected.find((file) => !extensions.test(file.name) || (file.type && !file.type.startsWith('image/') && !['application/pdf', 'application/x-pdf', 'application/octet-stream', 'binary/octet-stream'].includes(file.type)));
    if (bad) { setError(t('propertiesPage.alerts.invalidFileType', { name: bad.name })); event.target.value = ''; return; }
    const large = selected.find((file) => file.size > 15 * 1024 * 1024);
    if (large) { setError(t('propertiesPage.alerts.fileTooLarge', { name: large.name, max: 15 })); event.target.value = ''; return; }
    setFiles(selected); setError('');
  }
  async function submit(event) {
    event.preventDefault(); if (sending.current) return;
    if (![form.title, form.address, form.city].every((value) => value.trim()) || (!property && user.role === 'admin' && !form.ownerId)) { setError(t('propertySimple.required')); return; }
    if (files.length > remaining) { setError(t('propertiesPage.alerts.tooManyFiles', { max: remaining })); return; }
    for (const field of ['surfaceArea', 'roomCount']) {
      if (form[field] !== '' && (!Number.isFinite(Number(form[field])) || Number(form[field]) < 0 || (field === 'roomCount' && !Number.isInteger(Number(form[field]))))) { setError(t('propertySimple.invalidSize')); return; }
    }
    sending.current = true; setBusy(true); setError('');
    try {
      const payload = { ...form, title: form.title.trim(), address: form.address.trim(), city: form.city.trim() };
      if (property || user.role !== 'admin') delete payload.ownerId;
      let saved;
      if (property) {
        const data = new FormData();
        Object.entries(payload).forEach(([key, value]) => data.append(key, value ?? ''));
        files.forEach((file) => data.append('files', file));
        if (removed.length) data.append('removePhotos', JSON.stringify(removed));
        const result = await api.put(`/properties/${property.id}`, data, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: Number(process.env.REACT_APP_PROPERTY_UPLOAD_TIMEOUT_MS) || 180000 });
        saved = result.data.property || property;
      } else saved = await createProperty(payload, files);
      if (alive.current) await onSaved(saved);
    } catch (failure) { if (alive.current) setError(failure?.response?.data?.error || t(property ? 'propertiesPage.alerts.updateError' : 'propertiesPage.alerts.createError')); }
    finally { sending.current = false; if (alive.current) setBusy(false); }
  }
  return <form aria-label={t(property ? 'propertySimple.edit' : 'propertySimple.new')} onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-surface-card p-4 sm:p-5">
    <h2 className="text-lg font-bold">{t(property ? 'propertySimple.edit' : 'propertySimple.new')}</h2>
    <fieldset disabled={busy} className="space-y-4">
      {optionsError && <p role="alert">{optionsError} <button type="button" onClick={() => setAttempt((value) => value + 1)} className="min-h-11 underline">{t('financialWorkspace.retry')}</button></p>}
      {!property && user.role === 'admin' && <label className="block text-sm">{t('projects.form.clientLabel')}<select required value={form.ownerId} onChange={change('ownerId')} className={projectFieldClass}><option value="">{t('projects.form.clientPlaceholder')}</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.firstName} {client.lastName} · {client.email}</option>)}</select></label>}
      <label className="block text-sm">{t('propertiesPage.form.labels.title')}<input required maxLength={150} value={form.title} onChange={change('title')} className={projectFieldClass} /></label>
      <label className="block text-sm">{t('propertiesPage.form.labels.type')}<select value={form.type} onChange={change('type')} className={projectFieldClass}>{!propertyTypes.includes(form.type) && <option value={form.type}>{t(`labels.property.types.${form.type}`, { defaultValue: form.type })}</option>}{propertyTypes.map((value) => <option key={value} value={value}>{t(`labels.property.types.${value}`, { defaultValue: value })}</option>)}</select></label>
      <label className="block text-sm">{t('propertiesPage.form.labels.address')}<LocationAutocompleteInput value={form.address} onChange={(address) => setForm((previous) => ({ ...previous, address, latitude: null, longitude: null }))} onPlaceSelected={(place) => setForm((previous) => ({ ...previous, ...place }))} className={projectFieldClass} /></label>
      <label className="block text-sm">{t('propertiesPage.form.labels.city')}<input required value={form.city} onChange={change('city')} className={projectFieldClass} /></label>
      <label className="block text-sm">{t('propertySimple.files')}<input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf" onChange={selectFiles} className={projectFieldClass} /></label>
      {files.length > 0 && <p className="break-words text-sm">{files.map((file) => file.name).join(' · ')}</p>}
      {existing.length > 0 && <details className="rounded-xl border border-border p-3"><summary className="min-h-11 cursor-pointer py-3 text-sm">{t('propertySimple.manageFiles')}</summary><ul className="space-y-2">{existing.map((url, index) => <li key={url} className="flex flex-wrap items-center justify-between gap-3"><a href={getFileUrl(url)} target="_blank" rel="noreferrer" className="min-h-11 py-3 text-sm underline">{t('propertySimple.fileNumber', { count: index + 1 })}</a><label className="text-sm"><input type="checkbox" checked={removed.includes(url)} onChange={(event) => setRemoved((previous) => event.target.checked ? [...previous, url] : previous.filter((value) => value !== url))} /> {t('propertySimple.removeFile')}</label></li>)}</ul></details>}
      <details className="rounded-xl border border-border p-3"><summary className="min-h-11 cursor-pointer py-3 text-sm">{t('propertySimple.options')}</summary><div className="space-y-3">
        <label className="block text-sm">{t('propertiesPage.form.labels.description')}<textarea value={form.description} rows={3} onChange={change('description')} className={projectFieldClass} /></label>
        {['surfaceArea', ...(form.type === 'land' || form.type === 'automobile' ? [] : ['roomCount']), 'postalCode'].map((name) => <label key={name} className="block text-sm">{t(name === 'surfaceArea' && form.type === 'automobile' ? 'propertiesPage.form.dynamic.automobileSurfaceLabel' : `propertySimple.${name}`)}<input type={name === 'postalCode' ? 'text' : 'number'} min={name === 'postalCode' ? undefined : 0} step={name === 'surfaceArea' ? 'any' : undefined} value={form[name]} onChange={change(name)} className={projectFieldClass} /></label>)}
      </div></details>
      <details open={mapOpen} onToggle={(event) => setMapOpen(event.currentTarget.open)} className="rounded-xl border border-border p-3"><summary className="min-h-11 cursor-pointer py-3 text-sm">{t('projectSimple.map')}</summary>{mapOpen && <MissionLocationMap latitude={form.latitude} longitude={form.longitude} onPositionChange={(coordinates) => setForm((previous) => ({ ...previous, ...coordinates }))} />}</details>
      <div className="flex flex-wrap gap-3"><button type="submit" className="btn-primary min-h-11 rounded-xl px-4 text-sm">{t(busy ? 'financialWorkspace.saving' : property ? 'financialWorkspace.save' : 'propertySimple.create')}</button><button type="button" onClick={onCancel} className="btn-secondary min-h-11 rounded-xl px-4 text-sm">{t('financialWorkspace.cancel')}</button></div>
    </fieldset>
    {error && <p role="alert" className="app-alert app-alert-error">{error}</p>}
  </form>;
}
