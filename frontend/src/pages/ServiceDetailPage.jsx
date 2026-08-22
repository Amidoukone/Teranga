import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
  ReceiptText,
  UserRound,
} from 'lucide-react';

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

const SERVICE_POLL_MS = 15000;
const TERMINAL_STATUSES = new Set(['validated']);
const PROGRESS_STEPS = ['request', 'assigned', 'inProgress', 'confirmed'];

function isDocumentVisible() {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

function progressIndex(service) {
  if (service?.status === 'validated') return 4;
  if (service?.status === 'completed') return 3;
  if (service?.status === 'in_progress') return 2;
  if (service?.agent) return 1;
  return 0;
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

function ServiceProgress({ service, t }) {
  const currentIndex = progressIndex(service);
  return (
    <ol
      className="mt-5 grid grid-cols-4 gap-1 rounded-2xl border border-border/70 bg-surface-main/60 p-3"
      aria-label={t('serviceTracking.progress.label')}
    >
      {PROGRESS_STEPS.map((step, index) => {
        const complete = index < currentIndex;
        const current = index === currentIndex;
        return (
          <li key={step} aria-current={current ? 'step' : undefined} className="flex min-w-0 flex-col items-center text-center">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold ${
                complete
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : current
                  ? 'border-blue-600 bg-blue-600 text-white ring-4 ring-blue-500/15'
                  : 'border-border bg-surface-card text-text-muted'
              }`}
            >
              {complete ? '✓' : index + 1}
            </span>
            <span className={`mt-1.5 text-[10px] leading-tight sm:text-xs ${complete || current ? 'font-semibold text-text-primary' : 'text-text-muted'}`}>
              {t(`serviceTracking.progress.${step}`)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function ServiceDetailPage() {
  const { t } = useTranslation();
  const { formatDate, formatNumber } = useLocale();
  const navigate = useNavigate();
  const { id } = useParams();
  const [role, setRole] = useState(null);
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [action, setAction] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const serviceRef = useRef(service);
  serviceRef.current = service;

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const data = await getServiceById(id);
      if (data?.missionStatus) {
        navigate(`/missions/${id}/track`, { replace: true });
        return;
      }
      setService(data);
      setError(null);
    } catch (e) {
      setError(
        e?.response?.status === 403
          ? t('serviceDetailPage.errors.forbidden')
          : t('serviceDetailPage.errors.load')
      );
    } finally {
      setLoading(false);
    }
  }, [id, navigate, t]);

  useEffect(() => {
    let active = true;
    me()
      .then(({ user }) => {
        if (!active) return;
        if (!user) navigate('/login');
        else setRole(normalizeRole(user.role));
      })
      .catch(() => navigate('/login'));
    return () => { active = false; };
  }, [navigate]);

  useEffect(() => {
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
      clearInterval(interval);
      window.removeEventListener('focus', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [load]);

  const runAction = useCallback(async (name) => {
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
      setAction(null);
    }
  }, [id, load, t]);

  const primaryAction = useMemo(() => {
    if (role === 'agent' && service?.status === 'created') {
      return { name: 'start', label: t('serviceTracking.actions.start') };
    }
    if (role === 'agent' && service?.status === 'in_progress') {
      return { name: 'complete', label: t('serviceTracking.actions.complete') };
    }
    if (role === 'client' && service?.status === 'completed') {
      return { name: 'validate', label: t('serviceTracking.actions.validate') };
    }
    return null;
  }, [role, service?.status, t]);

  const backTo = role === 'agent' ? '/agent/services' : role === 'admin' ? '/admin/services' : '/services';
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
        <div className="app-alert app-alert-error">{error || t('serviceDetailPage.errors.load')}</div>
        <Link to={backTo} className="btn-secondary mt-4 inline-flex rounded-full px-5 py-2.5 text-sm">
          {t('serviceDetailPage.backToServices')}
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
    <div className="app-page-wrap pb-24 sm:pb-10">
      <div className="app-page-shell max-w-3xl space-y-5">
        <Link to={backTo} className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary">
          <ArrowLeft size={16} aria-hidden="true" /> {t('serviceDetailPage.backToServices')}
        </Link>

        <section className="rounded-[28px] border border-border/70 bg-surface-card p-5 shadow-sm sm:p-7">
          <p className="page-kicker">{t('serviceTracking.kicker')}</p>
          <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="app-page-headline break-words">
                {service.title || t('serviceDetailPage.fallbackTitle', { id: service.id })}
              </h1>
              <p className="mt-1 text-sm text-text-muted">
                {service.typeLabel || t(`services.type.${service.type}`, { defaultValue: service.type })}
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

          <ServiceProgress service={service} t={t} />

          {feedback ? (
            <div className={`app-alert mt-5 ${feedback.type === 'error' ? 'app-alert-error' : 'app-alert-success'}`}>
              {feedback.message}
            </div>
          ) : null}

          {primaryAction ? (
            <button
              type="button"
              onClick={() => runAction(primaryAction.name)}
              disabled={Boolean(action)}
              className="btn-primary mt-5 hidden min-h-12 items-center justify-center rounded-2xl px-6 text-sm font-bold sm:inline-flex"
            >
              {action === primaryAction.name ? <Loader2 size={17} className="mr-2 animate-spin" /> : <CheckCircle2 size={17} className="mr-2" />}
              {primaryAction.label}
            </button>
          ) : null}
        </section>

        <section className="rounded-[24px] border border-border/70 bg-surface-card p-5 shadow-sm">
          <h2 className="text-base font-bold text-text-primary">{t('serviceTracking.detailsTitle')}</h2>
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
            {Number.isFinite(budget) ? (
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
        </section>

        <details className="rounded-2xl border border-border/70 bg-surface-card px-5 py-4 text-sm">
          <summary className="cursor-pointer font-semibold text-text-primary">{t('serviceTracking.moreOptions')}</summary>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to={`/services/${service.id}/tasks`} className="btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2.5">
              <BriefcaseBusiness size={16} /> {t('serviceDetailPage.buttons.viewTasks')}
            </Link>
            <Link to={`/services/${service.id}/transactions`} className="btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2.5">
              <ReceiptText size={16} /> {t('serviceDetailPage.buttons.viewTransactions')}
            </Link>
          </div>
        </details>
      </div>

      {primaryAction ? (
        <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-surface-card/95 p-3 shadow-2xl backdrop-blur sm:hidden">
          <button
            type="button"
            onClick={() => runAction(primaryAction.name)}
            disabled={Boolean(action)}
            className="btn-primary flex min-h-12 w-full items-center justify-center rounded-2xl px-5 text-sm font-bold"
          >
            {action === primaryAction.name ? <Loader2 size={17} className="mr-2 animate-spin" /> : <CheckCircle2 size={17} className="mr-2" />}
            {primaryAction.label}
          </button>
        </div>
      ) : null}
    </div>
  );
}
