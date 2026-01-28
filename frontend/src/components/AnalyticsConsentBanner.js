import { useMemo } from 'react';

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
            Votre confidentialité compte
          </p>
          <p>
            Nous utilisons des cookies d’analytics pour mesurer l’audience et
            améliorer l’expérience Teranga. Vous pouvez accepter ou refuser.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleDecline}
            className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
          >
            Refuser
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            Accepter
          </button>
        </div>
      </div>
    </div>
  );
}
