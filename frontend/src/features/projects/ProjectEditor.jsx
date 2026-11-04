import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createProject, updateProject } from '../../services/projects';
import { updateCoordination } from '../../services/operations';
import api from '../../services/api';
import LocationAutocompleteInput from '../mission-creation/LocationAutocompleteInput';
import MissionLocationMap from '../mission-creation/MissionLocationMap';
import { dossierFieldClass } from '../../components/formStyles';
import { CURRENCY_LABELS } from '../../utils/labels';

export const projectTypes = ['immobilier', 'agricole', 'commerce', 'autre'];
export const projectStates = ['created', 'in_progress', 'completed', 'validated', 'cancelled'];
export const projectFieldClass = dossierFieldClass;
const regionalCurrencies = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('currency') : ['GHS', 'GNF', 'NGN', 'ZAR', 'KES', 'MAD', 'CAD', 'CDF'];

export function canModifyProject(project, user, now = Date.now()) {
  return user?.role === 'admin' || (user?.role === 'client' && String(project.clientId ?? project.client?.id) === String(user.id) && Number.isFinite(Date.parse(project.createdAt)) && now - Date.parse(project.createdAt) <= 3600000);
}

export default function ProjectEditor({ user, project, active = true, onSaved, onCancel }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => ({ title: project?.title || '', type: project?.type || 'autre', description: project?.description || '', address: project?.address || '', city: project?.city || '', latitude: project?.latitude ?? null, longitude: project?.longitude ?? null, budget: project?.budget ?? '', currency: project?.currency || '', clientId: '', agentId: project?.coordination?.executorUserId ?? project?.agentId ?? '' }));
  const [clients, setClients] = useState([]), [agents, setAgents] = useState([]);
  const [optionsError, setOptionsError] = useState(''), [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [mapOpen, setMapOpen] = useState(false);
  const [agentTouched, setAgentTouched] = useState(false);
  const originalAgent = useRef(project?.coordination?.executorUserId ?? project?.agentId ?? '');
  const alive = useRef(true), sending = useRef(false), optionsLoaded = useRef(false);
  const admin = user.role === 'admin';
  const canAssign = admin && (!project?.coordination || project.status === 'created');
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (!active || !admin || optionsLoaded.current) return undefined;
    let current = true;
    const requests = [!project ? api.get('/users', { params: { role: 'client', limit: 200 } }) : Promise.resolve({ data: { users: [] } }), canAssign ? api.get('/users', { params: { role: 'agent', limit: 200 } }) : Promise.resolve({ data: { users: [] } })];
    Promise.all(requests).then(([customers, workers]) => {
      if (!current) return;
      setClients(customers.data?.users || []); setAgents(workers.data?.users || []); setOptionsError(''); optionsLoaded.current = true;
    }).catch(() => { if (current) setOptionsError(t('projectSimple.peopleFailed')); });
    return () => { current = false; };
  }, [active, admin, project, canAssign, attempt, t]);
  const change = (name) => (event) => setForm((previous) => ({ ...previous, [name]: event.target.value, ...(['city'].includes(name) ? { latitude: null, longitude: null } : {}) }));
  async function submit(event) {
    event.preventDefault();
    if (sending.current) return;
    if (!form.title.trim() || (!project && admin && !form.clientId)) { setError(t('projectSimple.required')); return; }
    const budget = String(form.budget).trim().replace(',', '.');
    if (budget && (!Number.isFinite(Number(budget)) || Number(budget) < 0)) { setError(t('projectSimple.invalidBudget')); return; }
    if (project && agentTouched && (!canAssign || String(originalAgent.current) !== String(project.coordination?.executorUserId ?? project.agentId ?? ''))) { setError(t('coordinationWorkspace.assignmentChanged')); return; }
    sending.current = true; setBusy(true); setError('');
    try {
      const payload = { title: form.title.trim(), type: form.type, description: form.description.trim(), address: form.address.trim(), city: form.city.trim(), latitude: form.latitude, longitude: form.longitude, budget: budget || null, ...(form.currency.trim() ? { currency: form.currency.trim().toUpperCase() } : {}) };
      if (!project && admin) payload.clientId = Number(form.clientId);
      const assignmentChanged = canAssign && agentTouched && String(form.agentId) !== String(originalAgent.current);
      if (assignmentChanged && !project?.coordination) payload.agentId = form.agentId ? Number(form.agentId) : null;
      const result = project ? await updateProject(project.id, payload) : await createProject(payload);
      if (assignmentChanged && project?.coordination) await updateCoordination(project.id, { executorUserId: form.agentId ? Number(form.agentId) : null, mode: 'manual' }, 'project');
      if (alive.current) await onSaved(result);
    } catch (failure) { if (alive.current) setError(failure?.response?.data?.error || t(project ? 'projects.alerts.updateError' : 'projects.alerts.createError')); }
    finally { sending.current = false; if (alive.current) setBusy(false); }
  }
  return <form aria-label={t(project ? 'projectSimple.edit' : 'projectSimple.new')} onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-surface-card p-4 sm:p-5">
    <h2 className="text-lg font-bold">{t(project ? 'projectSimple.edit' : 'projectSimple.new')}</h2>
    <p className="text-sm text-text-secondary">{t('projectSimple.createHint')}</p>
    <fieldset disabled={busy} className="space-y-4">
      {optionsError && <p role="alert">{optionsError} <button type="button" onClick={() => setAttempt((value) => value + 1)} className="min-h-11 underline">{t('financialWorkspace.retry')}</button></p>}
      {!project && admin && <label className="block text-sm">{t('projects.form.clientLabel')}<select required value={form.clientId} onChange={change('clientId')} className={projectFieldClass}><option value="">{t('projects.form.clientPlaceholder')}</option>{clients.map((client) => <option key={client.id} value={client.id}>{[client.firstName, client.lastName].filter(Boolean).join(' ')} · {client.email}</option>)}</select></label>}
      <label className="block text-sm">{t('projects.form.titleLabel')}<input required maxLength={150} value={form.title} onChange={change('title')} className={projectFieldClass} /></label>
      <label className="block text-sm">{t('projects.form.typeLabel')}<select value={form.type} onChange={change('type')} className={projectFieldClass}>{!projectTypes.includes(form.type) && <option value={form.type}>{form.type}</option>}{projectTypes.map((value) => <option key={value} value={value}>{t(`projects.type.${value}`)}</option>)}</select></label>
      <label className="block text-sm">{t('projects.form.descriptionLabel')}<textarea maxLength={5000} rows={3} value={form.description} onChange={change('description')} className={projectFieldClass} /></label>
      <label className="block text-sm">{t('projects.form.addressLabel')}<LocationAutocompleteInput value={form.address} onChange={(address) => setForm((previous) => ({ ...previous, address, latitude: null, longitude: null }))} onPlaceSelected={(place) => setForm((previous) => ({ ...previous, ...place }))} className={projectFieldClass} /></label>
      <details className="rounded-xl border border-border p-3"><summary className="min-h-11 cursor-pointer py-3 text-sm">{t('projectSimple.options')}</summary><div className="space-y-3">
        <label className="block text-sm">{t('projectSimple.budget')}<input inputMode="decimal" value={form.budget} onChange={change('budget')} className={projectFieldClass} /></label>
        <label className="block text-sm">{t('financialWorkspace.currency')}<select aria-label={t('financialWorkspace.currency')} value={form.currency} onChange={change('currency')} className={projectFieldClass}><option value="">{t('financialWorkspace.localCurrency')}</option>{[...new Set([...Object.keys(CURRENCY_LABELS), ...regionalCurrencies, ...(form.currency ? [form.currency] : [])])].map((code) => <option key={code} value={code}>{t(`currency.${code}`, { defaultValue: code })}</option>)}</select></label>
        <label className="block text-sm">{t('propertiesPage.form.labels.city')}<input value={form.city} onChange={change('city')} className={projectFieldClass} /></label>
        {canAssign && <label className="block text-sm">{t('projects.form.agentLabel')}<select value={form.agentId} onChange={(event) => { setAgentTouched(true); change('agentId')(event); }} className={projectFieldClass}><option value="">{t('projects.form.agentPlaceholder')}</option>{form.agentId && !agents.some((agent) => String(agent.id) === String(form.agentId)) && <option value={form.agentId}>{[project?.agent?.firstName, project?.agent?.lastName].filter(Boolean).join(' ') || `#${form.agentId}`}</option>}{agents.map((agent) => <option key={agent.id} value={agent.id}>{[agent.firstName, agent.lastName].filter(Boolean).join(' ')} · {agent.email}</option>)}</select></label>}
      </div></details>
      <details open={mapOpen} onToggle={(event) => setMapOpen(event.currentTarget.open)} className="rounded-xl border border-border p-3"><summary className="min-h-11 cursor-pointer py-3 text-sm">{t('projectSimple.map')}</summary>{mapOpen && <MissionLocationMap latitude={form.latitude} longitude={form.longitude} onPositionChange={(coordinates) => setForm((previous) => ({ ...previous, ...coordinates }))} />}</details>
      <div className="flex flex-wrap gap-3"><button type="submit" className="btn-primary min-h-11 rounded-xl px-4 text-sm font-semibold">{t(busy ? 'financialWorkspace.saving' : project ? 'financialWorkspace.save' : 'projectSimple.create')}</button><button type="button" onClick={onCancel} className="btn-secondary min-h-11 rounded-xl px-4 text-sm">{t('financialWorkspace.cancel')}</button></div>
    </fieldset>
    {error && <p role="alert" className="app-alert app-alert-error">{error}</p>}
  </form>;
}
