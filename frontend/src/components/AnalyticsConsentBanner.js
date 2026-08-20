import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  getAnalyticsConsent,
  loadAnalytics,
  setAnalyticsConsent,
} from '../utils/analytics';

export default function AnalyticsConsentBanner({
  trackingId,
  consent,
  onConsentChange,
}) {
  const { t } = useTranslation();
  const shouldShow = useMemo(() => {
    if (consent) return false;
    return getAnalyticsConsent() === null;
  }, [consent]);

  if (!shouldShow) return null;

  const handleAccept = () => {
    setAnalyticsConsent('granted');
    loadAnalytics(trackingId);
    onConsentChange?.('granted');
  };

  const handleDecline = () => {
    setAnalyticsConsent('denied');
    onConsentChange?.('denied');
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/80 bg-surface-card/95 px-4 py-3 shadow-2xl backdrop-blur sm:px-6 sm:py-4"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
      role="region"
      aria-labelledby="analytics-consent-title"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="text-xs leading-relaxed text-text-secondary sm:text-sm">
          <p id="analytics-consent-title" className="font-semibold text-text-primary">
            {t('analyticsConsent.title')}
          </p>
          <p className="mt-0.5">
            {t('analyticsConsent.description')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex md:shrink-0 md:items-center">
          <button
            type="button"
            onClick={handleDecline}
            className="app-btn-soft min-h-11 rounded-full px-4 py-2 text-sm"
          >
            {t('analyticsConsent.decline')}
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="app-btn-primary min-h-11 rounded-full px-4 py-2 text-sm"
          >
            {t('analyticsConsent.accept')}
          </button>
        </div>
      </div>
    </div>
  );
}


