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
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur px-6 py-4 shadow-xl">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-gray-700">
          <p className="font-semibold text-gray-900">
            {t('analyticsConsent.title')}
          </p>
          <p>
            {t('analyticsConsent.description')}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleDecline}
            className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
          >
            {t('analyticsConsent.decline')}
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            {t('analyticsConsent.accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
