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
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/80 bg-surface-card/95 px-4 py-4 shadow-2xl backdrop-blur sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-text-secondary">
          <p className="font-semibold text-text-primary">
            {t('analyticsConsent.title')}
          </p>
          <p>
            {t('analyticsConsent.description')}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handleDecline}
            className="app-btn-soft rounded-full px-4 py-2"
          >
            {t('analyticsConsent.decline')}
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="app-btn-primary rounded-full px-4 py-2"
          >
            {t('analyticsConsent.accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
