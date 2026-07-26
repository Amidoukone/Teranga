// Chargeur du SDK Google Maps (docs/DEV_SPEC_TERANGA_v3.md section 4.3).
// Pas de dépendance npm (@googlemaps/js-api-loader) : CRA n'est pas éjecté
// (décision 4.4), et une injection de <script> manuelle suffit pour ce
// besoin ponctuel (Autocomplete + carte), sans alourdir le bundle.
//
// Sans clé configurée (REACT_APP_GOOGLE_MAPS_BROWSER_KEY absente), la
// promesse se résout à `null` plutôt que d'échouer bruyamment : les
// composants qui en dépendent (LocationAutocompleteInput) retombent sur un
// simple champ texte (mode data-light / dégradation gracieuse, section 4.4).

const SCRIPT_ID = 'google-maps-sdk';

let loaderPromise = null;

export function loadGoogleMaps() {
  if (loaderPromise) return loaderPromise;

  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_BROWSER_KEY;

  if (!apiKey) {
    loaderPromise = Promise.resolve(null);
    return loaderPromise;
  }

  if (window.google?.maps?.places) {
    loaderPromise = Promise.resolve(window.google.maps);
    return loaderPromise;
  }

  loaderPromise = new Promise((resolve) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google?.maps || null));
      existing.addEventListener('error', () => resolve(null));
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google?.maps || null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });

  return loaderPromise;
}
