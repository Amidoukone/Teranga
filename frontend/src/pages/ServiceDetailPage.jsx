import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  UserRound,
} from 'lucide-react';

import MissionCompletionPanel from '../features/mission-tracking/MissionCompletionPanel';
import ServiceStepsPanel from '../features/service-workspace/ServiceStepsPanel';
import RequestProgress from '../components/RequestProgress';
import RequestHelp from '../components/RequestHelp';
import RequestAmounts from '../components/RequestAmounts';
import DossierFinanceSection from '../features/finance/DossierFinanceSection';
import { me } from '../services/auth';
import {
  completeService,
  getServiceById,
  startService,
  validateService,
} from '../services/services';
import { normalizeRole } from '../utils/role';
import { buildTelHref, buildWhatsappHref } from '../utils/phone';
import { useLocale } from '../i18n/useLocale';
import { focusCompletionReport, needsCompletionReport } from '../utils/completion';
import { getRequestDetailPath, getRequestReturnPath } from '../utils/requestLifecycle';

const SERVICE_POLL_MS = 15000;
const TERMINAL_STATUSES = new Set(['validated']);

function isDocumentVisible() {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

function statusTone(status) {
  if (status === 'validated') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100';
  if (status === 'completed') return 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100';
  if (status === 'in_progress') return 'border-blue-500/30 bg-blue-500/10 text-blue-900 dark:text-blue-100';
  return 'border-slate-500/25 bg-slate-500/10 text-text-primary';
}

function displayUser(user) {
  if (!user) return null;
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || null;
}

export default function ServiceDetailPage() {
  const { id } = useParams();
  return <ServiceDetail key={id} id={id} />;
}

function ServiceDetail({ id }) {
  const { t } = useTranslation();
  const { formatDate, formatNumber } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState(null);
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshError, setRefreshError] = useState(false);
  const [action, setAction] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const serviceRef = useRef(service);
  const loadVersion = useRef(0);
  const mutation = useRef(false);
  serviceRef.current = service;

  const load = useCallback(async ({ silent = false } = {}) => {
    const epoch = ++loadVersion.current;
    if (!silent) setLoading(true);
    try {
      const data = await getServiceById(id);
      if (epoch !== loadVersion.current) return;
      if (data?.missionStatus) {
        navigate(getRequestDetailPath(data, undefined, role || 'client'), { replace: true, state: location.state });
        return;
      }
      setService(data);
      setError(null);
      setRefreshError(false);
    } catch (e) {
      if (epoch !== loadVersion.current) return;
      if (String(serviceRef.current?.id) === String(id) && ![401, 403, 404].includes(e?.response?.status)) {
        setRefreshError(true);
        return;
      }
      setError(
        e?.response?.status === 403
          ? t('serviceDetailPage.errors.forbidden')
          : t('serviceDetailPage.errors.load')
      );
    } finally {
      if (epoch === loadVersion.current) setLoading(false);
    }
  }, [id, navigate, t, role, location.state]);

  useEffect(() => {
    let active = true;
    me()
      .then(({ user }) => {
        if (!active) return;
        if (!user) navigate('/login');
        else setRole(normalizeRole(user.role));
      })
      .catch(() => { if (active) navigate('/login'); });
    return () => { active = false; };
  }, [navigate]);

  useEffect(() => {
    if (!role) return undefined;
    load();

    function refreshIfVisible() {
      if (!isDocumentVisible()) return;
      if (TERMINAL_STATUSES.has(serviceRef.current?.status)) return;
      load({ silent: true });
    }

    const interval = setInterval(refreshIfVisible, SERVICE_POLL_MS);
    window.addEventListener('focus', refreshIfVisible);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      loadVersion.current += 1;
      clearInterval(interval);
      window.removeEventListener('focus', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [load, role]);

  const runAction = useCallback(async (name) => {
    if (name === 'report') { focusCompletionReport(); return; }
    if (mutation.current) return;
    mutation.current = true;
    setAction(name);
    setFeedback(null);
    try {
      if (name === 'start') await startService(id);
      if (name === 'complete') await completeService(id);
      if (name === 'validate') await validateService(id);
      await load({ silent: true });
      setFeedback({ type: 'success', message: t(`serviceTracking.success.${name}`) });
    } catch (e) {
      setFeedback({
        type: 'error',
        message: e?.response?.data?.error || t('serviceTracking.errors.action'),
      });
    } finally {
      mutation.current = false;
      setAction(null);
    }
  }, [id, load, t]);

  const primaryAction = useMemo(() => {
    if (role === 'agent' && service?.status === 'created') {
      return { name: 'start', label: t('serviceTracking.actions.start') };
    }
    if (role === 'agent' && service?.status === 'in_progress') {
      if (needsCompletionReport(service.completion)) return { name: 'report', label: t('completion.prepare') };
      return { name: 'complete', label: t('serviceTracking.actions.complete') };
    }
    if (role === 'client' && service?.status === 'completed') {
      return { name: 'validate', label: t('serviceTracking.actions.validate') };
    }
    return null;
  }, [role, service?.status, service?.completion, t]);

  const backTo = getRequestReturnPath(location.state?.from, role === 'agent' ? '/agent/services' : role === 'admin' ? '/admin/services' : '/demandes');
  const backLabel = t(backTo.startsWith('/operations') ? 'roleViews.backHome' : backTo.startsWith('/agent/services') ? 'roleViews.backAssigned' : backTo.startsWith('/properties/') ? 'propertySimple.backProperty' : backTo.split('?')[0].endsWith('/transactions') ? 'financialWorkspace.backJournal' : 'serviceDetailPage.backToServices');
  const counterpart = role === 'agent' ? service?.client : service?.agent;
  const telHref = buildTelHref(counterpart?.phone);
  const whatsappHref = buildWhatsappHref(
    counterpart?.phone,
    service ? t('serviceTracking.whatsappMessage', { id: service.id, title: service.title }) : ''
  );

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center gap-2 text-sm text-text-muted">
        <Loader2 size={18} className="animate-spin" /> {t('serviceDetailPage.loading')}
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="mx-auto max-w-xl px-6 py-10">
        <div role="alert" className="app-alert app-alert-error">{error || t('serviceDetailPage.errors.load')} <button type="button" onClick={() => load()} className="underline">{t('serviceOrders.retry')}</button></div>
        <Link to={backTo} className="btn-secondary mt-4 inline-flex rounded-full px-5 py-2.5 text-sm">
          {backLabel}
        </Link>
      </div>
    );
  }

  const budget = service.budget === null || service.budget === '' ? null : Number(service.budget);
  const currency = String(service.currency || 'XOF').toUpperCase();
  const statusIcon = service.status === 'validated' ? BadgeCheck : service.status === 'in_progress' ? BriefcaseBusiness : Clock3;
  const StatusIcon = statusIcon;
  const liveStatusKey = service.status === 'created' && service.agent ? 'createdAssigned' : service.status;

  return (
    <div className="app-page-wrap role-workspace pb-24 sm:pb-10">
      <div className="app-page-shell max-w-3xl space-y-5">
        <Link to={backTo} className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary">
          <ArrowLeft size={16} aria-hidden="true" /> {backLabel}
        </Link>

        <section>
          <p className="page-kicker">{t('serviceTracking.kicker')}</p>
          <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="app-page-headline break-words">
                {service.title || t('serviceDetailPage.fallbackTitle', { id: service.id })}
              </h1>
              <p className="mt-1 text-sm text-text-muted">
                {service.typeLabel || (service.type ? t(`services.type.${service.type}`, { defaultValue: service.type }) : t('serviceOrders.filters.service'))}
                {' · '}{t('serviceTracking.reference', { id: service.id })}
              </p>
            </div>
            <span className="app-toolbar-pill">{t(`services.status.${service.status}`, { defaultValue: service.status })}</span>
          </div>

          <div role="status" aria-live="polite" className={`mt-5 flex items-start gap-3 rounded-2xl border p-4 ${statusTone(service.status)}`}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-card/80 shadow-sm">
              <StatusIcon size={22} aria-hidden="true" />
            </span>
            <div>
              <p className="font-bold">{t(`serviceTracking.liveStatus.${liveStatusKey}.title`, { agent: displayUser(service.agent) })}</p>
              <p className="mt-1 text-sm opacity-80">{t(`serviceTracking.liveStatus.${liveStatusKey}.hint`)}</p>
            </div>
          </div>

          <RequestProgress request={service} />
          {refreshError && <div role="alert" className="app-alert app-alert-error mt-4"><p>{t('completion.connectionInterrupted')}</p><button type="button" onClick={() => load({ silent: true })} className="btn-secondary mt-2 min-h-11 rounded-xl px-4">{t('operations.refresh')}</button></div>}

          {feedback ? (
            <div className={`app-alert mt-5 ${feedback.type === 'error' ? 'app-alert-error' : 'app-alert-success'}`}>
              {feedback.message}
            </div>
          ) : null}

        </section>
        {primaryAction && ['start', 'report'].includes(primaryAction.name) && <section aria-label={t('requestWorkspace.next')} className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4"><h2 className="font-semibold">{t('requestWorkspace.next')}</h2><p className="mt-2 text-sm text-text-secondary">{t(primaryAction.name === 'report' ? 'requestWorkspace.prepareHint' : 'requestWorkspace.startHint')}</p><button type="button" onClick={() => runAction(primaryAction.name)} disabled={Boolean(action)} className="btn-primary mt-3 inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-sm font-semibold">{primaryAction.label}</button></section>}
        <MissionCompletionPanel key={service.id} missionId={service.id} completion={service.completion} canSubmit={role === 'agent' && service.status === 'in_progress'} onSaved={() => load({ silent: true })} />
        {primaryAction && ['complete', 'validate'].includes(primaryAction.name) && <section aria-label={t('requestWorkspace.next')} className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4"><h2 className="font-semibold">{t('requestWorkspace.next')}</h2><p className="mt-2 text-sm text-text-secondary">{t(primaryAction.name === 'validate' ? 'requestWorkspace.confirmHint' : service.completion?.report?.summary ? 'requestWorkspace.readyHint' : 'serviceSteps.handoverHint')}</p><button type="button" onClick={() => runAction(primaryAction.name)} disabled={Boolean(action)} className="btn-primary mt-3 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold">{action ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={17} aria-hidden="true" />}{primaryAction.label}</button></section>}
        <ServiceStepsPanel serviceId={service.id} />
        {role === 'client' && <RequestAmounts request={service} transactionsTo={`/services/${service.id}/transactions`} />}

        <details className="rounded-2xl border border-border bg-surface-card p-4">
          <summary className="cursor-pointer font-semibold">{t('serviceTracking.detailsTitle')}</summary>
          {service.description ? <p className="mt-2 whitespace-pre-line text-sm text-text-secondary">{service.description}</p> : null}
          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            {service.address ? (
              <div className="flex items-start gap-2">
                <MapPin size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                <span className="text-text-primary">{service.address}</span>
              </div>
            ) : null}
            <div className="flex items-start gap-2">
              <UserRound size={16} className="mt-0.5 shrink-0 text-blue-600" />
              <span className="text-text-primary">
                {service.agent
                  ? t('serviceTracking.assignedTo', { name: displayUser(service.agent) })
                  : t('serviceTracking.notAssigned')}
              </span>
            </div>
            {role !== 'client' && Number.isFinite(budget) ? (
              <p className="font-semibold text-text-primary">
                {t('serviceTracking.budget', {
                  amount: formatNumber(budget),
                  currency: t(`currency.${currency}`, { defaultValue: currency }),
                })}
              </p>
            ) : null}
            {service.createdAt ? (
              <p className="text-text-secondary">{t('serviceTracking.createdAt', { date: formatDate(service.createdAt) })}</p>
            ) : null}
          </div>

          {(telHref || whatsappHref) ? (
            <div className="mt-5 grid grid-cols-2 gap-2">
              {telHref ? (
                <a href={telHref} className="btn-secondary flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm">
                  <Phone size={16} /> {t('serviceTracking.actions.call')}
                </a>
              ) : <span />}
              {whatsappHref ? (
                <a href={whatsappHref} target="_blank" rel="noreferrer" className="btn-secondary flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm">
                  <MessageCircle size={16} /> WhatsApp
                </a>
              ) : null}
            </div>
          ) : null}
        </details>

        {role !== 'client' && <DossierFinanceSection kind="service" reference={service.id} />}
        <details className="rounded-2xl border border-border p-4"><summary className="cursor-pointer font-semibold">{t('requestHelp.title')}</summary><div className="mt-3"><RequestHelp id={service.id} title={service.title} phone={service.assistancePhone} /></div></details>
      </div>
    </div>
  );
}
