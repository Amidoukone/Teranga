const CONSENT_KEY = 'teranga_analytics_consent';

export function getAnalyticsConsent() {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(CONSENT_KEY);
  return value === 'granted' || value === 'denied' ? value : null;
}

export function setAnalyticsConsent(value) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CONSENT_KEY, value);
}

export function loadAnalytics(trackingId) {
  if (!trackingId || typeof window === 'undefined') return;
  if (window.__TERANGA_GTAG_LOADED) return;

  window.__TERANGA_GTAG_LOADED = true;
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${trackingId}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = window.gtag || gtag;
  window.gtag('js', new Date());
  window.gtag('config', trackingId);
}
