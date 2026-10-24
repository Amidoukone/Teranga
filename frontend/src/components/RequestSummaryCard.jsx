import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getRequestDetailPath, getRequestNextAction, needsClientAction } from '../utils/requestLifecycle';

export default function RequestSummaryCard({ request }) {
  const { t } = useTranslation();
  const needsAction = needsClientAction(request);
  const executor = request.provider?.displayFirstName || [request.agent?.firstName, request.agent?.lastName].filter(Boolean).join(' ');
  return <article className={`rounded-2xl border bg-surface-card p-4 ${needsAction ? 'border-amber-500/40' : 'border-border'}`}>
    <p className="text-xs text-text-muted">{t('serviceOrders.reference', { id: request.id })}</p>
    <h3 className="mt-1 break-words font-semibold text-text-primary">{request.title || t('serviceOrders.reference', { id: request.id })}</h3>
    {executor && <p className="mt-2 text-sm text-text-secondary">{executor}</p>}
    <p className="mt-2 text-sm text-text-secondary">{t(`serviceOrders.clientNextAction.${getRequestNextAction(request, 'client')}`)}</p>
    <Link to={getRequestDetailPath(request)} className="btn-primary mt-4 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold">{t(needsAction ? 'clientHome.review' : 'serviceOrders.follow')}</Link>
  </article>;
}
