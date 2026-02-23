import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { applyLabels, SERVICE_STATUSES, SERVICE_TYPES } from '../utils/labels';
import { useLocale } from '../i18n/useLocale';
import { useTranslation } from 'react-i18next';
import { notify } from '../utils/notify';

const TOKEN_KEY = 'teranga_token';

/**
 * Ã°Å¸Â§â€˜Ã¢â‚¬ÂÃ°Å¸â€Â§ AgentServicesPage Ã¢â‚¬â€ Version Apple Light Minimal Premium
 * ------------------------------------------------------------
 * - Interface clean, douce, ÃƒÂ©lÃƒÂ©gante
 * - Aucune logique mÃƒÂ©tier modifiÃƒÂ©e
 * - Ã¢Å“â€¦ Multi-pays / Master-safe : PAS de geo params cÃƒÂ´tÃƒÂ© frontend
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
      const token =
        localStorage.getItem(TOKEN_KEY) || localStorage.getItem('token');

      const { data } = await api.get('/services/agent/services', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const enriched = (data?.services || []).map((s) =>
        applyLabels(s, 'service')
      );
      setServices(enriched);
    } catch (err) {
      console.error('Ã¢ÂÅ’ Erreur chargement services agent:', err);
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
      const token =
        localStorage.getItem(TOKEN_KEY) || localStorage.getItem('token');

      let endpoint = '';
      if (action === 'start') endpoint = `/services/agent/services/${id}/start`;
      if (action === 'complete')
        endpoint = `/services/agent/services/${id}/complete`;

      if (!endpoint) return;

      await api.post(
        endpoint,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      await load();
    } catch (err) {
      console.error('Ã¢ÂÅ’ Erreur mise ÃƒÂ  jour statut service:', err);
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
    <div className="min-h-screen bg-gradient-to-br from-[#f5f5f7] via-surface-card to-[#e5e5ea] px-4 py-10">
      <div className="max-w-5xl mx-auto bg-surface-card/90 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.06)] rounded-3xl border border-[#e5e5ea] p-8">
        {/* Ã°Å¸Â§Â­ En-tÃƒÂªte */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#111827] tracking-tight">
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
                  ? 'bg-[#bfdcff] cursor-not-allowed text-white'
                  : 'bg-[#0a84ff] text-white hover:bg-[#0066cc] active:bg-[#004fa3]'
              }
            `}
          >
            {loading
              ? t('agentServicesPage.loading.refresh')
              : t('agentServicesPage.buttons.refresh')}
          </button>
        </div>

        {/* Ã°Å¸â€œÂ¦ Liste des services */}
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
                  bg-surface-card border border-[#e5e7eb] rounded-3xl
                  shadow-sm p-6 transition
                  hover:shadow-md hover:-translate-y-0.5
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
                      {SERVICE_TYPES[s.type] || s.type} Ã¢â‚¬Â¢{' '}
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

                  {/* Ã°Å¸ÂÂ·Ã¯Â¸Â Badge statut */}
                  <div
                    className={`
                      mt-3 sm:mt-0 px-4 py-1 rounded-full text-xs font-semibold
                      whitespace-nowrap text-center
                      ${
                        s.status === 'created'
                          ? 'bg-surface-main/80 text-text-secondary'
                          : s.status === 'in_progress'
                          ? 'bg-[#cce4ff] text-[#0a84ff]'
                          : s.status === 'completed'
                          ? 'bg-green-100 text-green-600'
                          : s.status === 'validated'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-surface-main/80 text-text-muted'
                      }
                    `}
                  >
                    {SERVICE_STATUSES[s.status] || s.status}
                  </div>
                </div>

                {/* ===================== */}
                {/* DÃƒÂ©tails supplÃƒÂ©mentaires */}
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
                            ? 'bg-[#9fc9ff] cursor-not-allowed text-white'
                            : 'bg-[#0a84ff] text-white hover:bg-[#0066cc] active:bg-[#004fa3]'
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
                            ? 'bg-green-300 cursor-not-allowed text-white'
                            : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
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
                    <span className="text-sm italic text-green-700">
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




