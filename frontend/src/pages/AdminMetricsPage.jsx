// frontend/src/pages/AdminMetricsPage.jsx
// ============================================================================
// AdminMetricsPage.jsx ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Monitoring minimal (lecture seule)
// Admin GLOBAL + MASTER (admin + geo scope) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ZÃƒÆ’Ã¢â‚¬Â°RO RÃƒÆ’Ã¢â‚¬Â°GRESSION
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getMetrics } from '../services/metrics';
import { useLocale } from '../i18n/useLocale';
import { useTranslation } from 'react-i18next';

function formatMs(value) {
  if (!Number.isFinite(value)) return '0 ms';
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} s`;
  }
  return `${Math.round(value)} ms`;
}

function toEntries(data) {
  return Object.entries(data || {}).map(([key, val]) => ({
    key,
    value: val,
  }));
}

export default function AdminMetricsPage() {
  const { t } = useTranslation();
  const { formatNumber, formatDateTime } = useLocale();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastFetched, setLastFetched] = useState(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getMetrics();
      setMetrics(data);
      setLastFetched(new Date());
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.message ||
          t('adminMetricsPage.errors.load')
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const totals = metrics?.totals || {};
  const durations = metrics?.durationsMs || {};
  const sloLatency = metrics?.slo?.latency || {};
  const frontendErrors = metrics?.frontendErrors || { total: 0, recent: [] };

  const statusEntries = useMemo(() => toEntries(metrics?.byStatus), [metrics]);
  const methodEntries = useMemo(() => toEntries(metrics?.byMethod), [metrics]);
  const routeEntries = useMemo(() => toEntries(metrics?.byRoute), [metrics]);
  const recentErrors = metrics?.recentErrors || [];
  const slowRequests = metrics?.slowRequests || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-text-primary">
            {t('adminMetricsPage.title')}
          </h1>
          <p className="text-sm text-text-secondary">
            {t('adminMetricsPage.lastUpdated')}{' '}
            {lastFetched
              ? formatDateTime(lastFetched)
              : t('adminMetricsPage.emptyValue')}
          </p>
        </div>
        <button
          type="button"
          onClick={fetchMetrics}
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-surface-main/80"
        >
          {t('adminMetricsPage.buttons.refresh')}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/15 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-border bg-surface-card p-6 text-sm text-text-secondary">
          {t('adminMetricsPage.loading')}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="rounded-2xl border border-border bg-surface-card p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase text-text-muted">
                {t('adminMetricsPage.cards.totalRequests')}
              </p>
              <p className="mt-2 text-2xl font-extrabold text-text-primary">
                {formatNumber(totals.requests || 0)}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-surface-card p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase text-text-muted">
                {t('adminMetricsPage.cards.errors5xx')}
              </p>
              <p className="mt-2 text-2xl font-extrabold text-rose-600 dark:text-rose-300">
                {formatNumber(totals.errors || 0)}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-surface-card p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase text-text-muted">
                {t('adminMetricsPage.cards.avgLatency')}
              </p>
              <p className="mt-2 text-2xl font-extrabold text-text-primary">
                {formatMs(durations.avg || 0)}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {t('adminMetricsPage.cards.maxLatency', {
                  value: formatMs(durations.max || 0),
                })}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-surface-card p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase text-text-muted">
                SLO latency
              </p>
              <p className="mt-2 text-2xl font-extrabold text-text-primary">
                {Number.isFinite(sloLatency.currentCompliancePct)
                  ? `${sloLatency.currentCompliancePct}%`
                  : 'n/a'}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                target {sloLatency.targetCompliancePct || 95}% {"<="}{" "}
                {formatMs(sloLatency.targetMs || 800)}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-surface-card p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase text-text-muted">
                Frontend errors
              </p>
              <p className="mt-2 text-2xl font-extrabold text-text-primary">
                {formatNumber(frontendErrors.total || 0)}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                last {formatNumber(frontendErrors.recent?.length || 0)} events
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-border bg-surface-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-text-primary">
                {t('adminMetricsPage.sections.httpStatus')}
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                {statusEntries.length === 0 && (
                  <li>{t('adminMetricsPage.emptyValue')}</li>
                )}
                {statusEntries.map((entry) => (
                  <li key={entry.key} className="flex justify-between">
                    <span>{entry.key}</span>
                    <span className="font-semibold">
                      {formatNumber(entry.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-surface-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-text-primary">
                {t('adminMetricsPage.sections.httpMethods')}
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                {methodEntries.length === 0 && (
                  <li>{t('adminMetricsPage.emptyValue')}</li>
                )}
                {methodEntries.map((entry) => (
                  <li key={entry.key} className="flex justify-between">
                    <span>{entry.key}</span>
                    <span className="font-semibold">
                      {formatNumber(entry.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-surface-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-text-primary">
                {t('adminMetricsPage.sections.topRoutes')}
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                {routeEntries.length === 0 && (
                  <li>{t('adminMetricsPage.emptyValue')}</li>
                )}
                {routeEntries.slice(0, 8).map((entry) => (
                  <li key={entry.key} className="flex justify-between gap-3">
                    <span className="truncate">{entry.key}</span>
                    <span className="font-semibold">
                      {formatNumber(entry.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-border bg-surface-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-text-primary">
                {t('adminMetricsPage.sections.recentErrors')}
              </h2>
              <div className="mt-3 space-y-3 text-sm text-text-secondary">
                {recentErrors.length === 0 && (
                  <p>{t('adminMetricsPage.emptyValue')}</p>
                )}
                {recentErrors.map((entry, idx) => (
                  <div
                    key={`${entry.requestId || 'err'}-${idx}`}
                    className="rounded-lg border border-rose-500/30 bg-rose-500/15 px-3 py-2"
                  >
                    <p className="font-semibold text-rose-700 dark:text-rose-300">
                      {entry.method} {entry.path}
                    </p>
                    <p>
                      {t('adminMetricsPage.items.status', {
                        code: entry.statusCode,
                      })} {" - "} {formatMs(entry.durationMs)}
                    </p>
                    <p className="text-xs text-rose-600 dark:text-rose-300/90">
                      {entry.timestamp}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-text-primary">
                {t('adminMetricsPage.sections.slowRequests')}
              </h2>
              <div className="mt-3 space-y-3 text-sm text-text-secondary">
                {slowRequests.length === 0 && (
                  <p>{t('adminMetricsPage.emptyValue')}</p>
                )}
                {slowRequests.map((entry, idx) => (
                  <div
                    key={`${entry.requestId || 'slow'}-${idx}`}
                    className="rounded-lg border border-amber-500/30 bg-amber-500/15 px-3 py-2"
                  >
                    <p className="font-semibold text-amber-700 dark:text-amber-300">
                      {entry.method} {entry.path}
                    </p>
                    <p>
                      {formatMs(entry.durationMs)} {" - "} {t('adminMetricsPage.items.threshold', {
                        value: formatMs(entry.thresholdMs),
                      })}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-300/90">
                      {entry.timestamp}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-text-primary">
                Frontend errors (recent)
              </h2>
              <div className="mt-3 space-y-3 text-sm text-text-secondary">
                {frontendErrors.recent?.length === 0 && (
                  <p>{t('adminMetricsPage.emptyValue')}</p>
                )}
                {(frontendErrors.recent || []).slice(0, 12).map((entry, idx) => (
                  <div
                    key={`${entry.requestId || 'fe'}-${idx}`}
                    className="rounded-lg border border-rose-500/30 bg-rose-500/15 px-3 py-2"
                  >
                    <p className="font-semibold text-rose-700 dark:text-rose-300">
                      {entry.name || 'Error'}: {entry.message || 'Unknown'}
                    </p>
                    <p className="truncate">
                      {entry.path || '/'}
                    </p>
                    <p className="text-xs text-rose-600 dark:text-rose-300/90">
                      {entry.timestamp}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}



