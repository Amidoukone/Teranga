// frontend/src/pages/ServiceDetailPage.jsx
// Détail d'un service classique (client propriétaire, agent assigné, admin). Point d'entrée par
// défaut quand on clique sur une notification/activité de type "service" — un service n'a pas
// forcément de tâches, donc on ouvre le service lui-même, pas directement ses tâches (l'utilisateur
// y navigue ensuite via le lien dédié si besoin).

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClipboardList, ReceiptEuro, ArrowLeft } from 'lucide-react';
import { me } from '../services/auth';
import { normalizeRole } from '../utils/role';
import { getServiceById } from '../services/services';
import { useLocale } from '../i18n/useLocale';

function statusBadgeClass(status) {
  switch (status) {
    case 'created':
      return 'bg-surface-main/80 text-text-secondary border border-border';
    case 'in_progress':
      return 'app-badge app-badge-info';
    case 'completed':
      return 'app-badge app-badge-success';
    case 'validated':
      return 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30';
    default:
      return 'bg-surface-main text-text-secondary border border-border';
  }
}

function displayUser(u) {
  if (!u) return null;
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
  return name || u.email || null;
}

export default function ServiceDetailPage() {
  const { t } = useTranslation();
  const { formatDate } = useLocale();
  const navigate = useNavigate();
  const { id } = useParams();

  const [role, setRole] = useState(null);
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { user } = await me();
      if (!user) {
        navigate('/login');
        return;
      }
      setRole(normalizeRole(user.role));

      const data = await getServiceById(id);
      setService(data);
    } catch (e) {
      console.error('ServiceDetailPage load error:', e);
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
    load();
  }, [load]);

  const backTo = role === 'agent' ? '/agent/services' : '/services';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-main">
        <p className="text-text-muted text-lg animate-pulse">{t('serviceDetailPage.loading')}</p>
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="mx-auto max-w-xl px-6 py-10">
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {error || t('serviceDetailPage.errors.load')}
        </div>
        <Link to={backTo} className="btn-secondary mt-4 inline-block rounded-full px-6 py-2.5 text-sm">
          {t('serviceDetailPage.backToServices')}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-3 sm:px-4 py-8 sm:py-10">
      <div className="max-w-3xl mx-auto bg-surface-card/90 backdrop-blur-sm shadow-xl rounded-2xl border border-border/70 px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={15} />
          {t('serviceDetailPage.backToServices')}
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary break-words">
              {service.title || t('serviceDetailPage.fallbackTitle', { id: service.id })}
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              {service.typeLabel || service.type || t('serviceDetailPage.typeUnknown')}
            </p>
          </div>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium capitalize ${statusBadgeClass(
              service.status
            )}`}
          >
            {service.statusLabel ||
              t(`services.status.${service.status}`, { defaultValue: service.status })}
          </span>
        </div>

        {service.description && (
          <p className="mt-4 text-sm text-text-secondary whitespace-pre-line">
            {service.description}
          </p>
        )}

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {service.address && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {t('serviceDetailPage.labels.address')}
              </div>
              <div className="mt-0.5 text-text-primary break-words">{service.address}</div>
            </div>
          )}

          {service.budget != null && service.budget !== '' && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {t('serviceDetailPage.labels.budget')}
              </div>
              <div className="mt-0.5 text-text-primary">
                {service.budget}{' '}
                {t(`currency.${String(service.currency || 'XOF').toUpperCase()}`, {
                  defaultValue: service.currencyLabel || service.currency,
                })}
              </div>
            </div>
          )}

          {displayUser(service.client) && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {t('serviceDetailPage.labels.client')}
              </div>
              <div className="mt-0.5 text-text-primary">{displayUser(service.client)}</div>
            </div>
          )}

          {displayUser(service.agent) && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {t('serviceDetailPage.labels.agent')}
              </div>
              <div className="mt-0.5 text-text-primary">{displayUser(service.agent)}</div>
            </div>
          )}

          {service.createdAt && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {t('serviceDetailPage.labels.createdAt')}
              </div>
              <div className="mt-0.5 text-text-primary">{formatDate(service.createdAt)}</div>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to={`/services/${service.id}/tasks`}
            className="btn-secondary inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm"
          >
            <ClipboardList size={16} />
            {t('serviceDetailPage.buttons.viewTasks')}
          </Link>
          <Link
            to={`/services/${service.id}/transactions`}
            className="btn-secondary inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm"
          >
            <ReceiptEuro size={16} />
            {t('serviceDetailPage.buttons.viewTransactions')}
          </Link>
        </div>
      </div>
    </div>
  );
}
