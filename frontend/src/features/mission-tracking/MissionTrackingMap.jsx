import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { loadGoogleMaps } from "../mission-creation/googleMapsLoader";

const DEFAULT_ZOOM = 15;

/**
 * Carte en lecture seule pour le suivi en direct (docs/DEV_SPEC_TERANGA_v3.md section 4.2) :
 * un marqueur qui se repositionne au fil du polling, sans interaction (pas de drag, pas de clic
 * — contrairement à `mission-creation/MissionLocationMap.jsx` qui sert à la dépose d'épingle).
 * Dégradation gracieuse si le SDK Google Maps n'est pas chargé (section 4.4).
 */
export default function MissionTrackingMap({ latitude, longitude, destinationLatitude, destinationLongitude }) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const destinationMarkerRef = useRef(null);
  const [mapsAvailable, setMapsAvailable] = useState(null);

  const hasPosition = Number.isFinite(latitude) && Number.isFinite(longitude);
  const hasDestination = Number.isFinite(destinationLatitude) && Number.isFinite(destinationLongitude);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps().then((maps) => {
      if (cancelled) return;
      if (!maps || !containerRef.current) {
        setMapsAvailable(false);
        return;
      }
      setMapsAvailable(true);

      const center = hasPosition
        ? { lat: latitude, lng: longitude }
        : hasDestination
        ? { lat: destinationLatitude, lng: destinationLongitude }
        : { lat: 12.6392, lng: -8.0029 };

      mapRef.current = new maps.Map(containerRef.current, {
        center,
        zoom: DEFAULT_ZOOM,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      });

      if (hasDestination) {
        destinationMarkerRef.current = new maps.Marker({
          position: { lat: destinationLatitude, lng: destinationLongitude },
          map: mapRef.current,
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: "#2563eb",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });
      }

      if (hasPosition) {
        markerRef.current = new maps.Marker({
          position: { lat: latitude, lng: longitude },
          map: mapRef.current,
        });
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Repositionne le marqueur de l'exécutant au fil du polling, sans recréer la carte.
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps || !hasPosition) return;

    const position = { lat: latitude, lng: longitude };
    if (markerRef.current) {
      markerRef.current.setPosition(position);
    } else {
      markerRef.current = new window.google.maps.Marker({ position, map: mapRef.current });
    }
    mapRef.current.panTo(position);
  }, [latitude, longitude, hasPosition]);

  if (mapsAvailable === false) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-border bg-surface-main px-4 text-center text-sm text-text-muted">
        {t("missionTracking.mapUnavailable")}
      </div>
    );
  }

  return <div ref={containerRef} className="h-64 w-full overflow-hidden rounded-2xl border border-border sm:h-80" />;
}
