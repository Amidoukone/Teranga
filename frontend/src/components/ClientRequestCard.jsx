import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../i18n/useLocale';
import RequestSummaryCard from './RequestSummaryCard';

export default function ClientRequestCard({ request, from }) {
  const { t } = useTranslation();
  const { formatDate } = useLocale();
  if (request.kind === 'service') return <RequestSummaryCard request={request} from={from} detailed />;
  const project = request.kind === 'project';
  return <article aria-labelledby={`request-${request.kind}-${request.id}`} className={`rounded-2xl border bg-surface-card p-4 ${request.review ? 'border-amber-500/40' : 'border-border'}`}>
    <p className="text-xs text-text-muted">{t(`unifiedRequests.kind.${request.kind}`)} · #{request.id}</p>
    <h3 id={`request-${request.kind}-${request.id}`} className="mt-1 break-words font-semibold text-text-primary">{request.title || request.reference || `#${request.id}`}</h3>
    {request.summary && <p className="mt-2 break-words text-sm text-text-secondary">{request.summary}</p>}
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-secondary"><span className="rounded-full border border-border bg-surface-main px-2.5 py-1">{t(`${project ? 'projects' : 'orders'}.status.${request.status === 'fulfilled' ? 'delivered' : request.status}`, { defaultValue: request.status })}</span>{request.createdAt && <time dateTime={request.createdAt}>{formatDate(request.createdAt)}</time>}</div>
    {!project && request.paymentStatus && <p className="mt-2 text-xs text-text-secondary">{t('orders.list.paymentStatusLabel')} {t(`orders.payment.${request.paymentStatus}`, { defaultValue: request.paymentStatus })}</p>}
    {request.executor && <p className="mt-2 text-sm text-text-secondary">{request.executor}</p>}
    <p className="mt-2 text-sm text-text-secondary">{t(`unifiedRequests.next.${request.history ? 'closed' : request.review ? 'review' : 'following'}`)}</p>
    <Link to={`/${project ? 'projects' : 'orders'}/${request.id}`} state={{ from }} className="btn-primary mt-4 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold">{t(request.review ? 'clientHome.review' : request.history ? 'serviceOrders.view' : 'serviceOrders.follow')}</Link>
  </article>;
}
