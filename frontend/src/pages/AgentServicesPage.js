import AgentCoordinationPanel from '../features/mission-tracking/AgentCoordinationPanel';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BadgeCheck,
  BriefcaseBusiness,
  Clock3,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCw,
  UserRound,
} from 'lucide-react';

import { getAgentServices, startService } from '../services/services';
import { buildTelHref, buildWhatsappHref } from '../utils/phone';
import { useLocale } from '../i18n/useLocale';

const SERVICE_POLL_MS = 15000;

function isDocumentVisible() {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

function statusTone(status) {
  if (status === 'validated') return 'app-badge app-badge-success';
  if (status === 'completed') return 'border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200';
  if (status === 'in_progress') return 'app-badge app-badge-info';
  return 'border border-border bg-surface-card text-text-secondary';
}

function displayClient(client, t) {
  if (!client) return t('serviceAgent.unknownClient');
  return [client.firstName, client.lastName].filter(Boolean).join(' ') || client.email || t('serviceAgent.unknownClient');
}

function AssignedServiceCard({ service, acting, onAction }) {
  const { t } = useTranslation();
  const { formatDate, formatNumber } = useLocale();
  const clientName = displayClient(service.client, t);
  const telHref = buildTelHref(service.client?.phone);
  const whatsappHref = buildWhatsappHref(
    service.client?.phone,
    t('serviceTracking.whatsappMessage', { id: service.id, title: service.title })
  );
  const budget = service.budget === null || service.budget === '' ? null : Number(service.budget);
  const currency = String(service.currency || 'XOF').toUpperCase();

  return (
    <article className="rounded-[24px] border border-border/70 bg-surface-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
          <BriefcaseBusiness size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                {service.typeLabel || t(`services.type.${service.type}`, { defaultValue: service.type })}
              </p>
              <h3 className="mt-1 font-bold text-text-primary break-words">{service.title}</h3>
            </div>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusTone(service.status)}`}>
              {t(`services.status.${service.status}`, { defaultValue: service.status })}
            </span>
          </div>

          <div className="mt-4 grid gap-2 text-sm text-text-secondary sm:grid-cols-2">
            <p className="flex items-center gap-2">
              <UserRound size={15} className="shrink-0 text-blue-600" /> {clientName}
            </p>
            {service.address ? (
              <p className="flex items-start gap-2">
                <MapPin size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                <span className="line-clamp-2">{service.address}</span>
              </p>
            ) : null}
            <p className="flex items-center gap-2">
              <Clock3 size={15} className="shrink-0 text-text-muted" />
              {service.createdAt ? formatDate(service.createdAt) : t('common.dash')}
            </p>
            {Number.isFinite(budget) ? (
              <p className="font-semibold text-text-primary">
                {formatNumber(budget)} {t(`currency.${currency}`, { defaultValue: currency })}
              </p>
            ) : null}
          </div>

          {service.status === 'completed' ? (
            <p className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-900 dark:text-amber-100">
              {t('serviceAgent.waitingValidation')}
            </p>
          ) : null}

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {service.status === 'created' ? (
              <button
                type="button"
                onClick={() => onAction(service.id, 'start')}
                disabled={acting === service.id}
                className="btn-primary flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-bold"
              >
                {acting === service.id ? <Loader2 size={17} className="mr-2 animate-spin" /> : null}
                {t('serviceTracking.actions.start')}
              </button>
            ) : service.status === 'in_progress' ? (
              <Link
                to={`/services/${service.id}#completion-report`}
                className="btn-primary flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-bold"
              >
                {t('completion.prepare')}
              </Link>
            ) : (
              <Link to={`/services/${service.id}`} className="btn-primary flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold">
                {t('serviceOrders.view')}
              </Link>
            )}
            <Link to={`/services/${service.id}`} className="btn-secondary flex min-h-11 items-center justify-center rounded-xl px-4 text-sm">
              {t('serviceAgent.details')}
            </Link>
          </div>

          {(telHref || whatsappHref) ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {telHref ? (
                <a href={telHref} className="btn-secondary flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm">
                  <Phone size={15} /> {t('serviceTracking.actions.call')}
                </a>
              ) : <span />}
              {whatsappHref ? (
                <a href={whatsappHref} target="_blank" rel="noreferrer" className="btn-secondary flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm">
                  <MessageCircle size={15} /> WhatsApp
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function AgentServicesPage() {
  const { t } = useTranslation();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [view, setView] = useState('active');
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const generation = useRef(0);
  const mutation = useRef(false);

  const load = useCallback(async ({ silent = false } = {}) => {
    const epoch = ++generation.current;
    if (!silent) setRefreshing(true);
    try {
      const data = await getAgentServices({ view, offset, limit: 25 }, { withPagination: true });
      if (epoch !== generation.current) return;
      if (!data.items.length && offset > 0 && data.pagination?.total <= offset) {
        setOffset(Math.max(0, Math.floor((data.pagination.total - 1) / 25) * 25));
        return;
      }
      setServices(data.items);
      setTotal(data.pagination?.total ?? data.items.length);
      setFeedback(null);
    } catch (_error) {
      if (epoch !== generation.current) return;
      setFeedback({ type: 'error', message: t('agentServicesPage.errors.load') });
    } finally {
      if (epoch === generation.current) { setLoading(false); setRefreshing(false); }
    }
  }, [t, view, offset]);

  useEffect(() => {
    load();
    function refreshIfVisible() {
      if (isDocumentVisible()) load({ silent: true });
    }
    const interval = setInterval(refreshIfVisible, SERVICE_POLL_MS);
    window.addEventListener('focus', refreshIfVisible);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      generation.current += 1;
      clearInterval(interval);
      window.removeEventListener('focus', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [load]);

  const handleAction = useCallback(async (id, action) => {
    if (mutation.current) return;
    mutation.current = true;
    setActing(id);
    setFeedback(null);
    try {
      await startService(id);
      await load({ silent: true });
      setFeedback({ type: 'success', message: t(`serviceTracking.success.${action}`) });
    } catch (e) {
      setFeedback({
        type: 'error',
        message: e?.response?.data?.error || t('agentServicesPage.errors.updateStatus'),
      });
    } finally {
      mutation.current = false;
      setActing(null);
    }
  }, [load, t]);

  if (loading) {
    return <div className="flex min-h-[55vh] items-center justify-center text-sm text-text-muted">{t('agentServicesPage.loading.list')}</div>;
  }

  return (
    <div className="app-page-wrap">
      <div className="app-page-shell space-y-8">
        <header className="rounded-[28px] border border-border/70 bg-surface-card p-5 shadow-sm sm:p-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="page-kicker">{t('serviceAgent.kicker')}</p>
              <h1 className="app-page-headline">{t('serviceAgent.title')}</h1>
              <p className="mt-2 text-sm text-text-secondary">{t('serviceAgent.subtitle')}</p>
            </div>
            <button type="button" onClick={() => load()} disabled={refreshing} className="btn-secondary flex h-11 w-11 shrink-0 items-center justify-center rounded-full" aria-label={t('serviceOrders.refresh')}>
              <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
          <button type="button" disabled={Boolean(acting) || refreshing} onClick={() => { setServices([]); setOffset(0); setView(view === 'active' ? 'history' : 'active'); }} className="btn-secondary mt-4 min-h-11 rounded-xl px-4 text-sm">{t(view === 'active' ? 'fieldWorkspace.showHistory' : 'fieldWorkspace.showActive')}</button>
        </header>

        <AgentCoordinationPanel />
        <Link to="/missions/mine" className="btn-secondary inline-flex min-h-11 items-center rounded-xl px-4 text-sm">{t('fieldWorkspace.supervised')}</Link>

        {feedback ? (
          <div className={`app-alert ${feedback.type === 'error' ? 'app-alert-error' : 'app-alert-success'}`}>{feedback.message}</div>
        ) : null}

        {!services.length ? (
          <div className="rounded-[28px] border border-dashed border-border bg-surface-card px-6 py-12 text-center">
            <BadgeCheck size={34} className="mx-auto text-blue-600" />
            <h2 className="mt-4 font-bold text-text-primary">{t('serviceAgent.emptyTitle')}</h2>
            <p className="mt-2 text-sm text-text-muted">{t('serviceAgent.emptyHint')}</p>
          </div>
        ) : (
          <>
            <section>
              <h2 className="mb-3 text-lg font-bold text-text-primary">{t(view === 'active' ? 'serviceAgent.activeTitle' : 'serviceAgent.historyTitle')}</h2>
              {services.length ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {[...services].sort((a, b) => Number(a.status === 'completed') - Number(b.status === 'completed')).map((service) => <AssignedServiceCard key={service.id} service={service} acting={acting} onAction={handleAction} />)}
                </div>
              ) : <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-text-muted">{t('serviceAgent.activeEmpty')}</p>}
            </section>
          </>
        )}
        {total > 25 && <nav aria-label={t('serviceAgent.title')} className="flex items-center justify-between gap-3">
          <button type="button" disabled={offset === 0 || refreshing} onClick={() => setOffset(Math.max(0, offset - 25))} className="btn-secondary min-h-11 rounded-xl px-4 disabled:opacity-50">{t('operations.previous')}</button>
          <p className="text-sm">{offset + 1}–{offset + services.length} / {total}</p>
          <button type="button" disabled={offset + 25 >= total || refreshing} onClick={() => setOffset(offset + 25)} className="btn-secondary min-h-11 rounded-xl px-4 disabled:opacity-50">{t('operations.next')}</button>
        </nav>}
      </div>
    </div>
  );
}
