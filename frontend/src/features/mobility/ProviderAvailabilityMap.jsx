import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { loadGoogleMaps } from "../mission-creation/googleMapsLoader";

function hasPoint(value) {
  return Number.isFinite(Number(value?.latitude)) && Number.isFinite(Number(value?.longitude));
}

export default function ProviderAvailabilityMap({ providers = [] }) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const [available, setAvailable] = useState(null);
  const mappedProviders = providers.filter((provider) => hasPoint(provider.dispatchPresence?.liveLocation));

  useEffect(() => {
    let cancelled = false;
    const markers = [];
    let map = null;

    loadGoogleMaps().then((maps) => {
      if (cancelled || !maps || !containerRef.current) {
        if (!cancelled) setAvailable(false);
        return;
      }
      setAvailable(true);
      const first = mappedProviders[0]?.dispatchPresence?.liveLocation;
      map = new maps.Map(containerRef.current, {
        center: { lat: Number(first?.latitude) || 12.6392, lng: Number(first?.longitude) || -8.0029 },
        zoom: 12,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      });
      const bounds = new maps.LatLngBounds();
      mappedProviders.forEach((provider, index) => {
        const location = provider.dispatchPresence.liveLocation;
        const position = { lat: Number(location.latitude), lng: Number(location.longitude) };
        bounds.extend(position);
        markers.push(new maps.Marker({
          map,
          position,
          label: { text: String(index + 1), color: "#ffffff", fontWeight: "700" },
          title: provider.displayFirstName || t("adminProvidersPage.table.emptyValue"),
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 13,
            fillColor: provider.availabilityStatus === "available" ? "#059669" : "#d97706",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
        }));
      });
      if (mappedProviders.length > 1) map.fitBounds(bounds, 50);
    });

    return () => {
      cancelled = true;
      markers.forEach((marker) => marker.setMap(null));
      if (map && window.google?.maps?.event) window.google.maps.event.clearInstanceListeners(map);
    };
  }, [mappedProviders, t]);

  if (!mappedProviders.length) {
    return <p className="rounded-xl border border-border bg-surface-main/60 p-4 text-sm text-text-muted">{t("adminProvidersPage.availability.mapEmpty")}</p>;
  }
  if (available === false) {
    return <p className="rounded-xl border border-border bg-surface-main/60 p-4 text-sm text-text-muted">{t("mobilityDispatch.map.unavailable")}</p>;
  }
  return (
    <div className="relative mt-3 overflow-hidden rounded-2xl border border-border bg-surface-main">
      <div ref={containerRef} className="h-72 w-full" />
      {available === null ? <div className="absolute inset-0 flex items-center justify-center bg-surface-main text-sm text-text-muted">{t("mobilityDispatch.loading")}</div> : null}
    </div>
  );
}
