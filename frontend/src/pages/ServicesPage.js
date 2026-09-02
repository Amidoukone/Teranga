import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BadgeCheck,
  BriefcaseBusiness,
  CarFront,
  Clock3,
  MapPin,
  PackageCheck,
  RefreshCw,
  UserRound,
} from 'lucide-react';

import { getMyServices } from '../services/services';
import { useLocale } from '../i18n/useLocale';
import { getRequestNextAction, getRequestProofState } from '../utils/requestLifecycle';

const SERVICE_POLL_MS = 15000;
const MISSION_TERMINAL_STATUSES = new Set([
  'VALIDATED',
  'CLOSED',
  'CANCELLED_BY_CLIENT',
  'NO_EXECUTOR_FOUND',
  'RESOLVED_REFUND',
  'RESOLVED_REDO',
  'RESOLVED_CLOSED',
]);

const REQUEST_FILTERS = ['all', 'service', 'taxi', 'delivery'];

function isDocumentVisible() {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

function isHistoryItem(service) {
  if (service?.missionStatus) return MISSION_TERMINAL_STATUSES.has(service.missionStatus);
  return service?.status === 'validated';
}

function requestKind(service) {
  const slug = service?.tradeCategory?.slug;
  if (slug === 'mobilite') return 'taxi';
  if (slug === 'livraison') return 'delivery';
  return 'service';
}

function detailPath(service) {
  const kind = requestKind(service);
  if (kind === 'taxi') return `/courses/${service.id}`;
  if (kind === 'delivery') return `/livraisons/${service.id}`;
  return service?.missionStatus
    ? `/missions/${service.id}/track`
    : `/services/${service.id}`;
}

function statusTone(service) {
  const status = service?.missionStatus || service?.status;
  if (['VALIDATED', 'CLOSED', 'validated'].includes(status)) return 'app-badge app-badge-success';
  if (['COMPLETED', 'completed'].includes(status)) {
    return 'border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200';
  }
  if (['EN_ROUTE', 'ON_SITE', 'IN_PROGRESS', 'in_progress'].includes(status)) {
    return 'app-badge app-badge-info';
  }
  return 'border border-border bg-surface-main text-text-secondary';
}

function executorName(service, t) {
  if (service?.provider?.displayFirstName) return service.provider.displayFirstName;
  if (service?.agent) {
    return [service.agent.firstName, service.agent.lastName].filter(Boolean).join(' ') || service.agent.email;
  }
  return t('serviceOrders.executorPending');
}

function ServiceCard({ service }) {
  const { t } = useTranslation();
  const { formatDate, formatNumber } = useLocale();
  const kind = requestKind(service);
  const RequestIcon = kind === 'taxi' ? CarFront : kind === 'delivery' ? PackageCheck : BriefcaseBusiness;
  const missionStatus = service.missionStatus || null;
  const statusLabel = missionStatus
    ? t(`missionTracking.status.${missionStatus}`, { defaultValue: missionStatus })
    : t(`services.status.${service.status}`, { defaultValue: service.status });
  const nextAction = getRequestNextAction(service);
  const proofState = getRequestProofState(service);
  const typeLabel =
    service.tradeCategory?.name ||
    service.typeLabel ||
    t(`services.type.${service.type}`, { defaultValue: service.type });
  const budget = service.budget === null || service.budget === '' ? null : Number(service.budget);
  const currency = String(service.currency || 'XOF').toUpperCase();
  const budgetLabel = Number.isFinite(budget)
    ? `${formatNumber(budget)} ${t(`currency.${currency}`, { defaultValue: currency })}`
    : null;

  return (
    <article className="rounded-[24px] border border-border/70 bg-surface-card p-5 shadow-sm transition hover:border-blue-500/30 hover:shadow-md">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
          <RequestIcon size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                {typeLabel}
              </p>
              <h3 className="mt-1 text-base font-bold text-text-primary break-words">
                {service.title || t('serviceOrders.reference', { id: service.id })}
              </h3>
            </div>
            <span role="status" aria-label={t('serviceOrders.statusLabel', { status: statusLabel })} className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusTone(service)}`}>
              {statusLabel}
            </span>
          </div>

          {service.description ? (
            <p className="mt-2 line-clamp-2 text-sm text-text-secondary">{service.description}</p>
          ) : null}

          <div className="mt-4 grid gap-2 text-sm text-text-secondary sm:grid-cols-2">
            <p className="flex items-start gap-2">
              <UserRound size={15} className="mt-0.5 shrink-0 text-blue-600" aria-hidden="true" />
              <span>{executorName(service, t)}</span>
            </p>
            {service.address ? (
              <p className="flex items-start gap-2">
                <MapPin size={15} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                <span className="line-clamp-2">{service.address}</span>
              </p>
            ) : null}
            <p className="flex items-center gap-2">
              <Clock3 size={15} className="shrink-0 text-text-muted" aria-hidden="true" />
              <span>{service.createdAt ? formatDate(service.createdAt) : t('common.dash')}</span>
            </p>
            {budgetLabel ? <p className="font-semibold text-text-primary">{budgetLabel}</p> : null}
          </div>

          {['COMPLETED', 'completed'].includes(missionStatus || service.status) ? (
            <p className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-900 dark:text-amber-100">
              {t('serviceOrders.confirmationNeeded')}
            </p>
          ) : null}

          <p className="mt-3 text-xs text-text-secondary" aria-live="polite">
            {t(`serviceOrders.nextAction.${nextAction}`, { defaultValue: t('serviceOrders.nextAction.follow') })}
            {nextAction === 'proof' && proofState === 'missing' ? ` · ${t('serviceOrders.proofRequired', { defaultValue: 'Preuve à fournir' })}` : ''}
          </p>

          <Link
            to={detailPath(service)}
            className="btn-primary mt-4 flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold sm:w-auto"
          >
            {isHistoryItem(service) ? t('serviceOrders.view') : t('serviceOrders.follow')}
          </Link>
        </div>
      </div>
    </article>
  );
}

function ServiceSection({ title, hint, items, emptyText }) {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-text-primary">{title}</h2>
          <p className="mt-0.5 text-xs text-text-muted">{hint}</p>
        </div>
        <span className="app-toolbar-pill">{items.length}</span>
      </div>
      {items.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((service) => <ServiceCard key={service.id} service={service} />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-surface-card/70 px-5 py-8 text-center text-sm text-text-muted">
          {emptyText}
        </div>
      )}
    </section>
  );
}

export default function ServicesPage() {
  const { t } = useTranslation();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setRefreshing(true);
    try {
      const result = await getMyServices(
        {
          limit: 100,
          sort: '-createdAt',
        },
        { withPagination: true }
      );
      setServices(Array.isArray(result?.items) ? result.items : []);
      setError(null);
    } catch (_error) {
      setError(t('serviceOrders.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    load();

    function refreshIfVisible() {
      if (isDocumentVisible()) load({ silent: true });
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

  const counts = useMemo(() => {
    const next = { all: services.length, service: 0, taxi: 0, delivery: 0 };
    services.forEach((service) => {
      next[requestKind(service)] += 1;
    });
    return next;
  }, [services]);

  const visibleServices = useMemo(
    () => filter === 'all' ? services : services.filter((service) => requestKind(service) === filter),
    [filter, services]
  );
  const active = useMemo(
    () => visibleServices.filter((service) => !isHistoryItem(service)),
    [visibleServices]
  );
  const history = useMemo(() => visibleServices.filter(isHistoryItem), [visibleServices]);

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center text-sm text-text-muted">
        {t('serviceOrders.loading')}
      </div>
    );
  }

  return (
    <div className="app-page-wrap">
      <div className="app-page-shell space-y-8">
        <header className="rounded-[28px] border border-border/70 bg-surface-card p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="page-kicker">{t('serviceOrders.kicker')}</p>
              <h1 className="app-page-headline">{t('serviceOrders.title')}</h1>
              <p className="mt-2 max-w-2xl text-sm text-text-secondary">{t('serviceOrders.subtitle')}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link
                to="/demandes/nouvelle?categorie=mobilite"
                className="btn-secondary flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold"
              >
                {t('serviceOrders.newTaxi')}
              </Link>
              <Link
                to="/demandes/nouvelle?categorie=livraison"
                className="btn-secondary flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold"
              >
                {t('serviceOrders.newDelivery')}
              </Link>
              <Link
                to="/demandes/nouvelle"
                className="btn-primary flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold"
              >
                {t('serviceOrders.newRequest')}
              </Link>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-blue-500/25 bg-blue-500/10 px-4 py-3">
              <p className="text-2xl font-bold text-text-primary">{active.length}</p>
              <p className="text-xs font-medium text-text-secondary">{t('serviceOrders.activeCount')}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
              <p className="text-2xl font-bold text-text-primary">{history.length}</p>
              <p className="text-xs font-medium text-text-secondary">{t('serviceOrders.completedCount')}</p>
            </div>
          </div>
        </header>

        <div
          className="flex gap-2 overflow-x-auto pb-1"
          role="group"
          aria-label={t('serviceOrders.filters.label')}
        >
          {REQUEST_FILTERS.map((value) => {
            const selected = filter === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                aria-pressed={selected}
                className={[
                  'min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition',
                  selected
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-border bg-surface-card text-text-secondary hover:border-blue-400 hover:text-text-primary',
                ].join(' ')}
              >
                {t(`serviceOrders.filters.${value}`)} ({counts[value]})
              </button>
            );
          })}
        </div>

        {error ? (
          <div className="app-alert app-alert-error flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <button type="button" onClick={() => load()} className="app-btn-neutral">
              {t('serviceOrders.retry')}
            </button>
          </div>
        ) : null}

        {!services.length && !error ? (
          <div className="rounded-[28px] border border-dashed border-border bg-surface-card px-6 py-12 text-center">
            <BadgeCheck size={34} className="mx-auto text-blue-600" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-bold text-text-primary">{t('serviceOrders.emptyTitle')}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">{t('serviceOrders.emptyHint')}</p>
            <Link to="/demandes/nouvelle" className="btn-primary mt-5 inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-bold">
              {t('serviceOrders.newRequest')}
            </Link>
          </div>
        ) : !visibleServices.length && !error ? (
          <div className="rounded-[28px] border border-dashed border-border bg-surface-card px-6 py-10 text-center">
            <p className="text-sm font-medium text-text-secondary">{t('serviceOrders.filters.empty')}</p>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className="btn-secondary mt-4 min-h-11 rounded-xl px-4 text-sm font-semibold"
            >
              {t('serviceOrders.filters.showAll')}
            </button>
          </div>
        ) : (
          <>
            <ServiceSection
              title={t('serviceOrders.activeTitle')}
              hint={t('serviceOrders.activeHint')}
              items={active}
              emptyText={t('serviceOrders.activeEmpty')}
            />
            {history.length ? (
              <ServiceSection
                title={t('serviceOrders.historyTitle')}
                hint={t('serviceOrders.historyHint')}
                items={history}
                emptyText={t('serviceOrders.historyEmpty')}
              />
            ) : null}
          </>
        )}

        <button
          type="button"
          onClick={() => load()}
          disabled={refreshing}
          className="btn-secondary mx-auto flex items-center gap-2 rounded-full px-4 py-2 text-xs"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
          {refreshing ? t('serviceOrders.refreshing') : t('serviceOrders.refresh')}
        </button>
      </div>
    </div>
  );
}
