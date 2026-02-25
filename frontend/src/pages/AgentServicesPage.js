import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { getAuthHeader } from '../services/auth';
import { applyLabels, SERVICE_STATUSES, SERVICE_TYPES } from '../utils/labels';
import { useLocale } from '../i18n/useLocale';
import { useTranslation } from 'react-i18next';
import { notify } from '../utils/notify';

/**
 * AA Aa AaAAA aA AgentServicesPage Aaa Version Apple Light Minimal Premium
 * ------------------------------------------------------------
 * - Interface clean, douce, AAlAAgante
 * - Aucune logique mAAtier modifiAAe
 * - AAa Multi-pays / Master-safe : PAS de geo params cAA tAA frontend
 *   (le backend applique le scope via req.user)
 */
export default function AgentServicesPage() {
  const { formatDateTime } = useLocale();
  const { t } = useTranslation();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState(null);

  /* ============================================================
     Ã°Å¸â€Â¹ Chargement des services assignÃƒÂ©s
     Ã¢Å¡Â Ã¯Â¸Â IMPORTANT :
     - Ne PAS injecter countryId/regionId en query params
     - Le backend filtre dÃƒÂ©jÃƒÂ  via applyGeoScope(where, req.user)
  ============================================================ */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/services/agent/services', {
        headers: getAuthHeader(),
      });

      const enriched = (data?.services || []).map((s) =>
        applyLabels(s, 'service')
      );
      setServices(enriched);
    } catch (err) {
      console.error('AAA Erreur chargement services agent:', err);
      setServices([]);
      notify(t('agentServicesPage.errors.load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  /* ============================================================
     Ã°Å¸â€Â¹ Mise ÃƒÂ  jour du statut (start / complete)
  ============================================================ */
  const updateStatus = async (id, action) => {
    try {
      setActingId(id);
      let endpoint = '';
      if (action === 'start') endpoint = `/services/agent/services/${id}/start`;
      if (action === 'complete')
        endpoint = `/services/agent/services/${id}/complete`;

      if (!endpoint) return;

      await api.post(
        endpoint,
        {},
        {
          headers: getAuthHeader(),
        }
      );

      await load();
    } catch (err) {
      console.error('AAA Erreur mise AA jour statut service:', err);
      notify(t('agentServicesPage.errors.updateStatus'));
    } finally {
      setActingId(null);
    }
  };

  /* ============================================================
     Ã°Å¸â€Â¹ Formatage utilisateur
  ============================================================ */
  const displayUser = (u) => {
    if (!u) return t('agentServicesPage.emptyValue');
    return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
  };

  /* ============================================================
     Ã°Å¸â€Â¹ UI Apple Light Ã¢â‚¬â€ Clean / Minimal / Premium
  ============================================================ */
  const emptyValue = t('agentServicesPage.emptyValue');

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-4 py-10">
      <div className="max-w-5xl mx-auto bg-surface-card/95 backdrop-blur-sm shadow-2xl rounded-3xl border border-border/70 p-8">
 {/* AA AA En-tAAate */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4 pb-4 border-b border-border/70">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary tracking-tight">
              {t('agentServicesPage.title')}
            </h1>
            <p className="text-sm text-text-muted">
              {t('agentServicesPage.subtitle')}
            </p>
          </div>

          <button
            onClick={load}
            disabled={loading}
            className={`
              px-5 py-2 text-sm font-medium rounded-full shadow-sm transition
              ${
                loading
                  ? 'bg-blue-300 dark:bg-blue-900/50 cursor-not-allowed text-white dark:text-blue-100'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
              }
            `}
          >
            {loading
              ? t('agentServicesPage.loading.refresh')
              : t('agentServicesPage.buttons.refresh')}
          </button>
        </div>

 {/* AA aA Liste des services */}
        {loading ? (
          <div className="text-center py-10 text-text-muted animate-pulse">
            {t('agentServicesPage.loading.list')}
          </div>
        ) : services.length === 0 ? (
          <p className="text-center text-text-muted italic py-8">
            {t('agentServicesPage.empty')}
          </p>
        ) : (
          <div className="grid gap-6">
            {services.map((s) => (
              <div
                key={s.id}
                className="
                  bg-surface-main border border-border rounded-2xl
                  shadow-sm p-6 transition
                  hover:shadow-md hover:border-blue-500/30 hover:-translate-y-0.5
                  transform
                "
              >
                {/* ===================== */}
                {/* Titre / informations */}
                {/* ===================== */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-text-primary mb-1 break-words">
                      {s.title}
                    </h3>

                    <p className="text-sm text-text-secondary">
                      {SERVICE_TYPES[s.type] || s.type}{' '}
                      <span className="text-text-muted">&bull;</span>{' '}
                      <span className="font-medium text-text-primary">
                        {t('agentServicesPage.labels.budget', {
                          amount: s.budget ?? emptyValue,
                        })}
                      </span>
                    </p>

                    {s.description && (
                      <p className="text-sm text-text-secondary mt-2 break-words">
                        {s.description}
                      </p>
                    )}
                  </div>

 {/* AA AAA A A Badge statut */}
                  <div
                    className={`
                      mt-3 sm:mt-0 px-4 py-1 rounded-full text-xs font-semibold border
                      whitespace-nowrap text-center
                      ${
                        s.status === 'created'
                          ? 'bg-surface-card/80 text-text-secondary border-border'
                          : s.status === 'in_progress'
                          ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
                          : s.status === 'completed'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          : s.status === 'validated'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          : 'bg-surface-card/80 text-text-muted border-border'
                      }
                    `}
                  >
                    {SERVICE_STATUSES[s.status] || s.status}
                  </div>
                </div>

                {/* ===================== */}
 {/* DAAtails supplAAmentaires */}
                {/* ===================== */}
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-text-secondary">
                  <div>
                    <span className="font-medium">
                      {t('agentServicesPage.labels.client')}
                    </span>{' '}
                    {displayUser(s.client)}
                  </div>

                  <div>
                    <span className="font-medium">
                      {t('agentServicesPage.labels.property')}
                    </span>{' '}
                    {s.property?.title
                      ? t('agentServicesPage.labels.propertyValue', {
                          title: s.property.title,
                          city: s.property.city,
                        })
                      : emptyValue}
                  </div>

                  <div>
                    <span className="font-medium">
                      {t('agentServicesPage.labels.contactPerson')}
                    </span>{' '}
                    {s.contactPerson || emptyValue}
                  </div>

                  <div>
                    <span className="font-medium">
                      {t('agentServicesPage.labels.phone')}
                    </span>{' '}
                    {s.contactPhone || emptyValue}
                  </div>

                  <div className="sm:col-span-2">
                    <span className="font-medium">
                      {t('agentServicesPage.labels.address')}
                    </span>{' '}
                    {s.address || emptyValue}
                  </div>

                  <div>
                    <span className="font-medium">
                      {t('agentServicesPage.labels.createdAt')}
                    </span>{' '}
                    {s.createdAt ? formatDateTime(s.createdAt) : emptyValue}
                  </div>
                </div>

                {/* ===================== */}
                {/* Actions Agent */}
                {/* ===================== */}
                <div className="mt-6 flex gap-3 flex-wrap">
                  {s.status === 'created' && (
                    <button
                      onClick={() => updateStatus(s.id, 'start')}
                      disabled={actingId === s.id}
                      className={`
                        px-5 py-2 rounded-full text-sm font-medium transition shadow-sm
                        ${
                          actingId === s.id
                            ? 'bg-blue-300 dark:bg-blue-900/50 cursor-not-allowed text-white dark:text-blue-100'
                            : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                        }
                      `}
                    >
                      {t('agentServicesPage.actions.start')}
                    </button>
                  )}

                  {s.status === 'in_progress' && (
                    <button
                      onClick={() => updateStatus(s.id, 'complete')}
                      disabled={actingId === s.id}
                      className={`
                        px-5 py-2 rounded-full text-sm font-medium transition shadow-sm
                        ${
                          actingId === s.id
                            ? 'bg-emerald-300 dark:bg-emerald-900/50 cursor-not-allowed text-white dark:text-emerald-100'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800'
                        }
                      `}
                    >
                      {t('agentServicesPage.actions.complete')}
                    </button>
                  )}

                  {s.status === 'completed' && (
                    <span className="text-sm italic text-text-muted">
                      {t('agentServicesPage.status.completed')}
                    </span>
                  )}

                  {s.status === 'validated' && (
                    <span className="text-sm italic text-emerald-700 dark:text-emerald-300">
                      {t('agentServicesPage.status.validated')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

