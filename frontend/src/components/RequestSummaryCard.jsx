import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getRequestDetailPath, getRequestNextAction, needsClientAction, isRequestHistory } from '../utils/requestLifecycle';
import { useLocale } from '../i18n/useLocale';

export default function RequestSummaryCard({ request, from, detailed = false }) {
  const { t } = useTranslation();
  const { formatDate } = useLocale();
  const needsAction = needsClientAction(request);
  const executor = request.provider?.displayFirstName || [request.agent?.firstName, request.agent?.lastName].filter(Boolean).join(' ');
  return <article aria-labelledby={`request-summary-${request.id}`} className={`rounded-2xl border bg-surface-card p-4 ${needsAction ? 'border-amber-500/40' : 'border-border'}`}>
    <p className="text-xs text-text-muted">{t('serviceOrders.reference', { id: request.id })}</p>
    <h3 id={`request-summary-${request.id}`} className="mt-1 break-words font-semibold text-text-primary">{request.title || t('serviceOrders.reference', { id: request.id })}</h3>
    {detailed && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-secondary"><span className={`rounded-full border px-2.5 py-1 ${needsAction ? 'border-amber-500/40 bg-amber-500/10' : 'border-border bg-surface-main'}`}>{t(request.missionStatus ? `missionTracking.status.${request.missionStatus}` : `services.status.${request.status}`, { defaultValue: request.missionStatus || request.status })}</span>{request.createdAt && <time dateTime={request.createdAt}>{formatDate(request.createdAt)}</time>}{request.tradeCategory?.name && <span>{request.tradeCategory.name}</span>}</div>}
    {executor && <p className="mt-2 text-sm text-text-secondary">{executor}</p>}
    <p className="mt-2 text-sm text-text-secondary">{t(`serviceOrders.clientNextAction.${getRequestNextAction(request, 'client')}`)}</p>
    <Link to={getRequestDetailPath(request)} state={from ? { from } : undefined} className="btn-primary mt-4 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold">{t(needsAction ? 'clientHome.review' : isRequestHistory(request) ? 'serviceOrders.view' : 'serviceOrders.follow')}</Link>
  </article>;
}
